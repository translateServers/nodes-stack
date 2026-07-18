import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BizCode, BusinessError, getBizMessage } from '@nebula/shared';
import { emitApiError } from './api-error';

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

// notifiedErrors 是模块级 WeakSet 且无清空 API。
// 由于每个用例都创建新的错误对象，WeakSet 中残留的旧引用不会干扰新用例的去重判定，
// 因此无需 resetModules；保持静态 import 即可确保 BusinessError 与 isBusinessError 共用同一类。
describe('emitApiError', () => {
  beforeEach(() => {
    toastMock.error.mockClear();
    toastMock.warning.mockClear();
  });

  describe('SCREEN_SAVE_CONFLICT 特例', () => {
    it('不显示全局 Toast（由 save-conflict-dialog 处理）', () => {
      const error = new BusinessError(
        BizCode.SCREEN_SAVE_CONFLICT,
        '项目已被其他会话修改，请重新加载后再保存',
      );
      emitApiError(error);
      expect(toastMock.error).not.toHaveBeenCalled();
      expect(toastMock.warning).not.toHaveBeenCalled();
    });

    it('带 details 的 SCREEN_SAVE_CONFLICT 仍不显示 Toast', () => {
      const error = new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '冲突', [
        'expectedUpdatedAt 不匹配',
      ]);
      emitApiError(error);
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it('message 为空的 SCREEN_SAVE_CONFLICT 仍不显示 Toast（按业务码识别）', () => {
      const error = new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '');
      emitApiError(error);
      expect(toastMock.error).not.toHaveBeenCalled();
    });
  });

  describe('普通 BusinessError', () => {
    it('使用 error.message 调用 toast.error', () => {
      emitApiError(new BusinessError(BizCode.NOT_FOUND, '资源不存在'));
      expect(toastMock.error).toHaveBeenCalledWith('资源不存在');
    });

    it('message 为空字符串时回退到 getBizMessage', () => {
      emitApiError(new BusinessError(BizCode.NOT_FOUND, ''));
      expect(toastMock.error).toHaveBeenCalledWith(getBizMessage(BizCode.NOT_FOUND));
    });
  });

  describe('非 BusinessError 错误', () => {
    it('普通 Error 使用默认文案调用 toast.error', () => {
      emitApiError(new Error('网络异常'));
      expect(toastMock.error).toHaveBeenCalledWith('请求失败，请稍后重试');
    });

    it('字符串错误使用默认文案调用 toast.error', () => {
      emitApiError('some string error');
      expect(toastMock.error).toHaveBeenCalledWith('请求失败，请稍后重试');
    });

    it('null 使用默认文案调用 toast.error', () => {
      emitApiError(null);
      expect(toastMock.error).toHaveBeenCalledWith('请求失败，请稍后重试');
    });

    it('undefined 使用默认文案调用 toast.error', () => {
      emitApiError(undefined);
      expect(toastMock.error).toHaveBeenCalledWith('请求失败，请稍后重试');
    });
  });

  describe('severity 参数', () => {
    it('severity="warning" 调用 toast.warning', () => {
      emitApiError(new Error('警告'), 'warning');
      expect(toastMock.warning).toHaveBeenCalledWith('请求失败，请稍后重试');
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it('默认 severity="error" 调用 toast.error', () => {
      emitApiError(new Error('错误'));
      expect(toastMock.error).toHaveBeenCalled();
      expect(toastMock.warning).not.toHaveBeenCalled();
    });
  });

  describe('并发错误去重（WeakSet）', () => {
    it('同一对象第二次调用不再显示 Toast', () => {
      const error = new BusinessError(BizCode.NOT_FOUND, '资源不存在');
      emitApiError(error);
      emitApiError(error);
      emitApiError(error);
      expect(toastMock.error).toHaveBeenCalledTimes(1);
    });

    it('不同对象（即使内容相同）每次都显示 Toast', () => {
      const err1 = new BusinessError(BizCode.NOT_FOUND, '资源不存在');
      const err2 = new BusinessError(BizCode.NOT_FOUND, '资源不存在');
      emitApiError(err1);
      emitApiError(err2);
      expect(toastMock.error).toHaveBeenCalledTimes(2);
    });

    it('SCREEN_SAVE_CONFLICT 重复调用仍不显示 Toast（去重先行返回）', () => {
      const error = new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '冲突');
      emitApiError(error);
      emitApiError(error);
      expect(toastMock.error).not.toHaveBeenCalled();
    });

    it('非对象错误（字符串/null）不进入去重，每次都显示 Toast', () => {
      emitApiError('err');
      emitApiError('err');
      emitApiError(null);
      emitApiError(null);
      expect(toastMock.error).toHaveBeenCalledTimes(4);
    });
  });
});
