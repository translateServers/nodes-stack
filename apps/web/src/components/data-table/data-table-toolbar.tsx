import { useState } from 'react';
import { type Table } from '@tanstack/react-table';
import { Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/confirm-dialog';
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

  const handleClearSearch = () => {
    handleSearchChange('');
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleBatchDelete = () => {
    if (!onBatchDelete || !hasSelection) return;
    setDeleteDialogOpen(true);
  };

  const confirmBatchDelete = () => {
    if (!onBatchDelete) return;
    const selectedData = selectedRows.map((row) => row.original);
    onBatchDelete(selectedData);
    table.toggleAllRowsSelected(false);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          {leftContent}
          {primarySearchColumn && (
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="h-8 pl-8 pr-8"
              />
              {searchValue && (
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
          {hasSelection && showBatchActions && (
            <div className="flex animate-in slide-in-from-left-2 items-center gap-2 duration-200">
              <Badge variant="secondary" className="h-6 px-2 text-xs">
                已选择 {selectedCount} 项
              </Badge>
              {onBatchDelete && (
                <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                  <Trash2 className="mr-1.5 size-3.5" />
                  删除选中
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.toggleAllRowsSelected(false)}
              >
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

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="批量删除"
        description={batchDeleteConfirmMessage}
        onConfirm={confirmBatchDelete}
      />
    </>
  );
}
