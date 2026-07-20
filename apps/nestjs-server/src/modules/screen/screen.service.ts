import { Injectable } from '@nestjs/common';
import { isSensitiveHeaderKey } from '@nebula/shared';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type {
  CreateScreenProjectDto,
  UpdateScreenProjectDto,
  PublishScreenProjectDto,
  ScreenProjectResponse,
} from '@/modules/screen/dto/screen.dto';
import { ScreenProjectResponseSchema } from '@/modules/screen/dto/screen.dto';

@Injectable()
export class ScreenService {
  constructor(private prisma: PrismaService) {}

  async createProject(dto: CreateScreenProjectDto): Promise<ScreenProjectResponse> {
    const existing = await this.prisma.screenProject.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BusinessException(BizCode.SCREEN_NAME_EXISTS);
    }

    const defaultCanvas = {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    };

    // 截断到秒精度，与 DateTimeStringSchema 的 "YYYY-MM-DD HH:mm:ss" 格式一致，
    // 避免毫秒精度丢失导致后续乐观锁比较（updateMany where updatedAt）失败。
    const now = this.truncateToSeconds(new Date());
    const created = await this.prisma.screenProject.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        canvas: JSON.stringify(dto.canvas ?? defaultCanvas),
        components: '[]',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
    });

    return this.toProjectResponse(created);
  }

  async findAllProjects(): Promise<ScreenProjectResponse[]> {
    const projects = await this.prisma.screenProject.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return projects.map((p) => this.toProjectResponse(p));
  }

  async findProjectById(id: string): Promise<ScreenProjectResponse> {
    const project = await this.prisma.screenProject.findUnique({
      where: { id },
    });
    if (!project) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    return this.toProjectResponse(project);
  }

  async findPublishedProjectById(id: string): Promise<ScreenProjectResponse> {
    const project = await this.prisma.screenProject.findFirst({
      where: { id, status: 'published' },
    });
    if (!project) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    const response = this.toProjectResponse(project);
    return this.sanitizeSensitiveHeaders(response);
  }

  /** 公开预览脱敏：移除组件 API 数据源配置中敏感请求头的明文值（任务 9.1） */
  private sanitizeSensitiveHeaders(response: ScreenProjectResponse): ScreenProjectResponse {
    const sanitizedComponents = response.components.map((component) => {
      const headers = component.dataSource?.apiConfig?.headers;
      if (headers === undefined) return component;
      const hasSensitive = Object.keys(headers).some((key) => isSensitiveHeaderKey(key));
      if (!hasSensitive) return component;
      const sanitizedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        sanitizedHeaders[key] = isSensitiveHeaderKey(key) ? '[REDACTED]' : value;
      }
      return {
        ...component,
        dataSource: {
          ...component.dataSource!,
          apiConfig: { ...component.dataSource!.apiConfig!, headers: sanitizedHeaders },
        },
      };
    });
    return { ...response, components: sanitizedComponents };
  }

  async updateProject(id: string, dto: UpdateScreenProjectDto): Promise<ScreenProjectResponse> {
    if (dto.name !== undefined) {
      const duplicate = await this.prisma.screenProject.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (duplicate) {
        throw new BusinessException(BizCode.SCREEN_NAME_EXISTS);
      }
    }

    // 单次条件写入：仅当数据库 updatedAt 与请求 expectedUpdatedAt 一致时才更新，
    // 避免先读后无条件 update 的竞态窗口；保存内容后状态统一回到 draft，
    // 已发布项目保存后退出公开可见。
    // updatedAt 显式截断到秒精度，覆盖 @updatedAt 的毫秒精度，
    // 确保后续乐观锁基线与 DateTimeStringSchema 格式一致。
    const result = await this.prisma.screenProject.updateMany({
      where: { id, updatedAt: new Date(dto.expectedUpdatedAt) },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
        ...(dto.canvas !== undefined ? { canvas: JSON.stringify(dto.canvas) } : {}),
        ...(dto.components !== undefined ? { components: JSON.stringify(dto.components) } : {}),
        ...(dto.thumbnail !== undefined ? { thumbnail: dto.thumbnail ?? null } : {}),
        status: 'draft',
        updatedAt: this.truncateToSeconds(new Date()),
      },
    });

    if (result.count === 0) {
      // 任务 6.2：条件写入未命中可能是项目不存在或基线过期，
      // 通过只读 id 字段区分两类错误；此处"先读"不影响原子写入语义，
      // 冲突分支不会执行任何覆盖写入。
      const existing = await this.prisma.screenProject.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
      }
      throw new BusinessException(BizCode.SCREEN_SAVE_CONFLICT);
    }

    const updated = await this.prisma.screenProject.findUnique({ where: { id } });
    if (!updated) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    return this.toProjectResponse(updated);
  }

  async publishProject(id: string, dto: PublishScreenProjectDto): Promise<ScreenProjectResponse> {
    // 单次条件写入：仅当数据库 updatedAt 与请求 expectedUpdatedAt 一致时才发布，
    // 发布只改状态，不接收可编辑内容；避免先读后无条件 update 的竞态窗口。
    // updatedAt 显式截断到秒精度，覆盖 @updatedAt 的毫秒精度，
    // 确保后续乐观锁基线与 DateTimeStringSchema 格式一致。
    const result = await this.prisma.screenProject.updateMany({
      where: { id, updatedAt: new Date(dto.expectedUpdatedAt) },
      data: { status: 'published', updatedAt: this.truncateToSeconds(new Date()) },
    });

    if (result.count === 0) {
      // 任务 6.3：条件写入未命中可能是项目不存在或基线过期，
      // 通过只读 id 字段区分两类错误；此处"先读"不影响原子写入语义，
      // 冲突分支不会执行任何覆盖写入，过期基线不改变状态。
      const existing = await this.prisma.screenProject.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
      }
      throw new BusinessException(BizCode.SCREEN_SAVE_CONFLICT);
    }

    const updated = await this.prisma.screenProject.findUnique({ where: { id } });
    if (!updated) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    return this.toProjectResponse(updated);
  }

  async removeProject(id: string): Promise<void> {
    await this.findProjectById(id);
    await this.prisma.screenProject.delete({
      where: { id },
    });
  }

  private toProjectResponse(entity: {
    id: string;
    name: string;
    description: string | null;
    canvas: string;
    components: string;
    status: string;
    thumbnail: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ScreenProjectResponse {
    // JSON.parse 返回 any,先收窄为 unknown 交给 ScreenProjectResponseSchema 运行时验证
    const canvas: unknown = JSON.parse(entity.canvas);
    const components: unknown = JSON.parse(entity.components);
    return ScreenProjectResponseSchema.parse({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      canvas,
      components,
      status: entity.status,
      thumbnail: entity.thumbnail,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  /**
   * 将 Date 截断到秒精度（毫秒置 0）。
   *
   * DateTimeStringSchema 使用 "YYYY-MM-DD HH:mm:ss" 格式，不包含毫秒。
   * Prisma @updatedAt 默认存储毫秒精度，导致 round-trip 后客户端回传的
   * expectedUpdatedAt（.000 毫秒）与数据库值（非零毫秒）不匹配，触发 409。
   * 截断后数据库存储的 updatedAt 始终为 .000 毫秒，与格式化字符串一致。
   */
  private truncateToSeconds(date: Date): Date {
    const result = new Date(date);
    result.setMilliseconds(0);
    return result;
  }
}
