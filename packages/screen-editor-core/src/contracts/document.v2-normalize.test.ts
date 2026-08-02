/**
 * V1 → V2 无损规范化 tests（Spec §12.2 + Requirement 9 + Requirement 13, Task 5.4）
 *
 * 仅测试 V2 规范化的业务约束（不测 Zod 框架自身能力）：
 * - normalizeV1DocumentToV2: 六内置组件 props 保留、schemaVersion 提升
 * - normalizeV1EnvelopeInputToV2: V1 envelope → V2 envelope + migrationPending=true
 * - canPublishWithMigration: migration pending 阻止 publish
 * - V1 SDK 拒绝 V2 文档（Requirement 9: 旧 consumer 拒绝未来版本）
 * - registry 校验：外部组件需在 registry 中有定义
 * - load-save-load round-trip：V1 → 规范化 V2 → 重新加载 V2，props 不丢
 * - 无效 V1 输入被拒绝
 * - V2 输入被 V1 规范化路径拒绝
 */

import { describe, expect, it } from 'vitest';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';
import {
  canPublishWithMigration,
  normalizeV1DocumentToV2,
  normalizeV1EnvelopeInputToV2,
  parseScreenDocument,
  parseScreenDocumentV2,
  type ScreenDocumentV1,
  type ScreenProjectEnvelopeInput,
} from './document.js';
import {
  buildInstanceRegistry,
  type ScreenComponentInstanceRegistry,
  type ScreenComponentRegistration,
} from '../registry/instance-registry.js';

// ===== Test helpers =====

function createBuiltinManifest(type: string): ScreenComponentManifestV1 {
  const base: ScreenComponentManifestV1 = {
    apiVersion: 'nebula.screen-component/v1',
    type,
    implementationVersion: '1.0.0',
    tagName: `nebula-screen-${type.replace(/-/g, '')}-v1`,
    name: type,
    category: 'decoration',
    icon: 'text',
    defaultSize: { width: 200, height: 80 },
    defaultProps: {},
    propsSchema: { type: 'object', properties: {}, additionalProperties: false },
    events: [
      { id: 'click', name: '点击' },
      { id: 'hover', name: '悬停' },
    ],
  };
  return base;
}

function createTextManifest(): ScreenComponentManifestV1 {
  return {
    ...createBuiltinManifest('text'),
    defaultProps: { content: '' },
    propsSchema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      additionalProperties: false,
    },
  };
}

function createBarChartManifest(): ScreenComponentManifestV1 {
  return {
    ...createBuiltinManifest('bar-chart'),
    defaultProps: { title: '', data: null },
    propsSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        data: {},
      },
      additionalProperties: false,
    },
  };
}

function createImageManifest(): ScreenComponentManifestV1 {
  return {
    ...createBuiltinManifest('image'),
    defaultProps: { src: '', alt: '' },
    propsSchema: {
      type: 'object',
      properties: {
        src: { type: 'string' },
        alt: { type: 'string' },
      },
      additionalProperties: false,
    },
  };
}

function createButtonManifest(): ScreenComponentManifestV1 {
  return {
    ...createBuiltinManifest('button'),
    defaultProps: { text: '' },
    propsSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      additionalProperties: false,
    },
  };
}

function buildBuiltinRegistry(): ScreenComponentInstanceRegistry {
  const registrations: ScreenComponentRegistration[] = [
    { source: 'built-in', manifest: createTextManifest() },
    { source: 'built-in', manifest: createBarChartManifest() },
    { source: 'built-in', manifest: createBuiltinManifest('rect') },
    { source: 'built-in', manifest: createBuiltinManifest('ellipse') },
    { source: 'built-in', manifest: createImageManifest() },
    { source: 'built-in', manifest: createButtonManifest() },
  ];
  return buildInstanceRegistry(registrations);
}

function createV1Document(): ScreenDocumentV1 {
  return {
    schemaVersion: 1,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
      backgroundImage: '',
    },
    components: [
      {
        id: 'text-1',
        type: 'text',
        name: 'Title',
        position: { x: 10, y: 10, width: 200, height: 80 },
        style: { opacity: 1 },
        props: { content: 'Hello V1' },
        status: { locked: false, hidden: false },
        zIndex: 1,
      },
      {
        id: 'bar-1',
        type: 'bar-chart',
        name: 'Chart',
        position: { x: 100, y: 100, width: 400, height: 300 },
        style: {},
        props: { title: 'Sales', data: [{ label: 'A', value: 10 }] },
        status: { locked: false, hidden: false },
        zIndex: 2,
      },
      {
        id: 'rect-1',
        type: 'rect',
        name: 'Rect',
        position: { x: 200, y: 200, width: 100, height: 100 },
        style: { backgroundColor: '#ff0000' },
        props: {},
        status: { locked: false, hidden: false },
        zIndex: 3,
      },
      {
        id: 'ellipse-1',
        type: 'ellipse',
        name: 'Ellipse',
        position: { x: 300, y: 300, width: 80, height: 80 },
        style: {},
        props: {},
        status: { locked: false, hidden: false },
        zIndex: 4,
      },
      {
        id: 'img-1',
        type: 'image',
        name: 'Logo',
        position: { x: 50, y: 50, width: 120, height: 60 },
        style: {},
        props: { src: 'https://example.com/logo.png', alt: 'Logo' },
        status: { locked: false, hidden: false },
        zIndex: 5,
      },
      {
        id: 'btn-1',
        type: 'button',
        name: 'Action',
        position: { x: 500, y: 500, width: 100, height: 40 },
        style: {},
        props: { text: 'Submit' },
        status: { locked: false, hidden: false },
        zIndex: 6,
      },
    ],
    globalVariables: [],
  };
}

function createV1EnvelopeInput(): ScreenProjectEnvelopeInput {
  const doc = createV1Document();
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    status: 'draft',
    revision: 'rev-1',
    document: doc,
  };
}

// ===== Tests =====

describe('normalizeV1DocumentToV2 — lossless document normalization (Requirement 9)', () => {
  it('upgrades schemaVersion from 1 to 2', () => {
    const v1 = createV1Document();

    const v2 = normalizeV1DocumentToV2(v1);

    expect(v2.schemaVersion).toBe(2);
  });

  it('preserves all 6 built-in components with their props', () => {
    const v1 = createV1Document();

    const v2 = normalizeV1DocumentToV2(v1);

    expect(v2.components).toHaveLength(6);
    expect(v2.components[0]?.type).toBe('text');
    expect(v2.components[0]?.props).toEqual({ content: 'Hello V1' });
    expect(v2.components[1]?.type).toBe('bar-chart');
    expect(v2.components[1]?.props).toEqual({ title: 'Sales', data: [{ label: 'A', value: 10 }] });
    expect(v2.components[2]?.type).toBe('rect');
    expect(v2.components[2]?.props).toEqual({});
    expect(v2.components[3]?.type).toBe('ellipse');
    expect(v2.components[3]?.props).toEqual({});
    expect(v2.components[4]?.type).toBe('image');
    expect(v2.components[4]?.props).toEqual({ src: 'https://example.com/logo.png', alt: 'Logo' });
    expect(v2.components[5]?.type).toBe('button');
    expect(v2.components[5]?.props).toEqual({ text: 'Submit' });
  });

  it('preserves component id, position, style, status, zIndex', () => {
    const v1 = createV1Document();

    const v2 = normalizeV1DocumentToV2(v1);

    for (let i = 0; i < v1.components.length; i++) {
      const v1c = v1.components[i];
      const v2c = v2.components[i];
      expect(v2c?.id).toBe(v1c?.id);
      expect(v2c?.name).toBe(v1c?.name);
      expect(v2c?.position).toEqual(v1c?.position);
      expect(v2c?.style).toEqual(v1c?.style);
      expect(v2c?.status).toEqual(v1c?.status);
      expect(v2c?.zIndex).toBe(v1c?.zIndex);
    }
  });

  it('preserves canvas configuration', () => {
    const v1 = createV1Document();

    const v2 = normalizeV1DocumentToV2(v1);

    expect(v2.canvas).toEqual(v1.canvas);
  });

  it('preserves globalVariables', () => {
    const v1 = createV1Document();
    v1.globalVariables = [
      { id: 'var-1', name: 'count', type: 'static', value: 42, description: 'counter' },
    ];

    const v2 = normalizeV1DocumentToV2(v1);

    expect(v2.globalVariables).toEqual(v1.globalVariables);
  });

  it('preserves blueprint when present', () => {
    const v1 = createV1Document();
    v1.blueprint = {
      version: 2,
      nodes: [{ id: 'n1', kind: 'component', componentId: 'text-1', position: { x: 0, y: 0 } }],
      edges: [],
    };

    const v2 = normalizeV1DocumentToV2(v1);

    expect(v2.blueprint).toEqual(v1.blueprint);
  });

  it('omits blueprint when absent', () => {
    const v1 = createV1Document();

    const v2 = normalizeV1DocumentToV2(v1);

    expect(v2.blueprint).toBeUndefined();
  });

  it('does not mutate the original V1 document', () => {
    const v1 = createV1Document();
    const originalSchemaVersion = v1.schemaVersion;

    normalizeV1DocumentToV2(v1);

    expect(v1.schemaVersion).toBe(originalSchemaVersion);
  });
});

describe('normalizeV1EnvelopeInputToV2 — envelope normalization + migration pending (Requirement 13)', () => {
  it('returns V2 envelope with migrationPending=true', () => {
    const input = createV1EnvelopeInput();

    const result = normalizeV1EnvelopeInputToV2(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.migrationPending).toBe(true);
      expect(result.envelope.document.schemaVersion).toBe(2);
      expect(result.envelope.id).toBe('proj-1');
      expect(result.envelope.name).toBe('Test Project');
      expect(result.envelope.status).toBe('draft');
      expect(result.envelope.revision).toBe('rev-1');
    }
  });

  it('preserves all component props through normalization', () => {
    const input = createV1EnvelopeInput();

    const result = normalizeV1EnvelopeInputToV2(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const components = result.envelope.document.components as Record<string, unknown>[];
      expect(components).toHaveLength(6);
      expect(components[0]?.props).toEqual({ content: 'Hello V1' });
      expect(components[5]?.props).toEqual({ text: 'Submit' });
    }
  });

  it('passes registry-aware V2 validation when registry is provided', () => {
    const input = createV1EnvelopeInput();
    const registry = buildBuiltinRegistry();

    const result = normalizeV1EnvelopeInputToV2(input, registry);

    expect(result.success).toBe(true);
  });

  it('fails registry validation when component type is missing from registry', () => {
    const input = createV1EnvelopeInput();
    // Provide a registry missing 'text' (only 5 of 6 built-ins)
    const registrations: ScreenComponentRegistration[] = [
      { source: 'built-in', manifest: createBarChartManifest() },
      { source: 'built-in', manifest: createBuiltinManifest('rect') },
      { source: 'built-in', manifest: createBuiltinManifest('ellipse') },
      { source: 'built-in', manifest: createImageManifest() },
      { source: 'built-in', manifest: createButtonManifest() },
    ];
    const registry = buildInstanceRegistry(registrations);

    const result = normalizeV1EnvelopeInputToV2(input, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'MISSING_COMPONENT_DEFINITION')).toBe(true);
    }
  });

  it('rejects non-envelope input', () => {
    const result = normalizeV1EnvelopeInputToV2({ not: 'an envelope' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects V1 document with invalid component props', () => {
    const input = createV1EnvelopeInput();
    // V1 image component requires src to be http(s) or data URL
    const components = input.document.components as Record<string, unknown>[];
    components[4].props = { src: 'not-a-url', alt: 'bad' };

    const result = normalizeV1EnvelopeInputToV2(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION');
    }
  });

  it('rejects V2 schemaVersion input through V1 normalization path (Requirement 9)', () => {
    const input = createV1EnvelopeInput();
    input.document.schemaVersion = 2;

    const result = normalizeV1EnvelopeInputToV2(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNSUPPORTED_DOCUMENT_FEATURE');
    }
  });
});

describe('canPublishWithMigration — migration pending blocks publish (Requirement 13)', () => {
  it('blocks publish when migrationPending is true', () => {
    expect(canPublishWithMigration({ migrationPending: true })).toBe(false);
  });

  it('allows publish when migrationPending is false', () => {
    expect(canPublishWithMigration({ migrationPending: false })).toBe(true);
  });
});

describe('V1 SDK rejects V2 documents (Requirement 9)', () => {
  it('parseScreenDocument rejects schemaVersion=2 with UNSUPPORTED_DOCUMENT_FEATURE', () => {
    const v2Doc = {
      ...createV1Document(),
      schemaVersion: 2,
    };

    const result = parseScreenDocument(v2Doc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNSUPPORTED_DOCUMENT_FEATURE');
      expect(result.diagnostics.some((d) => d.code === 'UNSUPPORTED_SCHEMA_VERSION')).toBe(true);
    }
  });

  it('parseScreenDocument rejects schemaVersion=3 with UNSUPPORTED_DOCUMENT_FEATURE', () => {
    const v3Doc = {
      ...createV1Document(),
      schemaVersion: 3,
    };

    const result = parseScreenDocument(v3Doc);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNSUPPORTED_DOCUMENT_FEATURE');
    }
  });
});

describe('load-save-load round-trip (Requirement 9 + 13)', () => {
  it('preserves all props through V1 → normalize V2 → re-parse V2 round-trip', () => {
    const v1Doc = createV1Document();
    const registry = buildBuiltinRegistry();

    // Step 1: V1 → V2 normalization (simulating V2 Adapter returning V1)
    const v2Doc = normalizeV1DocumentToV2(v1Doc);

    // Step 2: V2 document is saved and reloaded (re-parsed through V2 parser)
    const reloadResult = parseScreenDocumentV2(v2Doc, registry);

    expect(reloadResult.success).toBe(true);
    if (reloadResult.success) {
      const reloaded = reloadResult.data;
      expect(reloaded.schemaVersion).toBe(2);
      expect(reloaded.components).toHaveLength(6);

      // All props preserved
      expect(reloaded.components[0]?.props).toEqual({ content: 'Hello V1' });
      expect(reloaded.components[1]?.props).toEqual({
        title: 'Sales',
        data: [{ label: 'A', value: 10 }],
      });
      expect(reloaded.components[2]?.props).toEqual({});
      expect(reloaded.components[3]?.props).toEqual({});
      expect(reloaded.components[4]?.props).toEqual({
        src: 'https://example.com/logo.png',
        alt: 'Logo',
      });
      expect(reloaded.components[5]?.props).toEqual({ text: 'Submit' });
    }
  });

  it('preserves props through full envelope round-trip with migration pending', () => {
    const v1Envelope = createV1EnvelopeInput();
    const registry = buildBuiltinRegistry();

    // Step 1: V1 envelope → V2 envelope (normalize)
    const normalizeResult = normalizeV1EnvelopeInputToV2(v1Envelope, registry);
    expect(normalizeResult.success).toBe(true);
    if (!normalizeResult.success) return;

    // migration pending is set, publish blocked
    expect(canPublishWithMigration({ migrationPending: normalizeResult.migrationPending })).toBe(
      false,
    );

    // Step 2: V2 envelope saved → reloaded as V2 (re-parse V2 document)
    const reloadResult = parseScreenDocumentV2(normalizeResult.envelope.document, registry);
    expect(reloadResult.success).toBe(true);
    if (!reloadResult.success) return;

    // After V2 save success, migration pending cleared → publish allowed
    expect(canPublishWithMigration({ migrationPending: false })).toBe(true);

    // All props preserved through round-trip
    const reloaded = reloadResult.data;
    expect(reloaded.components[0]?.props).toEqual({ content: 'Hello V1' });
    expect(reloaded.components[5]?.props).toEqual({ text: 'Submit' });
  });
});
