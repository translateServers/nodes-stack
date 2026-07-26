import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type {
  CreateDataSourceConnectionDto,
  UpdateDataSourceConnectionDto,
  ListDataSourceConnectionQueryDto,
  DataSourceConnectionResponse,
  TestConnectionResultResponse,
} from '@/modules/datasource-connection/dto/datasource-connection.dto';
import { DataSourceConnectionResponseSchema } from '@/modules/datasource-connection/dto/datasource-connection.dto';
import type {
  DataSourceConnection,
  DataSourceConnectionType,
  DatabaseConnectionConfig,
  HttpApiConnectionConfig,
} from '@nebula/shared/schemas';

/**
 * 数据源连接配置 union（DatabaseConnectionConfig | HttpApiConnectionConfig）
 *
 * shared schema 未导出统一的 `DataSourceConnectionConfig` 类型名（仅分别导出
 * DatabaseConnectionConfig 和 HttpApiConnectionConfig）。这里从 DataSourceConnection
 * 判别联合的 `config` 字段推导出等价 union，避免在 service 中重复维护类型。
 */
type DataSourceConnectionConfig = DataSourceConnection['config'];

/**
 * 持久化实体类型：与 Prisma DataSourceConnection 模型对应
 */
interface DataSourceConnectionEntity {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  type: string;
  config: string;
  status: string;
  lastTestedAt: Date | null;
  lastTestResult: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 脱敏占位值（响应中替换 password / authConfig） */
const MASKED_SECRET = '***';

/**
 * 数据源连接服务
 *
 * 设计依据：`docs/specs/dataset-management/data-model.md` §2
 *
 * 安全约定：
 * - 凭证隔离：password / authConfig 字段独立加密存储
 *   - 第一阶段以明文存储（数据库本机 SQLite，开发期），生产环境需切换到加密存储
 *   - 响应中统一脱敏为 `'***'`，不回显明文
 * - 更新时 password / authConfig 留空表示不修改（由本 service 处理合并）
 * - 测试连接：仅记录 success/fail 到 lastTestResult，不记录错误详情（防信息泄露）
 */
@Injectable()
export class DataSourceConnectionService {
  private readonly logger = new Logger(DataSourceConnectionService.name);

  constructor(private prisma: PrismaService) {}

  // ===== CRUD =====

  async create(
    dto: CreateDataSourceConnectionDto,
    userId: string,
  ): Promise<DataSourceConnectionResponse> {
    // projectId 可选：未传时回退到默认项目（与 dataset 模块保持一致）
    let projectId = dto.projectId;
    if (!projectId) {
      const firstProject = await this.prisma.screenProject.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!firstProject) {
        throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
      }
      projectId = firstProject.id;
    } else {
      const project = await this.prisma.screenProject.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) {
        throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
      }
    }

    // 名称唯一校验（项目内）
    const existing = await this.prisma.dataSourceConnection.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new BusinessException(BizCode.CONNECTION_NAME_EXISTS);
    }

    const created = await this.prisma.dataSourceConnection.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        config: JSON.stringify(dto.config),
        status: 'active',
        createdBy: userId,
      },
    });

    return this.toResponse(created);
  }

  async findAll(query: ListDataSourceConnectionQueryDto): Promise<DataSourceConnectionResponse[]> {
    const where: Record<string, unknown> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const connections = await this.prisma.dataSourceConnection.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return connections.map((c) => this.toResponse(c));
  }

  async findOne(id: string): Promise<DataSourceConnectionResponse> {
    const connection = await this.findEntityById(id);
    return this.toResponse(connection);
  }

  async update(
    id: string,
    dto: UpdateDataSourceConnectionDto,
  ): Promise<DataSourceConnectionResponse> {
    const existing = await this.findEntityById(id);

    // 名称唯一校验（项目内，排除自身）
    if (dto.name !== undefined && dto.name !== existing.name) {
      const duplicate = await this.prisma.dataSourceConnection.findFirst({
        where: {
          projectId: existing.projectId,
          name: dto.name,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BusinessException(BizCode.CONNECTION_NAME_EXISTS);
      }
    }

    // 合并 config：保留现有 password/authConfig（如果 dto.config 中未提供）
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.config !== undefined) {
      const currentConfig = this.parseConfig(existing);
      const merged = this.mergeConfig(currentConfig, dto.config, existing.type);
      data.config = JSON.stringify(merged);
    }

    const updated = await this.prisma.dataSourceConnection.update({
      where: { id },
      data,
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findEntityById(id);
    await this.prisma.dataSourceConnection.delete({ where: { id } });
  }

  // ===== 测试连接 =====

  /**
   * 测试数据源连接
   *
   * 实现：第一阶段的简单 ping 探测
   * - mysql / postgres：尝试建立 TCP 连接到 host:port（不实际登录，避免凭证泄露到日志）
   * - http-api：尝试 HEAD 请求 baseUrl，2xx/3xx 视为成功
   *
   * 测试结果记录到 lastTestedAt / lastTestResult，不记录错误详情。
   */
  async test(id: string): Promise<TestConnectionResultResponse> {
    const entity = await this.findEntityById(id);
    const config = this.parseConfig(entity);
    const start = Date.now();

    try {
      const success = await this.performTest(entity.type as DataSourceConnectionType, config);
      const latencyMs = Date.now() - start;

      // 更新测试状态
      await this.prisma.dataSourceConnection.update({
        where: { id },
        data: {
          lastTestedAt: new Date(),
          lastTestResult: success ? 'success' : 'fail',
        },
      });

      if (success) {
        return { success: true, latencyMs };
      }
      return {
        success: false,
        errorMessage: '连接测试失败（详见服务端日志）',
      };
    } catch (error) {
      this.logger.warn(
        `连接 ${id} 测试异常: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      await this.prisma.dataSourceConnection.update({
        where: { id },
        data: {
          lastTestedAt: new Date(),
          lastTestResult: 'fail',
        },
      });
      return {
        success: false,
        errorMessage: '连接测试异常',
      };
    }
  }

  // ===== 私有方法 =====

  private async findEntityById(id: string): Promise<DataSourceConnectionEntity> {
    const connection = await this.prisma.dataSourceConnection.findUnique({ where: { id } });
    if (!connection) {
      throw new BusinessException(BizCode.CONNECTION_NOT_FOUND);
    }
    return connection;
  }

  /**
   * 实际执行连接测试
   *
   * 第一阶段简化实现：
   * - mysql / postgres：用 net.Socket 试连 host:port，能建立连接即视为成功
   * - http-api：fetch HEAD baseUrl，timeout 5s，2xx/3xx 视为成功
   *
   * 后续阶段可扩展为：
   * - mysql/postgres：实际登录验证凭证
   * - http-api：根据 authType 配置发起鉴权测试请求
   */
  private async performTest(
    type: DataSourceConnectionType,
    config: DataSourceConnectionConfig,
  ): Promise<boolean> {
    switch (type) {
      case 'mysql':
      case 'postgres': {
        const dbConfig = config as DatabaseConnectionConfig;
        return this.testTcpConnection(dbConfig.host, dbConfig.port);
      }
      case 'http-api': {
        const httpConfig = config as HttpApiConnectionConfig;
        return this.testHttpConnection(httpConfig.baseUrl);
      }
      default: {
        const exhaustive: never = type;
        this.logger.warn(`未知连接类型: ${String(exhaustive)}`);
        return false;
      }
    }
  }

  /**
   * TCP 连接测试：用 net.Socket 试连 host:port
   */
  private async testTcpConnection(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      // 动态导入避免影响不使用 net 的环境
      import('net')
        .then(({ Socket }) => {
          const socket = new Socket();
          const timeoutMs = 5000;

          socket.setTimeout(timeoutMs);
          socket.once('connect', () => {
            socket.destroy();
            resolve(true);
          });
          socket.once('error', () => {
            socket.destroy();
            resolve(false);
          });
          socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
          });
          socket.connect(port, host);
        })
        .catch(() => resolve(false));
    });
  }

  /**
   * HTTP 连接测试：HEAD 请求 baseUrl
   */
  private async testHttpConnection(baseUrl: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      return response.status >= 200 && response.status < 400;
    } catch {
      // HEAD 不支持时降级为 GET
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(baseUrl, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timeout);
        return response.status >= 200 && response.status < 400;
      } catch {
        return false;
      }
    }
  }

  /**
   * 解析 config JSON 字符串
   *
   * 注意：使用 `as unknown as` 二次断言，因为 `{ type, ...parsed }` 是运行时构造的对象，
   * TS 无法从 `Record<string, unknown>` 自动推断为 `DataSourceConnectionConfig` union。
   * ZodValidationPipe 在 controller 层已对 dto.config 做过 schema 校验，
   * 此处只是从数据库字符串字段反序列化，运行时结构由写入时保证。
   */
  private parseConfig(entity: DataSourceConnectionEntity): DataSourceConnectionConfig {
    const parsed: unknown = JSON.parse(entity.config);
    const configWithType = { type: entity.type, ...(parsed as object) };
    return configWithType as unknown as DataSourceConnectionConfig;
  }

  /**
   * 合并 config：保留现有 password/authConfig（如果 dto.config 中未提供）
   *
   * 约定：更新时 password/authConfig 留空（undefined）表示不修改。
   */
  private mergeConfig(
    current: DataSourceConnectionConfig,
    update: Partial<DataSourceConnectionConfig>,
    type: string,
  ): DataSourceConnectionConfig {
    if (type === 'mysql' || type === 'postgres') {
      const cur = current as DatabaseConnectionConfig;
      const upd = update as Partial<DatabaseConnectionConfig>;
      return {
        host: upd.host ?? cur.host,
        port: upd.port ?? cur.port,
        database: upd.database ?? cur.database,
        username: upd.username ?? cur.username,
        // password 留空表示不修改
        password: upd.password !== undefined && upd.password !== '' ? upd.password : cur.password,
        ...(upd.ssl !== undefined ? { ssl: upd.ssl } : {}),
        ...(cur.ssl !== undefined && upd.ssl === undefined ? { ssl: cur.ssl } : {}),
      };
    }
    if (type === 'http-api') {
      const cur = current as HttpApiConnectionConfig;
      const upd = update as Partial<HttpApiConnectionConfig>;
      const merged: HttpApiConnectionConfig = {
        baseUrl: upd.baseUrl ?? cur.baseUrl,
        ...(upd.defaultHeaders !== undefined ? { defaultHeaders: upd.defaultHeaders } : {}),
        ...(cur.defaultHeaders !== undefined && upd.defaultHeaders === undefined
          ? { defaultHeaders: cur.defaultHeaders }
          : {}),
        ...(upd.authType !== undefined ? { authType: upd.authType } : {}),
        ...(cur.authType !== undefined && upd.authType === undefined
          ? { authType: cur.authType }
          : {}),
        // authConfig 留空表示不修改
        authConfig:
          upd.authConfig !== undefined && upd.authConfig !== '' ? upd.authConfig : cur.authConfig,
      };
      return merged;
    }
    // 未知类型 fallback：直接返回 update
    return { ...current, ...update };
  }

  /**
   * Prisma 实体 → API 响应
   *
   * - password / authConfig 字段脱敏为 `'***'`
   * - 时间戳格式化为 "YYYY-MM-DD HH:mm:ss" 字符串
   */
  private toResponse(entity: DataSourceConnectionEntity): DataSourceConnectionResponse {
    const config: unknown = JSON.parse(entity.config);
    const maskedConfig = this.maskSecrets(config, entity.type);

    const response = {
      id: entity.id,
      projectId: entity.projectId,
      name: entity.name,
      description: entity.description ?? undefined,
      type: entity.type,
      config: maskedConfig,
      status: entity.status,
      lastTestedAt: entity.lastTestedAt
        ? dayjs(entity.lastTestedAt).format('YYYY-MM-DD HH:mm:ss')
        : null,
      lastTestResult: entity.lastTestResult as 'success' | 'fail' | null,
      createdBy: entity.createdBy,
      createdAt: dayjs(entity.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs(entity.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
    };

    return DataSourceConnectionResponseSchema.parse(response);
  }

  /**
   * 脱敏 config 中的 password / authConfig 字段
   */
  private maskSecrets(config: unknown, type: string): unknown {
    if (!config || typeof config !== 'object') return config;
    const cfg = config as Record<string, unknown>;
    if (type === 'mysql' || type === 'postgres') {
      return { ...cfg, password: MASKED_SECRET };
    }
    if (type === 'http-api') {
      if (cfg.authConfig !== undefined) {
        return { ...cfg, authConfig: MASKED_SECRET };
      }
      return cfg;
    }
    return cfg;
  }
}
