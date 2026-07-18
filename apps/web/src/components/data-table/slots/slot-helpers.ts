import type { DataTableSlots } from '../types';

/**
 * 插槽合并工具函数。
 * 合并优先级：用户 slots > feature slots（后者覆盖前者）> 默认 slots。
 *
 * @param userSlots 用户通过 props 传入的插槽
 * @param featureSlots feature 插件注入的插槽列表（按顺序合并，后者覆盖前者）
 * @param defaultSlots 默认插槽实现
 * @returns 合并后的插槽
 */
export function mergeSlots<TData>(
  userSlots?: Partial<DataTableSlots<TData>>,
  featureSlots: Partial<DataTableSlots<TData>>[] = [],
  defaultSlots: Partial<DataTableSlots<TData>> = {},
): Partial<DataTableSlots<TData>> {
  const merged: Partial<DataTableSlots<TData>> = { ...defaultSlots };

  // feature slots 按顺序合并（后面的覆盖前面的）
  for (const fs of featureSlots) {
    for (const [key, value] of Object.entries(fs)) {
      if (value !== undefined) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  // user slots 优先级最高
  if (userSlots) {
    for (const [key, value] of Object.entries(userSlots)) {
      if (value !== undefined) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  return merged;
}

/**
 * 获取插槽渲染结果。
 * 如果插槽存在则调用，否则返回 undefined。
 */
export function renderSlot<TData, K extends keyof DataTableSlots<TData>>(
  slots: Partial<DataTableSlots<TData>>,
  key: K,
  ...args: Parameters<NonNullable<DataTableSlots<TData>[K]>>
): React.ReactNode {
  const slot = slots[key];
  if (!slot) return undefined;

  return (slot as (...a: unknown[]) => React.ReactNode)(...args);
}
