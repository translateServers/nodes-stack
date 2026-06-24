import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import {
  RegisterSchema as _RegisterSchema,
  LoginSchema as _LoginSchema,
  RefreshTokenSchema as _RefreshTokenSchema,
  TokenResponseSchema as _TokenResponseSchema,
  CaptchaResponseSchema as _CaptchaResponseSchema,
  ProfileResponseSchema as _ProfileResponseSchema,
} from '@nebula/shared/schemas';

// 所有 Schema 从 shared 导入，确保前后端字段 1:1 一致
export const RegisterSchema = _RegisterSchema;
export const LoginSchema = _LoginSchema;
export const RefreshTokenSchema = _RefreshTokenSchema;
export const TokenResponseSchema = _TokenResponseSchema;
export const CaptchaResponseSchema = _CaptchaResponseSchema;
export const ProfileResponseSchema = _ProfileResponseSchema;

export class RegisterDto extends createZodDto(RegisterSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}

export class TokenResponseDto extends createZodDto(TokenResponseSchema) {}
export class CaptchaResponseDto extends createZodDto(CaptchaResponseSchema) {}
export class ProfileResponseDto extends createZodDto(ProfileResponseSchema) {}

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type CaptchaResponse = z.infer<typeof CaptchaResponseSchema>;
