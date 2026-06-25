import type { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DataTableFeature } from '../types';

/**
 * 主从展开按钮列定义。
 * 点击展开/折叠按钮，显示/隐藏展开行内容（通过 renderExpandedRow 插槽渲染）。
 */
export function createExpandButtonColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: 'master-detail-expand',
    header: () => null,
    cell: ({ row }) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          row.toggleExpanded();
        }}
        className={cn(
          'flex size-5 items-center justify-center rounded text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground',
        )}
        aria-label={row.getIsExpanded() ? '折叠' : '展开'}
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>
    ),
    size: 36,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
  };
}

/**
 * 主从展开 Feature 插件工厂。
 * 展开行内容通过 DataTableProps.renderExpandedRow 插槽渲染。
 * 此 feature 提供展开按钮列。
 */
export function createMasterDetailFeature<TData>(
  enabled: boolean,
): DataTableFeature<TData> & { getColumnEnhancers: () => ColumnDef<TData, unknown>[] } {
  return {
    id: 'master-detail',
    columnEnhancers: () => (enabled ? [createExpandButtonColumn<TData>()] : []),
  };
}
