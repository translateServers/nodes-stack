/**
 * Manifest 校验测试（Task 0.3, Spec §18.1）
 *
 * 覆盖 identity、JSON 边界、propsSchema、propertyPanel 和 events 的正负例。
 */

import { describe, it, expect } from 'vitest';
import {
  validateManifest,
  defineScreenComponent,
  SCREEN_COMPONENT_API_VERSION,
  type ScreenComponentManifest,
} from '../index.js';
import { createMinimalManifest, expectManifestOk, expectManifestInvalid } from '../testing.js';

function withOverrides(overrides: Partial<ScreenComponentManifest>): ScreenComponentManifest {
  return { ...createMinimalManifest(), ...overrides };
}

describe('manifest validation - identity', () => {
  it('合法的最小 manifest 通过校验', () => {
    expectManifestOk(createMinimalManifest());
  });

  it('apiVersion 不匹配返回 UNSUPPORTED_COMPONENT_API_VERSION', () => {
    const m = withOverrides({ apiVersion: 'nebula.screen-component/v2' as never });
    expectManifestInvalid(m, 'UNSUPPORTED_COMPONENT_API_VERSION');
  });

  it('外部 type 缺少命名空间返回 INVALID_COMPONENT_TYPE', () => {
    const m = withOverrides({ type: 'kpi' });
    expectManifestInvalid(m, 'INVALID_COMPONENT_TYPE');
  });

  it('外部 type 缺少版本返回 INVALID_COMPONENT_TYPE', () => {
    const m = withOverrides({ type: 'acme.kpi' });
    expectManifestInvalid(m, 'INVALID_COMPONENT_TYPE');
  });

  it('外部 type 使用 nebula. 前缀返回 INVALID_COMPONENT_TYPE', () => {
    const m = withOverrides({ type: 'nebula.kpi/v1', tagName: 'nebula-kpi-v1' });
    expectManifestInvalid(m, 'INVALID_COMPONENT_TYPE');
  });

  it('内置保留 type 通过校验', () => {
    const m = withOverrides({ type: 'text', tagName: 'nebula-text-v1' });
    expectManifestOk(m);
  });

  it('implementationVersion 不是 SemVer 返回 INVALID_IMPLEMENTATION_VERSION', () => {
    const m = withOverrides({ implementationVersion: '1.0' });
    expectManifestInvalid(m, 'INVALID_IMPLEMENTATION_VERSION');
  });

  it('tagName 不含版本后缀返回 INVALID_COMPONENT_TAG_NAME', () => {
    const m = withOverrides({ tagName: 'acme-kpi' });
    expectManifestInvalid(m, 'INVALID_COMPONENT_TAG_NAME');
  });

  it('tagName 主版本与 type 主版本不一致返回 INVALID_COMPONENT_TAG_NAME', () => {
    const m = withOverrides({ type: 'acme.kpi/v1', tagName: 'acme-kpi-v2' });
    expectManifestInvalid(m, 'INVALID_COMPONENT_TAG_NAME');
  });

  it('name 为空返回 INVALID_COMPONENT_MANIFEST', () => {
    const m = withOverrides({ name: '' });
    expectManifestInvalid(m, 'INVALID_COMPONENT_MANIFEST');
  });

  it('category 不合法返回 INVALID_COMPONENT_MANIFEST', () => {
    const m = withOverrides({ category: 'invalid' as never });
    expectManifestInvalid(m, 'INVALID_COMPONENT_MANIFEST');
  });

  it('icon 不在 token 列表返回 INVALID_COMPONENT_MANIFEST', () => {
    const m = withOverrides({ icon: 'custom-icon' as never });
    expectManifestInvalid(m, 'INVALID_COMPONENT_MANIFEST');
  });

  it('defaultSize 零值返回 INVALID_DEFAULT_SIZE', () => {
    const m = withOverrides({ defaultSize: { width: 0, height: 100 } });
    expectManifestInvalid(m, 'INVALID_DEFAULT_SIZE');
  });

  it('order 非整数返回 INVALID_COMPONENT_MANIFEST', () => {
    const m = withOverrides({ order: 1.5 });
    expectManifestInvalid(m, 'INVALID_COMPONENT_MANIFEST');
  });
});

describe('manifest validation - JSON boundary', () => {
  it('defaultProps 含 undefined 返回 INVALID_JSON_VALUE', () => {
    const m = createMinimalManifest();
    (m.defaultProps as Record<string, unknown>).extra = undefined;
    expectManifestInvalid(m, 'INVALID_JSON_VALUE');
  });

  it('defaultProps 含 function 返回 INVALID_JSON_VALUE', () => {
    const m = createMinimalManifest();
    (m.defaultProps as Record<string, unknown>).fn = () => 1;
    expectManifestInvalid(m, 'INVALID_JSON_VALUE');
  });

  it('defaultProps 含 bigint 返回 INVALID_JSON_VALUE', () => {
    const m = createMinimalManifest();
    (m.defaultProps as Record<string, unknown>).big = BigInt(1);
    expectManifestInvalid(m, 'INVALID_JSON_VALUE');
  });

  it('defaultProps 含 __proto__ 键返回 INVALID_JSON_VALUE', () => {
    const m = createMinimalManifest();
    const props: Record<string, unknown> = { title: 't', value: 1, color: '#ffffff' };
    Object.defineProperty(props, '__proto__', {
      value: { x: 1 },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    m.defaultProps = props as never;
    expectManifestInvalid(m, 'INVALID_JSON_VALUE');
  });

  it('defaultProps 含 NaN 返回 INVALID_JSON_VALUE', () => {
    const m = createMinimalManifest();
    (m.defaultProps as Record<string, unknown>).nan = Number.NaN;
    expectManifestInvalid(m, 'INVALID_JSON_VALUE');
  });

  it('defaultProps 含循环引用返回 INVALID_JSON_VALUE', () => {
    const m = createMinimalManifest();
    const cyclic: Record<string, unknown> = { title: 't', value: 1, color: '#ffffff' };
    cyclic.self = cyclic;
    m.defaultProps = cyclic as never;
    expectManifestInvalid(m, 'INVALID_JSON_VALUE');
  });
});

describe('manifest validation - propsSchema', () => {
  it('根 schema type 不是 object 返回 INVALID_PROPS_SCHEMA', () => {
    const m = createMinimalManifest();
    (m.propsSchema as Record<string, unknown>).type = 'string';
    expectManifestInvalid(m, 'INVALID_PROPS_SCHEMA');
  });

  it('根 schema 缺少 additionalProperties: false 返回 INVALID_PROPS_SCHEMA', () => {
    const m = createMinimalManifest();
    (m.propsSchema as Record<string, unknown>).additionalProperties = true;
    expectManifestInvalid(m, 'INVALID_PROPS_SCHEMA');
  });

  it('propsSchema 含 $ref 返回 INVALID_PROPS_SCHEMA', () => {
    const m = createMinimalManifest();
    (m.propsSchema as Record<string, unknown>).$ref = '#/definitions/foo';
    expectManifestInvalid(m, 'INVALID_PROPS_SCHEMA');
  });

  it('propsSchema 含 allOf 返回 INVALID_PROPS_SCHEMA', () => {
    const m = createMinimalManifest();
    (m.propsSchema as Record<string, unknown>).allOf = [];
    expectManifestInvalid(m, 'INVALID_PROPS_SCHEMA');
  });

  it('propsSchema 含 default 返回 INVALID_PROPS_SCHEMA', () => {
    const m = createMinimalManifest();
    (m.propsSchema as Record<string, unknown>).default = {};
    expectManifestInvalid(m, 'INVALID_PROPS_SCHEMA');
  });

  it('propsSchema 嵌套 properties 含 $ref 返回 INVALID_PROPS_SCHEMA', () => {
    const m = createMinimalManifest();
    const props = m.propsSchema as { properties: Record<string, unknown> };
    props.properties.title = { type: 'string', $ref: '#/defs/x' };
    expectManifestInvalid(m, 'INVALID_PROPS_SCHEMA');
  });

  it('defaultProps 不符合 required 返回 INVALID_DEFAULT_PROPS', () => {
    const m = createMinimalManifest();
    m.defaultProps = { title: 't', value: 1 };
    expectManifestInvalid(m, 'INVALID_DEFAULT_PROPS');
  });

  it('defaultProps 类型不匹配返回 INVALID_DEFAULT_PROPS', () => {
    const m = createMinimalManifest();
    m.defaultProps = { title: 't', value: 'not-a-number', color: '#ffffff' };
    expectManifestInvalid(m, 'INVALID_DEFAULT_PROPS');
  });

  it('defaultProps 违反 minimum 返回 INVALID_DEFAULT_PROPS', () => {
    const m = createMinimalManifest();
    m.defaultProps = { title: 't', value: -1, color: '#ffffff' };
    expectManifestInvalid(m, 'INVALID_DEFAULT_PROPS');
  });

  it('defaultProps 违反 pattern 返回 INVALID_DEFAULT_PROPS', () => {
    const m = createMinimalManifest();
    m.defaultProps = { title: 't', value: 1, color: 'red' };
    expectManifestInvalid(m, 'INVALID_DEFAULT_PROPS');
  });

  it('defaultProps 含 additionalProperties=false 之外的未知属性返回 INVALID_DEFAULT_PROPS', () => {
    const m = createMinimalManifest();
    m.defaultProps = { title: 't', value: 1, color: '#ffffff', extra: 'no' };
    expectManifestInvalid(m, 'INVALID_DEFAULT_PROPS');
  });

  it('propsSchema type 联合数组返回 INVALID_PROPS_SCHEMA', () => {
    const m = createMinimalManifest();
    const props = m.propsSchema as Record<string, unknown>;
    (props.properties as Record<string, unknown>).title = { type: ['string', 'null'] };
    expectManifestInvalid(m, 'INVALID_PROPS_SCHEMA');
  });
});

describe('manifest validation - propertyPanel', () => {
  it('无 propertyPanel 时通过校验', () => {
    const m = createMinimalManifest();
    m.propertyPanel = undefined;
    expectManifestOk(m);
  });

  it('合法 propertyPanel 通过校验', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      {
        id: 'basic',
        title: '基础配置',
        fields: [
          { id: 'title-field', label: '标题', pointer: '/title', control: 'text' },
          { id: 'value-field', label: '数值', pointer: '/value', control: 'number', min: 0 },
          { id: 'color-field', label: '颜色', pointer: '/color', control: 'color' },
        ],
      },
    ];
    expectManifestOk(m);
  });

  it('section id 重复返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      { id: 'basic', title: 'A', fields: [] },
      { id: 'basic', title: 'B', fields: [] },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });

  it('field id 在 section 内重复返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      {
        id: 'basic',
        title: 'A',
        fields: [
          { id: 'f1', label: 'X', pointer: '/title', control: 'text' },
          { id: 'f1', label: 'Y', pointer: '/value', control: 'number' },
        ],
      },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });

  it('pointer 未在 propsSchema 声明返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      {
        id: 'basic',
        title: 'A',
        fields: [{ id: 'f1', label: 'X', pointer: '/unknown', control: 'text' }],
      },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });

  it('pointer 不是 RFC 6901 格式返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      {
        id: 'basic',
        title: 'A',
        fields: [{ id: 'f1', label: 'X', pointer: 'title', control: 'text' }],
      },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });

  it('同一 pointer 绑定两个字段返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      {
        id: 'basic',
        title: 'A',
        fields: [
          { id: 'f1', label: 'X', pointer: '/title', control: 'text' },
          { id: 'f2', label: 'Y', pointer: '/title', control: 'textarea' },
        ],
      },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });

  it('control 与 schema type 不兼容返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      {
        id: 'basic',
        title: 'A',
        fields: [{ id: 'f1', label: 'X', pointer: '/value', control: 'text' }],
      },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });

  it('select 空选项返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    (m.propsSchema as Record<string, unknown>).properties = {
      ...(m.propsSchema as { properties: Record<string, unknown> }).properties,
      mode: { type: 'string', enum: ['a', 'b'] },
    };
    m.propertyPanel = [
      {
        id: 'basic',
        title: 'A',
        fields: [{ id: 'f1', label: 'Mode', pointer: '/mode', control: 'select', options: [] }],
      },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });

  it('number 控件 min > max 返回 INVALID_PROPERTY_PANEL', () => {
    const m = createMinimalManifest();
    m.propertyPanel = [
      {
        id: 'basic',
        title: 'A',
        fields: [{ id: 'f1', label: 'Val', pointer: '/value', control: 'number', min: 10, max: 5 }],
      },
    ];
    expectManifestInvalid(m, 'INVALID_PROPERTY_PANEL');
  });
});

describe('manifest validation - events', () => {
  it('合法 events 通过校验', () => {
    const m = createMinimalManifest();
    m.events = [{ id: 'valueClick', name: '数值点击' }];
    expectManifestOk(m);
  });

  it('event id 不匹配格式返回 INVALID_EVENT_DEFINITION', () => {
    const m = createMinimalManifest();
    m.events = [{ id: 'Value_Click', name: '点击' }];
    expectManifestInvalid(m, 'INVALID_EVENT_DEFINITION');
  });

  it('event id 重复返回 INVALID_EVENT_DEFINITION', () => {
    const m = createMinimalManifest();
    m.events = [
      { id: 'valueClick', name: 'A' },
      { id: 'valueClick', name: 'B' },
    ];
    expectManifestInvalid(m, 'INVALID_EVENT_DEFINITION');
  });

  it('event name 为空返回 INVALID_EVENT_DEFINITION', () => {
    const m = createMinimalManifest();
    m.events = [{ id: 'valueClick', name: '' }];
    expectManifestInvalid(m, 'INVALID_EVENT_DEFINITION');
  });
});

describe('defineScreenComponent', () => {
  it('合法 plugin 返回原对象', () => {
    const m = createMinimalManifest();
    const plugin = {
      manifest: m,
      define: () => {
        class Kpi extends HTMLElement {}
        return Kpi;
      },
    };
    const result = defineScreenComponent(plugin);
    expect(result).toBe(plugin);
  });

  it('非法 manifest 抛出 Error', () => {
    const m = withOverrides({ type: 'invalid-type' });
    expect(() =>
      defineScreenComponent({
        manifest: m,
        define: () => {
          class X extends HTMLElement {}
          return X;
        },
      }),
    ).toThrow();
  });

  it('不依赖 React/editor-core 也能定义组件', () => {
    // 这个测试验证 defineScreenComponent 是纯函数，不引入任何框架依赖
    const m = createMinimalManifest();
    const result = defineScreenComponent({
      manifest: m,
      define: () => {
        class VanillaKpi extends HTMLElement {
          private _model: unknown = null;
          get model(): unknown {
            return this._model;
          }
          set model(value: unknown) {
            this._model = value;
          }
        }
        return VanillaKpi;
      },
    });
    expect(result.manifest.apiVersion).toBe(SCREEN_COMPONENT_API_VERSION);
  });
});

describe('manifest validation - diagnostics safety', () => {
  it('校验结果不含完整 props 值', () => {
    const m = createMinimalManifest();
    m.defaultProps = { title: 'SECRET_VALUE', value: 1, color: '#ffffff' };
    (m.propsSchema as Record<string, unknown>).type = 'string'; // 使校验失败
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    const messages = result.diagnostics.map((d) => d.message).join(' ');
    expect(messages).not.toContain('SECRET_VALUE');
  });
});
