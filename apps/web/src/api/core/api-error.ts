import { toast } from 'sonner';
import { BizCode } from '@nebula/shared';
import { BusinessError, getBizMessage, isBusinessError } from '@nebula/shared/errors';

export type ApiErrorSeverity = 'error' | 'warning';

const notifiedErrors = new WeakSet<object>();

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function emitApiError(error: unknown, severity: ApiErrorSeverity = 'error'): void {
  if (isObject(error)) {
    if (notifiedErrors.has(error)) {
      return;
    }
    notifiedErrors.add(error);
  }

  // SCREEN_SAVE_CONFLICT 由保存冲突对话框（任务 9.3）处理，不显示全局 Toast
  if (isBusinessError(error) && error.code === BizCode.SCREEN_SAVE_CONFLICT) {
    return;
  }

  const message = isBusinessError(error)
    ? error.message || getBizMessage(error.code)
    : '请求失败，请稍后重试';

  if (severity === 'warning') {
    toast.warning(message);
  } else {
    toast.error(message);
  }
}

export { BusinessError };
