import { describe, it, expect } from 'vitest';
import {
  DataSourceConfigSchema,
  ScreenComponentSchema,
  isSensitiveHeaderKey,
} from './screen.schema.js';

describe('DataSourceConfigSchema', () => {
  it('should reject invalid type', () => {
    expect(() => DataSourceConfigSchema.parse({ type: 'websocket' })).toThrow();
  });

  it('should reject POST API configuration because only GET is supported', () => {
    expect(() =>
      DataSourceConfigSchema.parse({
        type: 'api',
        apiConfig: { url: 'https://example.com/api', method: 'POST' },
      }),
    ).toThrow();
  });

  it('should reject API data source without apiConfig', () => {
    expect(() => DataSourceConfigSchema.parse({ type: 'api' })).toThrow();
  });

  it('should reject static data source without staticData', () => {
    expect(() => DataSourceConfigSchema.parse({ type: 'static' })).toThrow();
  });

  it('should preserve inactive source configuration for type switching', () => {
    const data = {
      type: 'api' as const,
      staticData: [{ name: 'A', value: 1 }],
      apiConfig: { url: 'https://example.com/api', method: 'GET' as const },
    };
    expect(DataSourceConfigSchema.parse(data)).toEqual(data);
  });
});

describe('ScreenComponentSchema - bar-chart superRefine', () => {
  const baseComponent = {
    id: 'c1',
    type: 'bar-chart',
    name: '柱状图',
    position: { x: 0, y: 0, width: 400, height: 300 },
    style: {},
    props: { data: [{ name: 'A', value: 1 }] },
    status: { locked: false, hidden: false },
    zIndex: 1,
  };

  it('should reject invalid bar-chart visual props', () => {
    const data = {
      ...baseComponent,
      props: { title: 123 },
    };
    expect(() => ScreenComponentSchema.parse(data)).toThrow();
  });

  it('should keep generic props validation for other component types', () => {
    const data = {
      ...baseComponent,
      type: 'text',
      props: { title: 123 },
    };
    expect(ScreenComponentSchema.parse(data).props).toEqual({ title: 123 });
  });
});

describe('isSensitiveHeaderKey', () => {
  it('should detect authorization (lowercase)', () => {
    expect(isSensitiveHeaderKey('authorization')).toBe(true);
  });

  it('should detect Authorization (mixed case)', () => {
    expect(isSensitiveHeaderKey('Authorization')).toBe(true);
  });

  it('should detect AUTHORIZATION (uppercase)', () => {
    expect(isSensitiveHeaderKey('AUTHORIZATION')).toBe(true);
  });

  it('should detect cookie', () => {
    expect(isSensitiveHeaderKey('cookie')).toBe(true);
    expect(isSensitiveHeaderKey('Cookie')).toBe(true);
  });

  it('should detect x-api-key', () => {
    expect(isSensitiveHeaderKey('x-api-key')).toBe(true);
    expect(isSensitiveHeaderKey('X-API-Key')).toBe(true);
  });

  it('should detect x-auth-token', () => {
    expect(isSensitiveHeaderKey('x-auth-token')).toBe(true);
  });

  it('should detect proxy-authorization', () => {
    expect(isSensitiveHeaderKey('proxy-authorization')).toBe(true);
  });

  it('should not detect content-type', () => {
    expect(isSensitiveHeaderKey('content-type')).toBe(false);
  });

  it('should not detect accept', () => {
    expect(isSensitiveHeaderKey('accept')).toBe(false);
  });

  it('should not detect empty string', () => {
    expect(isSensitiveHeaderKey('')).toBe(false);
  });

  it('should not detect x-custom-header', () => {
    expect(isSensitiveHeaderKey('x-custom-header')).toBe(false);
  });
});
