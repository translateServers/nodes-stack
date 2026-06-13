import http from '@/api/http';

// 验证码响应
export interface CaptchaResponse {
  captchaId: string;
  captchaImage: string;
}

// Token 响应
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

// 登录参数
export interface LoginParams {
  account: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}

// 注册参数
export interface RegisterParams {
  email: string;
  username: string;
  password: string;
  name?: string;
}

// 刷新 Token 参数
export interface RefreshTokenParams {
  refreshToken: string;
}

// 个人资料响应
export interface ProfileResponse {
  id: string;
  email: string;
  username: string;
  name?: string | null;
}

// 获取验证码
export function getCaptcha(): Promise<CaptchaResponse> {
  return http.get<unknown, CaptchaResponse>('/auth/captcha');
}

// 用户注册
export function register(params: RegisterParams): Promise<TokenResponse> {
  return http.post<unknown, TokenResponse>('/auth/register', params);
}

// 用户登录
export function login(params: LoginParams): Promise<TokenResponse> {
  return http.post<unknown, TokenResponse>('/auth/login', params);
}

// 刷新访问令牌
export function refreshToken(params: RefreshTokenParams): Promise<TokenResponse> {
  return http.post<unknown, TokenResponse>('/auth/refresh', params);
}

// 退出登录
export function logout(): Promise<void> {
  return http.post<unknown, void>('/auth/logout');
}

// 获取当前用户信息
export function getProfile(): Promise<ProfileResponse> {
  return http.get<unknown, ProfileResponse>('/auth/profile');
}
