import type { Table } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  const handleResetAll = () => {
    table.resetColumnVisibility();
    table.resetColumnSizing();
    table.resetColumnOrder();
  };

  const allColumns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide());

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    const currentOrder = table.getState().columnOrder;
    const orderedIds = currentOrder.length > 0 ? currentOrder : allColumns.map((c) => c.id);

    const index = orderedIds.indexOf(columnId);
    if (index < 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return;

    const newOrder = [...orderedIds];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    table.setColumnOrder(newOrder);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
          <Settings2 />
          列设置
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>列设置</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-5 w-5"
            onClick={handleResetAll}
            title="恢复默认"
          >
            <RotateCcw className="size-3" />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allColumns.map((column, index) => {
          const label =
            typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;
          return (
            <div key={column.id} className="flex items-center">
              <DropdownMenuCheckboxItem
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                className="flex-1"
              >
                {label}
              </DropdownMenuCheckboxItem>
              <div className="flex items-center pr-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-5 w-5"
                  onClick={() => moveColumn(column.id, 'up')}
                  disabled={index === 0}
                  title="上移"
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-5 w-5"
                  onClick={() => moveColumn(column.id, 'down')}
                  disabled={index === allColumns.length - 1}
                  title="下移"
                >
                  <ArrowDown className="size-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
