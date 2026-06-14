import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  AssignMenusDto,
  RoleResponse,
} from '@/modules/role/dto/role.dto';
import { RoleResponseSchema } from '@/modules/role/dto/role.dto';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoleDto): Promise<RoleResponse> {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BusinessException(BizCode.ROLE_ALREADY_EXISTS);
    }

    const created = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
      },
    });

    return this.toResponse(created);
  }

  async findAll(): Promise<RoleResponse[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
    return roles.map((role) => this.toResponse(role));
  }

  async findOne(id: string): Promise<RoleResponse> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new BusinessException(BizCode.ROLE_NOT_FOUND);
    }
    return this.toResponse(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponse> {
    await this.findOne(id);

    if (dto.name && dto.name.length > 0) {
      const duplicate = await this.prisma.role.findFirst({
        where: {
          name: dto.name,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BusinessException(BizCode.ROLE_ALREADY_EXISTS);
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
      },
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.role.delete({
      where: { id },
    });
  }

  async assignMenus(id: string, dto: AssignMenusDto): Promise<RoleResponse> {
    await this.findOne(id);

    if (dto.menuIds.length > 0) {
      const existingMenus = await this.prisma.menu.findMany({
        where: { id: { in: dto.menuIds } },
        select: { id: true },
      });
      if (existingMenus.length !== dto.menuIds.length) {
        throw new BusinessException(BizCode.MENU_NOT_FOUND);
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        menus: {
          set: dto.menuIds.map((menuId) => ({ id: menuId })),
        },
      },
    });

    return this.toResponse(updated);
  }

  private toResponse(role: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): RoleResponse {
    return RoleResponseSchema.parse({
      id: role.id,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  }
}
