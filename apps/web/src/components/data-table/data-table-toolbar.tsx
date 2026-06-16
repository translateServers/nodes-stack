import { type Table } from '@tanstack/react-table';
import { Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from './data-table-view-options';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  /** 搜索框占位符 */
  searchPlaceholder?: string;
  /** 搜索框绑定的列 ID */
  searchColumnId?: string;
  /** 是否显示批量操作按钮 */
  showBatchActions?: boolean;
  /** 批量删除回调 */
  onBatchDelete?: (rows: TData[]) => void;
  /** 批量删除确认提示 */
  batchDeleteConfirmMessage?: string;
  /** 自定义工具栏左侧内容 */
  leftContent?: React.ReactNode;
  /** 自定义工具栏右侧内容 */
  rightContent?: React.ReactNode;
}

/**
 * 数据表格工具栏组件
 * 包含搜索、批量操作、列设置等功能
 */
export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = '搜索...',
  searchColumnId,
  showBatchActions = true,
  onBatchDelete,
  batchDeleteConfirmMessage = '确定要删除选中的项目吗？',
  leftContent,
  rightContent,
}: DataTableToolbarProps<TData>) {
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const hasSelection = selectedCount > 0;

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
        {searchColumnId && (
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={
                (table.getColumn(searchColumnId)?.getFilterValue() as string | undefined) ?? ''
              }
              onChange={(event) =>
                table.getColumn(searchColumnId)?.setFilterValue(event.target.value)
              }
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
