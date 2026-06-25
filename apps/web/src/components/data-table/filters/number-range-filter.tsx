import { Input } from '@/components/ui/input';
import type { FilterRendererProps } from './text-filter';

/** 数字范围筛选器值类型 */
export type NumberRangeValue = [number | undefined, number | undefined];

/** 数字范围筛选器：min - max */
export function NumberRangeFilter<TData>({ column }: FilterRendererProps<TData>) {
  const value = (column.getFilterValue() as NumberRangeValue) ?? [undefined, undefined];
  const [min, max] = Array.isArray(value) ? value : [undefined, undefined];

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value === '' ? undefined : Number(e.target.value);
    column.setFilterValue([num, max] as NumberRangeValue);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value === '' ? undefined : Number(e.target.value);
    column.setFilterValue([min, num] as NumberRangeValue);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={min ?? ''}
        onChange={handleMinChange}
        placeholder="最小值"
        className="h-8 w-full"
      />
      <span className="text-muted-foreground">-</span>
      <Input
        type="number"
        value={max ?? ''}
        onChange={handleMaxChange}
        placeholder="最大值"
        className="h-8 w-full"
      />
    </div>
  );
}

/** 数字范围筛选的 filterFn */
export function numberRangeFilterFn<TData>(
  row: { original: TData },
  columnId: string,
  filterValue: NumberRangeValue,
): boolean {
  const [min, max] = filterValue;
  const cellValue = (row.original as Record<string, unknown>)[columnId] as number | undefined;
  if (cellValue === undefined || cellValue === null) return false;
  if (min !== undefined && cellValue < min) return false;
  if (max !== undefined && cellValue > max) return false;
  return true;
}
