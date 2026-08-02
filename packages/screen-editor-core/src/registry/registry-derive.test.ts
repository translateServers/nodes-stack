/**
 * registry-derive 单元测试（Spec §13.2 Phase 1, Task 1.5）
 *
 * 覆盖：
 * - getRendererFromRegistry: registry 非空 / null 双路径
 * - getSchemaFromRegistry: registry 非空 / null 双路径 + DEFAULT_SCHEMA 回退
 * - getIconFromRegistry: registry 非空 / null 双路径 + DEFAULT_ICON 回退
 * - getComponentEventsFromRegistry: registry 非空 / null 双路径 + DEFAULT_EVENTS 回退 + 浅拷贝
 * - getComponentActionsFromRegistry: registry 非空 / null 双路径 + DEFAULT_ACTIONS 回退 + 浅拷贝
 * - built-in 组件一致性：DEFAULT_BUILTIN_REGISTRY 路径与 legacy 模块函数返回值等价
 *
 * 测试策略：
 * - 使用 DEFAULT_BUILTIN_REGISTRY 验证生产路径（含 6 个完整 built-in registration）
 * - 使用 buildInstanceRegistry + 自定义 registration 验证边界（缺 legacy 字段、未知 type）
 * - 调用 legacy 模块函数验证 null 分支返回值与之等价
 */

import { describe, expect, it } from 'vitest';
import type { ComponentActionDefinition, ComponentEventDefinition } from '@nebula/shared';
import type { ScreenComponentManifest } from '@nebula/screen-component-sdk';
import { Box, Type } from 'lucide-react';
import { DEFAULT_BUILTIN_REGISTRY } from './registry-context';
import { buildInstanceRegistry, type ScreenComponentRegistration } from './instance-registry';
import {
  getComponentActionsFromRegistry,
  getComponentEventsFromRegistry,
  getIconFromRegistry,
  getRendererFromRegistry,
  getSchemaFromRegistry,
} from './registry-derive';
import {
  DEFAULT_ACTIONS,
  DEFAULT_EVENTS,
  getComponentActions,
  getComponentEvents,
} from './component-events-actions';
import { DEFAULT_ICON, getIconForType } from './icons';
import { DEFAULT_SCHEMA, getSchemaForComponentType } from '../property-schema/schemas';
import { getRenderer } from './registry';

const SCREEN_COMPONENT_API_VERSION = 'nebula.screen-component/v1' as const;

/** 构造最小合法 manifest */
function makeManifest(overrides: Partial<ScreenComponentManifest>): ScreenComponentManifest {
  return {
    apiVersion: SCREEN_COMPONENT_API_VERSION,
    type: 'text',
    implementationVersion: '1.0.0',
    tagName: 'nebula-screen-text-v1',
    name: '文本',
    category: 'text',
    defaultSize: { width: 200, height: 60 },
    defaultProps: { content: '请输入文本' },
    propsSchema: {
      type: 'object',
      properties: { content: { type: 'string' } },
      additionalProperties: false,
    },
    ...overrides,
  };
}

/** 构造最小 built-in registration（无 legacy 字段） */
function makeBuiltIn(
  manifest: ScreenComponentManifest,
  legacy?: Omit<ScreenComponentRegistration, 'source' | 'manifest'>,
): ScreenComponentRegistration {
  return {
    source: 'built-in',
    manifest,
    ...legacy,
  };
}

describe('registry-derive', () => {
  describe('getRendererFromRegistry', () => {
    it('registry 非空且 type 已注册：未迁移组件返回 reg.internalRenderer', () => {
      const reg = DEFAULT_BUILTIN_REGISTRY.get('bar-chart');
      const renderer = getRendererFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'bar-chart');
      expect(renderer).toBe(reg?.internalRenderer);
    });

    it('registry 非空且 type 已迁移：返回 Custom Element bridge renderer', () => {
      for (const type of ['text', 'rect', 'ellipse', 'image', 'button']) {
        const reg = DEFAULT_BUILTIN_REGISTRY.get(type);
        const renderer = getRendererFromRegistry(DEFAULT_BUILTIN_REGISTRY, type);
        expect(reg?.internalRenderer).toBeUndefined();
        expect(reg?.elementConstructor).toBeDefined();
        expect(renderer).toBeDefined();
        expect(renderer).not.toBe(getRenderer(type));
      }
    });

    it('registry 非空但 type 未注册：返回 undefined', () => {
      const renderer = getRendererFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'unknown-type');
      expect(renderer).toBeUndefined();
    });

    it('registry 非空且 registration 无 internalRenderer：返回 undefined', () => {
      const registry = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-v1' })),
      ]);
      expect(getRendererFromRegistry(registry, 'plain')).toBeUndefined();
    });

    it('registry 为 null：回退到模块级 getRenderer', () => {
      // text 已通过 registered-components 注册到模块级 registry
      const renderer = getRendererFromRegistry(null, 'text');
      expect(renderer).toBe(getRenderer('text'));
    });

    it('registry 为 null 且 type 未注册：返回 undefined（与模块级 getRenderer 一致）', () => {
      expect(getRendererFromRegistry(null, 'unknown-type')).toBe(getRenderer('unknown-type'));
      expect(getRendererFromRegistry(null, 'unknown-type')).toBeUndefined();
    });

    it('built-in 一致性：未迁移 built-in registry 路径与模块级 getRenderer 返回同一引用', () => {
      // 未迁移内置组件的 registration.internalRenderer 来自 ComponentModule.renderer，
      // 与模块级 moduleRegistry 中的 renderer 是同一对象引用。
      for (const type of ['bar-chart']) {
        const fromRegistry = getRendererFromRegistry(DEFAULT_BUILTIN_REGISTRY, type);
        const fromLegacy = getRenderer(type);
        expect(fromRegistry).toBe(fromLegacy);
      }
    });
  });

  describe('getSchemaFromRegistry', () => {
    it('registry 非空且 type 已注册：返回 reg.legacySchema', () => {
      const reg = DEFAULT_BUILTIN_REGISTRY.get('text');
      const schema = getSchemaFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'text');
      expect(schema).toBe(reg?.legacySchema);
    });

    it('registry 非空但 type 未注册：返回 DEFAULT_SCHEMA', () => {
      const schema = getSchemaFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'unknown-type');
      expect(schema).toBe(DEFAULT_SCHEMA);
    });

    it('registry 非空且 registration 无 legacySchema：返回 DEFAULT_SCHEMA', () => {
      const registry = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-v1' })),
      ]);
      expect(getSchemaFromRegistry(registry, 'plain')).toBe(DEFAULT_SCHEMA);
    });

    it('registry 为 null：回退到模块级 getSchemaForComponentType', () => {
      expect(getSchemaFromRegistry(null, 'text')).toBe(getSchemaForComponentType('text'));
      expect(getSchemaFromRegistry(null, 'unknown-type')).toBe(
        getSchemaForComponentType('unknown-type'),
      );
    });

    it('built-in registry 路径返回完整 schema，null fallback 保持兼容默认值', () => {
      expect(getSchemaFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'text')).not.toBe(DEFAULT_SCHEMA);
      expect(getSchemaFromRegistry(null, 'unknown-type')).toBe(
        getSchemaForComponentType('unknown-type'),
      );
    });
  });

  describe('getIconFromRegistry', () => {
    it('registry 非空且 type 已注册：返回 reg.legacyIcon', () => {
      const reg = DEFAULT_BUILTIN_REGISTRY.get('text');
      const icon = getIconFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'text');
      expect(icon).toBe(reg?.legacyIcon);
      expect(icon).toBe(Type);
    });

    it('registry 非空但 type 未注册：返回 DEFAULT_ICON (Box)', () => {
      const icon = getIconFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'unknown-type');
      expect(icon).toBe(DEFAULT_ICON);
      expect(icon).toBe(Box);
    });

    it('registry 非空且 registration 无 legacyIcon：返回 DEFAULT_ICON', () => {
      const registry = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-v1' })),
      ]);
      expect(getIconFromRegistry(registry, 'plain')).toBe(DEFAULT_ICON);
    });

    it('registry 为 null：回退到模块级 getIconForType', () => {
      expect(getIconFromRegistry(null, 'text')).toBe(getIconForType('text'));
      expect(getIconFromRegistry(null, 'unknown-type')).toBe(getIconForType('unknown-type'));
    });

    it('built-in 一致性：DEFAULT_BUILTIN_REGISTRY 路径与模块级 getIconForType 返回同一引用', () => {
      for (const type of ['text', 'bar-chart', 'rect', 'ellipse', 'image', 'button']) {
        expect(getIconFromRegistry(DEFAULT_BUILTIN_REGISTRY, type)).toBe(getIconForType(type));
      }
    });
  });

  describe('getComponentEventsFromRegistry', () => {
    it('registry 非空且 type 已注册：返回 reg.legacyEvents 的浅拷贝', () => {
      const reg = DEFAULT_BUILTIN_REGISTRY.get('bar-chart');
      const events = getComponentEventsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'bar-chart');
      expect(events).toEqual(reg?.legacyEvents);
      // bar-chart 应包含 4 个事件：click / hover / dataLoaded / dataError
      expect(events.map((e) => e.id)).toEqual(['click', 'hover', 'dataLoaded', 'dataError']);
    });

    it('registry 非空：返回的是浅拷贝，修改不影响原 registration', () => {
      const reg = DEFAULT_BUILTIN_REGISTRY.get('bar-chart');
      const originalLength = reg?.legacyEvents?.length ?? 0;
      const events = getComponentEventsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'bar-chart');
      events.push({ id: 'injected', name: '注入事件' });
      // 原 registration 不受影响
      expect(reg?.legacyEvents?.length).toBe(originalLength);
    });

    it('registry 非空但 type 未注册：返回 [...DEFAULT_EVENTS]', () => {
      const events = getComponentEventsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'unknown-type');
      expect(events).toEqual([...DEFAULT_EVENTS]);
      expect(events.map((e) => e.id)).toEqual(['click', 'hover']);
    });

    it('registry 非空且 registration 无 legacyEvents：返回 [...DEFAULT_EVENTS]', () => {
      const registry = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-v1' })),
      ]);
      const events = getComponentEventsFromRegistry(registry, 'plain');
      expect(events).toEqual([...DEFAULT_EVENTS]);
    });

    it('registry 为 null：回退到模块级 getComponentEvents', () => {
      expect(getComponentEventsFromRegistry(null, 'bar-chart')).toEqual(
        getComponentEvents('bar-chart'),
      );
      expect(getComponentEventsFromRegistry(null, 'unknown-type')).toEqual(
        getComponentEvents('unknown-type'),
      );
    });

    it('built-in registry 路径返回完整 events，null fallback 保持默认事件', () => {
      expect(
        getComponentEventsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'bar-chart').map((e) => e.id),
      ).toEqual(['click', 'hover', 'dataLoaded', 'dataError']);
      expect(getComponentEventsFromRegistry(null, 'unknown-type')).toEqual(
        getComponentEvents('unknown-type'),
      );
    });

    it('返回类型为 mutable ComponentEventDefinition[]（非 readonly）', () => {
      const events = getComponentEventsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'text');
      // TypeScript 类型断言验证：mutable 数组允许 push
      const mutable: ComponentEventDefinition[] = events;
      mutable.push({ id: 'test', name: '测试' });
      expect(events).toHaveLength(3);
    });
  });

  describe('getComponentActionsFromRegistry', () => {
    it('registry 非空且 type 已注册：返回 reg.legacyActions 的浅拷贝', () => {
      const reg = DEFAULT_BUILTIN_REGISTRY.get('bar-chart');
      const actions = getComponentActionsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'bar-chart');
      expect(actions).toEqual(reg?.legacyActions);
      // bar-chart 应包含 4 个动作：show / hide / toggleVisibility / refreshData
      expect(actions.map((a) => a.id)).toEqual(['show', 'hide', 'toggleVisibility', 'refreshData']);
    });

    it('registry 非空：返回的是浅拷贝，修改不影响原 registration', () => {
      const reg = DEFAULT_BUILTIN_REGISTRY.get('bar-chart');
      const originalLength = reg?.legacyActions?.length ?? 0;
      const actions = getComponentActionsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'bar-chart');
      actions.push({ id: 'injected', name: '注入动作' });
      expect(reg?.legacyActions?.length).toBe(originalLength);
    });

    it('registry 非空但 type 未注册：返回 [...DEFAULT_ACTIONS]', () => {
      const actions = getComponentActionsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'unknown-type');
      expect(actions).toEqual([...DEFAULT_ACTIONS]);
      expect(actions.map((a) => a.id)).toEqual(['show', 'hide', 'toggleVisibility']);
    });

    it('registry 非空且 registration 无 legacyActions：返回 [...DEFAULT_ACTIONS]', () => {
      const registry = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-v1' })),
      ]);
      const actions = getComponentActionsFromRegistry(registry, 'plain');
      expect(actions).toEqual([...DEFAULT_ACTIONS]);
    });

    it('registry 为 null：回退到模块级 getComponentActions', () => {
      expect(getComponentActionsFromRegistry(null, 'bar-chart')).toEqual(
        getComponentActions('bar-chart'),
      );
      expect(getComponentActionsFromRegistry(null, 'unknown-type')).toEqual(
        getComponentActions('unknown-type'),
      );
    });

    it('built-in registry 路径返回完整 actions，null fallback 保持默认动作', () => {
      expect(
        getComponentActionsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'bar-chart').map((a) => a.id),
      ).toEqual(['show', 'hide', 'toggleVisibility', 'refreshData']);
      expect(getComponentActionsFromRegistry(null, 'unknown-type')).toEqual(
        getComponentActions('unknown-type'),
      );
    });

    it('返回类型为 mutable ComponentActionDefinition[]（非 readonly）', () => {
      const actions = getComponentActionsFromRegistry(DEFAULT_BUILTIN_REGISTRY, 'text');
      const mutable: ComponentActionDefinition[] = actions;
      mutable.push({ id: 'test', name: '测试' });
      expect(actions).toHaveLength(4);
    });
  });

  describe('Instance Isolation（Spec §8.4）', () => {
    it('两个不同 registry 对同一 type 返回不同的 internalRenderer', () => {
      const rendererA = () => null;
      const rendererB = () => null;
      const registryA = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-a-v1' }), {
          internalRenderer: rendererA as unknown as ScreenComponentRegistration['internalRenderer'],
        }),
      ]);
      const registryB = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-b-v1' }), {
          internalRenderer: rendererB as unknown as ScreenComponentRegistration['internalRenderer'],
        }),
      ]);

      expect(getRendererFromRegistry(registryA, 'plain')).toBe(rendererA);
      expect(getRendererFromRegistry(registryB, 'plain')).toBe(rendererB);
    });

    it('registry A 中的 type 在 registry B 中未注册时返回 undefined / DEFAULT', () => {
      const rendererA = () => null;
      const registryA = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'acme.kpi/v1', tagName: 'acme-kpi-v1' }), {
          internalRenderer: rendererA as unknown as ScreenComponentRegistration['internalRenderer'],
        }),
      ]);
      const registryB = buildInstanceRegistry([
        makeBuiltIn(makeManifest({ type: 'plain', tagName: 'nebula-screen-plain-v1' })),
      ]);

      expect(getRendererFromRegistry(registryA, 'acme.kpi/v1')).toBe(rendererA);
      expect(getRendererFromRegistry(registryB, 'acme.kpi/v1')).toBeUndefined();

      // schema / icon / events / actions 在 registry B 中回退到 default
      expect(getSchemaFromRegistry(registryB, 'acme.kpi/v1')).toBe(DEFAULT_SCHEMA);
      expect(getIconFromRegistry(registryB, 'acme.kpi/v1')).toBe(DEFAULT_ICON);
      expect(getComponentEventsFromRegistry(registryB, 'acme.kpi/v1')).toEqual([...DEFAULT_EVENTS]);
      expect(getComponentActionsFromRegistry(registryB, 'acme.kpi/v1')).toEqual([
        ...DEFAULT_ACTIONS,
      ]);
    });
  });
});
