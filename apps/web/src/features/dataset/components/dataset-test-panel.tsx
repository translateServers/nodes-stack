/**
 * 数据集测试结果面板
 *
 * 设计依据：`docs/specs/dataset-management/ui-design.md` §2.2
 *
 * 展示：
 * - 原始响应（后端返回的 raw 数据，只读 JSON）
 * - 解析后数据（应用 dataPath + fieldMapping + filter 后的 parsed 数据）
 * - 执行信息（耗时、缓存命中状态、成功/失败状态）
 *
 * 测试执行通过 useTestDataset hook 调用 POST /dataset/:id/test（不缓存）。
 */

import { useState } from 'react';
import type { DatasetExecuteResult } from '@nebula/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTestDataset } from '../hooks';

const jsonBlockClass =
  'rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs overflow-auto max-h-80 whitespace-pre-wrap break-all';

interface DatasetTestPanelProps {
  datasetId: string | undefined;
}

export function DatasetTestPanel({ datasetId }: DatasetTestPanelProps) {
  const testMutation = useTestDataset();
  const [useMock, setUseMock] = useState(false);
  const [result, setResult] = useState<DatasetExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canTest = Boolean(datasetId);

  const handleTest = async () => {
    if (!datasetId) return;
    setError(null);
    try {
      const res = await testMutation.mutateAsync({ id: datasetId, params: { useMock } });
      setResult(res);
      if (res.status === 'fail') {
        setError('执行失败，请检查配置');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '测试执行失败');
      setResult(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => void handleTest()}
            disabled={!canTest || testMutation.isPending}
          >
            {testMutation.isPending ? '测试中...' : '测试执行'}
          </Button>
          {!canTest && <span className="text-xs text-muted-foreground">请先保存数据集</span>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={useMock} onCheckedChange={setUseMock} />
          使用 Mock
        </label>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {result && (
        <div className="space-y-3">
          {/* 执行信息 */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">状态：</span>
            {result.status === 'success' ? (
              <Badge variant="default">成功</Badge>
            ) : (
              <Badge variant="destructive">失败</Badge>
            )}
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">耗时：</span>
            <span className="font-mono">{result.meta.durationMs}ms</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">缓存：</span>
            {result.meta.fromCache ? (
              <Badge variant="secondary">命中</Badge>
            ) : (
              <Badge variant="outline">未命中</Badge>
            )}
          </div>

          {/* 原始响应 */}
          <div>
            <h4 className="mb-1 text-xs font-semibold text-muted-foreground">原始响应</h4>
            <pre className={jsonBlockClass}>{JSON.stringify(result.raw, null, 2)}</pre>
          </div>

          {/* 解析后数据 */}
          <div>
            <h4 className="mb-1 text-xs font-semibold text-muted-foreground">解析后数据</h4>
            <pre className={jsonBlockClass}>{JSON.stringify(result.parsed, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
