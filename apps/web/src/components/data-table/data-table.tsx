import { memo, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnOrderState,
  type ExpandedState,
  type Row,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type ColumnSizingState,
  type RowSelectionState,
  type TableOptions,
  type Updater,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableToolbar } from './data-table-toolbar';
import { DataTablePagination } from './data-table-pagination';
import { DataTableCheckbox } from './data-table-checkbox';
import type { DataTableProps } from './types';
import {
  useVirtualScroll,
  getVirtualScrollMetrics,
  getVirtualScrollContainerStyle,
} from './features/virtual-scroll';
import { useServerSideQuery } from './features/server-side';
import { useTableStatePersistence, loadPersistedState } from './features/state-persistence';
import { createEditableColumns } from './features/cell-editing';
import { createDragHandleColumn } from './features/row-drag';
import {
  validateFeatures,
  mergeFeatureColumnEnhancers,
  mergeFeatureTableOptions,
} from './features/registry';
import { createFeatureContext } from './context';

/** 行渲染片段组件的 props */
interface DataTableRowFragmentProps<TData> {
  row: Row<TData>;
  /** 是否选中（显式传入，确保 memo 能检测到选择状态变化并触发重渲染） */
  isSelected: boolean;
  onRowClick?: (row: TData) => void;
  renderExpandedRowContent?: (row: TData) => React.ReactNode;
  isExpanded: boolean;
  getColSpan?: (row: TData, columnId: string) => number | undefined;
  getRowSpan?: (row: TData, columnId: string) => number | undefined;
}

/** 行渲染片段组件（行 + 可选的展开行），memo 优化大数据量重渲染 */
const DataTableRowFragmentImpl = <TData,>({
  row,
  isSelected,
  onRowClick,
  renderExpandedRowContent,
  isExpanded,
  getColSpan,
  getRowSpan,
}: DataTableRowFragmentProps<TData>) => (
  <>
    <TableRow
      data-state={isSelected ? 'selected' : undefined}
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
      className={onRowClick ? 'cursor-pointer' : undefined}
    >
      {row.getVisibleCells().map((cell) => {
        // 合并单元格处理
        let colSpan: number | undefined;
        let rowSpan: number | undefined;

        if (getColSpan || getRowSpan) {
          const cs = getColSpan?.(row.original, cell.column.id);
          const rs = getRowSpan?.(row.original, cell.column.id);
          if (cs === 0 || rs === 0) return null;
          if (cs && cs > 1) colSpan = cs;
          if (rs && rs > 1) rowSpan = rs;
        }

        return (
          <TableCell key={cell.id} colSpan={colSpan} rowSpan={rowSpan}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
    {isExpanded && renderExpandedRowContent && (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={row.getVisibleCells().length} className="bg-muted/30 p-4">
          {renderExpandedRowContent(row.original)}
        </TableCell>
      </TableRow>
    )}
  </>
);

export const DataTableRowFragment = memo(DataTableRowFragmentImpl) as <TData>(
  props: DataTableRowFragmentProps<TData>,
) => React.ReactElement;

/**
 * 企业级数据表格组件。
 * 基于 @tanstack/react-table v8 + shadcn/ui，支持虚拟滚动、服务端模式、状态持久化等增强功能。
 * 所有新特性通过可选 props 启用，默认行为与基础表格完全一致，向下兼容。
 */
export function DataTable<TData>(allProps: DataTableProps<TData>) {
  const {
    data,
    columns,
    getRowId,
    isLoading = false,
    searchPlaceholder,
    searchColumnIds,
    enableRowSelection = false,
    enableColumnResize = false,
    onBatchDelete,
    batchDeleteConfirmMessage,
    toolbarLeftContent,
    toolbarRightContent,
    emptyIcon,
    emptyTitle = '暂无数据',
    emptyDescription,
    onRowClick,
    className,
    // 性能优化 props
    enableVirtualScroll = false,
    virtualScrollHeight = 400,
    enableServerSide = false,
    serverQuery,
    statePersistence,
    // 交互体验 props
    enableMultiSort = false,
    enableCellEditing = false,
    onCellEdit,
    enableRowDrag = false,
    onRowReorder,
    enableColumnDrag = false,
    // 数据展示 props
    getSubRows,
    renderExpandedRow: renderExpandedRowContent,
    getColSpan,
    getRowSpan,
    // 工程化 props
    features = [],
  } = allProps;
  // enableColumnDrag 预留：列拖拽换序将在列头层使用 @dnd-kit 集成
  void enableColumnDrag;
  // 开发环境验证 feature 插件
  if (features.length > 0) {
    validateFeatures(features);
  }
  // 加载持久化初始状态
  const persistedState = useMemo(() => loadPersistedState(statePersistence), [statePersistence]);

  const [sorting, setSorting] = useState<SortingState>(persistedState.sorting ?? []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    persistedState.columnFilters ?? [],
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    persistedState.columnVisibility ?? {},
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    persistedState.columnSizing ?? {},
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    persistedState.columnOrder ?? [],
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // 服务端模式下的分页状态
  const [pagination, setPagination] = useState(
    persistedState.pagination
      ? {
          pageIndex: persistedState.pagination.pageIndex,
          pageSize: persistedState.pagination.pageSize,
        }
      : { pageIndex: 0, pageSize: 10 },
  );

  const columnsWithExtras = useMemo(() => {
    let result = columns;

    // 单元格编辑：包装可编辑列
    if (enableCellEditing && onCellEdit) {
      result = createEditableColumns(result, onCellEdit);
    }

    // 行拖拽：添加拖拽手柄列
    if (enableRowDrag && onRowReorder) {
      result = [createDragHandleColumn<TData>(), ...result];
    }

    // 行选择：添加选择列
    if (enableRowSelection) {
      const selectionColumn: ColumnDef<TData, unknown> = {
        id: 'selection',
        header: ({ table }) => <DataTableCheckbox table={table} />,
        cell: ({ row }) => <DataTableCheckbox row={row} />,
        size: 40,
        enableSorting: false,
        enableHiding: false,
      };
      result = [selectionColumn, ...result];
    }

    // Feature 插件的列增强（在 table 创建前，ctx.table 为 undefined）
    if (features.length > 0) {
      const ctx = createFeatureContext<TData>(undefined, { ...allProps });
      const enhancers = mergeFeatureColumnEnhancers(features, ctx);
      if (enhancers.length > 0) {
        result = [...enhancers, ...result];
      }
    }

    return result;
  }, [
    columns,
    enableRowSelection,
    enableCellEditing,
    onCellEdit,
    enableRowDrag,
    onRowReorder,
    features,
  ]);

  // 服务端模式的分页更新器
  const handleServerPaginationChange = (updater: Updater<typeof pagination>) => {
    setPagination((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const tableOptions: TableOptions<TData> = {
    data,
    columns: columnsWithExtras,
    getRowId,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      columnOrder: columnOrder.length > 0 ? columnOrder : undefined,
      rowSelection,
      expanded,
      ...(enableServerSide ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: enableServerSide ? undefined : getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows,
    enableRowSelection,
    enableColumnResizing: enableColumnResize,
    columnResizeMode: 'onChange',
    enableMultiSort,
    // 服务端模式配置
    manualPagination: enableServerSide,
    manualSorting: enableServerSide,
    manualFiltering: enableServerSide,
    pageCount: enableServerSide ? (serverQuery?.pageCount ?? -1) : undefined,
    ...(enableServerSide ? { onPaginationChange: handleServerPaginationChange } : {}),
    ...(persistedState.pagination && !enableServerSide
      ? {
          initialState: {
            pagination: {
              pageIndex: persistedState.pagination.pageIndex,
              pageSize: persistedState.pagination.pageSize,
            },
          },
        }
      : {}),
  };

  // 合并 feature 插件的 tableOptions（在 table 创建前，ctx.table 为 undefined）
  if (features.length > 0) {
    const featureCtx = createFeatureContext<TData>(undefined, allProps);
    const featureOptions = mergeFeatureTableOptions(features, featureCtx);
    Object.assign(tableOptions, featureOptions);
  }

  const table = useReactTable(tableOptions);

  // 服务端模式：监听状态变化，透传查询参数
  useServerSideQuery(table, serverQuery, enableServerSide, searchColumnIds);

  // 状态持久化：监听状态变化，debounce 写入
  useTableStatePersistence(table, statePersistence);

  // 虚拟滚动
  const { parentRef, virtualizer, rows } = useVirtualScroll(table, enableVirtualScroll, {
    height: virtualScrollHeight,
  });
  const virtualMetrics = enableVirtualScroll ? getVirtualScrollMetrics(virtualizer) : null;

  // === 共享渲染逻辑 ===

  const renderHeader = () => (
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              colSpan={header.colSpan}
              style={{ width: header.getSize(), position: 'relative' }}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
              {enableColumnResize && header.column.getCanResize() && (
                <div
                  onMouseDown={header.getResizeHandler() as React.MouseEventHandler}
                  onTouchStart={header.getResizeHandler() as React.TouchEventHandler}
                  className={cn(
                    'absolute top-0 -right-1 z-20 flex h-full w-3 cursor-col-resize select-none touch-none justify-center opacity-0 hover:opacity-100',
                    header.column.getIsResizing() && 'opacity-100',
                    'transition-opacity',
                  )}
                >
                  <div
                    className={cn(
                      'h-full w-0.5 rounded-full transition-colors',
                      header.column.getIsResizing()
                        ? 'bg-primary'
                        : 'bg-foreground/20 hover:bg-primary/60',
                    )}
                  />
                </div>
              )}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  );

  const renderEmptyState = () => (
    <TableRow>
      <TableCell colSpan={columnsWithExtras.length} className="h-48 text-center">
        <div className="flex animate-in fade-in zoom-in-95 flex-col items-center gap-3 duration-300">
          {emptyIcon && <div className="text-muted-foreground/60">{emptyIcon}</div>}
          <div className="font-medium">{emptyTitle}</div>
          {emptyDescription && (
            <div className="text-sm text-muted-foreground">{emptyDescription}</div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  const renderSkeleton = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={i} className="hover:bg-transparent">
        {Array.from({ length: columnsWithExtras.length }).map((_, j) => (
          <TableCell key={j}>
            <div className="h-4 w-full max-w-[120px] animate-pulse rounded bg-muted" />
          </TableCell>
        ))}
      </TableRow>
    ));

  return (
    <div className={className}>
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        searchColumnIds={searchColumnIds}
        showBatchActions={enableRowSelection}
        onBatchDelete={onBatchDelete}
        batchDeleteConfirmMessage={batchDeleteConfirmMessage}
        leftContent={toolbarLeftContent}
        rightContent={toolbarRightContent}
      />

      <div className="mt-4 rounded-xl ring-1 ring-foreground/10">
        {enableVirtualScroll ? (
          <div ref={parentRef} style={getVirtualScrollContainerStyle(virtualScrollHeight)}>
            <Table>
              {renderHeader()}
              <TableBody>
                {isLoading ? (
                  renderSkeleton()
                ) : rows.length === 0 ? (
                  renderEmptyState()
                ) : (
                  <>
                    {virtualMetrics && virtualMetrics.paddingTop > 0 && (
                      <tr style={{ height: virtualMetrics.paddingTop }}>
                        <td style={{ padding: 0, border: 0 }} colSpan={columnsWithExtras.length} />
                      </tr>
                    )}
                    {virtualMetrics?.virtualItems.map((virtualItem) => {
                      const row = rows[virtualItem.index];
                      return (
                        <DataTableRowFragment
                          key={row.id}
                          row={row}
                          isSelected={row.getIsSelected()}
                          onRowClick={onRowClick}
                          renderExpandedRowContent={renderExpandedRowContent}
                          isExpanded={row.getIsExpanded()}
                          getColSpan={getColSpan}
                          getRowSpan={getRowSpan}
                        />
                      );
                    })}
                    {virtualMetrics && virtualMetrics.paddingBottom > 0 && (
                      <tr style={{ height: virtualMetrics.paddingBottom }}>
                        <td style={{ padding: 0, border: 0 }} colSpan={columnsWithExtras.length} />
                      </tr>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Table>
            {renderHeader()}
            <TableBody>
              {isLoading
                ? renderSkeleton()
                : table.getRowModel().rows.length === 0
                  ? renderEmptyState()
                  : table
                      .getRowModel()
                      .rows.map((row) => (
                        <DataTableRowFragment
                          key={row.id}
                          row={row}
                          isSelected={row.getIsSelected()}
                          onRowClick={onRowClick}
                          renderExpandedRowContent={renderExpandedRowContent}
                          isExpanded={row.getIsExpanded()}
                          getColSpan={getColSpan}
                          getRowSpan={getRowSpan}
                        />
                      ))}
            </TableBody>
          </Table>
        )}
        <DataTablePagination
          table={table}
          total={enableServerSide ? serverQuery?.total : undefined}
        />
      </div>
    </div>
  );
}
