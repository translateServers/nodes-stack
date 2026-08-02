import { describe, expect, it } from 'vitest';
import type { ScreenComponent } from '@nebula/shared';
import type { ScreenComponentManifest } from '@nebula/screen-component-sdk';
import { BUILTIN_COMPONENT_REGISTRATIONS } from '../registry/builtin-manifests';
import { buildInstanceRegistry } from '../registry/instance-registry';
import {
  createEditableComponentJsonSchema,
  extractEditableComponentConfig,
  formatEditableComponentJson,
  isStructurallyEqual,
  serializeEditableComponentConfig,
  validateEditableComponentJson,
} from './component-json-config';

function makeTextComponent(): ScreenComponent {
  return {
    id: 'text-1',
    name: '标题',
    position: { x: 100, y: 120, width: 360, height: 72 },
    props: { content: '欢迎使用' },
    status: { hidden: false, locked: false },
    style: { color: '#ffffff', fontSize: 32 },
    type: 'text',
    zIndex: 1,
  };
}

function makeHostManifest(): ScreenComponentManifest {
  return {
    apiVersion: 'nebula.screen-component/v1',
    category: 'chart',
    defaultProps: { color: '#4f46e5', title: '指标', value: 0 },
    defaultSize: { height: 180, width: 320 },
    implementationVersion: '1.0.0',
    name: '指标卡',
    propsSchema: {
      additionalProperties: false,
      properties: {
        color: { pattern: '^#[0-9a-fA-F]{6}$', type: 'string' },
        title: { maxLength: 64, type: 'string' },
        value: { minimum: 0, type: 'number' },
      },
      required: ['title', 'value', 'color'],
      type: 'object',
    },
    tagName: 'example-indicator-card-v1',
    type: 'example.indicator-card/v1',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function makeRegistry() {
  return buildInstanceRegistry(BUILTIN_COMPONENT_REGISTRATIONS);
}

function makeHostRegistry() {
  return buildInstanceRegistry([
    {
      elementConstructor: class extends HTMLElement {},
      manifest: makeHostManifest(),
      source: 'host' as const,
    },
  ]);
}

describe('component JSON config', () => {
  it('serializes a stable editable subset without protected identity fields', () => {
    const serialized = serializeEditableComponentConfig(
      extractEditableComponentConfig(makeTextComponent()),
    );

    expect(serialized).toContain('"name": "标题"');
    expect(serialized).toContain('"props"');
    expect(serialized).not.toContain('"id"');
    expect(serialized).not.toContain('"type"');
    expect(serialized).not.toContain('"parentId"');
  });

  it('formats valid JSON and compares object keys independent of insertion order', () => {
    expect(formatEditableComponentJson('{"zIndex":1,"name":"标题"}')).toBe(
      '{\n  "zIndex": 1,\n  "name": "标题"\n}',
    );
    expect(
      isStructurallyEqual(
        { props: { content: 'A' }, zIndex: 1 },
        { zIndex: 1, props: { content: 'A' } },
      ),
    ).toBe(true);
    expect(isStructurallyEqual(['A', 'B'], ['B', 'A'])).toBe(false);
  });

  it('accepts a complete valid built-in configuration', () => {
    const component = makeTextComponent();
    const result = validateEditableComponentJson(
      serializeEditableComponentConfig(extractEditableComponentConfig(component)),
      {
        capabilityProfile: 'dynamic',
        identity: { id: component.id, parentId: component.parentId, type: component.type },
        registry: makeRegistry(),
      },
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.diagnostics[0]?.message);
    expect(result.config).toEqual(extractEditableComponentConfig(component));
  });

  it('rejects unknown common configuration fields without mutating them away', () => {
    const component = makeTextComponent();
    const config = {
      ...extractEditableComponentConfig(component),
      unexpected: true,
    };
    const result = validateEditableComponentJson(JSON.stringify(config), {
      capabilityProfile: 'dynamic',
      identity: { id: component.id, parentId: component.parentId, type: component.type },
      registry: makeRegistry(),
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected unknown field validation to fail');
    expect(result.diagnostics.some((diagnostic) => diagnostic.path.length === 0)).toBe(true);
  });

  it('rejects protected identity fields supplied by the draft', () => {
    const component = makeTextComponent();
    const result = validateEditableComponentJson(
      JSON.stringify({ ...extractEditableComponentConfig(component), id: 'replacement-id' }),
      {
        capabilityProfile: 'dynamic',
        identity: { id: component.id, parentId: component.parentId, type: component.type },
        registry: makeRegistry(),
      },
    );

    expect(result.success).toBe(false);
  });

  it('rejects non-finite values at the JSON boundary', () => {
    const component = makeTextComponent();
    const text = serializeEditableComponentConfig(
      extractEditableComponentConfig(component),
    ).replace('"x": 100', '"x": 1e400');
    const result = validateEditableComponentJson(text, {
      capabilityProfile: 'dynamic',
      identity: { id: component.id, parentId: component.parentId, type: component.type },
      registry: makeRegistry(),
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected non-finite JSON value validation to fail');
    expect(result.diagnostics.some((diagnostic) => diagnostic.path.includes('x'))).toBe(true);
  });

  it('rejects prototype pollution keys at the JSON boundary', () => {
    const component = makeTextComponent();
    const text = serializeEditableComponentConfig(
      extractEditableComponentConfig(component),
    ).replace('"content": "欢迎使用"', '"content": "欢迎使用", "__proto__": {}');
    const result = validateEditableComponentJson(text, {
      capabilityProfile: 'dynamic',
      identity: { id: component.id, parentId: component.parentId, type: component.type },
      registry: makeRegistry(),
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected JSON boundary validation to fail');
    expect(result.diagnostics.some((diagnostic) => diagnostic.path.includes('__proto__'))).toBe(
      true,
    );
  });

  it('uses a host manifest for props validation and schema completion metadata', () => {
    const component: ScreenComponent = {
      ...makeTextComponent(),
      props: { color: '#4f46e5', title: '收入', value: 12 },
      type: 'example.indicator-card/v1',
    };
    const registry = makeHostRegistry();
    const identity = { id: component.id, parentId: component.parentId, type: component.type };
    const invalid = validateEditableComponentJson(
      JSON.stringify({
        ...extractEditableComponentConfig(component),
        props: { color: '#zzzzzz', title: '收入', value: -1 },
      }),
      { capabilityProfile: 'dynamic', identity, registry },
    );

    expect(invalid.success).toBe(false);
    if (invalid.success) throw new Error('Expected host props validation to fail');
    expect(invalid.diagnostics.some((diagnostic) => diagnostic.path[0] === 'props')).toBe(true);

    const registration = registry.get(component.type);
    if (registration === undefined) throw new Error('Host registration is missing');
    const schema = createEditableComponentJsonSchema({
      capabilityProfile: 'dynamic',
      registration,
    });
    const properties = schema['properties'];
    if (!isRecord(properties)) {
      throw new Error('Schema properties are missing');
    }
    const props = properties['props'];
    if (!isRecord(props)) {
      throw new Error('Props schema is missing');
    }
    expect(props).toMatchObject({
      properties: {
        color: { default: '#4f46e5' },
        title: { default: '指标' },
        value: { default: 0 },
      },
    });
    expect(Object.hasOwn(properties, 'dataSource')).toBe(false);
  });

  it('limits static profiles to static data sources', () => {
    const component: ScreenComponent = {
      ...makeTextComponent(),
      dataSource: {
        apiConfig: { method: 'GET', url: 'https://example.com/data' },
        type: 'api',
      },
    };
    const result = validateEditableComponentJson(
      JSON.stringify(extractEditableComponentConfig(component)),
      {
        capabilityProfile: 'static',
        identity: { id: component.id, parentId: component.parentId, type: component.type },
        registry: makeRegistry(),
      },
    );

    expect(result.success).toBe(false);
  });
});
