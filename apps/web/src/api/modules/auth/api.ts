import type {
  CaptchaResponse,
  LoginParams,
  ProfileResponse,
  RefreshTokenParams,
  RegisterParams,
  TokenResponse,
} from '@nebula/shared';
import {
  CaptchaResponseSchema,
  LoginSchema,
  ProfileResponseSchema,
  RefreshTokenSchema,
  RegisterSchema,
  TokenResponseSchema,
} from '@nebula/shared';
import { ENDPOINTS } from '../../core/endpoints';
import { get, post } from '../../core/http';

export function getCaptcha(): Promise<CaptchaResponse> {
  return get(ENDPOINTS.auth.captcha, CaptchaResponseSchema);
}

export function register(params: RegisterParams): Promise<TokenResponse> {
  return post(ENDPOINTS.auth.register, RegisterSchema.parse(params), TokenResponseSchema);
}

export function login(params: LoginParams): Promise<TokenResponse> {
  return post(ENDPOINTS.auth.login, LoginSchema.parse(params), TokenResponseSchema);
}

export function refreshToken(params: RefreshTokenParams): Promise<TokenResponse> {
  return post(ENDPOINTS.auth.refresh, RefreshTokenSchema.parse(params), TokenResponseSchema);
}

export function logout(): Promise<undefined> {
  return post(ENDPOINTS.auth.logout);
}

export function getProfile(): Promise<ProfileResponse> {
  return get(ENDPOINTS.auth.profile, ProfileResponseSchema);
}

export type { ProfileResponse };
