import { describe, it, expect } from 'vitest';
import { BizCode, getHttpStatus, type BizCodeValue } from '../types/api.types.js';
import { BizMessage, BusinessError, getBizMessage, isBusinessError } from './index.js';

describe('BizCode', () => {
  it('SCREEN_SAVE_CONFLICT 应紧接现有 screen 码使用 70004', () => {
    expect(BizCode.SCREEN_SAVE_CONFLICT).toBe(70004);
    expect(BizCode.SCREEN_SAVE_CONFLICT).toBe(BizCode.SCREEN_PUBLISH_FAILED + 1);
  });

  it('SCREEN_SAVE_CONFLICT 不与现有 screen 码冲突', () => {
    const screenCodes = [
      BizCode.SCREEN_NOT_FOUND,
      BizCode.SCREEN_NAME_EXISTS,
      BizCode.SCREEN_PUBLISH_FAILED,
    ];
    expect(screenCodes).not.toContain(BizCode.SCREEN_SAVE_CONFLICT);
  });
});

describe('BizMessage', () => {
  it('SCREEN_SAVE_CONFLICT 应有独立中文消息', () => {
    expect(BizMessage[BizCode.SCREEN_SAVE_CONFLICT]).toBe(
      '项目已被其他会话修改，请重新加载后再保存',
    );
  });

  it('SCREEN_SAVE_CONFLICT 消息不复用 SCREEN_NAME_EXISTS 文案', () => {
    expect(BizMessage[BizCode.SCREEN_SAVE_CONFLICT]).not.toBe(
      BizMessage[BizCode.SCREEN_NAME_EXISTS],
    );
  });

  it('getBizMessage 通过业务码返回默认消息', () => {
    expect(getBizMessage(BizCode.SCREEN_SAVE_CONFLICT)).toBe(
      '项目已被其他会话修改，请重新加载后再保存',
    );
  });

  it('getBizMessage 未知码回退到 fallback', () => {
    expect(getBizMessage(999999, '回退消息')).toBe('回退消息');
  });

  it('getBizMessage 未知码且无 fallback 回退到未知错误', () => {
    expect(getBizMessage(999999)).toBe('未知错误');
  });
});

describe('getHttpStatus', () => {
  it('SCREEN_SAVE_CONFLICT 应映射为 HTTP 409', () => {
    expect(getHttpStatus(BizCode.SCREEN_SAVE_CONFLICT)).toBe(409);
  });

  it('SCREEN_SAVE_CONFLICT 与其他 409 冲突码保持一致状态', () => {
    expect(getHttpStatus(BizCode.SCREEN_SAVE_CONFLICT)).toBe(
      getHttpStatus(BizCode.SCREEN_NAME_EXISTS),
    );
  });

  it('未知业务码回退到 500', () => {
    expect(getHttpStatus(999999 as BizCodeValue)).toBe(500);
  });
});

describe('BusinessError', () => {
  it('可通过 SCREEN_SAVE_CONFLICT 构造业务异常', () => {
    const error = new BusinessError(
      BizCode.SCREEN_SAVE_CONFLICT,
      BizMessage[BizCode.SCREEN_SAVE_CONFLICT],
    );
    expect(isBusinessError(error)).toBe(true);
    expect(error.code).toBe(BizCode.SCREEN_SAVE_CONFLICT);
    expect(error.message).toBe('项目已被其他会话修改，请重新加载后再保存');
    expect(error.name).toBe('BusinessError');
  });

  it('isBusinessError 对非 BusinessError 返回 false', () => {
    expect(isBusinessError(new Error('普通错误'))).toBe(false);
    expect(isBusinessError(null)).toBe(false);
    expect(isBusinessError(undefined)).toBe(false);
  });
});
