import { flexRender, type CellContext, type ColumnDef, type Row } from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataTableFeature } from '../types';

/** 树形展开/折叠按钮 */
export function TreeExpandButton<TData>({ row }: { row: Row<TData> }) {
  const hasSubRows = row.subRows && row.subRows.length > 0;
  if (!hasSubRows) {
    // 无子行时占位，保持对齐
    return <span className="inline-block w-5" />;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        row.toggleExpanded();
      }}
      className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={row.getIsExpanded() ? '折叠' : '展开'}
    >
      {row.getIsExpanded() ? (
        <ChevronDown className="size-4" />
      ) : (
        <ChevronRight className="size-4" />
      )}
    </button>
  );
}

/**
 * 将列定义包装为树形展开列。
 * 在单元格内容前添加展开/折叠按钮和层级缩进线。
 *
 * @param column 原始列定义（通常是第一列）
 * @param indentSize 每层缩进像素，默认 20
 */
export function wrapWithTreeExpand<TData>(
  column: ColumnDef<TData, unknown>,
  indentSize = 20,
): ColumnDef<TData, unknown> {
  const originalCell = column.cell;
  return {
    ...column,
    cell: (ctx: CellContext<TData, unknown>) => (
      <div className="flex items-center" style={{ paddingLeft: `${ctx.row.depth * indentSize}px` }}>
        {ctx.row.depth > 0 && (
          <div
            className="mr-1 h-4 border-l border-border/40"
            style={{ marginLeft: `-${indentSize}px`, width: `${indentSize}px` }}
          />
        )}
        <TreeExpandButton row={ctx.row} />
        <span className="ml-1">
          {originalCell ? flexRender(originalCell, ctx) : String(ctx.getValue() ?? '')}
        </span>
      </div>
    ),
  };
}

/**
 * 树形数据 Feature 插件工厂。
 * 树形展开通过 getSubRows + getExpandedRowModel 实现（主组件已配置）。
 * 此 feature 提供树形 UI 辅助组件。
 */
export function createTreeDataFeature<TData>(): DataTableFeature<TData> {
  return {
    id: 'tree-data',
  };
}

/**
 * 递归选择辅助函数。
 * 选择父行时自动选择所有子行，取消父行时自动取消所有子行。
 * 通过 TanStack Table 的 enableSubRowSelection 配置自动支持。
 */
export function enableTreeRowSelection<TData>(): Partial<{
  enableSubRowSelection: boolean;
}> {
  return {
    enableSubRowSelection: true,
  };
}

export type { Row };
