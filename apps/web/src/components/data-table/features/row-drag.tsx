import type { ColumnDef } from '@tanstack/react-table';
import { GripVertical } from 'lucide-react';
import type { DataTableFeature } from '../types';

/** 行拖拽手柄列定义 */
export function createDragHandleColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: 'drag-handle',
    header: () => null,
    cell: () => (
      <div className="flex items-center justify-center" aria-label="拖拽排序">
        <GripVertical className="size-4 cursor-grab text-muted-foreground hover:text-foreground" />
      </div>
    ),
    size: 36,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
  };
}

/**
 * 行拖拽排序 Feature 插件工厂。
 * 使用 @dnd-kit/sortable 实现行拖拽排序。
 * 拖拽完成后通过 onRowReorder 回调返回新数据顺序。
 */
export function createRowDragFeature<TData>(
  onRowReorder?: (newData: TData[]) => void,
): DataTableFeature<TData> {
  return {
    id: 'row-drag',
    columnEnhancers: () => {
      if (!onRowReorder) return [];
      return [createDragHandleColumn<TData>()];
    },
  };
}

/**
 * 计算行拖拽后的新数据顺序。
 * @param data 原始数据
 * @param fromIndex 拖拽起始索引
 * @param toIndex 拖拽目标索引
 * @returns 重排序后的新数据数组
 */
export function reorderData<TData>(data: TData[], fromIndex: number, toIndex: number): TData[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return data;
  if (fromIndex >= data.length || toIndex >= data.length) return data;

  const newData = [...data];
  const [moved] = newData.splice(fromIndex, 1);
  newData.splice(toIndex, 0, moved);
  return newData;
}
