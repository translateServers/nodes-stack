import { Injectable, Logger } from '@nestjs/common';
import { EMPTY_SCREEN_DOCUMENT, ScreenDocumentSchema, type ScreenDocument } from '@nebula/shared';

import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
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
  readonly document: string;
  readonly status: string;
  readonly thumbnail: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class ScreenService {
  private readonly logger = new Logger(ScreenService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createProject(dto: CreateScreenProjectDto): Promise<ScreenProjectResponse> {
    const existing = await this.prisma.screenProject.findUnique({ where: { name: dto.name } });
    if (existing !== null) {
      throw new BusinessException(BizCode.SCREEN_NAME_EXISTS);
    }

    const document = ScreenDocumentSchema.parse(dto.document ?? EMPTY_SCREEN_DOCUMENT);
    const now = this.truncateToSeconds(new Date());
    const created = await this.prisma.screenProject.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
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
    return this.toProjectResponse(project);
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
    const currentDocument = this.readDocument(current);
    const document =
      dto.document === undefined ? currentDocument : ScreenDocumentSchema.parse(dto.document);

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

  private toProjectResponse(entity: ScreenProjectEntity): ScreenProjectResponse {
    const document = this.readDocument(entity);
    return ScreenProjectResponseSchema.parse({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      status: entity.status,
      thumbnail: entity.thumbnail,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      document,
    });
  }

  private readDocument(entity: ScreenProjectEntity): ScreenDocument {
    try {
      return ScreenDocumentSchema.parse(JSON.parse(entity.document));
    } catch (error) {
      this.logger.error(`Project ${entity.id} has an invalid persisted document`, error);
      throw new BusinessException(BizCode.VALIDATION_ERROR);
    }
  }

  private truncateToSeconds(date: Date): Date {
    const result = new Date(date);
    result.setMilliseconds(0);
    return result;
  }
}
