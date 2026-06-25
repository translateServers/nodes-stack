import type { DataTableFeature } from '../types';

/**
 * 列拖拽换序 Feature 插件工厂。
 * 使用 @dnd-kit 在 TableHeader 层实现列拖拽，结合 TanStack Table 的 columnOrder state 同步。
 * 列固定（pinning）时不可拖拽。
 */
export function createColumnDragFeature<TData>(): DataTableFeature<TData> {
  return {
    id: 'column-drag',
    // 列拖拽的渲染逻辑由主组件在 TableHeader 中处理
    // 通过 columnOrder state 同步实现列顺序变更
  };
}

/**
 * 计算列拖拽后的新列顺序。
 * @param columnOrder 当前列顺序
 * @param fromId 拖拽起始列 ID
 * @param toId 拖拽目标列 ID
 * @returns 重排序后的列 ID 数组
 */
export function reorderColumns(columnOrder: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return columnOrder;
  const fromIndex = columnOrder.indexOf(fromId);
  const toIndex = columnOrder.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0) return columnOrder;

  const newOrder = [...columnOrder];
  const [moved] = newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, moved);
  return newOrder;
}
