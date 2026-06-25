import type { DataTableFeature } from '../types';

/**
 * 高级筛选 Feature 插件工厂。
 * 高级筛选 UI 通过列头 DropdownMenu 展示，筛选器组件从 filters/ 目录加载。
 * 筛选条件 Badge 展示在工具栏中。
 */
export function createAdvancedFilterFeature<TData>(): DataTableFeature<TData> {
  return {
    id: 'advanced-filter',
  };
}
