/**
 * 实例注册表派生函数（Spec §13.2 Phase 1, Task 1.5）
 *
 * 从 `ScreenComponentInstanceRegistry` 派生 renderer / schema / icon / events / actions，
 * 替代模块级 `RENDERERS` / `PROPERTY_SCHEMAS` / `ICON_MAP` / `getComponentEvents` /
 * `getComponentActions` 的运行时查询。
 *
 * 双模式策略（Spec §13.2 Phase 1, Task 1.5 决策）：
 * - **registry 非空**（生产 RegistryProvider 内）：从实例注册表 O(1) 查询，
 *   支持 Instance Isolation（Spec §8.4）。
 * - **registry 为 null**（测试或无 Provider 场景）：回退到模块级 legacy 函数，
 *   保持现有测试与无 Provider 渲染场景行为不变。
 *
 * Legacy 函数在 Phase 7 删除（Spec §13.2 step 5），届时 null 分支一并移除。
 *
 * 行为一致性约束（Checkpoint 1: 零用户可见行为变化）：
 * - registry 中 built-in 组件的 legacy 字段直接来自 ComponentModule，与模块级
 *   registry.ts 的 moduleRegistry 指向同一对象引用。
 * - 因此 registry 非空时返回的 renderer/schema/icon/events/actions 与 null 分支
 *   的 legacy 函数返回值在引用上等价（同一对象）。
 */

import type { ComponentActionDefinition, ComponentEventDefinition } from '@nebula/shared';
import type { LucideIcon } from 'lucide-react';
import type { PropertySchema } from '../property-schema/types';
import { buildHostComponentSchema } from '../property-schema/manifest-adapter';
import {
  DEFAULT_ACTIONS,
  DEFAULT_EVENTS,
  getComponentActions,
  getComponentEvents,
} from './component-events-actions';
import { createHostElementRenderer } from './custom-element-renderer';
import { DEFAULT_ICON, getIconForType } from './icons';
import type { LegacyRendererProps, ScreenComponentInstanceRegistry } from './instance-registry';
import { getRenderer } from './registry';
import { DEFAULT_SCHEMA, getSchemaForComponentType } from '../property-schema/schemas';

/**
 * host renderer 工厂缓存（Spec §13.2 Phase 2, Task 2.2）。
 *
 * 同一 tagName 多次调用 `getRendererFromRegistry` 应返回同一组件引用，
 * 避免 React 在 memo diff 时因引用变化触发不必要的重渲染。
 *
 * 缓存 key 为 tagName（每个 manifest.tagName 全局唯一，Spec §7.2 命名约束）。
 * 缓存 value 为 `createHostElementRenderer(tagName)` 返回的组件。
 *
 * 缓存生命周期：
 * - 模块级单例，与 `customElements` 全局注册对齐（Spec §8.4: customElements 是 Document 全局能力）
 * - 不随 registry 实例销毁而清理：tagName → constructor 一致性由 registry-factory 保证
 * - Phase 6 接入 SDK 公开 registry 时升级为 per-registry 缓存
 */
const hostRendererCache = new Map<string, React.ComponentType<LegacyRendererProps>>();

/**
 * 从实例注册表派生 renderer（Spec §13.2 Phase 1 + Phase 2 Task 2.2）。
 *
 * 三分支：
 * - registry 非空且 registration 提供 elementConstructor：返回
 *   `createHostElementRenderer(tagName)` 包装的 Custom Element renderer，缓存复用避免引用漂移
 * - registry 非空且 source='built-in'：返回 `reg.internalRenderer`（未迁移 built-in 兼容路径）
 * - registry 非空但 type 未注册：返回 undefined（与模块级 `getRenderer` 行为一致）
 * - registry 为 null：回退到模块级 `getRenderer(type)`（legacy fallback）
 *
 * 返回类型为 `React.ComponentType<LegacyRendererProps>`（最小入参子集），
 * 调用方（如 ComponentRenderer）按需 `as React.ComponentType<RendererComponentProps>`
 * 以透传可选字段（dataSource / logic / interaction / apiRawDataOverride / mode /
 * interactive / size），与改造前 `RENDERERS` 派生逻辑一致。
 *
 * host renderer 实际接收 `RendererComponentProps`（更宽的可选字段集），但声明为
 * `LegacyRendererProps` 以保持与 built-in 同一签名，调用方按需 cast 即可。
 */
export function getRendererFromRegistry(
  registry: ScreenComponentInstanceRegistry | null,
  type: string,
): React.ComponentType<LegacyRendererProps> | undefined {
  if (registry !== null) {
    const reg = registry.get(type);
    if (reg === undefined) {
      return undefined;
    }
    // Phase 2 Task 2.2 + Phase 7：host 组件和已迁移 built-in 组件都走 Custom Element 桥接。
    // Phase 4: 将 manifest.events 透传给 createHostElementRenderer 作为事件校验 allowlist。
    if (reg.elementConstructor !== undefined) {
      const tagName = reg.manifest.tagName;
      let cached = hostRendererCache.get(tagName);
      if (cached === undefined) {
        cached = createHostElementRenderer(
          tagName,
          reg.manifest.events,
        ) as React.ComponentType<LegacyRendererProps>;
        hostRendererCache.set(tagName, cached);
      }
      return cached;
    }
    // source === 'built-in'：Phase 1 行为，Phase 7 迁移到 Custom Element
    return reg.internalRenderer;
  }
  return getRenderer(type);
}

/**
 * 从实例注册表派生属性面板 Schema。
 *
 * 三分支（Spec §13.2 Phase 1 + Phase 3 Task 3.2）：
 * - registry 非空且 source='host'：使用 `buildHostComponentSchema(manifest.propertyPanel)`，
 *   将 manifest 声明式属性面板插入 appearance tab（Spec §7.4）
 * - registry 非空且 source='built-in'：返回 `reg.legacySchema`，未声明则回退 `DEFAULT_SCHEMA`
 * - registry 非空但 type 未注册：回退 `DEFAULT_SCHEMA`
 * - registry 为 null：回退到模块级 `getSchemaForComponentType(type)`
 *
 * 外部组件（source='host'）不使用 legacySchema（Spec §13.3: propertyPanel only for
 * external components first; built-in components keep legacy property panel）。
 */
export function getSchemaFromRegistry(
  registry: ScreenComponentInstanceRegistry | null,
  type: string,
): PropertySchema {
  if (registry !== null) {
    const reg = registry.get(type);
    if (reg === undefined) {
      return DEFAULT_SCHEMA;
    }
    // Phase 3 Task 3.2：外部组件使用 manifest.propertyPanel 驱动的声明式属性面板
    if (reg.source === 'host') {
      return buildHostComponentSchema(reg.manifest.propertyPanel);
    }
    // source === 'built-in'：Phase 1 行为，Phase 7 迁移到 manifest propertyPanel
    return reg.legacySchema ?? DEFAULT_SCHEMA;
  }
  return getSchemaForComponentType(type);
}

/**
 * 从实例注册表派生 lucide 图标组件。
 *
 * - registry 非空且 type 已注册：返回 `reg.legacyIcon`
 * - registry 非空但 type 未注册：返回 `DEFAULT_ICON`（Box）
 * - registry 为 null：回退到模块级 `getIconForType(type)`
 *   （优先查 moduleRegistry.icon，再查 KNOWN_TYPE_TO_ICON，最后回退 DEFAULT_ICON）
 *
 * 与改造前 `getIconForType` 行为一致：未知类型返回 `DEFAULT_ICON`。
 */
export function getIconFromRegistry(
  registry: ScreenComponentInstanceRegistry | null,
  type: string,
): LucideIcon {
  if (registry !== null) {
    const reg = registry.get(type);
    return reg?.legacyIcon ?? DEFAULT_ICON;
  }
  return getIconForType(type);
}

/**
 * 从实例注册表派生组件事件列表。
 *
 * - registry 非空且 type 已注册：
 *   - source='built-in'：返回 `reg.legacyEvents` 的浅拷贝
 *     （`ComponentDefinition.events` 是 readonly，返回 mutable 副本与 legacy
 *     `getComponentEvents` 行为一致，调用方可安全修改不影响注册表）
 *   - source='host'（Phase 4 Task 4.2）：从 `reg.manifest.events` 派生 `evt:*`
 *     source handles，映射为兼容的 ComponentEventDefinition（id+name）
 * - registry 非空但 type 未注册：返回 `[...DEFAULT_EVENTS]`（click + hover）
 * - registry 为 null：回退到模块级 `getComponentEvents(type)`
 *
 * V1 行为约束：调用方 `component-node.tsx` 在 `staticOnly=true` 路径固定使用
 * click/hover 白名单（Phase 7 之前 built-in 不变）。V2 路径（staticOnly=false）
 * 直接消费此函数返回的全部事件，host 组件的 manifest 自定义事件（如 valueClick）
 * 通过 V2 编译为 `evt:valueClick` 锚点（Spec §9.2.1）。
 *
 * 返回 mutable 数组（非 readonly）以保持与 legacy `getComponentEvents` 签名一致。
 */
export function getComponentEventsFromRegistry(
  registry: ScreenComponentInstanceRegistry | null,
  type: string,
): ComponentEventDefinition[] {
  if (registry !== null) {
    const reg = registry.get(type);
    if (reg?.legacyEvents !== undefined) {
      return [...reg.legacyEvents];
    }
    // Phase 4 Task 4.2: host 组件使用 manifest.events 派生 evt:* source handles
    if (reg?.manifest.events !== undefined) {
      return reg.manifest.events.map((e) => ({ id: e.id, name: e.name }));
    }
    return [...DEFAULT_EVENTS];
  }
  return getComponentEvents(type);
}

/**
 * 从实例注册表派生组件动作列表。
 *
 * - registry 非空且 type 已注册：返回 `reg.legacyActions` 的浅拷贝
 * - registry 非空但 type 未注册：返回 `[...DEFAULT_ACTIONS]`（show/hide/toggleVisibility）
 * - registry 为 null：回退到模块级 `getComponentActions(type)`
 *
 * 返回 mutable 数组（非 readonly）以保持与 legacy `getComponentActions` 签名一致。
 */
export function getComponentActionsFromRegistry(
  registry: ScreenComponentInstanceRegistry | null,
  type: string,
): ComponentActionDefinition[] {
  if (registry !== null) {
    const reg = registry.get(type);
    if (reg?.legacyActions !== undefined) {
      return [...reg.legacyActions];
    }
    return [...DEFAULT_ACTIONS];
  }
  return getComponentActions(type);
}
