import { type Table, type Row } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';

interface DataTableCheckboxProps<TData> {
  table?: Table<TData>;
  row?: Row<TData>;
}

/**
 * 数据表格复选框组件
 * 支持表头全选和行选择两种模式
 */
export function DataTableCheckbox<TData>({ table, row }: DataTableCheckboxProps<TData>) {
  // 表头全选模式
  if (table) {
    return (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="全选"
      />
    );
  }

  // 行选择模式
  if (row) {
    return (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="选择行"
      />
    );
  }

  return null;
}
