/**
 * 数据集编辑页
 *
 * 设计依据：`docs/specs/dataset-management/ui-design.md` §2
 *
 * 左右分栏布局：
 * - 左侧：配置区（DatasetForm，按 type 动态渲染 config + shape/refresh/cache/mock）
 * - 右侧：测试结果区（DatasetTestPanel，原始 + 解析后 + 执行信息）
 *
 * 路由参数 id = 'new' 时为创建模式，无测试面板（需先保存）。
 */

import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { CreateDatasetParams } from '@nebula/shared';
import { useDataset, useCreateDataset, useUpdateDataset } from './hooks';
import { DatasetForm } from './components/dataset-form';
import { DatasetTestPanel } from './components/dataset-test-panel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface DatasetEditorPageProps {
  id: string;
}

export function DatasetEditorPage({ id }: DatasetEditorPageProps) {
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: dataset, isLoading } = useDataset(isNew ? '' : id);
  const createMutation = useCreateDataset();
  const updateMutation = useUpdateDataset();

  const handleBack = useCallback(() => {
    void navigate({ to: '/dataset' });
  }, [navigate]);

  const handleSubmit = useCallback(
    async (params: Record<string, unknown>) => {
      try {
        if (isNew) {
          await createMutation.mutateAsync(params as CreateDatasetParams);
          toast.success('数据集创建成功');
        } else {
          await updateMutation.mutateAsync({
            id,
            params,
          });
          toast.success('数据集更新成功');
        }
        void navigate({ to: '/dataset' });
      } catch {
        // mutation onError 已通过 emitApiError 全局 Toast
      }
    },
    [isNew, id, createMutation, updateMutation, navigate],
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">加载中...</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={handleBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isNew ? '新建数据集' : `编辑数据集${dataset ? `：${dataset.name}` : ''}`}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 左侧：配置区 */}
        <div className="rounded-lg border border-border bg-background p-4">
          <DatasetForm
            dataset={!isNew ? dataset : undefined}
            onSubmit={handleSubmit}
            onCancel={handleBack}
            isSubmitting={isSubmitting}
          />
        </div>

        {/* 右侧：测试结果区 */}
        <div className="rounded-lg border border-border bg-background p-4">
          <h3 className="mb-3 border-b pb-1 text-sm font-semibold text-foreground">测试结果</h3>
          {isNew ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              保存数据集后可进行测试执行
            </p>
          ) : (
            <DatasetTestPanel datasetId={id} />
          )}
        </div>
      </div>
    </div>
  );
}
