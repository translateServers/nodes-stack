import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: TData) => void;
  /** 服务端分页时传入总数 */
  total?: number;
  /** 服务端分页时传入当前页（从 1 开始） */
  page?: number;
  /** 服务端分页时传入每页数量 */
  pageSize?: number;
  /** 服务端分页回调 */
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** 工具栏区域（搜索框、操作按钮等） */
  toolbar?: React.ReactNode;
}

// ── SortIcon ───────────────────────────────────────────

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <ChevronUp className="size-3.5" />;
  if (isSorted === 'desc') return <ChevronDown className="size-3.5" />;
  return <ChevronsUpDown className="size-3.5 opacity-40" />;
}

// ── DataTable ──────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyMessage = '暂无数据',
  className,
  onRowClick,
  total,
  page: serverPage,
  pageSize: serverPageSize,
  onPageChange,
  onPageSizeChange,
  toolbar,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const isServerPagination = total !== undefined;

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(isServerPagination
      ? {
          manualPagination: true,
          pageCount: Math.ceil(total / (serverPageSize ?? 10)),
        }
      : { getPaginationRowModel: getPaginationRowModel() }),
  });

  const currentPage = isServerPagination
    ? (serverPage ?? 1)
    : table.getState().pagination.pageIndex + 1;
  const currentPageSize = isServerPagination
    ? (serverPageSize ?? 10)
    : table.getState().pagination.pageSize;
  const totalPages = isServerPagination ? Math.ceil(total / currentPageSize) : table.getPageCount();
  const totalRows = isServerPagination ? total : table.getFilteredRowModel().rows.length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      {toolbar && <div className="flex items-center justify-between gap-3">{toolbar}</div>}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1 transition-colors hover:text-foreground',
                          !header.column.getCanSort() && 'cursor-default',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIcon isSorted={header.column.getIsSorted()} />
                        )}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <Spinner className="mx-auto size-6" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
                  onClick={() => onRowClick?.(row.original)}
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

        {/* Pagination */}
        {totalRows > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-muted-foreground text-sm">
              共 {totalRows} 条，第 {currentPage}/{totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              {/* Page size selector */}
              <Select
                value={String(currentPageSize)}
                onValueChange={(value) => {
                  const size = Number(value);
                  if (isServerPagination) {
                    onPageSizeChange?.(size);
                    onPageChange?.(1);
                  } else {
                    table.setPageSize(size);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 条/页</SelectItem>
                  <SelectItem value="20">20 条/页</SelectItem>
                  <SelectItem value="50">50 条/页</SelectItem>
                </SelectContent>
              </Select>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    isServerPagination ? onPageChange?.(currentPage - 1) : table.previousPage()
                  }
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    isServerPagination ? onPageChange?.(currentPage + 1) : table.nextPage()
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── createColumnHelper ─────────────────────────────────

/**
 * 创建列定义辅助函数，提供类型安全的列定义。
 *
 * @example
 * const columnHelper = createColumnHelper<UserResponse>();
 * const columns = [
 *   columnHelper.accessor('username', { header: '用户名' }),
 *   columnHelper.display({ id: 'actions', cell: () => <Button>编辑</Button> }),
 * ];
 */
export function createColumnHelper<TData>() {
  return {
    accessor: <TAccessor extends keyof TData>(
      accessor: TAccessor,
      config?: {
        header: string;
        cell?: (value: TData[TAccessor], row: TData) => React.ReactNode;
        size?: number;
        enableSorting?: boolean;
      },
    ): ColumnDef<TData, unknown> => ({
      accessorKey: String(accessor),
      header: config?.header ?? String(accessor),
      size: config?.size,
      enableSorting: config?.enableSorting ?? true,
      cell: config?.cell
        ? ({ row }) => config.cell!(row.getValue(String(accessor)), row.original)
        : ({ row }) => {
            const value = row.getValue(String(accessor));
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return JSON.stringify(value);
          },
    }),
    display: (config: {
      id: string;
      header?: string;
      cell: (row: TData) => React.ReactNode;
      size?: number;
    }): ColumnDef<TData, unknown> => ({
      id: config.id,
      header: config.header,
      size: config.size,
      cell: ({ row }) => config.cell(row.original),
    }),
  };
}
