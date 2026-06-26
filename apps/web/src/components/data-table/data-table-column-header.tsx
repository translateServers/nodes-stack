import type { Column, Table } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, FilterX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DataTableColumnMeta } from './types';
import { getFilterRenderer, hasActiveFilter, type FilterType } from './filters';

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  /** 表格实例，用于读取多列排序状态。由 header 渲染函数的 context.table 传入。 */
  table: Table<TData>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  table,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const enableMultiSort = table.options.enableMultiSort ?? false;
  const sortingState = table.getState().sorting;
  const sortIndex = sortingState.findIndex((s) => s.id === column.id);
  const isSorted = sortIndex >= 0;

  // 高级筛选：通过 column meta 的 filterType 判断
  const meta = column.columnDef.meta as DataTableColumnMeta<TData> | undefined;
  const filterType = meta?.filterType as FilterType | undefined;
  const FilterComponent = filterType ? getFilterRenderer<TData>(filterType) : undefined;
  const hasFilter = hasActiveFilter(column);

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              '-ml-3 h-8 data-[state=open]:bg-accent',
              isSorted ? 'text-foreground font-semibold' : 'text-muted-foreground',
              hasFilter && 'text-primary',
            )}
          >
            <span>{title}</span>
            {column.getIsSorted() === 'desc' ? (
              <ArrowDown />
            ) : column.getIsSorted() === 'asc' ? (
              <ArrowUp />
            ) : (
              <ChevronsUpDown />
            )}
            {/* 多列排序优先级角标 */}
            {enableMultiSort && isSorted && (
              <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {sortIndex + 1}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={(e) => column.toggleSorting(false, e.shiftKey && enableMultiSort)}
          >
            <ArrowUp />
            升序
            {enableMultiSort && (
              <span className="ml-auto text-xs text-muted-foreground">Shift+点击多列</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => column.toggleSorting(true, e.shiftKey && enableMultiSort)}
          >
            <ArrowDown />
            降序
          </DropdownMenuItem>

          {/* 高级筛选区域 */}
          {FilterComponent && (
            <>
              <DropdownMenuSeparator />
              <div className="min-w-[220px] p-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">筛选</p>
                <FilterComponent column={column as Column<TData, unknown>} />
              </div>
            </>
          )}

          {/* 清除筛选 */}
          {hasFilter && (
            <DropdownMenuItem onClick={() => column.setFilterValue(undefined)}>
              <FilterX />
              清除筛选
            </DropdownMenuItem>
          )}

          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff />
                隐藏
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 筛选活跃指示器：列头底部高亮线 */}
      {hasFilter && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
      )}
    </div>
  );
}
