import { createContext, useContext } from 'react';
import type { Table } from '@tanstack/react-table';
import type { DataTableProps, DataTableSlots, FeatureContext } from './types';

/**
 * DataTableContext 暴露给插槽组件和子组件的上下文值。
 */
export interface DataTableContextValue<TData> {
  /** TanStack Table 实例 */
  table: Table<TData>;
  /** DataTable 原始 props */
  props: DataTableProps<TData>;
  /** 合并后的插槽（用户 slots > feature slots > default） */
  slots: Partial<DataTableSlots<TData>>;
}

/**
 * DataTable React Context，默认值为 null。
 * 使用 useDataTableContext Hook 安全访问，未在 Provider 内使用会抛错。
 */
export const DataTableContext = createContext<DataTableContextValue<unknown> | null>(null);

DataTableContext.displayName = 'DataTableContext';

/**
 * 获取 DataTable 上下文的 Hook。
 * 必须在 DataTableProvider 内部使用，否则抛出错误。
 */
export function useDataTableContext<TData>(): DataTableContextValue<TData> {
  const ctx = useContext(DataTableContext);
  if (!ctx) {
    throw new Error('useDataTableContext 必须在 DataTable 组件内部使用');
  }
  return ctx as DataTableContextValue<TData>;
}

/**
 * 构建 FeatureContext（供插件访问）。
 */
export function createFeatureContext<TData>(
  table: Table<TData> | undefined,
  props: DataTableProps<TData>,
): FeatureContext<TData> {
  return {
    table,
    props,
    getState: table ? () => table.getState() : undefined,
  };
}
