import type { Table, Row } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';

type DataTableCheckboxProps<TData> =
  | { table: Table<TData>; row?: never }
  | { table?: never; row: Row<TData> };

export function DataTableCheckbox<TData>({ table, row }: DataTableCheckboxProps<TData>) {
  if (table) {
    const allSelected = table.getIsAllPageRowsSelected();
    const someSelected = table.getIsSomePageRowsSelected();

    return (
      <Checkbox
        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="全选"
      />
    );
  }

  // 行级 checkbox：支持树形数据的半选状态
  const isSelected = row.getIsSelected();
  const someSubRowsSelected = row.getIsSomeSelected();

  return (
    <Checkbox
      checked={isSelected ? true : someSubRowsSelected ? 'indeterminate' : false}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="选择行"
    />
  );
}
