import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BizCode } from '@/common/enums/biz-code.enum';
import { BusinessException } from '@/common/exceptions/business.exception';
import {
  CreateMenuDto,
  MenuResponseSchema,
  UpdateMenuDto,
  type MenuResponse,
} from './dto/menu.dto';
import type { MenuTreeNode } from '@nebula/shared/schemas';
import type { Menu } from '@prisma/client';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMenuDto): Promise<MenuResponse> {
    const created = await this.prisma.menu.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        path: dto.path ?? null,
        icon: dto.icon ?? null,
        type: dto.type,
        sort: dto.sort ?? 0,
        isActive: dto.isVisible ?? true,
        permission: dto.permission ?? null,
        component: dto.component ?? null,
      },
    });
    return this.toResponse(created);
  }

  async findAll(): Promise<MenuResponse[]> {
    const menus = await this.prisma.menu.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    return menus.map((m) => this.toResponse(m));
  }

  async findTree(): Promise<MenuTreeNode[]> {
    const menus = await this.prisma.menu.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    const responses = menus.map((m) => this.toResponse(m));
    return this.buildTree(responses);
  }

  async findOne(id: string): Promise<MenuResponse> {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) {
      throw new BusinessException(BizCode.NOT_FOUND);
    }
    return this.toResponse(menu);
  }

  async update(id: string, dto: UpdateMenuDto): Promise<MenuResponse> {
    await this.findOne(id);

    const updateData: Partial<Menu> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;
    if (dto.path !== undefined) updateData.path = dto.path ?? null;
    if (dto.icon !== undefined) updateData.icon = dto.icon ?? null;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.sort !== undefined) updateData.sort = dto.sort;
    if (dto.isVisible !== undefined) updateData.isActive = dto.isVisible;
    if (dto.permission !== undefined) updateData.permission = dto.permission ?? null;
    if (dto.component !== undefined) updateData.component = dto.component ?? null;

    const updated = await this.prisma.menu.update({
      where: { id },
      data: updateData,
    });

    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.menu.delete({ where: { id } });
  }

  private buildTree(menus: MenuResponse[]): MenuTreeNode[] {
    const map = new Map<string, MenuTreeNode>();
    const roots: MenuTreeNode[] = [];

    for (const menu of menus) {
      map.set(menu.id, { ...menu, children: [] });
    }

    for (const menu of menus) {
      const node = map.get(menu.id)!;
      if (menu.parentId && map.has(menu.parentId)) {
        map.get(menu.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private toResponse(menu: Menu): MenuResponse {
    return MenuResponseSchema.parse({
      id: menu.id,
      name: menu.name,
      type: menu.type,
      path: menu.path,
      icon: menu.icon,
      component: menu.component,
      parentId: menu.parentId,
      sort: menu.sort,
      permission: menu.permission,
      isVisible: menu.isActive,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
    });
  }
}
