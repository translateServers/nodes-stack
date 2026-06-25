import type { Column } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';

/** 筛选器组件统一 props */
export interface FilterRendererProps<TData> {
  column: Column<TData, unknown>;
}

/** 文本筛选器：支持包含匹配，与现有搜索行为一致 */
export function TextFilter<TData>({ column }: FilterRendererProps<TData>) {
  const value = ((column.getFilterValue() as string | undefined) ?? '') as string;

  return (
    <Input
      value={value}
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      placeholder="输入筛选文本..."
      className="h-8 w-full"
    />
  );
}
