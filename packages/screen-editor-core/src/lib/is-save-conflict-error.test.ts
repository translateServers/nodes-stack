import { describe, expect, it } from 'vitest';
import { BizCode, BusinessError } from '@nebula/shared';
import { isSaveConflictError } from './is-save-conflict-error';

describe('isSaveConflictError', () => {
  describe('保存冲突业务错误', () => {
    it('bizCode 为 SCREEN_SAVE_CONFLICT 的业务错误返回 true', () => {
      const error = new BusinessError(
        BizCode.SCREEN_SAVE_CONFLICT,
        '项目已被其他会话修改，请重新加载后再保存',
      );

      expect(isSaveConflictError(error)).toBe(true);
    });

    it('带 details 的保存冲突业务错误仍返回 true', () => {
      const error = new BusinessError(
        BizCode.SCREEN_SAVE_CONFLICT,
        '项目已被其他会话修改，请重新加载后再保存',
        ['expectedUpdatedAt 不匹配'],
      );

      expect(isSaveConflictError(error)).toBe(true);
    });

    it('不依赖错误消息文本：消息为空时仍按业务码识别', () => {
      const error = new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '');

      expect(isSaveConflictError(error)).toBe(true);
    });
  });

  describe('普通 409 业务错误', () => {
    it('bizCode 为 SCREEN_NAME_EXISTS 的业务错误返回 false', () => {
      const error = new BusinessError(BizCode.SCREEN_NAME_EXISTS, '大屏项目名称已存在');

      expect(isSaveConflictError(error)).toBe(false);
    });

    it('其他同样映射到 409 的业务错误返回 false', () => {
      const error = new BusinessError(BizCode.MENU_ALREADY_EXISTS, '菜单名称已存在');

      expect(isSaveConflictError(error)).toBe(false);
    });

    it('普通非冲突业务错误（如 NOT_FOUND）返回 false', () => {
      const error = new BusinessError(BizCode.SCREEN_NOT_FOUND, '大屏项目不存在');

      expect(isSaveConflictError(error)).toBe(false);
    });
  });

  describe('非业务错误', () => {
    it('网络错误（普通 Error）返回 false', () => {
      const error = new Error('网络异常');

      expect(isSaveConflictError(error)).toBe(false);
    });

    it('AxiosError 形态的网络错误返回 false', () => {
      const error = {
        name: 'AxiosError',
        message: 'Request failed with status code 500',
        code: 'ERR_NETWORK',
        response: { status: 500, data: { code: -1, message: '网络异常' } },
      };

      expect(isSaveConflictError(error)).toBe(false);
    });
  });

  describe('未知错误', () => {
    it('普通对象返回 false', () => {
      const error = { code: BizCode.SCREEN_SAVE_CONFLICT, message: '伪冲突' };

      expect(isSaveConflictError(error)).toBe(false);
    });

    it('字符串返回 false', () => {
      expect(isSaveConflictError('SCREEN_SAVE_CONFLICT')).toBe(false);
    });

    it('数字返回 false', () => {
      expect(isSaveConflictError(BizCode.SCREEN_SAVE_CONFLICT)).toBe(false);
    });

    it('Symbol 返回 false', () => {
      expect(isSaveConflictError(Symbol('conflict'))).toBe(false);
    });
  });

  describe('null/undefined', () => {
    it('null 返回 false', () => {
      expect(isSaveConflictError(null)).toBe(false);
    });

    it('undefined 返回 false', () => {
      expect(isSaveConflictError(undefined)).toBe(false);
    });
  });
});
