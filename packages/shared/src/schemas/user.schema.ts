import { z } from 'zod';

// 用户相关原子字段（与后端 userFields 对齐）
const userFields = {
  email: z.email('邮箱格式不正确').min(1, '邮箱不能为空').describe('用户邮箱地址'),
  username: z.string().min(3, '用户名至少 3 个字符').describe('用户名，至少 3 个字符'),
  password: z.string().min(6, '密码至少 6 个字符').describe('用户密码，至少 6 个字符'),
  name: z.string().optional().describe('显示名称'),
};

// --- User Schemas ---
export const CreateUserSchema = z.object({
  email: userFields.email,
  username: userFields.username,
  password: userFields.password,
  name: userFields.name,
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });

export const UserResponseSchema = z.object({
  id: z.string().describe('用户唯一标识（UUID）'),
  email: z.string().describe('用户邮箱地址'),
  username: z.string().describe('用户名'),
  name: z.string().nullable().optional().describe('用户显示名称'),
  isActive: z.boolean().describe('是否启用'),
  createdAt: z.string().describe('创建时间'),
  updatedAt: z.string().describe('更新时间'),
});

export type CreateUserParams = z.infer<typeof CreateUserSchema>;
export type UpdateUserParams = z.infer<typeof UpdateUserSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
