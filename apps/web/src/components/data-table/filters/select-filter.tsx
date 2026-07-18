import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { DataTableColumnMeta } from '../types';
import type { FilterRendererProps } from './text-filter';

/** 多选筛选器：通过 Checkbox 选择多个值 */
export function SelectFilter<TData>({ column }: FilterRendererProps<TData>) {
  const meta: DataTableColumnMeta<TData> | undefined = column.columnDef.meta;
  const options = meta?.filterOptions ?? [];
  const selectedValues: string[] = (column.getFilterValue() as string[]) ?? [];

  const handleToggle = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    column.setFilterValue(newValues.length > 0 ? newValues : undefined);
  };

  const handleClear = () => {
    column.setFilterValue(undefined);
  };

  return (
    <div className="flex flex-col gap-2">
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">未配置筛选选项</p>
      ) : (
        options.map((option) => {
          const valueStr = String(option.value);
          return (
            <label key={valueStr} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={selectedValues.includes(valueStr)}
                onCheckedChange={() => handleToggle(valueStr)}
              />
              <span>{option.label}</span>
            </label>
          );
        })
      )}
      {selectedValues.length > 0 && (
        <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 w-full">
          清除
        </Button>
      )}
    </div>
  );
}

/** 多选筛选的 filterFn */
export function selectFilterFn<TData>(
  row: { original: TData },
  columnId: string,
  filterValue: string[],
): boolean {
  const cellValue = (row.original as Record<string, unknown>)[columnId];
  if (cellValue === undefined || cellValue === null) return false;
  if (typeof cellValue === 'string' || typeof cellValue === 'number') {
    return filterValue.includes(String(cellValue));
  }
  return false;
}
