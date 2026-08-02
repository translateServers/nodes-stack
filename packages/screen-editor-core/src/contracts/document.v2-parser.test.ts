/**
 * parseScreenDocumentV2 registry-aware parser tests（Spec §12.2 + Requirement 8 + 14, Task 5.2）
 *
 * 仅测试 V2 parser 的业务约束（不测 Zod 框架自身能力）：
 * - MISSING_COMPONENT_DEFINITION: registry 中无对应 type
 * - INVALID_COMPONENT_PROPS: props 不匹配 manifest.propsSchema
 * - UNSUPPORTED_COMPONENT_CAPABILITY: 外部组件声明 dataSource/logic/interaction
 * - INVALID_COMPONENT_EVENT: 蓝图 source handle 不在 manifest.events 派生 allowlist
 * - 合法外部组件 + 自定义事件通过
 * - 内置组件 evt:click/evt:hover 向后兼容
 * - fail-closed: 失败时返回 diagnostics，不抛异常
 */

import { describe, expect, it } from 'vitest';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';
import {
  parseScreenDocumentV2,
  ScreenDocumentV2WireSchema,
  type ScreenDocumentV2,
} from './document.js';
import {
  buildInstanceRegistry,
  type ScreenComponentInstanceRegistry,
  type ScreenComponentRegistration,
} from '../registry/instance-registry.js';

// ===== Test helpers =====

function createTextManifest(): ScreenComponentManifestV1 {
  return {
    apiVersion: 'nebula.screen-component/v1',
    type: 'text',
    implementationVersion: '1.0.0',
    tagName: 'nebula-screen-text-v1',
    name: '文本',
    category: 'text',
    icon: 'text',
    defaultSize: { width: 200, height: 80 },
    defaultProps: { content: '' },
    propsSchema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      additionalProperties: false,
    },
    events: [
      { id: 'click', name: '点击' },
      { id: 'hover', name: '悬停' },
    ],
  };
}

function createExternalKpiManifest(): ScreenComponentManifestV1 {
  return {
    apiVersion: 'nebula.screen-component/v1',
    type: 'acme.kpi/v1',
    implementationVersion: '1.0.0',
    tagName: 'acme-kpi-v1',
    name: '指标卡',
    category: 'chart',
    icon: 'chart',
    defaultSize: { width: 320, height: 180 },
    defaultProps: { title: '指标', value: 0 },
    propsSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        value: { type: 'number', minimum: 0 },
      },
      required: ['title', 'value'],
      additionalProperties: false,
    },
    events: [{ id: 'refresh', name: '刷新' }],
  };
}

function createTextRegistration(): ScreenComponentRegistration {
  return {
    source: 'built-in',
    manifest: createTextManifest(),
  };
}

function createExternalKpiRegistration(): ScreenComponentRegistration {
  return {
    source: 'host',
    manifest: createExternalKpiManifest(),
    elementConstructor: class TestKpiElement extends HTMLElement {},
  };
}

function buildTestRegistry(
  registrations: readonly ScreenComponentRegistration[],
): ScreenComponentInstanceRegistry {
  return buildInstanceRegistry(registrations);
}

function createTextComponent(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'text-1',
    type: 'text',
    name: 'Text',
    position: { x: 0, y: 0, width: 200, height: 80 },
    style: {},
    props: { content: 'Hello' },
    status: { locked: false, hidden: false },
    zIndex: 1,
    ...overrides,
  };
}

function createKpiComponent(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'kpi-1',
    type: 'acme.kpi/v1',
    name: 'KPI',
    position: { x: 100, y: 100, width: 320, height: 180 },
    style: {},
    props: { title: '延迟', value: 42 },
    status: { locked: false, hidden: false },
    zIndex: 1,
    ...overrides,
  };
}

function createV2Document(
  components: Record<string, unknown>[],
  blueprint?: Record<string, unknown>,
): ScreenDocumentV2 {
  const doc: Record<string, unknown> = {
    schemaVersion: 2,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components,
    globalVariables: [],
  };
  if (blueprint !== undefined) doc.blueprint = blueprint;
  return ScreenDocumentV2WireSchema.parse(doc);
}

function createBlueprint(
  nodes: Record<string, unknown>[],
  edges: Record<string, unknown>[],
): Record<string, unknown> {
  return { version: 2, nodes, edges };
}

// ===== Tests =====

describe('parseScreenDocumentV2 — registry-aware component validation (Requirement 8)', () => {
  it('accepts a valid built-in text component', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([createTextComponent()]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(true);
  });

  it('accepts a valid external component with correct props', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document([createKpiComponent()]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(true);
  });

  it('returns MISSING_COMPONENT_DEFINITION when type is not in registry', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([createKpiComponent()]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics).toContainEqual({
        code: 'MISSING_COMPONENT_DEFINITION',
        path: ['components', 0, 'type'],
        severity: 'error',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.stringContaining('acme.kpi/v1'),
      });
    }
  });

  it('returns INVALID_COMPONENT_PROPS when props contain unknown field (additionalProperties: false)', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([
      createTextComponent({ props: { content: 'Hello', unknown: 'field' } }),
    ]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'INVALID_COMPONENT_PROPS')).toBe(true);
    }
  });

  it('returns INVALID_COMPONENT_PROPS when required prop is missing', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document([createKpiComponent({ props: { title: '指标' } })]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'INVALID_COMPONENT_PROPS')).toBe(true);
    }
  });

  it('returns INVALID_COMPONENT_PROPS when prop type mismatches schema', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document([
      createKpiComponent({ props: { title: '指标', value: 'not-a-number' } }),
    ]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'INVALID_COMPONENT_PROPS')).toBe(true);
    }
  });

  it('rejects non-finite props before schema validation', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([createTextComponent({ props: { content: Number.NaN } })]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_COMPONENT_PROPS',
          path: ['components', 0, 'props', 'content'],
        }),
      );
    }
  });
});

describe('parseScreenDocumentV2 — external component capability (Requirement 14)', () => {
  it('returns UNSUPPORTED_COMPONENT_CAPABILITY when external component has dataSource', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document([
      createKpiComponent({
        dataSource: { type: 'static', staticData: [{ name: 'A', value: 1 }] },
      }),
    ]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics).toContainEqual({
        code: 'UNSUPPORTED_COMPONENT_CAPABILITY',
        path: ['components', 0, 'dataSource'],
        severity: 'error',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.any(String),
      });
    }
  });

  it('returns UNSUPPORTED_COMPONENT_CAPABILITY when external component has logic', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document([createKpiComponent({ logic: { sortDirection: 'desc' } })]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.diagnostics.some(
          (d) =>
            d.code === 'UNSUPPORTED_COMPONENT_CAPABILITY' && d.path.join('.').includes('logic'),
        ),
      ).toBe(true);
    }
  });

  it('returns UNSUPPORTED_COMPONENT_CAPABILITY when external component has interaction', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document([createKpiComponent({ interaction: { tooltipOnHover: true } })]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.diagnostics.some(
          (d) =>
            d.code === 'UNSUPPORTED_COMPONENT_CAPABILITY' &&
            d.path.join('.').includes('interaction'),
        ),
      ).toBe(true);
    }
  });

  it('allows built-in component to have dataSource (not external)', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([
      createTextComponent({
        dataSource: { type: 'static', staticData: [{ name: 'A', value: 1 }] },
      }),
    ]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(true);
  });
});

describe('parseScreenDocumentV2 — blueprint event validation (registry-derived allowlist)', () => {
  it('accepts evt:click for built-in text component (backward compat)', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document(
      [createTextComponent()],
      createBlueprint(
        [
          {
            id: 'node-1',
            kind: 'component',
            componentId: 'text-1',
            position: { x: 0, y: 0 },
          },
          {
            id: 'node-2',
            kind: 'component',
            componentId: 'text-1',
            position: { x: 200, y: 0 },
          },
        ],
        [
          {
            id: 'edge-1',
            source: 'node-1',
            sourceHandle: 'evt:click',
            target: 'node-2',
            targetHandle: 'act:show',
          },
        ],
      ),
    );

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(true);
  });

  it('accepts evt:refresh for external component with custom event', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document(
      [createKpiComponent()],
      createBlueprint(
        [
          {
            id: 'node-1',
            kind: 'component',
            componentId: 'kpi-1',
            position: { x: 0, y: 0 },
          },
        ],
        [],
      ),
    );

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(true);
  });

  it('returns INVALID_COMPONENT_EVENT when source handle not in manifest.events', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document(
      [createKpiComponent()],
      createBlueprint(
        [
          {
            id: 'node-1',
            kind: 'component',
            componentId: 'kpi-1',
            position: { x: 0, y: 0 },
          },
          {
            id: 'node-2',
            kind: 'component',
            componentId: 'kpi-1',
            position: { x: 200, y: 0 },
          },
        ],
        [
          {
            id: 'edge-1',
            source: 'node-1',
            sourceHandle: 'evt:click',
            target: 'node-2',
            targetHandle: 'act:show',
          },
        ],
      ),
    );

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics).toContainEqual({
        code: 'INVALID_COMPONENT_EVENT',
        path: ['blueprint', 'edges', 0, 'sourceHandle'],
        severity: 'error',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: expect.any(String),
      });
    }
  });

  it('accepts external component with evt:refresh edge', () => {
    const registry = buildTestRegistry([createTextRegistration(), createExternalKpiRegistration()]);
    const doc = createV2Document(
      [createKpiComponent()],
      createBlueprint(
        [
          {
            id: 'node-1',
            kind: 'component',
            componentId: 'kpi-1',
            position: { x: 0, y: 0 },
          },
          {
            id: 'node-2',
            kind: 'component',
            componentId: 'kpi-1',
            position: { x: 200, y: 0 },
          },
        ],
        [
          {
            id: 'edge-1',
            source: 'node-1',
            sourceHandle: 'evt:refresh',
            target: 'node-2',
            targetHandle: 'act:show',
          },
        ],
      ),
    );

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(true);
  });

  it('returns UNSUPPORTED_BLUEPRINT_NODE for requestApi global node', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document(
      [createTextComponent()],
      createBlueprint(
        [
          {
            id: 'node-1',
            kind: 'component',
            globalType: 'requestApi',
            componentId: 'global',
            position: { x: 0, y: 0 },
            config: {
              globalType: 'requestApi',
              method: 'GET',
              url: 'https://example.com',
              headers: {},
              body: '',
              secretHeaderKeys: [],
              timeoutMs: 10000,
            },
          },
        ],
        [],
      ),
    );

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'UNSUPPORTED_BLUEPRINT_NODE')).toBe(true);
    }
  });

  it('returns DANGLING_COMPONENT_REFERENCE when blueprint references missing component', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document(
      [createTextComponent()],
      createBlueprint(
        [
          {
            id: 'node-1',
            kind: 'component',
            componentId: 'non-existent',
            position: { x: 0, y: 0 },
          },
        ],
        [],
      ),
    );

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'DANGLING_COMPONENT_REFERENCE')).toBe(true);
    }
  });
});

describe('parseScreenDocumentV2 — fail-closed behavior', () => {
  it('returns failure result without throwing on invalid input', () => {
    const registry = buildTestRegistry([createTextRegistration()]);

    expect(() => parseScreenDocumentV2({ schemaVersion: 2 }, registry)).not.toThrow();
  });

  it('returns VALIDATION code for wire schema failure', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const validDoc = createV2Document([createTextComponent()]);
    const inputWithTag = { ...structuredClone(validDoc), tagName: 'nebula-evil' };

    const result = parseScreenDocumentV2(inputWithTag, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('returns UNSUPPORTED_DOCUMENT_FEATURE code for registry-aware failure', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([createKpiComponent()]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNSUPPORTED_DOCUMENT_FEATURE');
    }
  });

  it('collects multiple diagnostics in a single pass', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([
      createKpiComponent(),
      createTextComponent({ props: { content: 'Hi', extra: 'bad' } }),
    ]);

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes).toContain('MISSING_COMPONENT_DEFINITION');
      expect(codes).toContain('INVALID_COMPONENT_PROPS');
    }
  });

  it('does not mutate the input document on failure', () => {
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([createKpiComponent()]);
    const original = structuredClone(doc);

    parseScreenDocumentV2(doc, registry);

    expect(doc).toEqual(original);
  });

  it('rejects non-JSON static data and global variable values', () => {
    class InvalidValue {
      public readonly value = 1;
    }
    const registry = buildTestRegistry([createTextRegistration()]);
    const doc = createV2Document([
      createTextComponent({ dataSource: { type: 'static', staticData: Number.POSITIVE_INFINITY } }),
    ]);
    doc.globalVariables = [
      { id: 'global-1', name: 'Invalid', type: 'static', value: new InvalidValue() },
    ];

    const result = parseScreenDocumentV2(doc, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_DOCUMENT',
            path: ['components', 0, 'dataSource', 'staticData'],
          }),
          expect.objectContaining({
            code: 'INVALID_DOCUMENT',
            path: ['globalVariables', 0, 'value'],
          }),
        ]),
      );
    }
  });
});
