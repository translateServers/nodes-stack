import { z } from 'zod';
import { UserResponseSchema } from './user.schema.js';

// 验证码字段
const captchaFields = {
  captchaId: z.string().min(1, '验证码 ID 不能为空').describe('验证码 ID'),
  captchaCode: z.string().min(1, '验证码不能为空').describe('验证码内容（不区分大小写）'),
  captchaImage: z.string().describe('验证码图片（SVG 格式）'),
};

// Auth 专属字段
const authFields = {
  account: z.string().min(1, '账号不能为空').describe('用户账号（邮箱或用户名）'),
  accessToken: z.string().min(1).describe('访问令牌（JWT）'),
  refreshToken: z.string().min(1, '刷新令牌不能为空').describe('刷新令牌（JWT）'),
};

// --- 请求 Schemas ---
export const RegisterSchema = z.object({
  email: z.email('邮箱格式不正确').min(1, '邮箱不能为空').describe('用户邮箱地址'),
  username: z.string().min(3, '用户名至少 3 个字符').describe('用户名'),
  password: z.string().min(6, '密码至少 6 个字符').describe('用户密码'),
  name: z.string().optional().describe('显示名称'),
});

export const LoginSchema = z.object({
  account: authFields.account,
  password: z.string().min(1, '密码不能为空').describe('用户密码'),
  captchaId: captchaFields.captchaId,
  captchaCode: captchaFields.captchaCode,
});

export const RefreshTokenSchema = z.object({
  refreshToken: authFields.refreshToken,
});

// --- 响应 Schemas ---
export const TokenResponseSchema = z.object({
  accessToken: authFields.accessToken,
  refreshToken: authFields.refreshToken,
});

export const CaptchaResponseSchema = z.object({
  captchaId: captchaFields.captchaId,
  captchaImage: captchaFields.captchaImage,
});

export const ProfileResponseSchema = UserResponseSchema.pick({
  id: true,
  email: true,
  username: true,
  name: true,
});

export type RegisterParams = z.infer<typeof RegisterSchema>;
export type LoginParams = z.infer<typeof LoginSchema>;
export type RefreshTokenParams = z.infer<typeof RefreshTokenSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type CaptchaResponse = z.infer<typeof CaptchaResponseSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
