// 性能优化 Feature 插件
export {
  createVirtualScrollFeature,
  useVirtualScroll,
  getVirtualScrollMetrics,
  getVirtualScrollContainerStyle,
  type VirtualScrollOptions,
} from './virtual-scroll';

export {
  createServerSideFeature,
  useServerSideQuery,
  buildTableQuery,
  buildSortQuery,
  buildFilterConditions,
} from './server-side';

export {
  createStatePersistenceFeature,
  useTableStatePersistence,
  loadPersistedState,
  clearPersistedState,
  type PersistableState,
} from './state-persistence';

// 交互体验 Feature 插件
export { createAdvancedFilterFeature } from './advanced-filter';
export {
  createCellEditingFeature,
  createEditableColumns,
  EditableCell,
} from './cell-editing';
export {
  createRowDragFeature,
  createDragHandleColumn,
  reorderData,
} from './row-drag';
export { createColumnDragFeature, reorderColumns } from './column-drag';

// 数据展示 Feature 插件
export {
  createTreeDataFeature,
  wrapWithTreeExpand,
  TreeExpandButton,
  enableTreeRowSelection,
} from './tree-data';
export { createMasterDetailFeature, createExpandButtonColumn } from './master-detail';
export { createCellMergeFeature, computeCellSpans, getCellSpan } from './cell-merge';

// 插件注册系统
export {
  createDataTableFeature,
  validateFeatures,
  mergeFeatureTableOptions,
  mergeFeatureColumnEnhancers,
  mergeFeatureSlots,
  mergeFeatureInitialState,
} from './registry';
