/**
 * requestApi 脱敏工具测试（任务 10.4）
 *
 * 验证点：
 * - maskHeaders：命中 secretHeaderKeys 的 header 值替换为 ***
 * - maskUrlQuery：URL query 参数脱敏
 * - maskJsonBody：JSON body 字段递归脱敏；非 JSON 原样返回
 * - maskRequestForLog：组合脱敏
 * - 不修改输入
 * - 大小写不敏感
 */

import { describe, expect, it } from 'vitest';
import {
  SECRET_MASK,
  maskHeaders,
  maskJsonBody,
  maskRequestForLog,
  maskUrlQuery,
} from './request-api-mask';

describe('maskHeaders', () => {
  it('命中 secretHeaderKeys 的键值替换为 ***', () => {
    const result = maskHeaders(
      { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      ['Authorization'],
    );
    expect(result.Authorization).toBe(SECRET_MASK);
    expect(result['Content-Type']).toBe('application/json');
  });

  it('大小写不敏感匹配', () => {
    const result = maskHeaders({ authorization: 'Bearer token', AUTHORIZATION: 'Bearer token2' }, [
      'Authorization',
    ]);
    expect(result.authorization).toBe(SECRET_MASK);
    expect(result.AUTHORIZATION).toBe(SECRET_MASK);
  });

  it('不修改输入 headers', () => {
    const original = { Authorization: 'Bearer token', 'X-Custom': 'value' };
    maskHeaders(original, ['Authorization']);
    expect(original.Authorization).toBe('Bearer token');
    expect(original['X-Custom']).toBe('value');
  });

  it('空 secretHeaderKeys 不脱敏', () => {
    const result = maskHeaders({ Authorization: 'Bearer token' }, []);
    expect(result.Authorization).toBe('Bearer token');
  });

  it('多个 secret 键全部脱敏', () => {
    const result = maskHeaders(
      { Authorization: 'token', 'X-API-Key': 'key', 'Content-Type': 'json' },
      ['Authorization', 'X-API-Key'],
    );
    expect(result.Authorization).toBe(SECRET_MASK);
    expect(result['X-API-Key']).toBe(SECRET_MASK);
    expect(result['Content-Type']).toBe('json');
  });
});

describe('maskUrlQuery', () => {
  it('命中参数键的值替换为 ***', () => {
    const result = maskUrlQuery('https://api.example.com/data?token=secret&page=1', ['token']);
    expect(result).toBe('https://api.example.com/data?token=***&page=1');
  });

  it('大小写不敏感', () => {
    const result = maskUrlQuery('https://api.example.com/?TOKEN=secret', ['token']);
    expect(result).toBe('https://api.example.com/?TOKEN=***');
  });

  it('保留 hash 部分', () => {
    const result = maskUrlQuery('https://api.example.com/?token=secret#section', ['token']);
    expect(result).toBe('https://api.example.com/?token=***#section');
  });

  it('无 query 参数的 URL 原样返回', () => {
    const result = maskUrlQuery('https://api.example.com/data', ['token']);
    expect(result).toBe('https://api.example.com/data');
  });

  it('空 secretKeys 原样返回', () => {
    const result = maskUrlQuery('https://api.example.com/?token=secret', []);
    expect(result).toBe('https://api.example.com/?token=secret');
  });

  it('多参数全部脱敏', () => {
    const result = maskUrlQuery('https://api.example.com/?token=t&key=k&name=n', ['token', 'key']);
    expect(result).toBe('https://api.example.com/?token=***&key=***&name=n');
  });

  it('无等号的参数保留', () => {
    const result = maskUrlQuery('https://api.example.com/?flag&token=secret', ['token']);
    expect(result).toBe('https://api.example.com/?flag&token=***');
  });
});

describe('maskJsonBody', () => {
  it('JSON 对象字段递归脱敏', () => {
    const body = JSON.stringify({ token: 'secret', name: 'foo', nested: { password: 'p' } });
    const result = maskJsonBody(body, ['token', 'password']);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.token).toBe(SECRET_MASK);
    expect(parsed.name).toBe('foo');
    expect((parsed.nested as Record<string, unknown>).password).toBe(SECRET_MASK);
  });

  it('数组元素递归脱敏', () => {
    const body = JSON.stringify([{ token: 't1' }, { token: 't2' }]);
    const result = maskJsonBody(body, ['token']);
    const parsed = JSON.parse(result) as Array<Record<string, unknown>>;
    expect(parsed[0]!.token).toBe(SECRET_MASK);
    expect(parsed[1]!.token).toBe(SECRET_MASK);
  });

  it('大小写不敏感', () => {
    const body = JSON.stringify({ TOKEN: 'secret' });
    const result = maskJsonBody(body, ['token']);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.TOKEN).toBe(SECRET_MASK);
  });

  it('非 JSON body 原样返回', () => {
    const result = maskJsonBody('not-json-content', ['token']);
    expect(result).toBe('not-json-content');
  });

  it('空 body 原样返回', () => {
    expect(maskJsonBody('', ['token'])).toBe('');
  });

  it('空 secretKeys 原样返回', () => {
    const body = JSON.stringify({ token: 'secret' });
    expect(maskJsonBody(body, [])).toBe(body);
  });

  it('嵌套数组与对象混合', () => {
    const body = JSON.stringify({
      list: [{ token: 'a' }, { other: 'b' }],
      meta: { secret: 's' },
    });
    const result = maskJsonBody(body, ['token', 'secret']);
    const parsed = JSON.parse(result) as {
      list: Array<Record<string, unknown>>;
      meta: Record<string, unknown>;
    };
    expect(parsed.list[0]!.token).toBe(SECRET_MASK);
    expect(parsed.list[1]!.other).toBe('b');
    expect(parsed.meta.secret).toBe(SECRET_MASK);
  });
});

describe('maskRequestForLog', () => {
  it('组合脱敏 headers + url + body', () => {
    const result = maskRequestForLog({
      url: 'https://api.example.com/?token=secret&page=1',
      headers: { Authorization: 'Bearer token' },
      body: JSON.stringify({ password: 'p', name: 'foo' }),
      secretHeaderKeys: ['Authorization', 'token', 'password'],
    });
    expect(result.url).toBe('https://api.example.com/?token=***&page=1');
    expect(result.headers.Authorization).toBe(SECRET_MASK);
    const parsed = JSON.parse(result.body) as Record<string, unknown>;
    expect(parsed.password).toBe(SECRET_MASK);
    expect(parsed.name).toBe('foo');
  });

  it('不修改输入参数', () => {
    const params = {
      url: 'https://api.example.com/?token=secret',
      headers: { Authorization: 'Bearer token' },
      body: JSON.stringify({ password: 'p' }),
      secretHeaderKeys: ['Authorization', 'token', 'password'],
    };
    const originalUrl = params.url;
    const originalHeaders = { ...params.headers };
    const originalBody = params.body;
    maskRequestForLog(params);
    expect(params.url).toBe(originalUrl);
    expect(params.headers.Authorization).toBe(originalHeaders.Authorization);
    expect(params.body).toBe(originalBody);
  });
});

describe('SECRET_MASK 常量', () => {
  it('值为 ***', () => {
    expect(SECRET_MASK).toBe('***');
  });
});
