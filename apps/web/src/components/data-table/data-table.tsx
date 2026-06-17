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
import { Spinner } from '@/components/ui/spinner';
import { DataTableToolbar } from './data-table-toolbar';
import { DataTablePagination } from './data-table-pagination';
import { DataTableCheckbox } from './data-table-checkbox';
import { useColumnResize } from './use-column-resize';
import { useRowSelection } from './use-row-selection';

interface DataTableProps<TData> {
  /** 表格数据 */
  data: TData[];
  /** 列定义 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  /** 是否加载中 */
  isLoading?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 搜索列 ID */
  searchColumnId?: string;
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

/**
 * 统一数据表格组件
 * 封装了搜索、分页、排序、行选择、列宽调整等功能
 */
export function DataTable<TData>({
  data,
  columns,
  isLoading = false,
  searchPlaceholder,
  searchColumnId,
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
  // 状态管理
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // 列宽调整
  const { columnSizing, setColumnSizing } = useColumnResize();

  // 行选择
  const { rowSelection, setRowSelection } = useRowSelection();

  // 构建带选择框的列
  const columnsWithSelection = useMemo(() => {
    if (!enableRowSelection) return columns;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectionColumn: ColumnDef<TData, any> = {
      id: 'selection',
      header: ({ table }) => <DataTableCheckbox table={table} />,
      cell: ({ row }) => <DataTableCheckbox row={row} />,
      size: 40,
      enableSorting: false,
      enableHiding: false,
    };

    return [selectionColumn, ...columns];
  }, [columns, enableRowSelection]);

  // 创建表格实例
  const table = useReactTable({
    data,
    columns: columnsWithSelection,
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
      {/* 工具栏 */}
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        searchColumnId={searchColumnId}
        showBatchActions={enableRowSelection}
        onBatchDelete={onBatchDelete}
        batchDeleteConfirmMessage={batchDeleteConfirmMessage}
        leftContent={toolbarLeftContent}
        rightContent={toolbarRightContent}
      />

      {/* 表格 */}
      <div className="mt-4 rounded-lg border">
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
                    {/* 列宽拖拽手柄 */}
                    {enableColumnResize && header.column.getCanResize() && (
                      <div
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        onMouseDown={header.getResizeHandler()}
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none opacity-0 hover:opacity-100',
                          header.column.getIsResizing() && 'opacity-100 bg-primary',
                          'hover:bg-primary/50 transition-colors',
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columnsWithSelection.length} className="h-32 text-center">
                  <Spinner className="mx-auto size-6" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnsWithSelection.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {emptyIcon && <div className="text-muted-foreground">{emptyIcon}</div>}
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
