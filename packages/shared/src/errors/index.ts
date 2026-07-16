import { BizCode } from '../types/api.types.js';

// 业务错误码对应的默认消息（与后端 BizMessage 同源）
export const BizMessage: Record<number, string> = {
  [BizCode.SUCCESS]: '操作成功',
  [BizCode.UNKNOWN_ERROR]: '未知错误',
  [BizCode.VALIDATION_ERROR]: '请求参数校验失败',
  [BizCode.UNAUTHORIZED]: '未授权，请先登录',
  [BizCode.FORBIDDEN]: '权限不足',
  [BizCode.NOT_FOUND]: '资源不存在',
  [BizCode.INTERNAL_ERROR]: '服务器内部错误',
  [BizCode.AUTH_INVALID_CREDENTIALS]: '凭证无效（邮箱或密码错误）',
  [BizCode.AUTH_EMAIL_ALREADY_REGISTERED]: '邮箱已注册',
  [BizCode.AUTH_USERNAME_ALREADY_TAKEN]: '用户名已被占用',
  [BizCode.AUTH_INVALID_REFRESH_TOKEN]: '刷新令牌无效或已过期',
  [BizCode.AUTH_CAPTCHA_NOT_FOUND]: '验证码不存在或已过期',
  [BizCode.AUTH_CAPTCHA_EXPIRED]: '验证码已过期',
  [BizCode.AUTH_CAPTCHA_INVALID]: '验证码错误',
  [BizCode.USER_NOT_FOUND]: '用户不存在',
  [BizCode.USER_EMAIL_EXISTS]: '用户邮箱已存在',
  [BizCode.MENU_NOT_FOUND]: '菜单不存在',
  [BizCode.MENU_ALREADY_EXISTS]: '菜单名称已存在',
  [BizCode.MENU_PARENT_NOT_FOUND]: '父菜单不存在',
  [BizCode.MENU_HAS_CHILDREN]: '菜单存在子菜单，无法删除',
  [BizCode.ROLE_NOT_FOUND]: '角色不存在',
  [BizCode.ROLE_ALREADY_EXISTS]: '角色名称已存在',
  [BizCode.DICT_TYPE_NOT_FOUND]: '字典类型不存在',
  [BizCode.DICT_TYPE_ALREADY_EXISTS]: '字典类型编码已存在',
  [BizCode.DICT_VALUE_NOT_FOUND]: '字典值不存在',
  [BizCode.DICT_VALUE_ALREADY_EXISTS]: '字典值编码在该类型下已存在',
  [BizCode.FILE_NOT_FOUND]: '文件不存在',
  [BizCode.FILE_UPLOAD_FAILED]: '文件上传失败',
  [BizCode.FILE_TYPE_NOT_ALLOWED]: '不支持的文件类型',
  [BizCode.FILE_SIZE_EXCEEDED]: '文件大小超出限制',
  [BizCode.SCREEN_NOT_FOUND]: '大屏项目不存在',
  [BizCode.SCREEN_NAME_EXISTS]: '大屏项目名称已存在',
  [BizCode.SCREEN_PUBLISH_FAILED]: '大屏发布失败',
};

// 业务异常类
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

// 类型守卫
export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError;
}

// 根据业务码获取默认消息
export function getBizMessage(code: number, fallback?: string): string {
  return BizMessage[code] ?? fallback ?? '未知错误';
}
