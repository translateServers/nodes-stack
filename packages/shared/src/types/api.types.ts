// 业务错误码枚举
export enum BizCode {
  SUCCESS = 0,
  INVALID_PARAMS = 10001,
  UNAUTHORIZED = 10002,
  FORBIDDEN = 10003,
  NOT_FOUND = 10004,
  CONFLICT = 10005,
  INTERNAL_ERROR = 10006,
}

// API 统一响应格式
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
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
