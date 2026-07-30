/**
 * 执行日志面板（任务 8.3）
 *
 * 按序展示沙盒模拟触发产出的动作执行/跳过/失败结果。
 *
 * 渲染规则（spec: "日志面板按序展示每个动作的执行/跳过结果、跳过原因与耗时；
 * 失败动作红色标记并可点击定位到节点"）：
 * - 模拟中：显示"正在执行..."
 * - trigger 不存在：显示"未找到触发器节点"
 * - 因 error 级诊断被拒绝：显示拒绝原因
 * - executionLogs 为空：显示"尚未执行模拟"空态
 * - executionLogs 非空：
 *   - 标题栏含日志计数（成功/跳过/失败）与清空按钮
 *   - 列表按 results 顺序展示每条 ActionResult
 *   - success：节点 ID + 耗时
 *   - skipped：节点 ID + 跳过原因
 *   - failure：节点 ID + 错误信息 + 耗时；红色标记；可点击定位到节点
 *   - 深度截断时末尾追加告警条目
 *
 * UI/UX 优化：
 * - 状态图标系统：CircleCheck / SkipForward / CircleX 替代纯色圆点，扫读更快
 * - 失败行 hover 显示定位提示（Crosshair），明确可点击性
 * - 各空态/异常态配图标配色，暗色模式适配（amber / emerald 双主题色）
 */

import { useCallback, type JSX } from 'react';
import {
  CircleCheck,
  CircleX,
  Crosshair,
  ListChecks,
  Loader2,
  OctagonX,
  Play,
  SkipForward,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ActionResult, RuleExecutionLog } from '../runtime/types.js';

/** 执行日志面板对外 API */
export interface ExecutionLogPanelProps {
  /** 沙盒运行时产出的执行日志（取最新一次） */
  executionLogs: RuleExecutionLog[];
  /** 是否正在执行模拟 */
  isSimulating: boolean;
  /** 因 error 级诊断被拒绝执行时的拒绝原因（有值表示拒绝） */
  refusalReason?: string;
  /** trigger 节点不存在时为 true */
  triggerNotFound: boolean;
  /** 点击失败动作定位到节点 */
  onLocateNode: (nodeId: string) => void;
  /** 清空日志（可选，未提供则不显示清空按钮） */
  onClear?: () => void;
}

/** 单条 ActionResult 的状态展示配置 */
interface ResultDisplayConfig {
  label: string;
  /** 文本色 Tailwind 类 */
  textClass: string;
  /** 背景色 Tailwind 类 */
  bgClass: string;
  /** 状态图标 */
  Icon: LucideIcon;
  /** 是否可点击定位（failure 为 true） */
  locatable: boolean;
}

const RESULT_CONFIG: Record<ActionResult['kind'], ResultDisplayConfig> = {
  success: {
    label: '成功',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    Icon: CircleCheck,
    locatable: false,
  },
  skipped: {
    label: '跳过',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    Icon: SkipForward,
    locatable: false,
  },
  failure: {
    label: '失败',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    Icon: CircleX,
    locatable: true,
  },
};

/** 统计一次模拟的成功/跳过/失败数量 */
function countResults(log: RuleExecutionLog): {
  success: number;
  skipped: number;
  failure: number;
} {
  let success = 0;
  let skipped = 0;
  let failure = 0;
  for (const r of log.results) {
    if (r.kind === 'success') success++;
    else if (r.kind === 'skipped') skipped++;
    else failure++;
  }
  return { success, skipped, failure };
}

/** 格式化耗时（ms） */
function formatDuration(ms: number): string {
  return `${ms}ms`;
}

export function ExecutionLogPanel({
  executionLogs,
  isSimulating,
  refusalReason,
  triggerNotFound,
  onLocateNode,
  onClear,
}: ExecutionLogPanelProps): JSX.Element {
  const handleResultClick = useCallback(
    (result: ActionResult) => {
      if (result.kind === 'failure') {
        onLocateNode(result.nodeId);
      }
    },
    [onLocateNode],
  );

  // 模拟中状态（优先级最高）
  if (isSimulating) {
    return (
      <div
        className="flex items-center gap-2 border-t border-border bg-background px-4 py-2 text-sm text-muted-foreground"
        data-testid="blueprint-execution-log-loading"
      >
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        <span>正在执行模拟...</span>
      </div>
    );
  }

  // trigger 不存在
  if (triggerNotFound) {
    return (
      <div
        className="flex items-center gap-2 border-t border-border bg-background px-4 py-2 text-sm text-amber-600 dark:text-amber-400"
        data-testid="blueprint-execution-log-trigger-not-found"
      >
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        <span>未找到触发器节点</span>
      </div>
    );
  }

  // 因 error 级诊断被拒绝
  if (refusalReason) {
    return (
      <div
        className="flex items-center gap-2 border-t border-border bg-background px-4 py-2 text-sm text-destructive"
        data-testid="blueprint-execution-log-refused"
      >
        <OctagonX className="size-3.5 shrink-0" aria-hidden="true" />
        <span>触发器存在错误级诊断，已拒绝执行：{refusalReason}</span>
      </div>
    );
  }

  // 无执行日志：空态
  if (executionLogs.length === 0) {
    return (
      <div
        className="flex items-center gap-2 border-t border-border bg-background px-4 py-2 text-sm text-muted-foreground"
        data-testid="blueprint-execution-log-empty"
      >
        <Play className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
        <span>尚未执行模拟</span>
      </div>
    );
  }

  // 取最新一次模拟日志（沙盒运行时每次模拟替换为最新）
  const latestLog = executionLogs[0];
  if (!latestLog) {
    return (
      <div
        className="flex items-center gap-2 border-t border-border bg-background px-4 py-2 text-sm text-muted-foreground"
        data-testid="blueprint-execution-log-empty"
      >
        <Play className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
        <span>尚未执行模拟</span>
      </div>
    );
  }

  const counts = countResults(latestLog);

  return (
    <div
      className="border-t border-border bg-background"
      data-testid="blueprint-execution-log-panel"
    >
      {/* 标题栏 */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-1.5 text-xs font-medium">
        <span className="flex items-center gap-1.5">
          <ListChecks className="size-3.5 text-muted-foreground" aria-hidden="true" />
          执行日志
        </span>
        <span
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          data-testid="execution-log-trigger"
        >
          触发器：{latestLog.triggerNodeId}
        </span>
        {counts.success > 0 && (
          <span
            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
            data-testid="execution-log-count-success"
          >
            <CircleCheck className="size-3" aria-hidden="true" />
            {counts.success} 成功
          </span>
        )}
        {counts.skipped > 0 && (
          <span
            className="flex items-center gap-1 text-muted-foreground"
            data-testid="execution-log-count-skipped"
          >
            <SkipForward className="size-3" aria-hidden="true" />
            {counts.skipped} 跳过
          </span>
        )}
        {counts.failure > 0 && (
          <span
            className="flex items-center gap-1 text-destructive"
            data-testid="execution-log-count-failure"
          >
            <CircleX className="size-3" aria-hidden="true" />
            {counts.failure} 失败
          </span>
        )}
        {onClear && (
          <button
            type="button"
            className="ml-auto inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={onClear}
            aria-label="清空日志"
            data-testid="execution-log-clear"
          >
            <X className="size-3" />
          </button>
        )}
      </header>

      {/* 日志列表 */}
      <ul className="max-h-40 overflow-y-auto">
        {latestLog.results.map((result, index) => {
          const config = RESULT_CONFIG[result.kind];
          const isFailure = result.kind === 'failure';
          const StatusIcon = config.Icon;
          return (
            <li
              key={`${result.nodeId}-${index}`}
              className={`group flex items-start gap-2 px-4 py-1.5 text-sm transition-colors ${
                config.locatable ? 'cursor-pointer hover:bg-accent/60' : ''
              } ${isFailure ? 'bg-destructive/5' : ''}`}
              data-testid="execution-log-item"
              data-result-kind={result.kind}
              data-node-id={result.nodeId}
              onClick={config.locatable ? () => handleResultClick(result) : undefined}
            >
              {/* 状态图标 */}
              <StatusIcon
                className={`mt-[3px] size-3.5 shrink-0 ${config.textClass}`}
                aria-hidden="true"
              />
              {/* 序号 */}
              <span className="shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
              {/* 节点 ID + 状态标签 */}
              <span className="flex-1">
                <span className="font-mono text-xs">{result.nodeId}</span>
                <span
                  className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs ${config.bgClass} ${config.textClass}`}
                  data-testid={`execution-log-status-${index}`}
                >
                  {config.label}
                </span>
              </span>
              {/* 详情：耗时 / 跳过原因 / 错误信息 */}
              {result.kind === 'success' && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDuration(result.durationMs)}
                </span>
              )}
              {result.kind === 'skipped' && (
                <span
                  className="shrink-0 text-xs text-muted-foreground"
                  data-testid={`execution-log-skip-reason-${index}`}
                >
                  {result.reason}
                </span>
              )}
              {result.kind === 'failure' && (
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className="text-xs text-destructive"
                    data-testid={`execution-log-error-${index}`}
                  >
                    {result.error} · {formatDuration(result.durationMs)}
                  </span>
                  <Crosshair
                    className="size-3 text-destructive/60 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
              )}
            </li>
          );
        })}

        {/* 深度截断告警 */}
        {latestLog.truncated && (
          <li
            className="flex items-center gap-2 px-4 py-1.5 text-sm text-amber-600 dark:text-amber-400"
            data-testid="execution-log-truncated"
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            <span>执行因深度超过上限被截断</span>
          </li>
        )}
      </ul>
    </div>
  );
}
