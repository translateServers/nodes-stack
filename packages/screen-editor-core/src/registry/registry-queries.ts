/**
 * 实例注册表查询函数（Spec §13.2 Phase 1, Task 1.4）
 *
 * 从 `ScreenComponentInstanceRegistry` 派生 `ComponentDefinition` 列表，
 * 替代模块级 `COMPONENT_DEFINITIONS` / `searchComponentDefinitions` /
 * `getDefinitionsByCategory` / `createComponentInstance`。
 *
 * Phase 1 行为与模块级查询函数完全一致（Checkpoint 1: 零用户可见行为变化），
 * 但读取来源改为当前实例注册表，支持 Instance Isolation。
 */

import type { ComponentDefinition, ScreenComponent } from '@nebula/shared';
import type {
  ScreenComponentInstanceRegistry,
  ScreenComponentRegistration,
} from './instance-registry';

/**
 * 将 ScreenComponentRegistration 转换为 ComponentDefinition。
 *
 * manifest 提供大部分字段，legacy 字段补充 manifest 不包含的信息：
 * - legacyIconName → ComponentDefinition.icon（lucide 名字符串）
 * - legacyDefaultStyle → ComponentDefinition.defaultStyle
 * - legacyEvents / legacyActions → ComponentDefinition.events / actions
 *
 * 返回的 ComponentDefinition 是 mutable 副本（不共享 manifest 的 readonly 引用），
 * 调用方可安全修改不影响注册表。
 */
export function registrationToDefinition(reg: ScreenComponentRegistration): ComponentDefinition {
  const m = reg.manifest;
  return {
    type: m.type,
    name: m.name,
    category: m.category,
    icon: reg.legacyIconName,
    description: m.description,
    keywords: m.keywords !== undefined ? [...m.keywords] : undefined,
    order: m.order,
    defaultSize: { width: m.defaultSize.width, height: m.defaultSize.height },
    defaultProps: { ...m.defaultProps },
    defaultStyle: reg.legacyDefaultStyle,
    events: reg.legacyEvents !== undefined ? [...reg.legacyEvents] : undefined,
    actions: reg.legacyActions !== undefined ? [...reg.legacyActions] : undefined,
  };
}

/**
 * 从实例注册表按 type 取 ComponentDefinition。
 *
 * 替代模块级 `getDefinitionByType`。type 未注册时返回 undefined。
 */
export function getDefinitionFromRegistry(
  registry: ScreenComponentInstanceRegistry,
  type: string,
): ComponentDefinition | undefined {
  const reg = registry.get(type);
  return reg === undefined ? undefined : registrationToDefinition(reg);
}

/**
 * 列出实例注册表中指定分类的所有组件定义（按 order 升序）。
 *
 * 替代模块级 `getDefinitionsByCategory`。order 缺省视为最大值（排在最后）。
 */
export function listDefinitionsByCategory(
  registry: ScreenComponentInstanceRegistry,
  category: string,
): ComponentDefinition[] {
  return registry
    .list()
    .filter((reg) => reg.manifest.category === category)
    .map(registrationToDefinition)
    .sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
}

/**
 * 列出实例注册表中所有组件定义（保持注册顺序）。
 *
 * 替代模块级 `getAllDefinitions`。
 */
export function listAllDefinitions(
  registry: ScreenComponentInstanceRegistry,
): ComponentDefinition[] {
  return registry.list().map(registrationToDefinition);
}

/**
 * 列出实例注册表中所有分类（去重，保持首次出现顺序）。
 *
 * 替代模块级 `CATEGORIES` 常量。
 */
export function listCategories(registry: ScreenComponentInstanceRegistry): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const reg of registry.list()) {
    const cat = reg.manifest.category;
    if (!seen.has(cat)) {
      seen.add(cat);
      categories.push(cat);
    }
  }
  return categories;
}

/**
 * 按 name / type / keywords 模糊匹配（大小写不敏感），并按相关度排序。
 *
 * 替代模块级 `searchComponentDefinitions`，评分逻辑完全一致：
 * - 4：name 完全匹配
 * - 3：name 前缀匹配
 * - 2：name 包含匹配
 * - 1：type 包含 或 keywords 包含
 *
 * 同分按 order 升序（order 缺省视为 0），保持分类内稳定排序。
 * 空关键词返回全部定义（按注册顺序）。
 */
export function searchDefinitions(
  registry: ScreenComponentInstanceRegistry,
  keyword: string,
): ComponentDefinition[] {
  const all = listAllDefinitions(registry);
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

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.def.order ?? 0) - (b.def.order ?? 0);
  });
  return scored.map((s) => s.def);
}

/**
 * 创建组件实例的选项（与模块级 CreateComponentInstanceOptions 对齐）。
 */
export interface CreateComponentInstanceFromRegistryOptions {
  /** 自定义尺寸（拖拽创建时传入，覆盖默认尺寸） */
  readonly customSize?: { readonly width: number; readonly height: number };
}

/**
 * 从实例注册表创建组件实例。
 *
 * 替代模块级 `createComponentInstance`，行为完全一致：
 * - type 未注册时返回 null
 * - 同类型命名自增（如 "文本 2"）
 * - style 合并默认样式与 legacyDefaultStyle
 * - props 深拷贝 defaultProps（避免共享引用）
 *
 * @param registry 实例注册表
 * @param type 组件 type
 * @param x 画布坐标 X
 * @param y 画布坐标 Y
 * @param zIndex 层级
 * @param existingComponents 当前画布已有组件（用于同类型命名自增）
 * @param options 自定义尺寸等可选项
 * @returns 组件实例；type 未注册时返回 null
 */
export function createComponentInstanceFromRegistry(
  registry: ScreenComponentInstanceRegistry,
  type: string,
  x: number,
  y: number,
  zIndex: number,
  existingComponents: ScreenComponent[],
  options?: CreateComponentInstanceFromRegistryOptions,
): ScreenComponent | null {
  const def = getDefinitionFromRegistry(registry, type);
  if (def === undefined) return null;

  const sameTypeCount = existingComponents.filter((c) => c.type === type).length;
  const name = sameTypeCount > 0 ? `${def.name} ${sameTypeCount + 1}` : def.name;

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
