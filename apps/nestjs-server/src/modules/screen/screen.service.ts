import { Injectable, Logger } from '@nestjs/common';
import {
  isSensitiveHeaderKey,
  LegacyScreenDocumentSchema,
  migrateLegacyBlueprint,
  migrateLegacyScreenDocument,
  type BlueprintInput,
  type EventBlueprint,
  ScreenDocumentSchema,
  type ScreenDocument,
} from '@nebula/shared';

import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import { DatasetReferenceService } from '@/modules/dataset/dataset-reference.service';
import {
  ScreenProjectResponseSchema,
  type CreateScreenProjectDto,
  type PublishScreenProjectDto,
  type ScreenProjectResponse,
  type UpdateScreenProjectDto,
} from '@/modules/screen/dto/screen.dto';
import { PrismaService } from '@/prisma/prisma.service';

interface ScreenProjectEntity {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** Historical columns, used only when document is absent. */
  readonly canvas: string;
  readonly components: string;
  readonly blueprint: string | null;
  readonly document: string | null;
  readonly status: string;
  readonly thumbnail: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const defaultCanvas = {
  width: 1920,
  height: 1080,
  backgroundColor: '#000000',
  scaleMode: 'fit' as const,
};

@Injectable()
export class ScreenService {
  private readonly logger = new Logger(ScreenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly datasetReferenceService: DatasetReferenceService,
  ) {}

  async createProject(dto: CreateScreenProjectDto): Promise<ScreenProjectResponse> {
    const existing = await this.prisma.screenProject.findUnique({ where: { name: dto.name } });
    if (existing !== null) {
      throw new BusinessException(BizCode.SCREEN_NAME_EXISTS);
    }

    const document = ScreenDocumentSchema.parse({
      canvas: dto.canvas ?? defaultCanvas,
      components: [],
      globalVariables: [],
    });
    const now = this.truncateToSeconds(new Date());
    const created = await this.prisma.screenProject.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        // Retained only to satisfy the historical nullable schema during rollout.
        canvas: '{}',
        components: '[]',
        document: JSON.stringify(document),
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toProjectResponse(created);
  }

  async findAllProjects(): Promise<ScreenProjectResponse[]> {
    const projects = await this.prisma.screenProject.findMany({ orderBy: { updatedAt: 'desc' } });
    return Promise.all(projects.map((project) => this.toProjectResponse(project)));
  }

  async findProjectById(id: string): Promise<ScreenProjectResponse> {
    const project = await this.prisma.screenProject.findUnique({ where: { id } });
    if (project === null) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    return this.toProjectResponse(project);
  }

  async findPublishedProjectById(id: string): Promise<ScreenProjectResponse> {
    const project = await this.prisma.screenProject.findFirst({
      where: { id, status: 'published' },
    });
    if (project === null) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    return this.sanitizeSensitiveHeaders(await this.toProjectResponse(project));
  }

  async updateProject(id: string, dto: UpdateScreenProjectDto): Promise<ScreenProjectResponse> {
    if (dto.name !== undefined) {
      const duplicate = await this.prisma.screenProject.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (duplicate !== null) {
        throw new BusinessException(BizCode.SCREEN_NAME_EXISTS);
      }
    }

    const current = await this.prisma.screenProject.findUnique({ where: { id } });
    if (current === null) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    const currentDocument = await this.readDocument(current);
    const blueprint =
      dto.blueprint === undefined ? undefined : this.migrateIncomingBlueprint(dto.blueprint);
    const document = ScreenDocumentSchema.parse({
      ...currentDocument,
      ...(dto.canvas === undefined ? {} : { canvas: dto.canvas }),
      ...(dto.components === undefined ? {} : { components: dto.components }),
      ...(blueprint === undefined ? {} : { blueprint }),
      ...(dto.globalVariables === undefined ? {} : { globalVariables: dto.globalVariables }),
    });

    const result = await this.prisma.screenProject.updateMany({
      where: { id, updatedAt: new Date(dto.expectedUpdatedAt) },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.description === undefined ? {} : { description: dto.description ?? null }),
        ...(dto.thumbnail === undefined ? {} : { thumbnail: dto.thumbnail ?? null }),
        document: JSON.stringify(document),
        status: 'draft',
        updatedAt: this.truncateToSeconds(new Date()),
      },
    });
    if (result.count === 0) {
      await this.throwUpdateFailure(id);
    }

    await this.datasetReferenceService.rebuildReferences(id, document.components);
    const updated = await this.prisma.screenProject.findUnique({ where: { id } });
    if (updated === null) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    return this.toProjectResponse(updated);
  }

  async publishProject(id: string, dto: PublishScreenProjectDto): Promise<ScreenProjectResponse> {
    const result = await this.prisma.screenProject.updateMany({
      where: { id, updatedAt: new Date(dto.expectedUpdatedAt) },
      data: { status: 'published', updatedAt: this.truncateToSeconds(new Date()) },
    });
    if (result.count === 0) {
      await this.throwUpdateFailure(id);
    }

    const updated = await this.prisma.screenProject.findUnique({ where: { id } });
    if (updated === null) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    return this.toProjectResponse(updated);
  }

  async removeProject(id: string): Promise<void> {
    await this.findProjectById(id);
    await this.prisma.screenProject.delete({ where: { id } });
  }

  private async throwUpdateFailure(id: string): Promise<never> {
    const existing = await this.prisma.screenProject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (existing === null) {
      throw new BusinessException(BizCode.SCREEN_NOT_FOUND);
    }
    throw new BusinessException(BizCode.SCREEN_SAVE_CONFLICT);
  }

  private sanitizeSensitiveHeaders(response: ScreenProjectResponse): ScreenProjectResponse {
    const components = response.components.map((component) => {
      const headers = component.dataSource?.apiConfig?.headers;
      if (headers === undefined || !Object.keys(headers).some(isSensitiveHeaderKey)) {
        return component;
      }
      const sanitized = structuredClone(component);
      const mutableHeaders = sanitized.dataSource?.apiConfig?.headers;
      if (mutableHeaders === undefined) return sanitized;
      for (const [key, value] of Object.entries(mutableHeaders)) {
        mutableHeaders[key] = isSensitiveHeaderKey(key) ? '[REDACTED]' : value;
      }
      return sanitized;
    });
    return { ...response, components };
  }

  private async toProjectResponse(entity: ScreenProjectEntity): Promise<ScreenProjectResponse> {
    const document = await this.readDocument(entity);
    return ScreenProjectResponseSchema.parse({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      ...document,
      status: entity.status,
      thumbnail: entity.thumbnail,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private async readDocument(entity: ScreenProjectEntity): Promise<ScreenDocument> {
    if (entity.document !== null) {
      return this.parseDocument(entity.document, entity.id);
    }

    const rawDocument: unknown = {
      canvas: this.parseJson(entity.canvas, entity.id),
      components: this.parseJson(entity.components, entity.id),
      ...(entity.blueprint === null
        ? {}
        : { blueprint: this.parseJson(entity.blueprint, entity.id) }),
    };
    const formal = ScreenDocumentSchema.safeParse(rawDocument);
    const document = formal.success
      ? formal.data
      : this.migrateLegacyDocument(rawDocument, entity.id);

    await this.prisma.screenProject.update({
      where: { id: entity.id },
      data: { document: JSON.stringify(document) },
    });
    return document;
  }

  private parseDocument(serialized: string, projectId: string): ScreenDocument {
    try {
      return ScreenDocumentSchema.parse(this.parseJson(serialized, projectId));
    } catch (error) {
      this.logger.error(`Project ${projectId} has an invalid persisted document`, error);
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }
  }

  private migrateLegacyDocument(rawDocument: unknown, projectId: string): ScreenDocument {
    try {
      const legacy = LegacyScreenDocumentSchema.parse(rawDocument);
      const migration = migrateLegacyScreenDocument(legacy);
      if (migration.warnings.length > 0) {
        this.logger.error(
          `Project ${projectId} legacy document migration failed`,
          migration.warnings,
        );
        throw new BusinessException(BizCode.VALIDATION_ERROR);
      }
      return migration.document;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logger.error(`Project ${projectId} has an invalid legacy document`, error);
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }
  }

  private migrateIncomingBlueprint(blueprint: BlueprintInput): EventBlueprint {
    if (blueprint.version === 2) {
      return blueprint;
    }

    const migration = migrateLegacyBlueprint(blueprint);
    if (migration.warnings.length === 0) {
      return migration.blueprint;
    }

    this.logger.error('Screen blueprint migration failed', migration.warnings);
    throw new BusinessException(BizCode.VALIDATION_ERROR);
  }

  private parseJson(serialized: string, projectId: string): unknown {
    try {
      return JSON.parse(serialized) as unknown;
    } catch (error) {
      this.logger.error(`Project ${projectId} contains invalid JSON`, error);
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }
  }

  private truncateToSeconds(date: Date): Date {
    const result = new Date(date);
    result.setMilliseconds(0);
    return result;
  }
}
