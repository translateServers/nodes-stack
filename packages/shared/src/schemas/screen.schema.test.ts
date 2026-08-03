import { describe, it, expect } from 'vitest';
import {
  ComponentStyleSchema,
  DataSourceConfigSchema,
  EMPTY_SCREEN_DOCUMENT,
  ScreenDocumentSchema,
  ScreenComponentSchema,
  UpdateScreenProjectSchema,
  isSensitiveHeaderKey,
} from './screen.schema.js';

function canonicalDocument(overrides: Record<string, unknown> = {}) {
  return {
    ...EMPTY_SCREEN_DOCUMENT,
    canvas: { ...EMPTY_SCREEN_DOCUMENT.canvas },
    components: [
      {
        id: 'metric-1',
        type: 'nebula.metric/v1',
        name: 'Metric',
        position: { x: 0, y: 0, width: 240, height: 100 },
        style: {},
        props: { title: 'CPU' },
        status: { locked: false, hidden: false },
        zIndex: 1,
      },
    ],
    ...overrides,
  };
}

describe('ScreenDocumentSchema', () => {
  it('accepts only the canonical marker and strict document shape', () => {
    expect(ScreenDocumentSchema.safeParse(canonicalDocument()).success).toBe(true);
    expect(
      ScreenDocumentSchema.safeParse({ ...canonicalDocument(), schemaVersion: 2 }).success,
    ).toBe(false);
    expect(
      ScreenDocumentSchema.safeParse({ ...canonicalDocument(), legacyDocument: true }).success,
    ).toBe(false);
  });

  it('rejects legacy data sources and component fields instead of stripping them', () => {
    const component = canonicalDocument().components[0];
    expect(
      ScreenDocumentSchema.safeParse({
        ...canonicalDocument(),
        components: [
          {
            ...component,
            dataSource: { type: 'api', apiConfig: { url: 'https://example.com', method: 'GET' } },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ScreenDocumentSchema.safeParse({
        ...canonicalDocument(),
        components: [{ ...component, logic: { limit: 5 } }],
      }).success,
    ).toBe(false);
  });

  it('does not strip unknown blueprint fields', () => {
    expect(
      ScreenDocumentSchema.safeParse({
        ...canonicalDocument(),
        blueprint: {
          version: 2,
          nodes: [
            {
              id: 'node-1',
              kind: 'component',
              position: { x: 0, y: 0 },
              componentId: 'metric-1',
              injected: true,
            },
          ],
          edges: [],
        },
      }).success,
    ).toBe(false);
  });

  it('rejects URI resource ids and forbidden nested request keys', () => {
    const component = canonicalDocument().components[0];
    expect(
      ScreenDocumentSchema.safeParse({
        ...canonicalDocument(),
        components: [
          {
            ...component,
            dataSource: {
              type: 'host-resource',
              resourceType: 'metric',
              resourceId: 'https://evil.test',
            },
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      ScreenDocumentSchema.safeParse({
        ...canonicalDocument(),
        components: [
          {
            ...component,
            dataSource: {
              type: 'host-resource',
              resourceType: 'metric',
              resourceId: 'dataset-1',
              params: { nested: { Headers: { Authorization: 'secret' } } },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('UpdateScreenProjectSchema', () => {
  it('distinguishes omitted metadata from explicit null clearing and accepts only full documents', () => {
    expect(
      UpdateScreenProjectSchema.safeParse({ expectedUpdatedAt: '2026-08-03 00:00:00' }).success,
    ).toBe(true);
    expect(
      UpdateScreenProjectSchema.safeParse({
        expectedUpdatedAt: '2026-08-03 00:00:00',
        description: null,
        thumbnail: null,
        document: canonicalDocument(),
      }).success,
    ).toBe(true);
    expect(
      UpdateScreenProjectSchema.safeParse({
        expectedUpdatedAt: '2026-08-03 00:00:00',
        canvas: EMPTY_SCREEN_DOCUMENT.canvas,
      }).success,
    ).toBe(false);
  });
});

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

describe('ComponentStyleSchema - filter', () => {
  it('filter 缺失时为 undefined（不应用默认对象）', () => {
    const style = ComponentStyleSchema.parse({});
    expect(style.filter).toBeUndefined();
  });

  it('filter 显式为 undefined 时为 undefined', () => {
    const style = ComponentStyleSchema.parse({ filter: undefined });
    expect(style.filter).toBeUndefined();
  });

  it('filter 空对象时使用各字段默认值（hueRotate=0, saturate=100, brightness=100, contrast=100, blur=0, grayscale=0）', () => {
    const style = ComponentStyleSchema.parse({ filter: {} });
    expect(style.filter).toEqual({
      hueRotate: 0,
      saturate: 100,
      brightness: 100,
      contrast: 100,
      blur: 0,
      grayscale: 0,
    });
  });

  it('filter 部分字段缺失时其余字段使用默认值', () => {
    const style = ComponentStyleSchema.parse({
      filter: { hueRotate: 90, blur: 5 },
    });
    expect(style.filter).toEqual({
      hueRotate: 90,
      saturate: 100,
      brightness: 100,
      contrast: 100,
      blur: 5,
      grayscale: 0,
    });
  });

  it('完整 filter 对象解析（所有字段非默认值）', () => {
    const filter = {
      hueRotate: 180,
      saturate: 150,
      brightness: 80,
      contrast: 120,
      blur: 3.5,
      grayscale: 50,
    };
    const style = ComponentStyleSchema.parse({ filter });
    expect(style.filter).toEqual(filter);
  });

  describe('边界值校验', () => {
    it('hueRotate 超过 360 应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { hueRotate: 361 } })).toThrow();
    });

    it('hueRotate 为负数应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { hueRotate: -1 } })).toThrow();
    });

    it('hueRotate 边界 0/360 通过', () => {
      expect(ComponentStyleSchema.parse({ filter: { hueRotate: 0 } }).filter?.hueRotate).toBe(0);
      expect(ComponentStyleSchema.parse({ filter: { hueRotate: 360 } }).filter?.hueRotate).toBe(
        360,
      );
    });

    it('saturate 为负数应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { saturate: -1 } })).toThrow();
    });

    it('saturate 超过 200 应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { saturate: 201 } })).toThrow();
    });

    it('brightness 超过 200 应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { brightness: 201 } })).toThrow();
    });

    it('contrast 超过 200 应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { contrast: 201 } })).toThrow();
    });

    it('blur 为负数应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { blur: -0.1 } })).toThrow();
    });

    it('blur 超过 20 应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { blur: 20.1 } })).toThrow();
    });

    it('blur 边界 0/20 通过', () => {
      expect(ComponentStyleSchema.parse({ filter: { blur: 0 } }).filter?.blur).toBe(0);
      expect(ComponentStyleSchema.parse({ filter: { blur: 20 } }).filter?.blur).toBe(20);
    });

    it('grayscale 为负数应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { grayscale: -1 } })).toThrow();
    });

    it('grayscale 超过 100 应失败', () => {
      expect(() => ComponentStyleSchema.parse({ filter: { grayscale: 101 } })).toThrow();
    });
  });

  it('filter 通过 ScreenComponentSchema 嵌套解析', () => {
    const component = ScreenComponentSchema.parse({
      id: 'c1',
      type: 'rect',
      name: '矩形',
      position: { x: 0, y: 0, width: 100, height: 100 },
      style: { filter: { brightness: 50, blur: 2 } },
      props: {},
      status: { locked: false, hidden: false },
      zIndex: 0,
    });
    expect(component.style.filter).toEqual({
      hueRotate: 0,
      saturate: 100,
      brightness: 50,
      contrast: 100,
      blur: 2,
      grayscale: 0,
    });
  });
});

describe('ComponentStyleSchema - Task 7 文本细化字段', () => {
  it('letterSpacing/textStrokeWidth/textStrokeColor 缺失时为 undefined', () => {
    const style = ComponentStyleSchema.parse({});
    expect(style.letterSpacing).toBeUndefined();
    expect(style.textStrokeWidth).toBeUndefined();
    expect(style.textStrokeColor).toBeUndefined();
  });

  it('letterSpacing 解析正数与负数（CSS letter-spacing 允许负值）', () => {
    expect(ComponentStyleSchema.parse({ letterSpacing: 2 }).letterSpacing).toBe(2);
    expect(ComponentStyleSchema.parse({ letterSpacing: -1.5 }).letterSpacing).toBe(-1.5);
    expect(ComponentStyleSchema.parse({ letterSpacing: 0 }).letterSpacing).toBe(0);
  });

  it('textStrokeWidth 解析非负数，0 为合法边界', () => {
    expect(ComponentStyleSchema.parse({ textStrokeWidth: 1 }).textStrokeWidth).toBe(1);
    expect(ComponentStyleSchema.parse({ textStrokeWidth: 0 }).textStrokeWidth).toBe(0);
    expect(ComponentStyleSchema.parse({ textStrokeWidth: 0.5 }).textStrokeWidth).toBe(0.5);
  });

  it('textStrokeWidth 拒绝负数', () => {
    expect(() => ComponentStyleSchema.parse({ textStrokeWidth: -0.1 })).toThrow();
  });

  it('textStrokeColor 接受任意字符串（颜色由前端控件约束）', () => {
    expect(ComponentStyleSchema.parse({ textStrokeColor: '#000000' }).textStrokeColor).toBe(
      '#000000',
    );
    expect(ComponentStyleSchema.parse({ textStrokeColor: 'rgba(0,0,0,0.5)' }).textStrokeColor).toBe(
      'rgba(0,0,0,0.5)',
    );
  });

  it('三个字段通过 ScreenComponentSchema 嵌套解析', () => {
    const component = ScreenComponentSchema.parse({
      id: 'c1',
      type: 'text',
      name: '文本',
      position: { x: 0, y: 0, width: 200, height: 60 },
      style: { letterSpacing: 2, textStrokeWidth: 1, textStrokeColor: '#ff0000' },
      props: { content: 'hello' },
      status: { locked: false, hidden: false },
      zIndex: 0,
    });
    expect(component.style.letterSpacing).toBe(2);
    expect(component.style.textStrokeWidth).toBe(1);
    expect(component.style.textStrokeColor).toBe('#ff0000');
  });
});
