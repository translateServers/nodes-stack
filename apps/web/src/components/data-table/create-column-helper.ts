import { type ColumnDef } from '@tanstack/react-table';

/**
 * 列配置选项
 */
interface ColumnConfig<TData, TValue> {
  /** 列标题 */
  header: string;
  /** 自定义单元格渲染 */
  cell?: (value: TValue, row: TData) => React.ReactNode;
  /** 列宽度 */
  size?: number;
  /** 最小列宽 */
  minSize?: number;
  /** 最大列宽 */
  maxSize?: number;
  /** 是否启用排序 */
  enableSorting?: boolean;
  /** 是否启用列宽调整 */
  enableResizing?: boolean;
  /** 是否固定列 */
  enablePinning?: boolean;
  /** 是否可隐藏 */
  enableHiding?: boolean;
}

/**
 * 显示列配置选项
 */
interface DisplayColumnConfig<TData> {
  /** 列 ID */
  id: string;
  /** 列标题 */
  header?: string;
  /** 自定义单元格渲染 */
  cell: (row: TData) => React.ReactNode;
  /** 列宽度 */
  size?: number;
  /** 最小列宽 */
  minSize?: number;
  /** 最大列宽 */
  maxSize?: number;
  /** 是否启用列宽调整 */
  enableResizing?: boolean;
  /** 是否固定列 */
  enablePinning?: boolean;
  /** 是否可隐藏 */
  enableHiding?: boolean;
}

/**
 * 创建列定义辅助函数，提供类型安全的列定义。
 *
 * @example
 * const columnHelper = createColumnHelper<UserResponse>();
 * const columns = [
 *   columnHelper.accessor('username', { header: '用户名', enableResizing: true }),
 *   columnHelper.display({ id: 'actions', cell: () => <Button>编辑</Button> }),
 * ];
 */
export function createColumnHelper<TData>() {
  return {
    /**
     * 创建数据访问列
     */
    accessor: <TAccessor extends keyof TData>(
      accessor: TAccessor,
      config?: ColumnConfig<TData, TData[TAccessor]>,
    ): ColumnDef<TData, unknown> => ({
      accessorKey: String(accessor),
      header: config?.header ?? String(accessor),
      size: config?.size,
      minSize: config?.minSize,
      maxSize: config?.maxSize,
      enableSorting: config?.enableSorting ?? true,
      enableResizing: config?.enableResizing ?? false,
      enablePinning: config?.enablePinning ?? false,
      enableHiding: config?.enableHiding ?? true,
      cell: config?.cell
        ? ({ row }) => config.cell!(row.getValue(String(accessor)), row.original)
        : ({ row }) => {
            const value = row.getValue(String(accessor));
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return JSON.stringify(value);
          },
    }),
    /**
     * 创建显示列（不绑定数据字段）
     */
    display: (config: DisplayColumnConfig<TData>): ColumnDef<TData, unknown> => ({
      id: config.id,
      header: config.header,
      size: config.size,
      minSize: config.minSize,
      maxSize: config.maxSize,
      enableResizing: config.enableResizing ?? false,
      enablePinning: config.enablePinning ?? false,
      enableHiding: config.enableHiding ?? true,
      cell: ({ row }) => config.cell(row.original),
    }),
  };
}
