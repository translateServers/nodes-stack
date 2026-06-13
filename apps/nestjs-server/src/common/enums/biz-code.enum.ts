/**
 * 业务状态码规范
 *
 * 编码规则：
 * - 0        : 成功
 * - 1xxx     : 通用错误
 * - 10xxx    : 认证模块
 * - 20xxx    : 用户模块
 * - 30xxx    : 菜单模块
 * - 40xxx    : 角色模块
 * - 50xxx    : 字典模块
 */
export enum BizCode {
  // ==================== 成功 ====================
  SUCCESS = 0,

  // ==================== 通用错误 (1xxx) ====================
  /** 未知错误 */
  UNKNOWN_ERROR = 1000,
  /** 请求参数校验失败 */
  VALIDATION_ERROR = 1001,
  /** 未授权，请先登录 */
  UNAUTHORIZED = 1002,
  /** 权限不足 */
  FORBIDDEN = 1003,
  /** 资源不存在 */
  NOT_FOUND = 1004,
  /** 服务器内部错误 */
  INTERNAL_ERROR = 1099,

  // ==================== 认证模块 (10xxx) ====================
  /** 凭证无效（邮箱或密码错误） */
  AUTH_INVALID_CREDENTIALS = 10001,
  /** 邮箱已注册 */
  AUTH_EMAIL_ALREADY_REGISTERED = 10002,
  /** 用户名已被占用 */
  AUTH_USERNAME_ALREADY_TAKEN = 10003,
  /** 刷新令牌无效或已过期 */
  AUTH_INVALID_REFRESH_TOKEN = 10004,
  /** 验证码不存在或已过期 */
  AUTH_CAPTCHA_NOT_FOUND = 10005,
  /** 验证码已过期 */
  AUTH_CAPTCHA_EXPIRED = 10006,
  /** 验证码错误 */
  AUTH_CAPTCHA_INVALID = 10007,

  // ==================== 用户模块 (20xxx) ====================
  /** 用户不存在 */
  USER_NOT_FOUND = 20001,
  /** 用户邮箱已存在 */
  USER_EMAIL_EXISTS = 20002,

  // ==================== 菜单模块 (30xxx) ====================
  /** 菜单不存在 */
  MENU_NOT_FOUND = 30001,
  /** 菜单名称已存在 */
  MENU_ALREADY_EXISTS = 30002,
  /** 父菜单不存在 */
  MENU_PARENT_NOT_FOUND = 30003,
  /** 菜单存在子菜单，无法删除 */
  MENU_HAS_CHILDREN = 30004,

  // ==================== 角色模块 (40xxx) ====================
  /** 角色不存在 */
  ROLE_NOT_FOUND = 40001,
  /** 角色名称已存在 */
  ROLE_ALREADY_EXISTS = 40002,

  // ==================== 字典模块 (50xxx) ====================
  /** 字典类型不存在 */
  DICT_TYPE_NOT_FOUND = 50001,
  /** 字典类型编码已存在 */
  DICT_TYPE_ALREADY_EXISTS = 50002,
  /** 字典值不存在 */
  DICT_VALUE_NOT_FOUND = 50003,
  /** 字典值编码在该类型下已存在 */
  DICT_VALUE_ALREADY_EXISTS = 50004,
}

/**
 * 业务码对应的默认消息
 */
export const BizMessage: Record<number, string> = {
  [BizCode.SUCCESS]: '操作成功',

  // 通用错误
  [BizCode.UNKNOWN_ERROR]: '未知错误',
  [BizCode.VALIDATION_ERROR]: '请求参数校验失败',
  [BizCode.UNAUTHORIZED]: '未授权，请先登录',
  [BizCode.FORBIDDEN]: '权限不足',
  [BizCode.NOT_FOUND]: '资源不存在',
  [BizCode.INTERNAL_ERROR]: '服务器内部错误',

  // 认证模块
  [BizCode.AUTH_INVALID_CREDENTIALS]: '凭证无效（邮箱或密码错误）',
  [BizCode.AUTH_EMAIL_ALREADY_REGISTERED]: '邮箱已注册',
  [BizCode.AUTH_USERNAME_ALREADY_TAKEN]: '用户名已被占用',
  [BizCode.AUTH_INVALID_REFRESH_TOKEN]: '刷新令牌无效或已过期',
  [BizCode.AUTH_CAPTCHA_NOT_FOUND]: '验证码不存在或已过期',
  [BizCode.AUTH_CAPTCHA_EXPIRED]: '验证码已过期',
  [BizCode.AUTH_CAPTCHA_INVALID]: '验证码错误',

  // 用户模块
  [BizCode.USER_NOT_FOUND]: '用户不存在',
  [BizCode.USER_EMAIL_EXISTS]: '用户邮箱已存在',

  // 菜单模块
  [BizCode.MENU_NOT_FOUND]: '菜单不存在',
  [BizCode.MENU_ALREADY_EXISTS]: '菜单名称已存在',
  [BizCode.MENU_PARENT_NOT_FOUND]: '父菜单不存在',
  [BizCode.MENU_HAS_CHILDREN]: '菜单存在子菜单，无法删除',

  // 角色模块
  [BizCode.ROLE_NOT_FOUND]: '角色不存在',
  [BizCode.ROLE_ALREADY_EXISTS]: '角色名称已存在',

  // 字典模块
  [BizCode.DICT_TYPE_NOT_FOUND]: '字典类型不存在',
  [BizCode.DICT_TYPE_ALREADY_EXISTS]: '字典类型编码已存在',
  [BizCode.DICT_VALUE_NOT_FOUND]: '字典值不存在',
  [BizCode.DICT_VALUE_ALREADY_EXISTS]: '字典值编码在该类型下已存在',
};

/**
 * 根据业务码获取对应的 HTTP 状态码
 */
const BIZ_CODE_TO_HTTP_STATUS: Record<BizCode, number> = {
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
};

export function getHttpStatus(bizCode: BizCode): number {
  return BIZ_CODE_TO_HTTP_STATUS[bizCode] ?? 500;
}
