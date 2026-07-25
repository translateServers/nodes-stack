import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { DatasetCacheService } from '@/modules/dataset/dataset-cache.service';
import { DatasetFilterService } from '@/modules/dataset/dataset-filter.service';
import { DatasetMockService } from '@/modules/dataset/dataset-mock.service';
import { DatasetReferenceService } from '@/modules/dataset/dataset-reference.service';
import { StaticExecutor } from '@/modules/dataset/executors/static.executor';
import { ApiExecutor } from '@/modules/dataset/executors/api.executor';
import { UnsupportedExecutor } from '@/modules/dataset/executors/unsupported.executor';
import type { DatasetExecutor } from '@/modules/dataset/executors/executor.interface';
import type {
  DatasetType,
  DatasetConfig,
  DatasetMockConfig,
  DatasetCacheStrategy,
  DatasetShape,
} from '@nebula/shared/schemas';
import type {
  CreateDatasetDto,
  UpdateDatasetDto,
  ExecuteDatasetDto,
  BatchExecuteDatasetDto,
  ListDatasetQueryDto,
  DatasetResponse,
  DatasetExecuteResultResponse,
  TestDatasetResultResponse,
  DatasetReferenceCountResponse,
  BatchDatasetExecuteItemResponse,
  BatchExecuteDatasetResultResponse,
} from '@/modules/dataset/dto/dataset.dto';
import { DatasetResponseSchema } from '@/modules/dataset/dto/dataset.dto';

/**
 * 持久化实体类型：与 Prisma Dataset 模型对应
 */
interface DatasetEntity {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  type: string;
  category: string | null;
  tags: string | null;
  config: string;
  shape: string | null;
  refresh: string | null;
  cache: string | null;
  mock: string | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DatasetWithProject extends DatasetEntity {
  project: { id: string; status: string };
}

/**
 * 数据集服务
 *
 * 设计依据：
 * - `docs/specs/dataset-management/architecture.md` §5（数据流设计）
 * - `docs/specs/dataset-management/security-decisions.md` §7.5（匿名执行防护）
 *
 * 执行流程（architecture §5.1）：
 * 1. 查 Dataset 实体 + 关联 Project
 * 2. 匿名执行校验（仅已发布项目，useMock=false 时）
 * 3. Mock 检查（useMock=true 或 mock.enabled）
 * 4. 缓存命中检查（仅 useMock=false 时）
 * 5. 按 type 选 Executor 执行
 * 6. filter 表达式求值（JSONata）
 * 7. dataPath 提取
 * 8. 返回 { status, raw, parsed, meta }
 */
@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: DatasetCacheService,
    private filterService: DatasetFilterService,
    private mockService: DatasetMockService,
    private referenceService: DatasetReferenceService,
    private staticExecutor: StaticExecutor,
    private apiExecutor: ApiExecutor,
    private unsupportedExecutor: UnsupportedExecutor,
  ) {}

  // ===== CRUD =====

  async create(dto: CreateDatasetDto, userId: string): Promise<DatasetResponse> {
    // projectId 可选：未传时回退到数据库第一个项目作为默认项目
    // （前端 UI 暂无项目上下文，提供默认项目保证创建可用）
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
      // 校验指定项目存在
      const project = await this.prisma.screenProject.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) {
        throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
      }
    }

    // 名称唯一校验（项目内）
    const existing = await this.prisma.dataset.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new BusinessException(BizCode.DATASET_NAME_EXISTS);
    }

    const created = await this.prisma.dataset.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        category: dto.category ?? null,
        tags: dto.tags ? JSON.stringify(dto.tags) : null,
        config: JSON.stringify(dto.config),
        shape: dto.shape ? JSON.stringify(dto.shape) : null,
        refresh: dto.refresh ? JSON.stringify(dto.refresh) : null,
        cache: dto.cache ? JSON.stringify(dto.cache) : null,
        mock: dto.mock ? JSON.stringify(dto.mock) : null,
        status: 'active',
        createdBy: userId,
      },
    });

    return this.toResponse(created);
  }

  async findAll(query: ListDatasetQueryDto): Promise<DatasetResponse[]> {
    // projectId 可选：未传时返回所有项目的数据集
    const where: Record<string, unknown> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const datasets = await this.prisma.dataset.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return datasets.map((d) => this.toResponse(d));
  }

  async findOne(id: string): Promise<DatasetResponse> {
    const dataset = await this.findEntityById(id);
    return this.toResponse(dataset);
  }

  async update(id: string, dto: UpdateDatasetDto): Promise<DatasetResponse> {
    const existing = await this.findEntityById(id);

    // 名称唯一校验（项目内，排除自身）
    if (dto.name !== undefined && dto.name !== existing.name) {
      const duplicate = await this.prisma.dataset.findFirst({
        where: {
          projectId: existing.projectId,
          name: dto.name,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BusinessException(BizCode.DATASET_NAME_EXISTS);
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.category !== undefined) data.category = dto.category ?? null;
    if (dto.tags !== undefined) data.tags = dto.tags ? JSON.stringify(dto.tags) : null;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    if (dto.shape !== undefined) data.shape = dto.shape ? JSON.stringify(dto.shape) : null;
    if (dto.refresh !== undefined) data.refresh = dto.refresh ? JSON.stringify(dto.refresh) : null;
    if (dto.cache !== undefined) data.cache = dto.cache ? JSON.stringify(dto.cache) : null;
    if (dto.mock !== undefined) data.mock = dto.mock ? JSON.stringify(dto.mock) : null;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.dataset.update({
      where: { id },
      data,
    });

    // 数据集更新时清除该 id 的所有缓存
    this.cacheService.invalidateDataset(id);

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findEntityById(id);
    // 删除前校验引用（存在引用时需用户确认，此处直接拒绝）
    await this.referenceService.checkReferencesBeforeDelete(id);
    await this.prisma.dataset.delete({ where: { id } });
    this.cacheService.invalidateDataset(id);
  }

  // ===== 引用数 =====

  async getReferenceCount(id: string): Promise<DatasetReferenceCountResponse> {
    await this.findEntityById(id);
    const count = await this.referenceService.countReferences(id);
    return { datasetId: id, count };
  }

  // ===== 执行 =====

  /**
   * 正式执行数据集
   *
   * @param id 数据集 ID
   * @param dto 执行参数
   * @param isAnonymous 是否匿名访问（@Public 端点），匿名时仅允许执行已发布项目的数据集
   */
  async execute(
    id: string,
    dto: ExecuteDatasetDto,
    isAnonymous: boolean,
  ): Promise<DatasetExecuteResultResponse> {
    const start = Date.now();
    const dataset = await this.findEntityWithProject(id);
    const config = this.parseConfig(dataset);
    const shape = this.parseJsonField<DatasetShape>(dataset.shape);
    const cacheStrategy = this.parseJsonField<DatasetCacheStrategy>(dataset.cache);
    const mockConfig = this.parseJsonField<DatasetMockConfig>(dataset.mock);

    // useMock=true 覆盖 mock.enabled（security-decisions §5.4）
    const useMock = dto.useMock || (mockConfig?.enabled ?? false);

    // 匿名访问 + 非 Mock 模式：仅允许执行已发布项目的数据集（security-decisions §7.5）
    if (isAnonymous && !useMock && dataset.project.status !== 'published') {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }

    // Mock 模式：返回 Mock 数据
    if (useMock && mockConfig) {
      const mockData = this.mockService.generate(mockConfig, dto.params);
      const filtered = shape?.filter
        ? await this.filterService.applyFilter(shape.filter, mockData)
        : mockData;
      const parsed = this.extractDataPath(filtered, shape?.dataPath);
      return {
        status: 'success',
        raw: mockData,
        parsed,
        meta: { fromCache: false, durationMs: Date.now() - start },
      };
    }

    // 缓存命中检查（仅非 Mock 模式）
    if (cacheStrategy?.enabled) {
      const cached = this.cacheService.get<unknown>(id, dto.params);
      if (cached !== undefined) {
        return {
          status: 'success',
          raw: cached,
          parsed: cached,
          meta: { fromCache: true, durationMs: Date.now() - start },
        };
      }
    }

    // 执行
    const executor = this.getExecutor(dataset.type as DatasetType);
    const raw = await executor.execute(config, dto.params);

    // filter 求值
    const filtered = shape?.filter ? await this.filterService.applyFilter(shape.filter, raw) : raw;

    // dataPath 提取
    const parsed = this.extractDataPath(filtered, shape?.dataPath);

    // 写入缓存
    if (cacheStrategy?.enabled) {
      this.cacheService.set(id, dto.params, raw, {
        ttl: cacheStrategy.ttl,
        tags: cacheStrategy.tags,
      });
    }

    return {
      status: 'success',
      raw,
      parsed,
      meta: { fromCache: false, durationMs: Date.now() - start },
    };
  }

  /**
   * 测试执行（不缓存，返回原始 + 解析后结果 + 元信息）
   *
   * 需 JWT 鉴权（非 @Public），不校验项目发布状态。
   */
  async test(id: string, dto: ExecuteDatasetDto): Promise<TestDatasetResultResponse> {
    const dataset = await this.findEntityWithProject(id);
    const config = this.parseConfig(dataset);
    const shape = this.parseJsonField<DatasetShape>(dataset.shape);
    const mockConfig = this.parseJsonField<DatasetMockConfig>(dataset.mock);

    const useMock = dto.useMock || (mockConfig?.enabled ?? false);

    // Mock 模式
    if (useMock && mockConfig) {
      const start = Date.now();
      const mockData = this.mockService.generate(mockConfig, dto.params);
      const filtered = shape?.filter
        ? await this.filterService.applyFilter(shape.filter, mockData)
        : mockData;
      const parsed = this.extractDataPath(filtered, shape?.dataPath);
      return {
        status: 'success',
        raw: mockData,
        parsed,
        meta: { fromCache: false, durationMs: Date.now() - start },
      };
    }

    // 执行器测试
    const executor = this.getExecutor(dataset.type as DatasetType);
    const testResult = await executor.test(config, dto.params);

    // filter + dataPath
    const filtered = shape?.filter
      ? await this.filterService.applyFilter(shape.filter, testResult.raw)
      : testResult.raw;
    const parsed = this.extractDataPath(filtered, shape?.dataPath);

    return {
      status: 'success',
      raw: testResult.raw,
      parsed,
      meta: { fromCache: false, durationMs: testResult.meta.durationMs },
    };
  }

  /**
   * 批量执行数据集
   *
   * 登录用户调用（非 @Public），单个数据集失败时将其结果标记为 fail，
   * 不影响其他数据集的执行。
   *
   * @param dto 批量执行参数（ids + params + useMock）
   * @returns 每个数据集的执行结果列表（与 ids 顺序一致）
   */
  async batchExecute(dto: BatchExecuteDatasetDto): Promise<BatchExecuteDatasetResultResponse> {
    const results: BatchDatasetExecuteItemResponse[] = [];
    for (const datasetId of dto.ids) {
      try {
        const result = await this.execute(datasetId, dto, false);
        results.push({ datasetId, result });
      } catch (error) {
        // 单个数据集失败时记录 fail，不影响其他
        const message = error instanceof Error ? error.message : '执行失败';
        this.logger.warn(`批量执行: 数据集 ${datasetId} 执行失败 - ${message}`);
        results.push({
          datasetId,
          result: {
            status: 'fail',
            raw: null,
            parsed: null,
            meta: { fromCache: false, durationMs: 0 },
          },
        });
      }
    }
    return results;
  }

  // ===== 私有方法 =====

  private async findEntityById(id: string): Promise<DatasetEntity> {
    const dataset = await this.prisma.dataset.findUnique({ where: { id } });
    if (!dataset) {
      throw new BusinessException(BizCode.DATASET_NOT_FOUND);
    }
    return dataset;
  }

  private async findEntityWithProject(id: string): Promise<DatasetWithProject> {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id },
      include: { project: { select: { id: true, status: true } } },
    });
    if (!dataset) {
      throw new BusinessException(BizCode.DATASET_NOT_FOUND);
    }
    return dataset;
  }

  /**
   * 按 type 选择 Executor
   */
  private getExecutor(type: DatasetType): DatasetExecutor<unknown> {
    switch (type) {
      case 'static':
        return this.staticExecutor;
      case 'api':
        return this.apiExecutor;
      case 'sql':
      case 'websocket':
        return this.unsupportedExecutor;
      default: {
        // satisfies never 保证 switch 分支穷尽性：新增 type 时编译报错
        const exhaustive: never = type;
        throw new BusinessException(BizCode.DATASET_TYPE_NOT_SUPPORTED, undefined, [
          `未知的数据集类型: ${String(exhaustive)}`,
        ]);
      }
    }
  }

  /**
   * 解析 config JSON 字符串为 DatasetConfig
   */
  private parseConfig(entity: DatasetEntity): DatasetConfig {
    const parsed: unknown = JSON.parse(entity.config);
    // DatasetConfig 是判别联合（含 type 字段），构造完整对象后解析
    const configWithType = { type: entity.type, ...(parsed as object) };
    // 这里不做 Zod parse（executor 内部会校验），直接返回结构化对象
    return configWithType as DatasetConfig;
  }

  /**
   * 解析 JSON 字符串字段（shape / refresh / cache / mock）
   */
  private parseJsonField<T>(value: string | null): T | undefined {
    if (!value) return undefined;
    return JSON.parse(value) as T;
  }

  /**
   * dataPath 提取：按点分隔路径从嵌套对象中提取目标数据
   *
   * 如 dataPath = "data.list"，从 { data: { list: [1,2,3] } } 中提取 [1,2,3]
   */
  private extractDataPath(data: unknown, dataPath?: string): unknown {
    if (!dataPath) return data;
    let current: unknown = data;
    for (const key of dataPath.split('.')) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return current;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  /**
   * Prisma 实体 → API 响应
   *
   * 时间戳格式化为 "YYYY-MM-DD HH:mm:ss" 字符串以匹配 shared DateTimeStringSchema。
   */
  private toResponse(entity: DatasetEntity): DatasetResponse {
    const config: unknown = JSON.parse(entity.config);
    const tags: unknown = entity.tags ? JSON.parse(entity.tags) : undefined;
    const shape: unknown = entity.shape ? JSON.parse(entity.shape) : undefined;
    const refresh: unknown = entity.refresh ? JSON.parse(entity.refresh) : undefined;
    const cache: unknown = entity.cache ? JSON.parse(entity.cache) : undefined;
    const mock: unknown = entity.mock ? JSON.parse(entity.mock) : undefined;

    const response = {
      id: entity.id,
      projectId: entity.projectId,
      name: entity.name,
      description: entity.description ?? undefined,
      type: entity.type,
      category: entity.category ?? undefined,
      tags: tags as string[] | undefined,
      config,
      shape: shape as DatasetShape | undefined,
      refresh: refresh as never,
      cache: cache as DatasetCacheStrategy | undefined,
      mock: mock as DatasetMockConfig | undefined,
      status: entity.status,
      createdBy: entity.createdBy,
      createdAt: dayjs(entity.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs(entity.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
    };

    return DatasetResponseSchema.parse(response);
  }
}
