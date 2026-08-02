/**
 * 蓝图问题面板（任务 6.2）
 *
 * 底部面板，按 error/warning/info 分级列出编译器诊断。
 * 点击条目定位并闪烁聚焦对应节点。
 *
 * 定位策略：
 * - 使用 ReactFlow 的 fitView 或 setCenter 将目标节点滚动到视口中心
 * - 添加临时 CSS class 触发闪烁动画（1s 后自动移除）
 */

import { useCallback } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Diagnostic } from '../compiler';

interface ProblemsPanelProps {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  onLocateNode: (nodeId: string) => void;
}

const SEVERITY_ORDER = ['error', 'warning', 'info'] as const;

const SEVERITY_CONFIG: Record<
  string,
  { label: string; colorClass: string; dotClass: string; Icon: LucideIcon }
> = {
  error: {
    label: '错误',
    colorClass: 'text-destructive',
    dotClass: 'bg-destructive',
    Icon: CircleAlert,
  },
  warning: {
    label: '警告',
    colorClass: 'text-yellow-600 dark:text-yellow-500',
    dotClass: 'bg-yellow-500',
    Icon: TriangleAlert,
  },
  info: {
    label: '信息',
    colorClass: 'text-muted-foreground',
    dotClass: 'bg-muted-foreground/60',
    Icon: Info,
  },
};

export function ProblemsPanel({
  diagnostics,
  errorCount,
  warningCount,
  infoCount,
  onLocateNode,
}: ProblemsPanelProps) {
  const handleClick = useCallback(
    (diagnostic: Diagnostic) => {
      if (diagnostic.nodeId) {
        onLocateNode(diagnostic.nodeId);
      }
    },
    [onLocateNode],
  );

  if (diagnostics.length === 0) {
    return (
      <div
        className="flex items-center gap-2 border-t border-border bg-background px-4 py-2 text-sm text-muted-foreground"
        data-testid="blueprint-problems-empty"
      >
        <CircleCheck className="size-3.5 text-emerald-500" />
        <span>无问题</span>
      </div>
    );
  }

  // 单次遍历按 severity 分组（避免对 diagnostics 数组多次 filter）
  const buckets = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const list = buckets.get(d.level);
    if (list) list.push(d);
    else buckets.set(d.level, [d]);
  }
  const grouped = SEVERITY_ORDER.flatMap((level) => {
    const items = buckets.get(level);
    if (!items || items.length === 0) return [];
    return [{ level, items, config: SEVERITY_CONFIG[level] }];
  });

  return (
    <div className="border-t border-border bg-background" data-testid="blueprint-problems-panel">
      <header className="flex items-center gap-3 border-b border-border px-4 py-1.5 text-xs font-medium">
        <span>问题</span>
        {errorCount > 0 && (
          <span
            className="flex items-center gap-1 text-destructive"
            data-testid="problem-count-error"
          >
            <CircleAlert className="size-3" />
            {errorCount} 错误
          </span>
        )}
        {warningCount > 0 && (
          <span
            className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500"
            data-testid="problem-count-warning"
          >
            <TriangleAlert className="size-3" />
            {warningCount} 警告
          </span>
        )}
        {infoCount > 0 && (
          <span
            className="flex items-center gap-1 text-muted-foreground"
            data-testid="problem-count-info"
          >
            <Info className="size-3" />
            {infoCount} 信息
          </span>
        )}
      </header>
      <ul className="max-h-40 overflow-y-auto">
        {grouped.map((group) =>
          group.items.map((diagnostic, index) => (
            <li
              key={`${diagnostic.code}-${diagnostic.nodeId ?? diagnostic.edgeId ?? index}`}
              className={`flex items-start gap-2 px-4 py-1.5 text-sm transition-colors ${
                diagnostic.nodeId ? 'cursor-pointer hover:bg-accent/60' : 'cursor-default'
              }`}
              data-testid="problem-item"
              data-severity={diagnostic.level}
              onClick={() => handleClick(diagnostic)}
            >
              <span
                className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${group.config.dotClass}`}
              />
              <span className={`flex-1 ${group.config.colorClass}`}>{diagnostic.message}</span>
              {diagnostic.nodeId && (
                <span className="shrink-0 text-xs text-muted-foreground">{diagnostic.nodeId}</span>
              )}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
