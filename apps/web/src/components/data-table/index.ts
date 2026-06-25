// 核心组件
export { DataTable } from './data-table';

// 子组件
export { DataTableColumnHeader } from './data-table-column-header';
export { DataTablePagination } from './data-table-pagination';
export { DataTableViewOptions } from './data-table-view-options';
export { DataTableToolbar } from './data-table-toolbar';
export { DataTableCheckbox } from './data-table-checkbox';
export { createColumnHelper } from './create-column-helper';

// 类型定义
export type {
  DataTableProps,
  DataTableFeature,
  DataTableSlots,
  DataTableColumnMeta,
  FeatureContext,
  StatePersistenceConfig,
  ServerQueryConfig,
} from './types';

// Context
export { DataTableContext, useDataTableContext, createFeatureContext } from './context';
export type { DataTableContextValue } from './context';

// Feature 插件（统一从 features/ 导出）
export {
  // 性能优化
  createVirtualScrollFeature,
  useVirtualScroll,
  getVirtualScrollMetrics,
  getVirtualScrollContainerStyle,
  type VirtualScrollOptions,
  createServerSideFeature,
  useServerSideQuery,
  buildTableQuery,
  buildSortQuery,
  buildFilterConditions,
  createStatePersistenceFeature,
  useTableStatePersistence,
  loadPersistedState,
  clearPersistedState,
  type PersistableState,
  // 交互体验
  createAdvancedFilterFeature,
  createCellEditingFeature,
  createEditableColumns,
  EditableCell,
  createRowDragFeature,
  createDragHandleColumn,
  reorderData,
  createColumnDragFeature,
  reorderColumns,
  // 数据展示
  createTreeDataFeature,
  wrapWithTreeExpand,
  TreeExpandButton,
  enableTreeRowSelection,
  createMasterDetailFeature,
  createExpandButtonColumn,
  createCellMergeFeature,
  computeCellSpans,
  getCellSpan,
  // 插件注册系统
  createDataTableFeature,
  validateFeatures,
  mergeFeatureTableOptions,
  mergeFeatureColumnEnhancers,
  mergeFeatureSlots,
  mergeFeatureInitialState,
} from './features';

// 内置筛选器
export {
  TextFilter,
  NumberRangeFilter,
  DateRangeFilter,
  SelectFilter,
  getFilterRenderer,
  hasActiveFilter,
  filterFns,
  type FilterType,
  type FilterRendererProps,
} from './filters';

// 内置编辑器
export {
  TextEditor,
  NumberEditor,
  SelectEditor,
  DateEditor,
  getEditor,
  type EditorType,
  type EditorProps,
} from './editors';

// 插槽工具
export { mergeSlots, renderSlot } from './slots/slot-helpers';
export { createDefaultSlots, defaultRenderEmpty } from './slots/default-slots';
