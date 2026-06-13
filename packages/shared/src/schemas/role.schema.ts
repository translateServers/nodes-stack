import { z } from 'zod';
import { DateTimeStringSchema } from './datetime.schema.js';

// 创建角色
export const CreateRoleSchema = z.object({
  name: z.string().min(1, '角色名称不能为空').describe('角色名称'),
  description: z.string().optional().describe('角色描述'),
});

// 更新角色
export const UpdateRoleSchema = CreateRoleSchema.partial();

// 角色响应
export const RoleResponseSchema = z.object({
  id: z.string().describe('角色唯一标识'),
  name: z.string().describe('角色名称'),
  description: z.string().nullable().optional().describe('角色描述'),
  isActive: z.boolean().describe('是否启用'),
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

// 分配菜单
export const AssignMenusSchema = z.object({
  menuIds: z.array(z.string()).describe('菜单 ID 列表'),
});

export type CreateRoleParams = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleParams = z.infer<typeof UpdateRoleSchema>;
export type RoleResponse = z.infer<typeof RoleResponseSchema>;
export type AssignMenusParams = z.infer<typeof AssignMenusSchema>;
