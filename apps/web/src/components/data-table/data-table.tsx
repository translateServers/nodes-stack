import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type ColumnSizingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableToolbar } from './data-table-toolbar';
import { DataTablePagination } from './data-table-pagination';
import { DataTableCheckbox } from './data-table-checkbox';

interface DataTableProps<TData> {
  /** 表格数据 */
  data: TData[];
  /** 列定义 */
  columns: ColumnDef<TData, unknown>[];
  /** 行 ID 提取函数，默认为 (row) => row.id */
  getRowId?: (row: TData) => string;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 搜索绑定的列 ID 列表，支持多列同时搜索 */
  searchColumnIds?: string[];
  /** 是否显示行选择 */
  enableRowSelection?: boolean;
  /** 是否显示列宽调整 */
  enableColumnResize?: boolean;
  /** 批量删除回调 */
  onBatchDelete?: (rows: TData[]) => void;
  /** 批量删除确认提示 */
  batchDeleteConfirmMessage?: string;
  /** 自定义工具栏左侧内容 */
  toolbarLeftContent?: React.ReactNode;
  /** 自定义工具栏右侧内容 */
  toolbarRightContent?: React.ReactNode;
  /** 空状态图标 */
  emptyIcon?: React.ReactNode;
  /** 空状态标题 */
  emptyTitle?: string;
  /** 空状态描述 */
  emptyDescription?: string;
  /** 行点击回调 */
  onRowClick?: (row: TData) => void;
  /** 表格类名 */
  className?: string;
}

export function DataTable<TData>({
  data,
  columns,
  getRowId,
  isLoading = false,
  searchPlaceholder,
  searchColumnIds,
  enableRowSelection = false,
  enableColumnResize = false,
  onBatchDelete,
  batchDeleteConfirmMessage,
  toolbarLeftContent,
  toolbarRightContent,
  emptyIcon,
  emptyTitle = '暂无数据',
  emptyDescription,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columnsWithSelection = useMemo(() => {
    if (!enableRowSelection) return columns;

    const selectionColumn: ColumnDef<TData, unknown> = {
      id: 'selection',
      header: ({ table }) => <DataTableCheckbox table={table} />,
      cell: ({ row }) => <DataTableCheckbox row={row} />,
      size: 40,
      enableSorting: false,
      enableHiding: false,
    };

    return [selectionColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: columnsWithSelection,
    getRowId,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection,
    enableColumnResizing: enableColumnResize,
    columnResizeMode: 'onChange',
  });

  return (
    <div className={className}>
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        searchColumnIds={searchColumnIds}
        showBatchActions={enableRowSelection}
        onBatchDelete={onBatchDelete}
        batchDeleteConfirmMessage={batchDeleteConfirmMessage}
        leftContent={toolbarLeftContent}
        rightContent={toolbarRightContent}
      />

      <div className="mt-4 rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{
                      width: header.getSize(),
                      position: 'relative',
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {enableColumnResize && header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler() as React.MouseEventHandler}
                        onTouchStart={header.getResizeHandler() as React.TouchEventHandler}
                        className={cn(
                          'absolute top-0 -right-1 z-20 flex h-full w-3 cursor-col-resize select-none touch-none justify-center opacity-0 hover:opacity-100',
                          header.column.getIsResizing() && 'opacity-100',
                          'transition-opacity',
                        )}
                      >
                        <div
                          className={cn(
                            'h-full w-0.5 rounded-full transition-colors',
                            header.column.getIsResizing()
                              ? 'bg-primary'
                              : 'bg-foreground/20 hover:bg-primary/60',
                          )}
                        />
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {Array.from({ length: columnsWithSelection.length }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnsWithSelection.length} className="h-48 text-center">
                  <div className="flex animate-in fade-in zoom-in-95 flex-col items-center gap-3 duration-300">
                    {emptyIcon && <div className="text-muted-foreground/60">{emptyIcon}</div>}
                    <div className="font-medium">{emptyTitle}</div>
                    {emptyDescription && (
                      <div className="text-sm text-muted-foreground">{emptyDescription}</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
