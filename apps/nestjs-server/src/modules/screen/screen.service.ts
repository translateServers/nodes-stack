import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type {
  CreateScreenProjectDto,
  UpdateScreenProjectDto,
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

    const created = await this.prisma.screenProject.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        canvas: JSON.stringify(dto.canvas ?? defaultCanvas),
        components: '[]',
        status: 'draft',
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

  async updateProject(id: string, dto: UpdateScreenProjectDto): Promise<ScreenProjectResponse> {
    await this.findProjectById(id);

    if (dto.name !== undefined) {
      const duplicate = await this.prisma.screenProject.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (duplicate) {
        throw new BusinessException(BizCode.SCREEN_NAME_EXISTS);
      }
    }

    const updated = await this.prisma.screenProject.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
        ...(dto.canvas !== undefined ? { canvas: JSON.stringify(dto.canvas) } : {}),
        ...(dto.components !== undefined ? { components: JSON.stringify(dto.components) } : {}),
        ...(dto.thumbnail !== undefined ? { thumbnail: dto.thumbnail ?? null } : {}),
      },
    });

    return this.toProjectResponse(updated);
  }

  async publishProject(id: string): Promise<ScreenProjectResponse> {
    await this.findProjectById(id);

    const updated = await this.prisma.screenProject.update({
      where: { id },
      data: { status: 'published' },
    });

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
    return ScreenProjectResponseSchema.parse({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      canvas: JSON.parse(entity.canvas),
      components: JSON.parse(entity.components),
      status: entity.status,
      thumbnail: entity.thumbnail,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
