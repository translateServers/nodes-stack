import type { Table, ColumnFiltersState } from '@tanstack/react-table';
import { FilterX, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { confirmDialog } from '@/components/confirm-dialog';
import { DataTableViewOptions } from './data-table-view-options';
import { useDebounce } from '@/hooks/use-debounce';
import { useState, useEffect } from 'react';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchPlaceholder?: string;
  searchColumnIds?: string[];
  showBatchActions?: boolean;
  onBatchDelete?: (rows: TData[]) => void;
  batchDeleteConfirmMessage?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = '搜索...',
  searchColumnIds,
  showBatchActions = true,
  onBatchDelete,
  batchDeleteConfirmMessage = '确定要删除选中的项目吗？',
  leftContent,
  rightContent,
}: DataTableToolbarProps<TData>) {
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const hasSelection = selectedCount > 0;

  const primarySearchColumn = searchColumnIds?.[0];
  const filterValue = primarySearchColumn
    ? ((table.getColumn(primarySearchColumn)?.getFilterValue() as string | undefined) ?? '')
    : '';

  // 本地状态存储输入值，与防抖值解耦
  const [localSearchValue, setLocalSearchValue] = useState(filterValue);
  const debouncedSearchValue = useDebounce(localSearchValue, 300);

  // 监听防抖后的值变化，更新表格过滤
  useEffect(() => {
    searchColumnIds?.forEach((columnId) => {
      table.getColumn(columnId)?.setFilterValue(debouncedSearchValue);
    });
  }, [debouncedSearchValue, searchColumnIds, table]);

  // 当外部过滤值变化时（如重置），同步本地状态
  useEffect(() => {
    setLocalSearchValue(filterValue);
  }, [filterValue]);

  const handleSearchChange = (value: string) => {
    setLocalSearchValue(value);
  };

  const handleClearSearch = () => {
    setLocalSearchValue('');
    // 立即清除过滤，不等待防抖
    searchColumnIds?.forEach((columnId) => {
      table.getColumn(columnId)?.setFilterValue('');
    });
  };

  // 活跃的高级筛选条件（排除搜索列的文本筛选）
  const activeFilters: ColumnFiltersState = table.getState().columnFilters.filter((f) => {
    // 排除搜索列（搜索列使用文本筛选，已由搜索框展示）
    if (searchColumnIds?.includes(f.id)) return false;
    return f.value !== undefined && f.value !== '' && f.value !== null;
  });

  const handleClearFilter = (columnId: string) => {
    table.getColumn(columnId)?.setFilterValue(undefined);
  };

  const handleClearAllFilters = () => {
    table.resetColumnFilters();
    handleClearSearch();
  };

  const handleBatchDelete = async () => {
    if (!onBatchDelete || !hasSelection) return;
    const ok = await confirmDialog({
      title: '批量删除',
      description: batchDeleteConfirmMessage,
    });
    if (!ok) return;
    const selectedData = selectedRows.map((row) => row.original);
    onBatchDelete(selectedData);
    table.toggleAllRowsSelected(false);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2">
        {leftContent}
        {primarySearchColumn && (
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={localSearchValue}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="h-8 pl-8 pr-8"
            />
            {localSearchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
        {/* 活跃筛选条件 Badge */}
        {activeFilters.length > 0 && (
          <div className="flex animate-in fade-in items-center gap-1.5 duration-200">
            {activeFilters.map((filter) => {
              const column = table.getColumn(filter.id);
              const label =
                typeof column?.columnDef.header === 'string' ? column.columnDef.header : filter.id;
              return (
                <Badge
                  key={filter.id}
                  variant="secondary"
                  className="h-6 cursor-pointer gap-1 px-2 text-xs"
                  onClick={() => handleClearFilter(filter.id)}
                >
                  {label}
                  <X className="size-3" />
                </Badge>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllFilters}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <FilterX className="size-3" />
              清除全部
            </Button>
          </div>
        )}
        {hasSelection && showBatchActions && (
          <div className="flex animate-in slide-in-from-left-2 items-center gap-2 duration-200">
            <Badge variant="secondary" className="h-6 px-2 text-xs">
              已选择 {selectedCount} 项
            </Badge>
            {onBatchDelete && (
              <Button variant="destructive" size="sm" onClick={() => void handleBatchDelete()}>
                <Trash2 className="mr-1.5 size-3.5" />
                删除选中
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => table.toggleAllRowsSelected(false)}>
              取消选择
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {rightContent}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
