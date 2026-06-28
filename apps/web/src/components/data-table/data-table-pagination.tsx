import { useState, type KeyboardEvent } from 'react';
import type { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  /** 服务端模式下的总记录数（由 PaginatedResponse.total 提供）。
   *  未提供时使用前端过滤后的行数。 */
  total?: number;
  /** 自定义每页选项，默认 [10, 20, 50] */
  pageSizeOptions?: number[];
  /** 是否显示跳页输入框，默认 true */
  showJumpToPage?: boolean;
}

export function DataTablePagination<TData>({
  table,
  total,
  pageSizeOptions = [10, 20, 50],
  showJumpToPage = true,
}: DataTablePaginationProps<TData>) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const totalCount = total ?? table.getFilteredRowModel().rows.length;
  const [jumpValue, setJumpValue] = useState('');

  const handleJumpToPage = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const page = Number.parseInt(jumpValue, 10);
    if (Number.isNaN(page) || page < 1 || page > pageCount) return;
    table.setPageIndex(page - 1);
    setJumpValue('');
  };

  return (
    <div className="flex flex-col gap-2 border-t px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
      <div className="text-center text-sm text-muted-foreground sm:text-left">
        共 {totalCount} 条
        <span className="hidden sm:inline">
          ，第 {pageIndex + 1}/{pageCount} 页
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 lg:gap-6">
        <div className="hidden items-center gap-2 sm:flex">
          <p className="text-sm font-medium">每页</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize} 条
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showJumpToPage && pageCount > 1 && (
          <div className="hidden items-center gap-2 md:flex">
            <p className="text-sm font-medium">跳至</p>
            <Input
              className="h-8 w-[50px] text-center"
              value={jumpValue}
              placeholder={`${pageIndex + 1}`}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={handleJumpToPage}
            />
            <p className="text-sm font-medium">页</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden md:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">首页</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">上一页</span>
            <ChevronLeft />
          </Button>
          <span className="flex items-center px-2 text-sm font-medium sm:hidden">
            {pageIndex + 1}/{pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">下一页</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden md:flex"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">末页</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
