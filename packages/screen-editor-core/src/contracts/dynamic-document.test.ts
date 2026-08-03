/**
 * V3 动态文档 parser 测试。
 *
 * 测业务约束：
 * - V2 parser 对 V3 文档 fail-closed / V3 parser 拒绝 V2 文档
 * - 数据能力约束（host/xj-metric 要求 host-metric 能力；none 禁止数据源）
 * - 数据源白名单（api/sql/script 拒绝）
 * - 蓝图 requestApi 拒绝、白名单动作、dangling 引用
 * - JSON Schema 生成与 wire 对齐
 */

import { describe, expect, it } from 'vitest';

import type { ScreenComponentManifest } from '@nebula/screen-component-sdk';
import type { ScreenComponentInstanceRegistry } from '../registry/instance-registry.js';
import {
  DynamicScreenDocumentV3Schema,
  generateDynamicScreenDocumentJsonSchema,
  getManifestDataCapability,
  parseDynamicScreenDocumentV3,
  type DynamicScreenDocumentV3,
} from './dynamic-document.js';
import { parseScreenDocument, type ScreenComponentRegistryLookup } from './document.js';

function manifest(
  type: string,
  overrides: Partial<ScreenComponentManifest> = {},
): ScreenComponentManifest {
  return {
    apiVersion: 'nebula.screen-component/v1',
    type,
    implementationVersion: '1.0.0',
    tagName: `xj-${type.replaceAll('.', '-')}-v1`,
    name: type,
    category: 'chart',
    defaultSize: { width: 100, height: 100 },
    defaultProps: {},
    propsSchema: {},
    ...overrides,
  };
}

function hostMetricManifest(type: string): ScreenComponentManifest {
  return {
    ...manifest(type),
    apiVersion: 'nebula.screen-component/v2',
    // dataCapability 是 v2 扩展字段，类型层面尚未并入 v1 manifest
    ...({ dataCapability: 'host-metric' } as object),
  } as unknown as ScreenComponentManifest;
}

function createRegistry(registrations: ScreenComponentManifest[]): ScreenComponentInstanceRegistry {
  const map = new Map(
    registrations.map((item) => [
      item.type,
      {
        source: 'host' as const,
        manifest: item,
        elementConstructor: class {} as CustomElementConstructor,
      },
    ]),
  );
  return {
    get: (type) => map.get(type),
    has: (type) => map.has(type),
    list: () => [...map.values()],
    size: map.size,
  };
}

function validDocument(overrides: Partial<DynamicScreenDocumentV3> = {}): DynamicScreenDocumentV3 {
  return {
    schemaVersion: 3,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [
      {
        id: 'c1',
        name: '指标卡',
        type: 'xj.metric-card/v1',
        position: { x: 0, y: 0, width: 300, height: 200 },
        style: {},
        props: { title: '在线数' },
        dataSource: {
          type: 'host/xj-metric',
          metricId: 1,
          binding: { valueFields: ['database_online'] },
        },
        status: 'active',
        zIndex: 1,
      },
    ],
    globalVariables: [],
    ...overrides,
  };
}

describe('parseDynamicScreenDocumentV3', () => {
  const registry = createRegistry([
    hostMetricManifest('xj.metric-card/v1'),
    manifest('nebula.bar/v1'),
  ]);

  it('解析合法 V3 文档', () => {
    const result = parseDynamicScreenDocumentV3(validDocument(), registry);
    expect(result.success).toBe(true);
  });

  it('V3 parser 拒绝 V2 文档（fail-closed 单向）', () => {
    const v2 = validDocument({ schemaVersion: 2 } as unknown as Partial<DynamicScreenDocumentV3>);
    const result = parseDynamicScreenDocumentV3(v2, registry);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
      expect(result.diagnostics.some((d) => d.path.includes('schemaVersion'))).toBe(true);
    }
  });

  it('V2 parser 对 V3 文档 fail-closed', () => {
    const result = parseScreenDocument(validDocument(), registry);
    expect(result.success).toBe(false);
  });

  it('未知组件类型返回 MISSING_COMPONENT_DEFINITION', () => {
    const document = validDocument({
      components: [{ ...validDocument().components[0], type: 'unknown.type/v1' }],
    });
    const result = parseDynamicScreenDocumentV3(document, registry);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'MISSING_COMPONENT_DEFINITION')).toBe(true);
    }
  });

  it('none 能力组件附加数据源返回 UNSUPPORTED_COMPONENT_CAPABILITY', () => {
    const document = validDocument({
      components: [
        {
          ...validDocument().components[0],
          type: 'nebula.bar/v1',
          dataSource: { type: 'host/xj-metric', metricId: 1 },
        },
      ],
    });
    const result = parseDynamicScreenDocumentV3(document, registry);
    expect(result.success).toBe(false);
    if (!result.success) {
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes).toContain('UNSUPPORTED_COMPONENT_CAPABILITY');
    }
  });

  it('static 能力组件使用 host/xj-metric 数据源被拒', () => {
    const staticRegistry = createRegistry([
      {
        ...manifest('xj.static/v1'),
        apiVersion: 'nebula.screen-component/v2',
        ...({ dataCapability: 'static' } as object),
      } as unknown as ScreenComponentManifest,
    ]);
    const document = validDocument({
      components: [
        {
          ...validDocument().components[0],
          type: 'xj.static/v1',
          dataSource: { type: 'host/xj-metric', metricId: 1 },
        },
      ],
    });
    const result = parseDynamicScreenDocumentV3(document, staticRegistry);
    expect(result.success).toBe(false);
  });

  it('api/sql 数据源在 wire 层拒绝', () => {
    const document = {
      ...validDocument(),
      components: [
        {
          ...validDocument().components[0],
          dataSource: { type: 'api', url: 'https://evil.example.com/x' },
        },
      ],
    };
    const result = parseDynamicScreenDocumentV3(document, registry);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.path.join('.').includes('dataSource'))).toBe(true);
    }
  });

  it('静态数据源对 host-metric 能力组件合法', () => {
    const document = validDocument({
      components: [
        {
          ...validDocument().components[0],
          dataSource: { type: 'static', staticData: [{ x: 1 }] },
        },
      ],
    });
    const result = parseDynamicScreenDocumentV3(document, registry);
    expect(result.success).toBe(true);
  });

  it('蓝图 requestApi 节点拒绝', () => {
    const document = validDocument({
      blueprint: {
        version: 2,
        nodes: [
          {
            id: 'n1',
            position: { x: 0, y: 0 },
            kind: 'component',
            componentId: 'global',
            globalType: 'requestApi',
            config: {
              globalType: 'requestApi',
              method: 'GET',
              url: 'https://evil.example.com/x',
              headers: {},
              body: '',
              secretHeaderKeys: [],
              timeoutMs: 10_000,
            },
          },
        ],
        edges: [],
      },
    });
    const result = parseDynamicScreenDocumentV3(document, registry);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'UNSUPPORTED_BLUEPRINT_NODE')).toBe(true);
    }
  });

  it('蓝图 dangling 引用返回 DANGLING_COMPONENT_REFERENCE', () => {
    const document = validDocument({
      blueprint: {
        version: 2,
        nodes: [{ id: 'n1', position: { x: 0, y: 0 }, kind: 'component', componentId: 'missing' }],
        edges: [],
      },
    });
    const result = parseDynamicScreenDocumentV3(document, registry);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'DANGLING_COMPONENT_REFERENCE')).toBe(true);
    }
  });

  it('合法蓝图（refreshData 动作）通过', () => {
    const metricCard = {
      ...hostMetricManifest('xj.metric-card/v1'),
      events: [{ id: 'dataLoaded', name: '数据加载完成' }],
    };
    const eventRegistry = createRegistry([metricCard]);
    const document = validDocument({
      blueprint: {
        version: 2,
        nodes: [{ id: 'n1', position: { x: 0, y: 0 }, kind: 'component', componentId: 'c1' }],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n1',
            sourceHandle: 'evt:dataLoaded',
            targetHandle: 'act:refreshData',
          },
        ],
      },
    });
    const result = parseDynamicScreenDocumentV3(document, eventRegistry);
    expect(result.success).toBe(true);
  });
});

describe('getManifestDataCapability', () => {
  it('v2 manifest 读取 dataCapability', () => {
    expect(getManifestDataCapability(hostMetricManifest('xj.metric-card/v1'))).toBe('host-metric');
  });

  it('v1 manifest 降级为 none', () => {
    expect(getManifestDataCapability(manifest('nebula.bar/v1'))).toBe('none');
  });

  it('非法 dataCapability 值降级为 none', () => {
    const bad = {
      ...manifest('xj.bad/v1'),
      apiVersion: 'nebula.screen-component/v2',
      ...({ dataCapability: 'evil' } as object),
    } as unknown as ScreenComponentManifest;
    expect(getManifestDataCapability(bad)).toBe('none');
  });
});

describe('DynamicScreenDocumentV3Schema 与 JSON Schema 生成', () => {
  it('wire schema 校验通过', () => {
    const result = DynamicScreenDocumentV3Schema.safeParse(validDocument());
    expect(result.success).toBe(true);
  });

  it('生成的 JSON Schema 与 wire 对齐（schemaVersion const 3）', () => {
    const schema = generateDynamicScreenDocumentJsonSchema();
    expect(schema['schemaVersion']).toBe(undefined);
    const properties = schema.properties as Record<string, unknown>;
    expect((properties.schemaVersion as { const: number }).const).toBe(3);
    expect((properties.components as { type: string }).type).toBe('array');
    const dataSource = (
      (properties.components as { items: { properties: Record<string, unknown> } }).items.properties
        .dataSource as { oneOf: Array<{ properties: Record<string, unknown> }> }
    ).oneOf;
    expect(dataSource).toHaveLength(2);
    expect((dataSource[1].properties.type as { const: string }).const).toBe('host/xj-metric');
  });
});

describe('parseScreenDocument canonical registry semantics', () => {
  function canonicalManifest(type: string): ScreenComponentManifest {
    return {
      ...manifest(type),
      events: [{ id: 'valueClick', name: 'Value click' }],
      dataCapability: {
        acceptedSources: ['static', 'host-resource'],
        hostResourceTypes: ['metric'],
      },
    } as unknown as ScreenComponentManifest;
  }

  function canonicalRegistry(): ScreenComponentRegistryLookup {
    const registration = {
      source: 'host' as const,
      manifest: canonicalManifest('nebula.metric/v1'),
    };
    return {
      get: (type) => (type === registration.manifest.type ? registration : undefined),
    };
  }

  function canonicalDocument(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 1,
      canvas: { width: 1920, height: 1080, backgroundColor: '#000000', scaleMode: 'fit' },
      components: [
        {
          id: 'metric-1',
          type: 'nebula.metric/v1',
          name: 'Metric',
          position: { x: 0, y: 0, width: 240, height: 100 },
          style: {},
          props: {},
          dataSource: { type: 'host-resource', resourceType: 'metric', resourceId: 'dataset-1' },
          status: { locked: false, hidden: false },
          zIndex: 1,
        },
      ],
      globalVariables: [],
      ...overrides,
    };
  }

  it('accepts a canonical host resource only when the manifest declares it', () => {
    expect(parseScreenDocument(canonicalDocument(), canonicalRegistry()).success).toBe(true);

    const staticOnly = {
      get: () => ({
        source: 'host' as const,
        manifest: {
          ...canonicalManifest('nebula.metric/v1'),
          dataCapability: { acceptedSources: ['static'] },
        } as unknown as ScreenComponentManifest,
      }),
    } satisfies ScreenComponentRegistryLookup;
    const result = parseScreenDocument(canonicalDocument(), staticOnly);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.diagnostics.some((item) => item.code === 'UNSUPPORTED_COMPONENT_CAPABILITY'),
      ).toBe(true);
    }
  });

  it('rejects unknown components, old branches, and non-host refreshData targets', () => {
    const unknown = parseScreenDocument(
      canonicalDocument({
        components: [{ ...canonicalDocument().components[0], type: 'unknown/v1' }],
      }),
      canonicalRegistry(),
    );
    expect(unknown.success).toBe(false);
    if (!unknown.success) {
      expect(unknown.diagnostics.some((item) => item.code === 'MISSING_COMPONENT_DEFINITION')).toBe(
        true,
      );
    }

    expect(
      parseScreenDocument(
        canonicalDocument({
          components: [{ ...canonicalDocument().components[0], logic: { limit: 1 } }],
        }),
        canonicalRegistry(),
      ).success,
    ).toBe(false);

    const refresh = parseScreenDocument(
      canonicalDocument({
        components: [
          { ...canonicalDocument().components[0], dataSource: { type: 'static', staticData: [] } },
        ],
        blueprint: {
          version: 2,
          nodes: [
            {
              id: 'metric-node',
              position: { x: 0, y: 0 },
              kind: 'component',
              componentId: 'metric-1',
            },
          ],
          edges: [
            {
              id: 'refresh',
              source: 'metric-node',
              sourceHandle: 'evt:valueClick',
              target: 'metric-node',
              targetHandle: 'act:refreshData',
            },
          ],
        },
      }),
      canonicalRegistry(),
    );
    expect(refresh.success).toBe(false);
    if (!refresh.success) {
      expect(
        refresh.diagnostics.some((item) => item.code === 'UNSUPPORTED_COMPONENT_CAPABILITY'),
      ).toBe(true);
    }
  });
});
