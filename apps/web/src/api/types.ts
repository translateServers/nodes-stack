// 业务错误码（与后端 BizCode 枚举保持一致）
export const BizCode = {
  SUCCESS: 0,

  // 通用错误
  UNKNOWN_ERROR: 1000,
  VALIDATION_ERROR: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  INTERNAL_ERROR: 1099,

  // 认证模块
  AUTH_INVALID_CREDENTIALS: 10001,
  AUTH_EMAIL_ALREADY_REGISTERED: 10002,
  AUTH_USERNAME_ALREADY_TAKEN: 10003,
  AUTH_INVALID_REFRESH_TOKEN: 10004,
  AUTH_CAPTCHA_NOT_FOUND: 10005,
  AUTH_CAPTCHA_EXPIRED: 10006,
  AUTH_CAPTCHA_INVALID: 10007,

  // 用户模块
  USER_NOT_FOUND: 20001,
  USER_EMAIL_EXISTS: 20002,
} as const;

export type BizCodeValue = (typeof BizCode)[keyof typeof BizCode];

// API 统一响应格式
export interface ApiResponse<T = unknown> {
  code: BizCodeValue;
  message: string;
  data?: T;
  timestamp?: string;
}

// API 错误响应格式
export interface ApiErrorResponse {
  code: BizCodeValue;
  message: string;
  details?: string[];
}

// 分页请求参数
export interface PaginationQuery {
  page: number;
  pageSize: number;
}

// 分页响应格式
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
