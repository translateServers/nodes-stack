/**
 * 组件注册中心（Spec 驱动改造：组件库统一注册接口）
 *
 * 从固定的内置组件模块清单派生查询，不再维护模块级 mutable Map。
 *
 * 派生表 getters：
 * - getDefinitionByType / getAllDefinitions / getDefinitionsByCategory
 * - getRenderer / getIcon / getSchema
 *
 * 旧 API 兼容（从 registry/index.ts 原样迁移，签名不变）：
 * - searchComponentDefinitions(keyword)
 * - createComponentInstance(type, x, y, zIndex, existing, options)
 *
 * 循环依赖打破机制：
 * - __registerDefinitionLookup 仍由 component-events-actions.ts 提供
 * - registered-components.ts 在模块加载后调用 __registerDefinitionLookup(getDefinitionByType)
 * - 这样 getComponentEvents/getComponentActions 在运行时能查到定义
 */

import type { ComponentDefinition, ComponentStyle, ScreenComponent } from '@nebula/shared';
import type { LucideIcon } from 'lucide-react';
import type { PropertySchema } from '../property-schema/types';
import type { ComponentModule } from './types';
import { BUILTIN_COMPONENT_MODULES } from './builtin-modules';

/**
 * renderer 统一入参的最小子集（与 ComponentModule.renderer 声明的入参一致）。
 *
 * 图表类组件的 renderer 实际接收更多字段（dataSource / logic / interaction / apiRawDataOverride），
 * 这些字段在 renderer.tsx 的 RendererComponentProps 中均为 optional，因此图表 renderer
 * 仍可赋值给此最小子集类型。
 */
type MinimalRendererProps = {
  componentId: string;
  props: Record<string, unknown>;
  style: ComponentStyle;
};

const builtinModulesByType = new Map(
  BUILTIN_COMPONENT_MODULES.map((module) => [module.definition.type, module]),
);

/**
 * 按 type 取组件定义（O(1) Map 索引）。
 */
export function getDefinitionByType(type: string): ComponentDefinition | undefined {
  return builtinModulesByType.get(type)?.definition;
}

/**
 * 取所有已注册组件定义（从 Map 派生）。
 *
 * 返回顺序为注册顺序（Map 保持插入顺序）。
 */
export function getAllDefinitions(): ComponentDefinition[] {
  return BUILTIN_COMPONENT_MODULES.map((module) => module.definition);
}

/**
 * 取指定分类下的所有组件定义（按 order 升序）。
 *
 * order 缺省视为最大值（排在最后）。
 */
export function getDefinitionsByCategory(category: string): ComponentDefinition[] {
  return BUILTIN_COMPONENT_MODULES.map((module) => module.definition)
    .filter((d) => d.category === category)
    .sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
}

/**
 * 按 type 取渲染组件。
 */
export function getRenderer(type: string): React.ComponentType<MinimalRendererProps> | undefined {
  return builtinModulesByType.get(type)?.renderer;
}

/**
 * 按 type 取 lucide 图标组件。
 */
export function getIcon(type: string): LucideIcon | undefined {
  return builtinModulesByType.get(type)?.icon;
}

/**
 * 按 type 取属性面板 Schema。
 */
export function getSchema(type: string): PropertySchema | undefined {
  return builtinModulesByType.get(type)?.schema;
}

/**
 * 取所有已注册组件模块（用于派生 ICON_MAP / PROPERTY_SCHEMAS / RENDERERS）。
 */
export function getAllModules(): IterableIterator<ComponentModule> {
  return new Map(
    BUILTIN_COMPONENT_MODULES.map((module) => [module.definition.type, module]),
  ).values();
}

/**
 * 创建组件实例的选项。
 *
 * - `customSize`：拖拽创建时传入自定义尺寸，覆盖 defaultSize（任务 6.3/6.4 使用）
 */
export interface CreateComponentInstanceOptions {
  /** 自定义尺寸（拖拽创建时传入，覆盖默认尺寸） */
  readonly customSize?: { readonly width: number; readonly height: number };
}

/**
 * 创建组件实例（原样从 registry/index.ts 迁移，签名与行为不变）。
 *
 * @param type 组件 type
 * @param x 画布坐标 X
 * @param y 画布坐标 Y
 * @param zIndex 层级
 * @param existingComponents 当前画布已有组件（用于同类型命名自增）
 * @param options 自定义尺寸等可选项
 * @returns 组件实例；type 未注册时返回 null
 */
export function createComponentInstance(
  type: string,
  x: number,
  y: number,
  zIndex: number,
  existingComponents: ScreenComponent[],
  options?: CreateComponentInstanceOptions,
): ScreenComponent | null {
  const def = getDefinitionByType(type);
  if (!def) return null;

  const sameTypeCount = existingComponents.filter((c) => c.type === type).length;
  const name = sameTypeCount > 0 ? `${def.name} ${sameTypeCount + 1}` : def.name;

  // 拖拽创建时使用 customSize，组件库拖入时使用 defaultSize
  const width = options?.customSize?.width ?? def.defaultSize.width;
  const height = options?.customSize?.height ?? def.defaultSize.height;

  return {
    id: crypto.randomUUID(),
    type: def.type,
    name,
    position: { x, y, width, height },
    style: {
      opacity: 1,
      borderWidth: 0,
      borderRadius: 0,
      overflow: 'hidden',
      ...def.defaultStyle,
    },
    props: structuredClone(def.defaultProps),
    status: { locked: false, hidden: false },
    zIndex,
    parentId: null,
  };
}

/**
 * 按 name / type / keywords 模糊匹配（大小写不敏感），并按相关度排序。
 *
 * 用于组件库搜索：用户输入 'zhexian' / '趋势' 等别名时可命中。
 * 空关键词返回全部定义（按注册顺序）。
 *
 * 相关度评分（越高越靠前）：
 * - 4：name 完全匹配
 * - 3：name 前缀匹配
 * - 2：name 包含匹配
 * - 1：type 包含 或 keywords 包含
 *
 * 同分按 order 升序（order 缺省视为 0），保持分类内稳定排序。
 */
export function searchComponentDefinitions(keyword: string): ComponentDefinition[] {
  const all = getAllDefinitions();
  const kw = keyword.trim().toLowerCase();
  if (!kw) return all;

  const scored: Array<{ def: ComponentDefinition; score: number }> = [];
  for (const d of all) {
    const nameLower = d.name.toLowerCase();
    const typeLower = d.type.toLowerCase();
    let score = 0;
    if (nameLower === kw) score = 4;
    else if (nameLower.startsWith(kw)) score = 3;
    else if (nameLower.includes(kw)) score = 2;
    else if (typeLower.includes(kw)) score = 1;
    else if (d.keywords !== undefined && d.keywords.some((k) => k.toLowerCase().includes(kw))) {
      score = 1;
    }
    if (score > 0) {
      scored.push({ def: d, score });
    }
  }

  // 按评分降序，同分按 order 升序（order 缺省为 0）
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.def.order ?? 0) - (b.def.order ?? 0);
  });
  return scored.map((s) => s.def);
}
