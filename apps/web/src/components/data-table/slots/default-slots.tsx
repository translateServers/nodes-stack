import type { DataTableSlots } from '../types';

/**
 * 默认空状态渲染。
 */
export function defaultRenderEmpty(): React.ReactNode {
  return null;
}

/**
 * 默认插槽实现。
 * 这些插槽作为最低优先级的兜底实现，可被 feature 插件和用户插槽覆盖。
 */
export function createDefaultSlots<TData>(): Partial<DataTableSlots<TData>> {
  return {
    renderEmpty: defaultRenderEmpty,
  };
}
