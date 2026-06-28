import { Input } from '@/components/ui/input';
import type { FilterRendererProps } from './text-filter';

/** 日期范围筛选器值类型（ISO 日期字符串） */
export type DateRangeValue = [string | undefined, string | undefined];

/** 日期范围筛选器：start - end（原生 date input） */
export function DateRangeFilter<TData>({ column }: FilterRendererProps<TData>) {
  const value = (column.getFilterValue() as DateRangeValue) ?? [undefined, undefined];
  const [start, end] = Array.isArray(value) ? value : [undefined, undefined];

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    column.setFilterValue([e.target.value || undefined, end] as DateRangeValue);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    column.setFilterValue([start, e.target.value || undefined] as DateRangeValue);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">开始</span>
        <Input
          type="date"
          value={start ?? ''}
          onChange={handleStartChange}
          className="h-8 flex-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs text-muted-foreground">结束</span>
        <Input type="date" value={end ?? ''} onChange={handleEndChange} className="h-8 flex-1" />
      </div>
    </div>
  );
}

/** 日期范围筛选的 filterFn */
export function dateRangeFilterFn<TData>(
  row: { original: TData },
  columnId: string,
  filterValue: DateRangeValue,
): boolean {
  const [start, end] = filterValue;
  const cellValue = (row.original as Record<string, unknown>)[columnId] as string | undefined;
  if (cellValue === undefined || cellValue === null) return false;
  if (start !== undefined && cellValue < start) return false;
  if (end !== undefined && cellValue > end) return false;
  return true;
}
