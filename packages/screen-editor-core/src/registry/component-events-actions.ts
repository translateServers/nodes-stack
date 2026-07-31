import type {
  ComponentActionDefinition,
  ComponentDefinition,
  ComponentEventDefinition,
} from '@nebula/shared';

/** 所有可视化组件默认拥有的事件 */
export const DEFAULT_EVENTS: readonly ComponentEventDefinition[] = [
  { id: 'click', name: '点击' },
  { id: 'hover', name: '悬停' },
];

/** 所有可视化组件默认拥有的动作 */
export const DEFAULT_ACTIONS: readonly ComponentActionDefinition[] = [
  { id: 'show', name: '显示' },
  { id: 'hide', name: '隐藏' },
  { id: 'toggleVisibility', name: '切换显隐' },
];

/** 数据源组件额外拥有的事件 */
export const DATASOURCE_EVENTS: readonly ComponentEventDefinition[] = [
  { id: 'dataLoaded', name: '数据加载完成' },
  { id: 'dataError', name: '数据加载错误' },
];

/** 数据源组件额外拥有的动作 */
export const DATASOURCE_ACTIONS: readonly ComponentActionDefinition[] = [
  { id: 'refreshData', name: '刷新数据' },
];

/** 容器组件额外拥有的动作 */
export const CONTAINER_ACTIONS: readonly ComponentActionDefinition[] = [
  { id: 'scrollTo', name: '滚动至该组件' },
];

/** 合并默认事件与额外事件 */
export function mergeEvents(
  ...extra: ReadonlyArray<readonly ComponentEventDefinition[]>
): ComponentEventDefinition[] {
  return [...DEFAULT_EVENTS, ...extra.flat()];
}

/** 合并默认动作与额外动作 */
export function mergeActions(
  ...extra: ReadonlyArray<readonly ComponentActionDefinition[]>
): ComponentActionDefinition[] {
  return [...DEFAULT_ACTIONS, ...extra.flat()];
}

/**
 * getDefinitionByType 的延迟引用。
 *
 * 为打破循环依赖：`registry/index.ts` 在模块加载时调用 mergeEvents/mergeActions，
 * 而 getComponentEvents/getComponentActions 又需要 index.ts 中的 getDefinitionByType。
 * 因此 index.ts 加载完成后会通过 __registerDefinitionLookup 注入该函数。
 */
let getDefinitionByTypeFn: ((type: string) => ComponentDefinition | undefined) | undefined;

/**
 * @internal 由 `registry/index.ts` 调用，注入 getDefinitionByType 以打破循环依赖。
 */
export function __registerDefinitionLookup(
  fn: (type: string) => ComponentDefinition | undefined,
): void {
  getDefinitionByTypeFn = fn;
}

/** 获取指定组件类型的事件列表（未声明则返回默认事件） */
export function getComponentEvents(componentType: string): ComponentEventDefinition[] {
  const def = getDefinitionByTypeFn?.(componentType);
  return def?.events ? [...def.events] : [...DEFAULT_EVENTS];
}

/** 获取指定组件类型的动作列表（未声明则返回默认动作） */
export function getComponentActions(componentType: string): ComponentActionDefinition[] {
  const def = getDefinitionByTypeFn?.(componentType);
  return def?.actions ? [...def.actions] : [...DEFAULT_ACTIONS];
}
