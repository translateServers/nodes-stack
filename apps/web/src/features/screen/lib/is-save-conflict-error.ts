import { BizCode, isBusinessError } from '@nebula/shared';

/**
 * 判断给定的错误是否为大屏保存/发布冲突错误。
 *
 * 仅依据专用业务码 `BizCode.SCREEN_SAVE_CONFLICT` 判定，
 * 不依赖错误消息文本，以保证识别稳定。
 *
 * @param error 任意错误值
 * @returns 当 error 为业务错误且 bizCode 等于 SCREEN_SAVE_CONFLICT 时返回 true，否则返回 false
 */
export function isSaveConflictError(error: unknown): boolean {
  return isBusinessError(error) && error.code === BizCode.SCREEN_SAVE_CONFLICT;
}
