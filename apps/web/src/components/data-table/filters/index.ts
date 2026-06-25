import type { Column } from '@tanstack/react-table';
import { TextFilter, type FilterRendererProps } from './text-filter';
import {
  NumberRangeFilter,
  numberRangeFilterFn,
  type NumberRangeValue,
} from './number-range-filter';
import { DateRangeFilter, dateRangeFilterFn, type DateRangeValue } from './date-range-filter';
import { SelectFilter, selectFilterFn } from './select-filter';

export type { FilterRendererProps, NumberRangeValue, DateRangeValue };

/** 筛选器类型 */
export type FilterType = 'text' | 'number-range' | 'date-range' | 'select';

/** 筛选器渲染器注册表 */
const filterRenderers: Record<FilterType, React.ComponentType<FilterRendererProps<unknown>>> = {
  text: TextFilter as React.ComponentType<FilterRendererProps<unknown>>,
  'number-range': NumberRangeFilter as React.ComponentType<FilterRendererProps<unknown>>,
  'date-range': DateRangeFilter as React.ComponentType<FilterRendererProps<unknown>>,
  select: SelectFilter as React.ComponentType<FilterRendererProps<unknown>>,
};

/** 根据筛选器类型获取渲染组件 */
export function getFilterRenderer<TData>(
  filterType: FilterType | undefined,
): React.ComponentType<FilterRendererProps<TData>> | undefined {
  if (!filterType) return undefined;
  const renderer = filterRenderers[filterType];
  return renderer as React.ComponentType<FilterRendererProps<TData>> | undefined;
}

/** 内置 filterFn 注册表 */
export const filterFns = {
  numberRange: numberRangeFilterFn,
  dateRange: dateRangeFilterFn,
  select: selectFilterFn,
};

/** 判断列是否有活跃的筛选条件 */
export function hasActiveFilter<TData>(column: Column<TData, unknown>): boolean {
  const value = column.getFilterValue();
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export { TextFilter, NumberRangeFilter, DateRangeFilter, SelectFilter };
