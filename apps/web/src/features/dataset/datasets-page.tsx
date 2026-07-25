/**
 * 数据集列表页
 *
 * 设计依据：`docs/specs/dataset-management/ui-design.md` §1
 *
 * 功能：
 * - DataTable 展示数据集列表（名称、类型、分类、状态、更新时间、操作）
 * - 搜索 + 类型/状态筛选
 * - 新建（跳转编辑页）/ 编辑（跳转编辑页）/ 删除（确认对话框）
 * - 空状态引导
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper } from '@tanstack/react-table';
import type { Dataset, DatasetType } from '@nebula/shared';
import { useDatasets, useDeleteDataset } from './hooks';
import { DataTable } from '@/components/data-table';
import { confirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Database } from 'lucide-react';

const TYPE_LABELS: Record<DatasetType, string> = {
  static: '静态',
  api: 'API',
  sql: 'SQL',
  websocket: 'WebSocket',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function DatasetsPage() {
  const navigate = useNavigate();
  const { data: datasets, isLoading, error } = useDatasets();
  const deleteMutation = useDeleteDataset();

  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredData = useMemo(() => {
    if (!datasets) return [];
    if (typeFilter === 'all') return datasets;
    return datasets.filter((d) => d.type === typeFilter);
  }, [datasets, typeFilter]);

  const handleCreate = useCallback(() => {
    void navigate({ to: '/dataset/$id', params: { id: 'new' } });
  }, [navigate]);

  const handleEdit = useCallback(
    (dataset: Dataset) => {
      void navigate({ to: '/dataset/$id', params: { id: dataset.id } });
    },
    [navigate],
  );

  const handleDelete = useCallback(
    async (dataset: Dataset) => {
      const ok = await confirmDialog({
        title: '删除数据集',
        description: (
          <>
            确定要删除数据集 <strong>"{dataset.name}"</strong> 吗？此操作将归档数据集，
            引用该数据集的组件将显示警告。
          </>
        ),
      });
      if (!ok) return;
      await deleteMutation.mutateAsync(dataset.id);
    },
    [deleteMutation],
  );

  const columnHelper = createColumnHelper<Dataset>();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: '名称',
        size: 200,
        enableResizing: true,
      }),
      columnHelper.accessor('type', {
        header: '类型',
        size: 100,
        cell: (info) => (
          <Badge variant="secondary">{TYPE_LABELS[info.getValue()] ?? info.getValue()}</Badge>
        ),
      }),
      columnHelper.accessor('category', {
        header: '分类',
        size: 120,
        cell: (info) => info.getValue() ?? '-',
      }),
      columnHelper.accessor('status', {
        header: '状态',
        size: 100,
        cell: (info) =>
          info.getValue() === 'active' ? (
            <Badge variant="default">活跃</Badge>
          ) : (
            <Badge variant="outline">已归档</Badge>
          ),
      }),
      columnHelper.accessor('updatedAt', {
        header: '更新时间',
        size: 120,
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: '操作',
        size: 120,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
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
    [handleEdit, handleDelete],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">数据集管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          新建数据集
        </Button>
      </div>

      {error && <Alert variant="destructive">加载数据集列表失败</Alert>}

      <DataTable
        data={filteredData}
        columns={columns}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="搜索数据集名称..."
        searchColumnIds={['name']}
        enableColumnResize
        emptyIcon={<Database className="size-12" />}
        emptyTitle="暂无数据集"
        emptyDescription="还没有任何数据集，点击上方按钮创建第一个数据集"
        toolbarLeftContent={
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="static">静态</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="sql">SQL</SelectItem>
              <SelectItem value="websocket">WebSocket</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
