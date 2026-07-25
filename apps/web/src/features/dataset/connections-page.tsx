/**
 * 数据源连接管理页
 *
 * 设计依据：`docs/specs/dataset-management/ui-design.md` §5
 *
 * 功能：
 * - DataTable 展示连接列表（名称、类型、状态指示灯、操作）
 * - 行内测试按钮（一键测试连接，更新状态）
 * - 新建/编辑用 Dialog
 * - 删除确认
 */

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createColumnHelper } from '@tanstack/react-table';
import type {
  CreateDataSourceConnectionParams,
  DataSourceConnection,
  DataSourceConnectionType,
} from '@nebula/shared';
import {
  useConnections,
  useCreateConnection,
  useUpdateConnection,
  useDeleteConnection,
  useTestConnection,
} from './hooks';
import { ConnectionForm } from './components/connection-form';
import { DataTable } from '@/components/data-table';
import { confirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Plug, Zap } from 'lucide-react';

const TYPE_LABELS: Record<DataSourceConnectionType, string> = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  'http-api': 'HTTP API',
};

export default function ConnectionsPage() {
  const { data: connections, isLoading, error } = useConnections();
  const createMutation = useCreateConnection();
  const updateMutation = useUpdateConnection();
  const deleteMutation = useDeleteConnection();
  const testMutation = useTestConnection();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<DataSourceConnection | undefined>();

  const handleCreate = useCallback(() => {
    setEditingConn(undefined);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((conn: DataSourceConnection) => {
    setEditingConn(conn);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (conn: DataSourceConnection) => {
      const ok = await confirmDialog({
        title: '删除连接',
        description: (
          <>
            确定要删除连接 <strong>"{conn.name}"</strong> 吗？引用此连接的数据集将无法执行。
          </>
        ),
      });
      if (!ok) return;
      await deleteMutation.mutateAsync(conn.id);
    },
    [deleteMutation],
  );

  const handleTest = useCallback(
    async (conn: DataSourceConnection) => {
      try {
        const result = await testMutation.mutateAsync(conn.id);
        if (result.success) {
          toast.success(`连接测试成功${result.latencyMs ? `（${result.latencyMs}ms）` : ''}`);
        } else {
          toast.error(`连接测试失败${result.errorMessage ? `：${result.errorMessage}` : ''}`);
        }
      } catch {
        // mutation onError 已通过 emitApiError 全局 Toast
      }
    },
    [testMutation],
  );

  const handleFormSubmit = useCallback(
    async (params: Record<string, unknown>) => {
      if (editingConn) {
        await updateMutation.mutateAsync({
          id: editingConn.id,
          params,
        });
      } else {
        await createMutation.mutateAsync(params as CreateDataSourceConnectionParams);
      }
      setDialogOpen(false);
    },
    [editingConn, createMutation, updateMutation],
  );

  const columnHelper = createColumnHelper<DataSourceConnection>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: '名称',
        size: 200,
        enableResizing: true,
      }),
      columnHelper.accessor('type', {
        header: '类型',
        size: 120,
        cell: (info) => (
          <Badge variant="secondary">{TYPE_LABELS[info.getValue()] ?? info.getValue()}</Badge>
        ),
      }),
      columnHelper.accessor('lastTestResult', {
        header: '状态',
        size: 100,
        cell: (info) => {
          const result = info.getValue();
          if (result === 'success') {
            return (
              <span className="flex items-center gap-1.5 text-sm">
                <span className="size-2 rounded-full bg-green-500" />
                正常
              </span>
            );
          }
          if (result === 'fail') {
            return (
              <span className="flex items-center gap-1.5 text-sm">
                <span className="size-2 rounded-full bg-red-500" />
                异常
              </span>
            );
          }
          return (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="size-2 rounded-full bg-gray-400" />
              未测试
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '操作',
        size: 160,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void handleTest(row.original)}
              disabled={testMutation.isPending}
              title="测试连接"
            >
              <Zap className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(row.original)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void handleDelete(row.original)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [handleEdit, handleDelete, handleTest, testMutation.isPending],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">数据源连接</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          新建连接
        </Button>
      </div>

      {error && <Alert variant="destructive">加载连接列表失败</Alert>}

      <DataTable
        data={connections ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="搜索连接名称..."
        searchColumnIds={['name']}
        enableColumnResize
        emptyIcon={<Plug className="size-12" />}
        emptyTitle="暂无数据源连接"
        emptyDescription="还没有任何连接，点击上方按钮创建第一个连接"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingConn ? '编辑连接' : '新建连接'}</DialogTitle>
            <DialogDescription>
              {editingConn ? `正在编辑连接：${editingConn.name}` : '创建一个新的数据源连接'}
            </DialogDescription>
          </DialogHeader>
          <ConnectionForm
            connection={editingConn}
            onSubmit={handleFormSubmit}
            onCancel={() => setDialogOpen(false)}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
