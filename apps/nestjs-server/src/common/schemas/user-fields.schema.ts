import { z } from 'zod';

/**
 * 用户相关原子字段定义
 *
 * Auth 模块和 User 模块共享这些字段定义，避免重复。
 */
export const userFields = {
  email: z.email('邮箱格式不正确').min(1, '邮箱不能为空').describe('用户邮箱地址'),
  username: z.string().min(3, '用户名至少 3 个字符').describe('用户名，至少 3 个字符'),
  password: z.string().min(6, '密码至少 6 个字符').describe('用户密码，至少 6 个字符'),
  name: z.string().optional().describe('显示名称'),
};
