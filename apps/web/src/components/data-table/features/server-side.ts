import { useEffect, useRef } from 'react';
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Table,
} from '@tanstack/react-table';
import type { FilterCondition, SortQuery, TableQuery } from '@nebula/shared';
import type { DataTableFeature, ServerQueryConfig } from '../types';

/**
 * 服务端模式 Feature 插件工厂。
 * 开启后分页/排序/筛选由后端处理，前端仅维护状态并透传查询参数。
 */
export function createServerSideFeature<TData>(): DataTableFeature<TData> {
  return {
    id: 'server-side',
    tableOptions: (ctx) => {
      const { serverQuery } = ctx.props;
      return {
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        pageCount: serverQuery?.pageCount ?? -1,
      };
    },
  };
}

/**
 * 从 TanStack Table 的 sorting state 构建排序查询参数。
 */
export function buildSortQuery(sorting: SortingState): SortQuery[] | undefined {
  if (sorting.length === 0) return undefined;
  return sorting.map((s) => ({
    field: s.id,
    order: s.desc ? 'desc' : 'asc',
  }));
}

/**
 * 从 TanStack Table 的 columnFilters state 构建筛选查询参数。
 * 默认使用 contains 操作符，列可通过 meta.filterType 自定义。
 */
export function buildFilterConditions(filters: ColumnFiltersState): FilterCondition[] | undefined {
  const conditions = filters
    .filter((f) => f.value !== undefined && f.value !== '' && f.value !== null)
    .map((f) => ({
      field: f.id,
      operator: 'contains' as const,
      value: f.value,
    }));
  return conditions.length > 0 ? conditions : undefined;
}

/**
 * 构建完整的 TableQuery 查询参数。
 */
export function buildTableQuery(
  pagination: PaginationState,
  sorting: SortingState,
  filters: ColumnFiltersState,
  search?: string,
): TableQuery {
  const sort = buildSortQuery(sorting);
  const filterConditions = buildFilterConditions(filters);
  return {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sort,
    filters: filterConditions,
    search: search || undefined,
  };
}

/**
 * 服务端模式查询 Hook。
 * 监听分页/排序/筛选状态变化，通过 onQueryChange 回调透传给消费方。
 * 消费方使用 TanStack Query 请求数据。
 */
export function useServerSideQuery<TData>(
  table: Table<TData>,
  config: ServerQueryConfig | undefined,
  enabled: boolean,
  searchColumnIds?: string[],
): void {
  // 缓存上一次查询参数，避免重复触发
  const lastQueryRef = useRef<string>('');

  const state = table.getState();
  const { pageIndex, pageSize } = state.pagination;
  const sorting = state.sorting;
  const columnFilters = state.columnFilters;

  // 从 columnFilters 中提取全局搜索关键词
  const searchValue = searchColumnIds?.[0]
    ? (table.getColumn(searchColumnIds[0])?.getFilterValue() as string | undefined)
    : undefined;

  useEffect(() => {
    if (!enabled || !config?.onQueryChange) return;

    const query = buildTableQuery({ pageIndex, pageSize }, sorting, columnFilters, searchValue);
    const queryKey = JSON.stringify(query);

    // 避免相同查询重复触发
    if (queryKey === lastQueryRef.current) return;
    lastQueryRef.current = queryKey;

    config.onQueryChange(query);
  }, [enabled, config, pageIndex, pageSize, sorting, columnFilters, searchValue]);
}
