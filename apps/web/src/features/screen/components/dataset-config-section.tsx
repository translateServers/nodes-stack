/**
 * 数据集数据源配置表单（编辑器内集成）
 *
 * 设计依据：`docs/specs/dataset-management/ui-design.md` §4
 *
 * 能力：
 * - 数据集选择（下拉，来自 useDatasets 查询）
 * - 管理 / 刷新 操作（管理在新标签页打开 /dataset）
 * - 参数绑定编辑（参数名 + 来源 + 路径 + 默认值）
 * - 测试执行按钮（调用 useExecuteDataset，展示成功/失败状态）
 *
 * 与 StaticDataForm / ApiConfigForm 一致的草稿语义：
 * - 类型切换为草稿态，应用/取消后经 onSettled 落定
 * - 应用时构建 DataSourceConfig { type: 'dataset', datasetId, paramBindings, ... }
 *   并保留 staticData / apiConfig（便于回切其他类型）
 */

import { useMemo, useState } from 'react';
import {
  type DataSourceConfig,
  type ParamBinding,
  type ParamBindingSource,
  type ScreenComponent,
} from '@nebula/shared';
import { useDatasets, useExecuteDataset } from '@/features/dataset';
import { Button, Input } from '@nebula/screen-sdk';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@nebula/screen-sdk';
import { buildDataSourceMigration } from '../lib/data-source-migration';
import { PanelSection } from './ui-primitives';

/** Radix Select 不接受空字符串值，用哨兵值表示"未选择" */
const NO_DATASET_OPTION = '__none__';

/** 参数绑定来源选项（MVP 仅支持 3 种，component-data / trigger 后续阶段开放） */
const PARAM_SOURCE_OPTIONS: { value: ParamBindingSource; label: string }[] = [
  { value: 'static', label: '静态值' },
  { value: 'component-prop', label: '组件属性' },
  { value: 'url-param', label: 'URL 参数' },
];

interface ParamBindingRow {
  id: string;
  name: string;
  source: ParamBindingSource;
  path: string;
  defaultValue: string;
}

let bindingRowSeq = 0;
function createBindingRow(init?: Partial<ParamBindingRow>): ParamBindingRow {
  bindingRowSeq += 1;
  return {
    id: `binding-${bindingRowSeq}`,
    name: '',
    source: 'static',
    path: '',
    defaultValue: '',
    ...init,
  };
}

/** 将组件的 paramBindings（Record）转为编辑行数组 */
function bindingsToRows(bindings: Record<string, ParamBinding> | undefined): ParamBindingRow[] {
  if (bindings === undefined) return [];
  return Object.entries(bindings).map(([name, binding]) =>
    createBindingRow({
      name,
      source: binding.source,
      path: binding.path,
      defaultValue: binding.defaultValue === undefined ? '' : JSON.stringify(binding.defaultValue),
    }),
  );
}

/** 将编辑行数组转回 paramBindings Record；过滤掉无参数名的行 */
function rowsToBindings(
  rows: readonly ParamBindingRow[],
): Record<string, ParamBinding> | undefined {
  const result: Record<string, ParamBinding> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (name === '') continue;
    const path = row.path.trim();
    const binding: ParamBinding = { source: row.source, path };
    if (row.source === 'static' && row.defaultValue !== '') {
      try {
        binding.defaultValue = JSON.parse(row.defaultValue);
      } catch {
        // 非法 JSON 当作字符串处理
        binding.defaultValue = row.defaultValue;
      }
    }
    result[name] = binding;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

interface DatasetConfigFormProps {
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
  onSettled: () => void;
}

function DatasetConfigForm({ component, onUpdate, onSettled }: DatasetConfigFormProps) {
  const existingDatasetId =
    component.dataSource?.type === 'dataset' ? component.dataSource.datasetId : '';
  const existingBindings =
    component.dataSource?.type === 'dataset' ? component.dataSource.paramBindings : undefined;

  const [datasetIdDraft, setDatasetIdDraft] = useState(existingDatasetId);
  const [bindingRows, setBindingRows] = useState<ParamBindingRow[]>(() =>
    bindingsToRows(existingBindings),
  );
  const [error, setError] = useState<string | null>(null);

  const { data: datasets, isLoading, refetch } = useDatasets();
  const executeMutation = useExecuteDataset();
  const [testResult, setTestResult] = useState<
    { status: 'success'; durationMs: number } | { status: 'error'; message: string } | null
  >(null);

  const selectedDataset = useMemo(
    () => datasets?.find((d) => d.id === datasetIdDraft),
    [datasets, datasetIdDraft],
  );

  const handleApply = () => {
    if (datasetIdDraft === '') {
      setError('请选择一个数据集');
      return;
    }

    const paramBindings = rowsToBindings(bindingRows);
    // 保留 staticData / apiConfig（便于回切其他类型），来自现有 dataSource
    const preservedFields: Pick<DataSourceConfig, 'staticData' | 'apiConfig'> = {};
    if (component.dataSource !== undefined) {
      if (component.dataSource.type !== 'dataset') {
        // 从其他类型切到 dataset：保留其专属字段
        if (component.dataSource.type === 'static') {
          preservedFields.staticData = component.dataSource.staticData;
        } else if (component.dataSource.type === 'api') {
          preservedFields.apiConfig = component.dataSource.apiConfig;
        }
      } else {
        // 已是 dataset：保留原有的 staticData / apiConfig（如果有）
        if (component.dataSource.staticData !== undefined) {
          preservedFields.staticData = component.dataSource.staticData;
        }
        if (component.dataSource.apiConfig !== undefined) {
          preservedFields.apiConfig = component.dataSource.apiConfig;
        }
      }
    }

    const nextDataSource: DataSourceConfig = {
      ...preservedFields,
      type: 'dataset',
      datasetId: datasetIdDraft,
      ...(paramBindings !== undefined ? { paramBindings } : {}),
    };

    setError(null);
    onUpdate(buildDataSourceMigration(component, nextDataSource));
    onSettled();
  };

  const handleCancel = () => {
    setDatasetIdDraft(existingDatasetId);
    setBindingRows(bindingsToRows(existingBindings));
    setError(null);
    onSettled();
  };

  const handleTest = async () => {
    if (datasetIdDraft === '') {
      setError('请先选择数据集');
      return;
    }
    setTestResult(null);
    try {
      const result = await executeMutation.mutateAsync({
        id: datasetIdDraft,
        params: { useMock: true },
      });
      if (result.status === 'success') {
        setTestResult({ status: 'success', durationMs: result.meta.durationMs });
      } else {
        setTestResult({ status: 'error', message: '数据集执行失败' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '测试执行失败';
      setTestResult({ status: 'error', message });
    }
  };

  const handleManageClick = () => {
    window.open('/dataset', '_blank');
  };

  const handleRefreshClick = () => {
    void refetch();
  };

  const updateRow = (id: string, patch: Partial<ParamBindingRow>) => {
    setBindingRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Select
            value={datasetIdDraft || NO_DATASET_OPTION}
            onValueChange={(v) => setDatasetIdDraft(v === NO_DATASET_OPTION ? '' : v)}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-full text-sm"
              aria-label="数据集"
              data-testid="dataset-selector"
            >
              <SelectValue placeholder={isLoading ? '加载中…' : '选择数据集'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DATASET_OPTION}>未选择</SelectItem>
              {datasets?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshClick}
            aria-label="刷新数据集列表"
            title="刷新数据集列表"
          >
            ↻
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManageClick}
            aria-label="管理数据集"
            title="在新标签页管理数据集"
          >
            管理
          </Button>
        </div>
        {selectedDataset?.description && (
          <p className="text-xs text-muted-foreground">{selectedDataset.description}</p>
        )}
      </div>

      <PanelSection
        title="参数绑定"
        collapsible
        testId="dataset-param-bindings"
        contentClassName="space-y-1"
      >
        {bindingRows.map((row) => (
          <div key={row.id} className="space-y-1">
            <div className="flex items-center gap-1">
              <Input
                aria-label="参数名"
                className="h-7 px-2 py-1 text-sm"
                placeholder="参数名"
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label="删除参数绑定"
                onClick={() => setBindingRows((rows) => rows.filter((r) => r.id !== row.id))}
              >
                ×
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Select
                value={row.source}
                onValueChange={(v) => updateRow(row.id, { source: v as ParamBindingSource })}
              >
                <SelectTrigger size="sm" className="h-7 w-full text-sm" aria-label="参数来源">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARAM_SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="路径"
                className="h-7 px-2 py-1 text-sm"
                placeholder={
                  row.source === 'component-prop'
                    ? 'props.date'
                    : row.source === 'url-param'
                      ? 'url.region'
                      : '默认值（JSON）'
                }
                value={row.path}
                onChange={(e) => updateRow(row.id, { path: e.target.value })}
              />
            </div>
            {row.source === 'static' && (
              <Input
                aria-label="默认值"
                className="h-7 px-2 py-1 text-sm"
                placeholder='如 "2026-07-24" 或 100'
                value={row.defaultValue}
                onChange={(e) => updateRow(row.id, { defaultValue: e.target.value })}
              />
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBindingRows((rows) => [...rows, createBindingRow()])}
        >
          添加绑定
        </Button>
      </PanelSection>

      <div className="space-y-1" data-testid="dataset-test-panel">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleTest()}
          disabled={executeMutation.isPending || datasetIdDraft === ''}
          aria-label="测试数据集"
        >
          {executeMutation.isPending ? '执行中…' : '测试数据'}
        </Button>
        {testResult !== null && (
          <p
            role="status"
            data-testid="dataset-test-result"
            className={
              testResult.status === 'success' ? 'text-xs text-green-500' : 'text-xs text-red-400'
            }
          >
            {testResult.status === 'success'
              ? `成功（${testResult.durationMs}ms）`
              : `失败：${testResult.message}`}
          </p>
        )}
      </div>

      {error !== null && (
        <p role="alert" data-testid="datasource-error" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          取消
        </Button>
        <Button size="sm" onClick={handleApply}>
          应用
        </Button>
      </div>
    </div>
  );
}

export { DatasetConfigForm };
