import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { userFields } from '@/common/schemas/user-fields.schema';

import { UserResponseSchema } from '@/modules/user/dto/user.dto';

const captchaFields = {
  captchaId: z.string().min(1, '验证码 ID 不能为空').describe('验证码 ID'),
  captchaCode: z.string().min(1, '验证码不能为空').describe('验证码内容（不区分大小写）'),
  captchaImage: z.string().describe('验证码图片（SVG 格式）'),
};

// --- Auth 专属原子字段 ---
const authFields = {
  account: z.string().min(1, '账号不能为空').describe('用户账号（邮箱或用户名）'),
  accessToken: z.string().min(1).describe('访问令牌（JWT）'),
  refreshToken: z.string().min(1, '刷新令牌不能为空').describe('刷新令牌（JWT）'),
};

// --- 请求 DTOs ---
export const RegisterSchema = z.object({
  email: userFields.email,
  username: userFields.username,
  password: userFields.password,
  name: userFields.name,
});

export const LoginSchema = z.object({
  account: authFields.account,
  password: z.string().min(1, '密码不能为空'), // 登录密码规则可与注册不同
  captchaId: captchaFields.captchaId,
  captchaCode: captchaFields.captchaCode,
});

export const RefreshTokenSchema = z.object({
  refreshToken: authFields.refreshToken,
});

// --- 响应 Types (Auth 专属) ---
export const TokenResponseSchema = z.object({
  accessToken: authFields.accessToken,
  refreshToken: authFields.refreshToken,
});

export const CaptchaResponseSchema = z.object({
  captchaId: captchaFields.captchaId,
  captchaImage: captchaFields.captchaImage,
});

// Profile 响应是 UserResponse 的子集
export const ProfileResponseSchema = UserResponseSchema.pick({
  id: true,
  email: true,
  username: true,
  name: true,
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}

export class TokenResponseDto extends createZodDto(TokenResponseSchema) {}
export class CaptchaResponseDto extends createZodDto(CaptchaResponseSchema) {}
export class ProfileResponseDto extends createZodDto(ProfileResponseSchema) {}

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type CaptchaResponse = z.infer<typeof CaptchaResponseSchema>;
