import type { ReactNode } from 'react';
import type {
  CellContext,
  ColumnDef,
  HeaderContext,
  Row,
  Table,
  TableOptions,
  TableState,
} from '@tanstack/react-table';
import type { TableQuery } from '@nebula/shared';

/**
 * Feature 插件上下文，提供给插件访问 table 实例与 props 的能力。
 * table 和 getState 在列增强阶段（table 创建前）可能为 undefined。
 */
export interface FeatureContext<TData> {
  table: Table<TData> | undefined;
  props: DataTableProps<TData>;
  getState: (() => TableState) | undefined;
}

/**
 * 统一插槽定义，所有渲染插槽的 render props 签名。
 * 插槽优先级：列定义中的 cell/header > feature 插件注入 > 默认渲染。
 */
export interface DataTableSlots<TData> {
  /** 列头渲染插槽 */
  renderHeader?: (ctx: HeaderContext<TData, unknown>) => ReactNode;
  /** 单元格渲染插槽 */
  renderCell?: (ctx: CellContext<TData, unknown>) => ReactNode;
  /** 行渲染插槽 */
  renderRow?: (row: Row<TData>, cells: ReactNode) => ReactNode;
  /** 工具栏渲染插槽 */
  renderToolbar?: (table: Table<TData>) => ReactNode;
  /** 分页渲染插槽 */
  renderPagination?: (table: Table<TData>) => ReactNode;
  /** 空状态渲染插槽 */
  renderEmpty?: () => ReactNode;
  /** 主从展开内容渲染插槽 */
  renderExpandedContent?: (row: Row<TData>) => ReactNode;
}

/**
 * Feature 插件接口。
 * 每个增强功能模块化为独立插件，通过 features prop 组合启用。
 */
export interface DataTableFeature<TData> {
  /** 插件唯一标识 */
  id: string;
  /** 依赖的其他插件 id 列表 */
  deps?: string[];
  /** 注入 TanStack Table options */
  tableOptions?: (ctx: FeatureContext<TData>) => Partial<TableOptions<TData>>;
  /** 注入列定义增强（如选择列、拖拽手柄列等） */
  columnEnhancers?: (ctx: FeatureContext<TData>) => ColumnDef<TData, unknown>[];
  /** 注入渲染插槽 */
  renderSlots?: Partial<DataTableSlots<TData>>;
  /** 状态初始化 */
  initialState?: Partial<TableState>;
}

/**
 * 状态持久化配置。
 */
export interface StatePersistenceConfig {
  /** 存储方式 */
  storage: 'localStorage' | 'url';
  /** 持久化 key（需包含表格唯一标识） */
  key: string;
  /** 需持久化的状态切片 */
  include?: ('sorting' | 'columnVisibility' | 'columnSizing' | 'columnOrder' | 'pagination')[];
}

/**
 * 服务端模式查询配置。
 */
export interface ServerQueryConfig {
  /** 总页数（由 PaginatedResponse.totalPages 提供） */
  pageCount?: number;
  /** 总记录数（由 PaginatedResponse.total 提供） */
  total?: number;
  /** 查询参数变化回调，消费方用 TanStack Query 请求数据 */
  onQueryChange?: (query: TableQuery) => void;
}

/**
 * 增强后的 DataTableProps（向后兼容扩展）。
 * 所有新增字段均为可选，默认行为与现有 DataTable 完全一致。
 */
export interface DataTableProps<TData> {
  // === 现有 props（保持不变） ===
  /** 表格数据 */
  data: TData[];
  /** 列定义 */
  columns: ColumnDef<TData, any>[];
  /** 行 ID 提取函数，默认为 (row) => row.id */
  getRowId?: (row: TData) => string;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 搜索绑定的列 ID 列表，支持多列同时搜索 */
  searchColumnIds?: string[];
  /** 是否显示行选择 */
  enableRowSelection?: boolean;
  /** 是否显示列宽调整 */
  enableColumnResize?: boolean;
  /** 批量删除回调 */
  onBatchDelete?: (rows: TData[]) => void;
  /** 批量删除确认提示 */
  batchDeleteConfirmMessage?: string;
  /** 自定义工具栏左侧内容 */
  toolbarLeftContent?: ReactNode;
  /** 自定义工具栏右侧内容 */
  toolbarRightContent?: ReactNode;
  /** 空状态图标 */
  emptyIcon?: ReactNode;
  /** 空状态标题 */
  emptyTitle?: string;
  /** 空状态描述 */
  emptyDescription?: string;
  /** 行点击回调 */
  onRowClick?: (row: TData) => void;
  /** 表格类名 */
  className?: string;

  // === 新增：Feature 插件 ===
  /** Feature 插件列表，按顺序组合 */
  features?: DataTableFeature<TData>[];

  // === 新增：性能优化 ===
  /** 是否启用虚拟滚动 */
  enableVirtualScroll?: boolean;
  /** 虚拟滚动容器高度（px 或 CSS 字符串） */
  virtualScrollHeight?: number | string;
  /** 是否启用服务端模式（分页/排序/筛选由后端处理） */
  enableServerSide?: boolean;
  /** 服务端模式查询配置 */
  serverQuery?: ServerQueryConfig;
  /** 状态持久化配置 */
  statePersistence?: StatePersistenceConfig;

  // === 新增：交互体验 ===
  /** 是否启用多列排序（Shift+点击追加） */
  enableMultiSort?: boolean;
  /** 是否启用单元格编辑 */
  enableCellEditing?: boolean;
  /** 单元格编辑回调 */
  onCellEdit?: (row: TData, columnId: string, newValue: unknown) => void | Promise<void>;
  /** 是否启用行拖拽排序 */
  enableRowDrag?: boolean;
  /** 行拖拽完成回调 */
  onRowReorder?: (newData: TData[]) => void;
  /** 是否启用列拖拽换序 */
  enableColumnDrag?: boolean;

  // === 新增：数据展示 ===
  /** 树形数据子行提取函数 */
  getSubRows?: (row: TData) => TData[] | undefined;
  /** 主从展开行渲染插槽 */
  renderExpandedRow?: (row: TData) => ReactNode;
  /** 合并单元格：列跨度回调 */
  getColSpan?: (row: TData, columnId: string) => number | undefined;
  /** 合并单元格：行跨度回调 */
  getRowSpan?: (row: TData, columnId: string) => number | undefined;

  // === 新增：工程化 ===
  /** 自定义渲染插槽 */
  slots?: Partial<DataTableSlots<TData>>;
}

/**
 * 列元数据扩展，用于声明列的可编辑性、筛选类型等增强信息。
 * 通过 columnDef.meta 字段传递。
 */
export interface DataTableColumnMeta<TData> {
  /** 是否可编辑 */
  editable?: boolean;
  /** 编辑器类型 */
  editorType?: 'text' | 'number' | 'select' | 'date';
  /** 编辑器选项（select 类型使用） */
  editorOptions?: { label: string; value: string | number }[];
  /** 筛选器类型 */
  filterType?: 'text' | 'number-range' | 'date-range' | 'select';
  /** 筛选器选项（select 类型使用） */
  filterOptions?: { label: string; value: string | number }[];
  /** 是否允许拖拽排序（行级） */
  draggable?: boolean;
  /** 自定义校验 schema（Zod） */
  validate?: (value: unknown, row: TData) => string | undefined;
}
