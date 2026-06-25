// 业务错误码（与后端 BizCode 枚举严格对齐）
export const BizCode = {
  // 成功
  SUCCESS: 0,

  // 通用错误 (1xxx)
  UNKNOWN_ERROR: 1000,
  VALIDATION_ERROR: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  INTERNAL_ERROR: 1099,

  // 认证模块 (10xxx)
  AUTH_INVALID_CREDENTIALS: 10001,
  AUTH_EMAIL_ALREADY_REGISTERED: 10002,
  AUTH_USERNAME_ALREADY_TAKEN: 10003,
  AUTH_INVALID_REFRESH_TOKEN: 10004,
  AUTH_CAPTCHA_NOT_FOUND: 10005,
  AUTH_CAPTCHA_EXPIRED: 10006,
  AUTH_CAPTCHA_INVALID: 10007,

  // 用户模块 (20xxx)
  USER_NOT_FOUND: 20001,
  USER_EMAIL_EXISTS: 20002,

  // 菜单模块 (30xxx)
  MENU_NOT_FOUND: 30001,
  MENU_ALREADY_EXISTS: 30002,
  MENU_PARENT_NOT_FOUND: 30003,
  MENU_HAS_CHILDREN: 30004,

  // 角色模块 (40xxx)
  ROLE_NOT_FOUND: 40001,
  ROLE_ALREADY_EXISTS: 40002,

  // 字典模块 (50xxx)
  DICT_TYPE_NOT_FOUND: 50001,
  DICT_TYPE_ALREADY_EXISTS: 50002,
  DICT_VALUE_NOT_FOUND: 50003,
  DICT_VALUE_ALREADY_EXISTS: 50004,

  // 文件模块 (60xxx)
  FILE_NOT_FOUND: 60001,
  FILE_UPLOAD_FAILED: 60002,
  FILE_TYPE_NOT_ALLOWED: 60003,
  FILE_SIZE_EXCEEDED: 60004,
} as const;

export type BizCodeValue = (typeof BizCode)[keyof typeof BizCode];

// API 统一响应格式（与后端 ApiResponseType 对齐）
export interface ApiResponse<T = unknown> {
  code: number;
  data?: T;
  message: string;
}

// API 错误响应格式
export interface ApiErrorResponse {
  code: number;
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

// 排序方向
export type SortOrder = 'asc' | 'desc';

// 排序查询参数
export interface SortQuery {
  field: string;
  order: SortOrder;
}

// 筛选操作符
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in';

// 筛选条件
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

// 表格查询参数（含分页、排序、筛选、搜索）
export interface TableQuery extends PaginationQuery {
  sort?: SortQuery[];
  filters?: FilterCondition[];
  search?: string;
}

// 表格查询响应（复用 PaginatedResponse 结构）
export type TableQueryResult<T> = PaginatedResponse<T>;

// 业务码 → HTTP 状态码映射
const BIZ_CODE_TO_HTTP_STATUS: Record<BizCodeValue, number> = {
  [BizCode.SUCCESS]: 200,

  // 通用错误
  [BizCode.UNKNOWN_ERROR]: 500,
  [BizCode.VALIDATION_ERROR]: 400,
  [BizCode.UNAUTHORIZED]: 401,
  [BizCode.FORBIDDEN]: 403,
  [BizCode.NOT_FOUND]: 404,
  [BizCode.INTERNAL_ERROR]: 500,

  // 认证模块
  [BizCode.AUTH_INVALID_CREDENTIALS]: 401,
  [BizCode.AUTH_EMAIL_ALREADY_REGISTERED]: 409,
  [BizCode.AUTH_USERNAME_ALREADY_TAKEN]: 409,
  [BizCode.AUTH_INVALID_REFRESH_TOKEN]: 401,
  [BizCode.AUTH_CAPTCHA_NOT_FOUND]: 404,
  [BizCode.AUTH_CAPTCHA_EXPIRED]: 400,
  [BizCode.AUTH_CAPTCHA_INVALID]: 400,

  // 用户模块
  [BizCode.USER_NOT_FOUND]: 404,
  [BizCode.USER_EMAIL_EXISTS]: 409,

  // 菜单模块
  [BizCode.MENU_NOT_FOUND]: 404,
  [BizCode.MENU_ALREADY_EXISTS]: 409,
  [BizCode.MENU_PARENT_NOT_FOUND]: 404,
  [BizCode.MENU_HAS_CHILDREN]: 409,

  // 角色模块
  [BizCode.ROLE_NOT_FOUND]: 404,
  [BizCode.ROLE_ALREADY_EXISTS]: 409,

  // 字典模块
  [BizCode.DICT_TYPE_NOT_FOUND]: 404,
  [BizCode.DICT_TYPE_ALREADY_EXISTS]: 409,
  [BizCode.DICT_VALUE_NOT_FOUND]: 404,
  [BizCode.DICT_VALUE_ALREADY_EXISTS]: 409,

  // 文件模块
  [BizCode.FILE_NOT_FOUND]: 404,
  [BizCode.FILE_UPLOAD_FAILED]: 500,
  [BizCode.FILE_TYPE_NOT_ALLOWED]: 400,
  [BizCode.FILE_SIZE_EXCEEDED]: 400,
};

/**
 * 根据业务码获取对应的 HTTP 状态码
 */
export function getHttpStatus(bizCode: BizCodeValue): number {
  return BIZ_CODE_TO_HTTP_STATUS[bizCode] ?? 500;
}
