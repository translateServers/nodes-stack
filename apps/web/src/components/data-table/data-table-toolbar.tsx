import { type Table } from '@tanstack/react-table';
import { Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from './data-table-view-options';

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
  const searchValue = primarySearchColumn
    ? ((table.getColumn(primarySearchColumn)?.getFilterValue() as string | undefined) ?? '')
    : '';

  const handleSearchChange = (value: string) => {
    searchColumnIds?.forEach((columnId) => {
      table.getColumn(columnId)?.setFilterValue(value);
    });
  };

  const handleBatchDelete = () => {
    if (!onBatchDelete || !hasSelection) return;
    if (!confirm(batchDeleteConfirmMessage)) return;

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
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="h-8 pl-8"
            />
          </div>
        )}
        {hasSelection && showBatchActions && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">已选择 {selectedCount} 项</span>
            {onBatchDelete && (
              <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
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
