import type { Row } from '@tanstack/react-table';
import type { DataTableFeature } from '../types';

/**
 * 合并单元格 Feature 插件工厂。
 * 通过 getColSpan / getRowSpan 回调动态设置单元格的 span 属性。
 * 合并逻辑在渲染前预计算。
 */
export function createCellMergeFeature<TData>(): DataTableFeature<TData> {
  return {
    id: 'cell-merge',
  };
}

/**
 * 预计算合并单元格映射。
 * 返回一个 Map，key 为 `${rowIndex}:${columnId}`，value 为 `{ colSpan, rowSpan }`。
 * colSpan/rowSpan 为 0 表示该单元格被合并（不渲染）。
 *
 * @param rows 表格行数据
 * @param visibleColumnIds 可见列 ID 列表
 * @param getColSpan 列跨度回调
 * @param getRowSpan 行跨度回调
 */
export function computeCellSpans<TData>(
  rows: Row<TData>[],
  visibleColumnIds: string[],
  getColSpan?: (row: TData, columnId: string) => number | undefined,
  getRowSpan?: (row: TData, columnId: string) => number | undefined,
): Map<string, { colSpan: number; rowSpan: number }> {
  const spans = new Map<string, { colSpan: number; rowSpan: number }>();

  // 跟踪被 rowSpan 合并的单元格
  // key: `${columnId}`, value: { remaining: number, startRowIndex: number }
  const rowSpanTracker = new Map<string, { remaining: number }>();

  rows.forEach((row, rowIndex) => {
    let colIndex = 0;
    while (colIndex < visibleColumnIds.length) {
      const columnId = visibleColumnIds[colIndex];

      // 检查此单元格是否被 rowSpan 合并
      const tracker = rowSpanTracker.get(columnId);
      if (tracker && tracker.remaining > 0) {
        spans.set(`${rowIndex}:${columnId}`, { colSpan: 0, rowSpan: 0 });
        tracker.remaining -= 1;
        if (tracker.remaining <= 0) {
          rowSpanTracker.delete(columnId);
        }
        colIndex += 1;
        continue;
      }

      // 计算 colSpan
      const colSpan = getColSpan?.(row.original, columnId) ?? 1;
      // 计算 rowSpan
      const rowSpan = getRowSpan?.(row.original, columnId) ?? 1;

      spans.set(`${rowIndex}:${columnId}`, { colSpan, rowSpan });

      // 如果有 rowSpan，标记后续行被合并
      if (rowSpan > 1) {
        rowSpanTracker.set(columnId, { remaining: rowSpan - 1 });
      }

      // 跳过被 colSpan 合并的列
      colIndex += colSpan;
    }
  });

  return spans;
}

/** 获取单元格的 span 值，无合并时返回 undefined */
export function getCellSpan(
  spans: Map<string, { colSpan: number; rowSpan: number }>,
  rowIndex: number,
  columnId: string,
): { colSpan: number; rowSpan: number } | undefined {
  const span = spans.get(`${rowIndex}:${columnId}`);
  if (!span) return undefined;
  if (span.colSpan === 0 && span.rowSpan === 0) return { colSpan: 0, rowSpan: 0 };
  if (span.colSpan === 1 && span.rowSpan === 1) return undefined;
  return span;
}
