import type { Table, Row } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';

type DataTableCheckboxProps<TData> =
  | { table: Table<TData>; row?: never }
  | { table?: never; row: Row<TData> };

export function DataTableCheckbox<TData>({ table, row }: DataTableCheckboxProps<TData>) {
  if (table) {
    return (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="全选"
      />
    );
  }

  return (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="选择行"
    />
  );
}
