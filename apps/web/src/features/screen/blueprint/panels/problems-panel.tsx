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
import type { Diagnostic } from '../compiler';

interface ProblemsPanelProps {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  onLocateNode: (nodeId: string) => void;
}

const SEVERITY_ORDER = ['error', 'warning', 'info'] as const;

const SEVERITY_CONFIG: Record<string, { label: string; colorClass: string; bgClass: string }> = {
  error: {
    label: '错误',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  warning: {
    label: '警告',
    colorClass: 'text-yellow-600',
    bgClass: 'bg-yellow-600/10',
  },
  info: {
    label: '信息',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
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
        <span>无问题</span>
      </div>
    );
  }

  const grouped = SEVERITY_ORDER.map((level) => ({
    level,
    items: diagnostics.filter((d) => d.level === level),
    config: SEVERITY_CONFIG[level],
  })).filter((g) => g.items.length > 0);

  return (
    <div className="border-t border-border bg-background" data-testid="blueprint-problems-panel">
      <header className="flex items-center gap-3 border-b border-border px-4 py-1.5 text-xs font-medium">
        <span>问题</span>
        {errorCount > 0 && (
          <span className="text-destructive" data-testid="problem-count-error">
            {errorCount} 错误
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-yellow-600" data-testid="problem-count-warning">
            {warningCount} 警告
          </span>
        )}
        {infoCount > 0 && (
          <span className="text-muted-foreground" data-testid="problem-count-info">
            {infoCount} 信息
          </span>
        )}
      </header>
      <ul className="max-h-40 overflow-y-auto">
        {grouped.map((group) =>
          group.items.map((diagnostic, index) => (
            <li
              key={`${diagnostic.code}-${diagnostic.nodeId ?? diagnostic.edgeId ?? index}`}
              className={`flex cursor-pointer items-start gap-2 px-4 py-1.5 text-sm hover:bg-accent ${
                diagnostic.nodeId ? '' : 'cursor-default'
              }`}
              data-testid="problem-item"
              data-severity={diagnostic.level}
              onClick={() => handleClick(diagnostic)}
            >
              <span
                className={`mt-0.5 inline-block size-2 shrink-0 rounded-full ${group.config.bgClass}`}
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
