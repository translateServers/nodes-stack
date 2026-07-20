import { describe, it, expect } from 'vitest';
import {
  BarChartVisualPropsSchema,
  DataSourceConfigSchema,
  FieldMappingSchema,
  InteractionConfigSchema,
  LogicConfigSchema,
  PublishScreenProjectSchema,
  ScreenComponentSchema,
  UpdateScreenProjectSchema,
  isSensitiveHeaderKey,
} from './screen.schema.js';

describe('UpdateScreenProjectSchema', () => {
  it('should accept valid expectedUpdatedAt', () => {
    const data = { expectedUpdatedAt: '2025-06-01 10:30:45' };
    expect(UpdateScreenProjectSchema.parse(data)).toEqual(data);
  });

  it('should accept valid expectedUpdatedAt together with optional fields', () => {
    const data = {
      name: 'screen-1',
      expectedUpdatedAt: '2025-06-01 10:30:45',
    };
    expect(UpdateScreenProjectSchema.parse(data)).toEqual(data);
  });

  it('should reject missing expectedUpdatedAt', () => {
    expect(() => UpdateScreenProjectSchema.parse({})).toThrow();
  });

  it('should reject invalid datetime string (ISO format)', () => {
    expect(() =>
      UpdateScreenProjectSchema.parse({ expectedUpdatedAt: '2025-06-01T10:30:45Z' }),
    ).toThrow();
  });

  it('should reject invalid datetime string (slash format)', () => {
    expect(() =>
      UpdateScreenProjectSchema.parse({ expectedUpdatedAt: '2025/06/01 10:30:45' }),
    ).toThrow();
  });

  it('should reject empty datetime string', () => {
    expect(() => UpdateScreenProjectSchema.parse({ expectedUpdatedAt: '' })).toThrow();
  });
});

describe('PublishScreenProjectSchema', () => {
  it('should reject missing expectedUpdatedAt', () => {
    expect(() => PublishScreenProjectSchema.parse({})).toThrow();
  });

  it('should reject invalid datetime string (ISO format)', () => {
    expect(() =>
      PublishScreenProjectSchema.parse({ expectedUpdatedAt: '2025-06-01T10:30:45Z' }),
    ).toThrow();
  });

  it('should reject invalid datetime string (slash format)', () => {
    expect(() =>
      PublishScreenProjectSchema.parse({ expectedUpdatedAt: '2025/06/01 10:30:45' }),
    ).toThrow();
  });

  it('should accept valid datetime string', () => {
    const data = { expectedUpdatedAt: '2025-06-01 10:30:45' };
    expect(PublishScreenProjectSchema.parse(data)).toEqual(data);
  });

  it('should strip extra fields (canvas) by default (zod non-strict)', () => {
    const data = {
      expectedUpdatedAt: '2025-06-01 10:30:45',
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
    };
    expect(PublishScreenProjectSchema.parse(data)).toEqual({
      expectedUpdatedAt: '2025-06-01 10:30:45',
    });
  });

  it('should not accept canvas/components fields as recognized keys', () => {
    const data = {
      expectedUpdatedAt: '2025-06-01 10:30:45',
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
      components: [],
    };
    const parsed = PublishScreenProjectSchema.parse(data);
    expect(parsed).not.toHaveProperty('canvas');
    expect(parsed).not.toHaveProperty('components');
  });
});

// ===== 阶段 2：四层配置契约 =====

describe('FieldMappingSchema', () => {
  it('should accept valid field mapping', () => {
    const data = { dimension: 'city', value: 'sales' };
    expect(FieldMappingSchema.parse(data)).toEqual(data);
  });

  it('should reject empty dimension', () => {
    expect(() => FieldMappingSchema.parse({ dimension: '', value: 'sales' })).toThrow();
  });

  it('should reject empty value', () => {
    expect(() => FieldMappingSchema.parse({ dimension: 'city', value: '' })).toThrow();
  });

  it('should reject missing fields', () => {
    expect(() => FieldMappingSchema.parse({})).toThrow();
  });
});

describe('DataSourceConfigSchema', () => {
  it('should accept static data source without fieldMapping', () => {
    const data = { type: 'static' as const, staticData: [{ name: 'A', value: 1 }] };
    expect(DataSourceConfigSchema.parse(data)).toEqual(data);
  });

  it('should accept static data source with fieldMapping', () => {
    const data = {
      type: 'static' as const,
      staticData: [{ city: '北京', sales: 100 }],
      fieldMapping: { dimension: 'city', value: 'sales' },
    };
    expect(DataSourceConfigSchema.parse(data)).toEqual(data);
  });

  it('should accept api data source with dataPath', () => {
    const data = {
      type: 'api' as const,
      apiConfig: { url: 'https://example.com/api', method: 'GET' as const },
      dataPath: 'data.list',
    };
    expect(DataSourceConfigSchema.parse(data)).toEqual(data);
  });

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

  it('should reject invalid fieldMapping', () => {
    expect(() =>
      DataSourceConfigSchema.parse({
        type: 'static',
        staticData: [],
        fieldMapping: { dimension: '', value: 'v' },
      }),
    ).toThrow();
  });
});

describe('LogicConfigSchema', () => {
  it('should accept empty object (no processing)', () => {
    expect(LogicConfigSchema.parse({})).toEqual({});
  });

  it('should accept valid sort and limit', () => {
    const data = { sortField: 'value' as const, sortDirection: 'desc' as const, limit: 10 };
    expect(LogicConfigSchema.parse(data)).toEqual(data);
  });

  it('should accept partial config', () => {
    expect(LogicConfigSchema.parse({ limit: 5 })).toEqual({ limit: 5 });
    expect(LogicConfigSchema.parse({ sortField: 'dimension' })).toEqual({
      sortField: 'dimension',
    });
  });

  it('should reject negative limit', () => {
    expect(() => LogicConfigSchema.parse({ limit: -1 })).toThrow();
  });

  it('should reject zero limit', () => {
    expect(() => LogicConfigSchema.parse({ limit: 0 })).toThrow();
  });

  it('should reject unknown sortField', () => {
    expect(() => LogicConfigSchema.parse({ sortField: 'unknown' })).toThrow();
  });

  it('should reject unknown sortDirection', () => {
    expect(() => LogicConfigSchema.parse({ sortDirection: 'random' })).toThrow();
  });
});

describe('InteractionConfigSchema', () => {
  it('should accept default (tooltip off)', () => {
    expect(InteractionConfigSchema.parse({})).toEqual({ tooltipOnHover: false });
  });

  it('should accept explicit tooltip on', () => {
    expect(InteractionConfigSchema.parse({ tooltipOnHover: true })).toEqual({
      tooltipOnHover: true,
    });
  });

  it('should reject non-boolean tooltipOnHover', () => {
    expect(() => InteractionConfigSchema.parse({ tooltipOnHover: 'yes' })).toThrow();
  });
});

describe('BarChartVisualPropsSchema', () => {
  it('should accept empty object', () => {
    expect(BarChartVisualPropsSchema.parse({})).toEqual({});
  });

  it('should accept title', () => {
    expect(BarChartVisualPropsSchema.parse({ title: '销售趋势' })).toEqual({
      title: '销售趋势',
    });
  });
});

describe('ScreenComponentSchema — 向后兼容', () => {
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

  it('should parse old component with only props.data (no dataSource/logic/interaction)', () => {
    const parsed = ScreenComponentSchema.parse(baseComponent);
    expect(parsed.dataSource).toBeUndefined();
    expect(parsed.logic).toBeUndefined();
    expect(parsed.interaction).toBeUndefined();
    expect(parsed.props).toEqual({ data: [{ name: 'A', value: 1 }] });
  });

  it('should parse component with dataSource but without logic/interaction', () => {
    const data = {
      ...baseComponent,
      dataSource: { type: 'static' as const, staticData: [{ name: 'A', value: 1 }] },
    };
    const parsed = ScreenComponentSchema.parse(data);
    expect(parsed.dataSource).toBeDefined();
    expect(parsed.logic).toBeUndefined();
    expect(parsed.interaction).toBeUndefined();
  });

  it('should parse component with all four layers', () => {
    const data = {
      ...baseComponent,
      dataSource: {
        type: 'static' as const,
        staticData: [{ city: '北京', sales: 100 }],
        fieldMapping: { dimension: 'city', value: 'sales' },
      },
      logic: { sortField: 'value' as const, sortDirection: 'desc' as const, limit: 5 },
      interaction: { tooltipOnHover: true },
    };
    const parsed = ScreenComponentSchema.parse(data);
    expect(parsed.dataSource?.fieldMapping).toEqual({ dimension: 'city', value: 'sales' });
    expect(parsed.logic).toEqual({ sortField: 'value', sortDirection: 'desc', limit: 5 });
    expect(parsed.interaction).toEqual({ tooltipOnHover: true });
  });

  it('should reject invalid logic config', () => {
    const data = {
      ...baseComponent,
      logic: { limit: -5 },
    };
    expect(() => ScreenComponentSchema.parse(data)).toThrow();
  });

  it('should reject invalid interaction config', () => {
    const data = {
      ...baseComponent,
      interaction: { tooltipOnHover: 'yes' },
    };
    expect(() => ScreenComponentSchema.parse(data)).toThrow();
  });

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
