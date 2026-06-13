import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse, ApiResponse } from './types';

// 业务异常类：用于业务码非 0 时抛出
export class BusinessError extends Error {
  readonly code: number;
  readonly details?: string[];

  constructor(code: number, message: string, details?: string[]) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
  }
}

// 401 未授权标记，防止多个请求并发刷新 token
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processPendingQueue(error: unknown, token: string | null): void {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token ?? '');
    }
  });
  pendingQueue = [];
}

const ACCESS_TOKEN_KEY = 'nebula_access_token';
const REFRESH_TOKEN_KEY = 'nebula_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// 创建 axios 实例
const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：注入 token
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截器：统一处理业务码和 401 刷新
http.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiResponse<unknown> | undefined;
    if (payload && typeof payload.code === 'number') {
      if (payload.code === 0) {
        return payload.data as unknown;
      }
      throw new BusinessError(payload.code, payload.message);
    }
    return response.data;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const { response, config } = error;

    // 网络错误或超时
    if (!response) {
      throw new BusinessError(-1, error.message || '网络错误');
    }

    const { status, data } = response;
    const bizCode = data?.code ?? status;
    const message = data?.message ?? error.message;

    // 401 处理：尝试刷新 token
    if (status === 401 && config && !('retry' in config && config.retry === true)) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        throw new BusinessError(bizCode, message, data?.details);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              (config as InternalAxiosRequestConfig & { retry?: boolean }).retry = true;
              config.headers.set('Authorization', `Bearer ${token}`);
              resolve(http(config));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const result = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          '/api/auth/refresh',
          { refreshToken },
        );
        const tokens = result.data.data;
        if (!tokens) {
          throw new BusinessError(bizCode, '刷新令牌失败');
        }
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
        processPendingQueue(null, tokens.accessToken);
        (config as InternalAxiosRequestConfig & { retry?: boolean }).retry = true;
        config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
        return http(config);
      } catch (refreshError) {
        processPendingQueue(refreshError, null);
        clearTokens();
        throw new BusinessError(bizCode, message, data?.details);
      } finally {
        isRefreshing = false;
      }
    }

    throw new BusinessError(bizCode, message, data?.details);
  },
);

export default http;
