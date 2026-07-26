/**
 * GlobalVariableSchema 测试（Task 8.6）
 *
 * 验证点：
 * - static / api / computed 三种类型的完整解析
 * - api 类型的 method / refreshInterval 默认值
 * - 缺失必填字段（id / name / type）应失败
 * - type 枚举值校验（非法值应失败）
 */

import { describe, it, expect } from 'vitest';
import {
  GlobalVariableSchema,
  GlobalVariableTypeSchema,
  GlobalVariableApiConfigSchema,
} from './global-variable.schema.js';

describe('GlobalVariableSchema - static 类型', () => {
  it('完整解析 static 类型变量', () => {
    const data = {
      id: 'v1',
      name: 'apiBaseUrl',
      type: 'static' as const,
      value: 'https://api.example.com',
      description: 'API 基址',
    };
    expect(GlobalVariableSchema.parse(data)).toEqual(data);
  });

  it('static 类型允许 value 为任意类型（对象/数组/数字）', () => {
    expect(
      GlobalVariableSchema.parse({
        id: 'v1',
        name: 'themeColor',
        type: 'static',
        value: { primary: '#fff', secondary: '#000' },
      }).value,
    ).toEqual({ primary: '#fff', secondary: '#000' });

    expect(
      GlobalVariableSchema.parse({
        id: 'v2',
        name: 'maxRetries',
        type: 'static',
        value: 3,
      }).value,
    ).toBe(3);
  });

  it('static 类型可省略 value', () => {
    const parsed = GlobalVariableSchema.parse({
      id: 'v1',
      name: 'emptyVar',
      type: 'static',
    });
    expect(parsed.value).toBeUndefined();
  });
});

describe('GlobalVariableSchema - api 类型', () => {
  it('完整解析 api 类型变量', () => {
    const data = {
      id: 'v1',
      name: 'token',
      type: 'api' as const,
      apiConfig: {
        url: 'https://auth.example.com/token',
        method: 'POST' as const,
        headers: { 'Content-Type': 'application/json' },
        refreshInterval: 60000,
      },
    };
    expect(GlobalVariableSchema.parse(data)).toEqual(data);
  });

  it('apiConfig.method 默认为 GET', () => {
    const parsed = GlobalVariableApiConfigSchema.parse({
      url: 'https://example.com/data',
    });
    expect(parsed.method).toBe('GET');
  });

  it('apiConfig.refreshInterval 默认为 0', () => {
    const parsed = GlobalVariableApiConfigSchema.parse({
      url: 'https://example.com/data',
    });
    expect(parsed.refreshInterval).toBe(0);
  });

  it('apiConfig.url 为空字符串应失败', () => {
    expect(() =>
      GlobalVariableApiConfigSchema.parse({
        url: '',
      }),
    ).toThrow();
  });

  it('apiConfig.method 非 GET/POST 应失败', () => {
    expect(() =>
      GlobalVariableApiConfigSchema.parse({
        url: 'https://example.com',
        method: 'PUT',
      }),
    ).toThrow();
  });
});

describe('GlobalVariableSchema - computed 类型', () => {
  it('完整解析 computed 类型变量', () => {
    const data = {
      id: 'v1',
      name: 'totalAmount',
      type: 'computed' as const,
      expression: 'a + b',
      description: '两个变量之和',
    };
    expect(GlobalVariableSchema.parse(data)).toEqual(data);
  });

  it('computed 类型可省略 expression', () => {
    const parsed = GlobalVariableSchema.parse({
      id: 'v1',
      name: 'placeholder',
      type: 'computed',
    });
    expect(parsed.expression).toBeUndefined();
  });
});

describe('GlobalVariableSchema - 必填字段校验', () => {
  it('缺失 id 应失败', () => {
    expect(() =>
      GlobalVariableSchema.parse({
        name: 'v',
        type: 'static',
      }),
    ).toThrow();
  });

  it('缺失 name 应失败', () => {
    expect(() =>
      GlobalVariableSchema.parse({
        id: 'v1',
        type: 'static',
      }),
    ).toThrow();
  });

  it('缺失 type 应失败', () => {
    expect(() =>
      GlobalVariableSchema.parse({
        id: 'v1',
        name: 'v',
      }),
    ).toThrow();
  });

  it('id 为空字符串应失败', () => {
    expect(() =>
      GlobalVariableSchema.parse({
        id: '',
        name: 'v',
        type: 'static',
      }),
    ).toThrow();
  });

  it('name 为空字符串应失败', () => {
    expect(() =>
      GlobalVariableSchema.parse({
        id: 'v1',
        name: '',
        type: 'static',
      }),
    ).toThrow();
  });
});

describe('GlobalVariableTypeSchema - 枚举校验', () => {
  it('合法枚举值通过', () => {
    expect(GlobalVariableTypeSchema.parse('static')).toBe('static');
    expect(GlobalVariableTypeSchema.parse('api')).toBe('api');
    expect(GlobalVariableTypeSchema.parse('computed')).toBe('computed');
  });

  it('非法枚举值应失败', () => {
    expect(() => GlobalVariableTypeSchema.parse('websocket')).toThrow();
    expect(() => GlobalVariableTypeSchema.parse('STATIC')).toThrow();
    expect(() => GlobalVariableTypeSchema.parse('')).toThrow();
  });
});
