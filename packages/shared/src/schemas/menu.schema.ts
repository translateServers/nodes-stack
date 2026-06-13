import { z } from 'zod';
import { DateTimeStringSchema } from './datetime.schema.js';

// 菜单类型枚举
export const MenuTypeSchema = z.enum(['DIRECTORY', 'MENU', 'BUTTON']).describe('菜单类型');

// 创建菜单
export const CreateMenuSchema = z.object({
  name: z.string().min(1, '菜单名称不能为空').describe('菜单名称'),
  type: MenuTypeSchema,
  path: z.string().optional().describe('路由路径'),
  icon: z.string().optional().describe('菜单图标'),
  component: z.string().optional().describe('组件路径'),
  parentId: z.string().nullable().optional().describe('父菜单 ID'),
  sort: z.number().int().min(0).optional().describe('排序'),
  permission: z.string().optional().describe('权限标识'),
  isVisible: z.boolean().optional().describe('是否可见'),
});

// 更新菜单
export const UpdateMenuSchema = CreateMenuSchema.partial();

// 菜单响应
export const MenuResponseSchema = z.object({
  id: z.string().describe('菜单唯一标识'),
  name: z.string().describe('菜单名称'),
  type: MenuTypeSchema,
  path: z.string().nullable().optional().describe('路由路径'),
  icon: z.string().nullable().optional().describe('菜单图标'),
  component: z.string().nullable().optional().describe('组件路径'),
  parentId: z.string().nullable().optional().describe('父菜单 ID'),
  sort: z.number().describe('排序'),
  permission: z.string().nullable().optional().describe('权限标识'),
  isVisible: z.boolean().describe('是否可见'),
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

// 菜单树节点
export const MenuTreeNodeSchema: z.ZodType<MenuTreeNode> = z.lazy(() =>
  MenuResponseSchema.extend({
    children: z.array(MenuTreeNodeSchema).optional(),
  }),
);

export interface MenuTreeNode extends z.infer<typeof MenuResponseSchema> {
  children?: MenuTreeNode[];
}

export type CreateMenuParams = z.infer<typeof CreateMenuSchema>;
export type UpdateMenuParams = z.infer<typeof UpdateMenuSchema>;
export type MenuResponse = z.infer<typeof MenuResponseSchema>;
