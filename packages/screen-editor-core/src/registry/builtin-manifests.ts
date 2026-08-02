/**
 * 内置组件 manifest 构造（Spec §13.2 Phase 1, Task 1.2）
 *
 * 为 6 个内置组件（text / bar-chart / rect / ellipse / image / button）构造
 * `ScreenComponentManifest`，并包裹为 `ScreenComponentRegistration`（source='built-in'）。
 *
 * 每个注册项同时保留 legacy 兼容字段（internalRenderer / legacySchema / legacyIcon /
 * legacyEvents / legacyActions），使 Phase 1.5 的 registry-derive 能在不改动 6 个
 * 组件文件的前提下代理现有 React renderer / 属性面板 Schema / 图标。
 * Phase 7 起已迁移的内置组件可提供 customElementConstructor，并停止写入
 * internalRenderer；text 是第一条迁移切片。
 *
 * 内置 type 保留为 text / bar-chart / rect / ellipse / image / button（Spec §7.2：
 * 为兼容既有文档保留的内置 type 例外）；tagName 使用 `nebula-screen-<type>-v1`。
 *
 * 属性面板（propertyPanel）暂不定义，仍由 legacy Schema 驱动面板渲染。
 */

import type {
  ScreenComponentIconToken,
  ScreenComponentJsonValue,
  ScreenComponentManifest,
} from '@nebula/screen-component-sdk';
import { SCREEN_COMPONENT_API_VERSION, validateManifest } from '@nebula/screen-component-sdk';
import type { ComponentEventDefinition } from '@nebula/shared';
import type { ScreenComponentEventDefinition } from '@nebula/screen-component-sdk';
import barChartModule from './components/bar-chart-component';
import buttonModule from './components/button-component';
import ellipseModule from './components/ellipse-component';
import imageModule from './components/image-component';
import rectModule from './components/rect-component';
import textModule from './components/text-component';
import type { ScreenComponentRegistration } from './instance-registry';
import type { ComponentModule } from './types';

/**
 * 内置组件 type → SDK icon token 映射。
 *
 * Spec §7.2: icon token 是框架无关的图标标识，由 SDK 定义允许列表。
 * lucide 名（Type / BarChart3 / Square / Circle / Image / MousePointerClick）
 * 仅用于 legacy 图标字段，不进入 manifest。
 */
const ICON_TOKEN_BY_TYPE: Record<string, ScreenComponentIconToken> = {
  text: 'text',
  'bar-chart': 'chart',
  rect: 'shape',
  ellipse: 'shape',
  image: 'media',
  button: 'button',
};

/**
 * 将 legacy ComponentEventDefinition 转换为 manifest 的 ScreenComponentEventDefinition。
 *
 * 两者结构兼容（id + name），但 ScreenComponentEventDefinition 允许可选 description。
 * 显式映射避免类型协变问题，并确保返回 readonly 数组。
 */
function toManifestEvents(
  events: readonly ComponentEventDefinition[] | undefined,
): readonly ScreenComponentEventDefinition[] | undefined {
  if (events === undefined) return undefined;
  return events.map((e) => ({ id: e.id, name: e.name }));
}

/**
 * 按组件 type 返回最小化 propsSchema（Spec §7.3 受限子集）。
 *
 * 根 schema 必须为 object + additionalProperties: false。
 * 仅声明 defaultProps 中出现的字段，bar-chart 的 data 数组 items 使用
 * additionalProperties: true 允许灵活的数据项结构（{name, value} 等任意键）。
 *
 * Phase 1 不驱动属性面板（仍由 legacy Schema 负责），propsSchema 仅用于
 * 校验 defaultProps 和为 Phase 3 声明式属性面板铺路。
 */
function getPropsSchemaForType(type: string): Readonly<Record<string, ScreenComponentJsonValue>> {
  switch (type) {
    case 'text':
      return {
        type: 'object',
        properties: { content: { type: 'string' } },
        additionalProperties: false,
      };
    case 'bar-chart':
      return {
        type: 'object',
        properties: {
          title: { type: 'string' },
          data: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
        },
        additionalProperties: false,
      };
    case 'image':
      return {
        type: 'object',
        properties: {
          src: { type: 'string' },
          alt: { type: 'string' },
        },
        additionalProperties: false,
      };
    case 'button':
      return {
        type: 'object',
        properties: { text: { type: 'string' } },
        additionalProperties: false,
      };
    case 'rect':
    case 'ellipse':
      return {
        type: 'object',
        additionalProperties: false,
      };
    default:
      throw new Error(`[builtin-manifests] 未知内置组件 type: ${type}`);
  }
}

/**
 * 从 ComponentModule 构造 ScreenComponentManifest。
 *
 * 字段映射策略（Spec §13.2 Phase 1）：
 * - apiVersion / implementationVersion / tagName / icon / propsSchema: 新建
 * - type / name / category / description / keywords / order / defaultSize / defaultProps:
 *   直接从 ComponentDefinition 复制
 * - events: 从 definition.events 转换为 ScreenComponentEventDefinition[]
 * - propertyPanel: undefined（仍由 legacy Schema 驱动）
 */
function buildManifest(mod: ComponentModule): ScreenComponentManifest {
  const def = mod.definition;
  return {
    apiVersion: SCREEN_COMPONENT_API_VERSION,
    type: def.type,
    implementationVersion: '1.0.0',
    tagName: `nebula-screen-${def.type}-v1`,
    name: def.name,
    category: def.category,
    icon: ICON_TOKEN_BY_TYPE[def.type],
    description: def.description,
    keywords: def.keywords,
    order: def.order,
    defaultSize: def.defaultSize,
    defaultProps: def.defaultProps as Readonly<Record<string, ScreenComponentJsonValue>>,
    propsSchema: getPropsSchemaForType(def.type),
    events: toManifestEvents(def.events),
  };
}

/**
 * 从 ComponentModule 构造 built-in ScreenComponentRegistration。
 *
 * legacy 字段保留对原 ComponentModule 的直接引用（不深拷贝）：
 * - internalRenderer: React renderer（仅尚未迁移的内置组件使用）
 * - legacySchema: 属性面板 Schema（Phase 3 声明式属性面板铺路后移除）
 * - legacyIcon: lucide 图标组件
 * - legacyEvents / legacyActions: 事件与动作定义（registry-derive 派生用）
 *
 * Dev 模式下校验 manifest 合法性，失败立即抛出（Fail Closed）。
 */
function buildRegistration(mod: ComponentModule): ScreenComponentRegistration {
  const manifest = buildManifest(mod);

  if (import.meta.env.DEV) {
    const result = validateManifest(manifest);
    if (!result.ok) {
      const details = result.diagnostics
        .map((d) => `  - ${d.code} at ${d.path.join('.')}: ${d.message}`)
        .join('\n');
      throw new Error(
        `[builtin-manifests] 内置组件 "${manifest.type}" manifest 校验失败:\n${details}`,
      );
    }
  }

  const base = {
    source: 'built-in' as const,
    manifest,
    legacySchema: mod.schema,
    legacyIcon: mod.icon,
    legacyIconName: mod.definition.icon,
    legacyDefaultStyle: mod.definition.defaultStyle,
    legacyEvents: mod.definition.events,
    legacyActions: mod.definition.actions,
  };
  return {
    ...base,
    ...(mod.customElementConstructor === undefined
      ? { internalRenderer: mod.renderer }
      : { elementConstructor: mod.customElementConstructor }),
  };
}

/**
 * 6 个内置组件的 registration 列表（Spec §13.2 Phase 1）。
 *
 * 顺序固定为 text / bar-chart / rect / ellipse / image / button，
 * 与 registered-components.ts 注册顺序一致。
 *
 * 该列表是实例注册表的唯一数据源（registry-context.tsx 的 DEFAULT_BUILTIN_REGISTRY
 * 通过 buildInstanceRegistry(BUILTIN_COMPONENT_REGISTRATIONS) 构建）。
 */
export const BUILTIN_COMPONENT_REGISTRATIONS: readonly ScreenComponentRegistration[] = [
  buildRegistration(textModule),
  buildRegistration(barChartModule),
  buildRegistration(rectModule),
  buildRegistration(ellipseModule),
  buildRegistration(imageModule),
  buildRegistration(buttonModule),
];
