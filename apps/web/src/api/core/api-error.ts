import { toast } from 'sonner';
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
