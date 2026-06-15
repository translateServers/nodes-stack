import { type ColumnDef } from '@tanstack/react-table';

/**
 * 创建列定义辅助函数，提供类型安全的列定义。
 *
 * @example
 * const columnHelper = createColumnHelper<UserResponse>();
 * const columns = [
 *   columnHelper.accessor('username', { header: '用户名' }),
 *   columnHelper.display({ id: 'actions', cell: () => <Button>编辑</Button> }),
 * ];
 */
export function createColumnHelper<TData>() {
  return {
    accessor: <TAccessor extends keyof TData>(
      accessor: TAccessor,
      config?: {
        header: string;
        cell?: (value: TData[TAccessor], row: TData) => React.ReactNode;
        size?: number;
        enableSorting?: boolean;
      },
    ): ColumnDef<TData, unknown> => ({
      accessorKey: String(accessor),
      header: config?.header ?? String(accessor),
      size: config?.size,
      enableSorting: config?.enableSorting ?? true,
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
    display: (config: {
      id: string;
      header?: string;
      cell: (row: TData) => React.ReactNode;
      size?: number;
    }): ColumnDef<TData, unknown> => ({
      id: config.id,
      header: config.header,
      size: config.size,
      cell: ({ row }) => config.cell(row.original),
    }),
  };
}
