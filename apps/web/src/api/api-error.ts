import { BusinessError, getBizMessage, isBusinessError } from '@nebula/shared';

export type ApiErrorEventDetail = {
  message: string;
  code?: number;
  severity?: 'error' | 'warning';
};

const API_ERROR_EVENT = 'nebula:api-error';

export function emitApiError(
  error: unknown,
  severity: ApiErrorEventDetail['severity'] = 'error',
): void {
  const detail: ApiErrorEventDetail = isBusinessError(error)
    ? { code: error.code, message: error.message || getBizMessage(error.code), severity }
    : { message: '请求失败，请稍后重试', severity };

  window.dispatchEvent(new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, { detail }));
}

export function listenApiError(listener: (detail: ApiErrorEventDetail) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ApiErrorEventDetail>;
    listener(customEvent.detail);
  };

  window.addEventListener(API_ERROR_EVENT, handler);
  return () => window.removeEventListener(API_ERROR_EVENT, handler);
}

export { BusinessError };
