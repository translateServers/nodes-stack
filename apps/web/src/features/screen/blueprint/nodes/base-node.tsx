/**
 * 蓝图节点共享容器（任务 4.2）
 *
 * 三类节点（trigger / action / comment）共享的渲染外壳：
 * - 选中态：蓝色边框高亮
 * - dangling 标记态：红色边框 + 红色阴影
 * - cycle 标记态：橙色虚线边框
 * - 类型图标容器与标签布局
 * - 深色主题配色
 *
 * 节点类型配色：
 * - trigger：琥珀色（amber）
 * - action：绿色（emerald）
 * - comment：灰色（gray）
 */

import type { JSX, ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';

/** 节点类型配色方案 */
export type NodeColorScheme = 'trigger' | 'action' | 'comment' | 'condition';

interface BaseNodeShellProps {
  /** 节点类型配色 */
  colorScheme: NodeColorScheme;
  /** 节点 ID（用于 E2E 定位与诊断映射） */
  nodeId: string;
  /** 节点图标 */
  icon: ReactNode;
  /** 节点标签（类型名称） */
  typeLabel: string;
  /** 节点显示名称（组件名或注释文本） */
  label: string;
  /** 是否被选中（由 React Flow 通过 NodeProps.selected 传入） */
  selected: boolean;
  /** 是否被编译器标记为 dangling */
  dangling?: boolean;
  /** 是否在执行流环中 */
  inCycle?: boolean;
  /**
   * 任务 6.1：该节点最高级别的诊断等级。
   * 用于在节点边框上显示问题标记（error 红色、warning 黄色）。
   * 优先级：dangling > error > warning > cycle > selected > 默认。
   */
  diagnosticLevel?: 'error' | 'warning' | 'info' | null;
  /**
   * 任务 6.2：节点是否正在被定位（从问题面板点击跳转）。
   * 为 true 时添加闪烁动画，1s 后自动清除。
   */
  locating?: boolean;
  /** 是否显示输入引脚（trigger 无输入，comment 无引脚） */
  showInputHandle: boolean;
  /** 是否显示输出引脚（comment 无引脚） */
  showOutputHandle: boolean;
  /**
   * 任务 10.2：输出引脚模式。
   * - 'single'：单个 `out` 引脚（trigger / action 默认）
   * - 'then-else'：then / else 双输出引脚（condition 节点）
   * 仅当 showOutputHandle=true 时生效。
   */
  outputHandleMode?: 'single' | 'then-else';
  /** 子元素（节点配置摘要或编辑器入口） */
  children?: ReactNode;
}

const COLOR_SCHEMES: Record<
  NodeColorScheme,
  { bg: string; border: string; text: string; iconBg: string }
> = {
  trigger: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/50 dark:border-amber-400/50',
    text: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-500/20 dark:bg-amber-500/30',
  },
  action: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/50 dark:border-emerald-400/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    iconBg: 'bg-emerald-500/20 dark:bg-emerald-500/30',
  },
  comment: {
    bg: 'bg-gray-500/10 dark:bg-gray-500/15',
    border: 'border-gray-500/50 dark:border-gray-400/50',
    text: 'text-gray-700 dark:text-gray-300',
    iconBg: 'bg-gray-500/20 dark:bg-gray-500/30',
  },
  condition: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    border: 'border-purple-500/50 dark:border-purple-400/50',
    text: 'text-purple-700 dark:text-purple-300',
    iconBg: 'bg-purple-500/20 dark:bg-purple-500/30',
  },
};

const HANDLE_BASE_CLASS = '!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground';

/**
 * 节点共享外壳组件。
 *
 * 不直接作为 React Flow 节点渲染，由 trigger-node / action-node / comment-node / condition-node 包装使用。
 */
export function BaseNodeShell({
  colorScheme,
  nodeId,
  icon,
  typeLabel,
  label,
  selected,
  dangling = false,
  inCycle = false,
  diagnosticLevel = null,
  locating = false,
  showInputHandle,
  showOutputHandle,
  outputHandleMode = 'single',
  children,
}: BaseNodeShellProps): JSX.Element {
  const scheme = COLOR_SCHEMES[colorScheme];

  // 边框样式：优先级 dangling > error > warning > cycle > selected > 默认
  const borderClass = dangling
    ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.3)]'
    : diagnosticLevel === 'error'
      ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.3)]'
      : diagnosticLevel === 'warning'
        ? 'border-yellow-500 shadow-[0_0_0_2px_rgba(234,179,8,0.3)]'
        : inCycle
          ? 'border-dashed border-orange-500'
          : selected
            ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]'
            : scheme.border;

  // 任务 6.2：定位闪烁动画
  const locateClass = locating ? 'animate-pulse ring-2 ring-blue-400 ring-offset-2' : '';

  return (
    <div
      className={`relative min-w-[180px] max-w-[280px] rounded-md border-2 ${scheme.bg} ${borderClass} ${locateClass} px-3 py-2 transition-colors`}
      data-testid="blueprint-node"
      data-node-id={nodeId}
      data-node-kind={colorScheme}
      data-blueprint-node-selected={selected}
      data-blueprint-node-dangling={dangling}
      data-blueprint-node-cycle={inCycle}
      data-blueprint-node-diagnostic={diagnosticLevel ?? undefined}
      data-locating={locating || undefined}
    >
      {showInputHandle && (
        <Handle type="target" position={Position.Left} className={HANDLE_BASE_CLASS} />
      )}
      <div className="flex items-center gap-2">
        <div
          className={`flex size-6 shrink-0 items-center justify-center rounded ${scheme.iconBg} ${scheme.text}`}
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className={`text-[10px] font-medium uppercase tracking-wide ${scheme.text}`}>
            {typeLabel}
          </span>
          <span className="truncate text-sm font-medium text-foreground" title={label}>
            {label}
          </span>
        </div>
      </div>
      {children && <div className="mt-2 border-t border-border/30 pt-2">{children}</div>}
      {showOutputHandle && outputHandleMode === 'single' && (
        <Handle type="source" position={Position.Right} id="out" className={HANDLE_BASE_CLASS} />
      )}
      {showOutputHandle && outputHandleMode === 'then-else' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="then"
            style={{ top: '40%' }}
            className={HANDLE_BASE_CLASS}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="else"
            style={{ top: '70%' }}
            className={HANDLE_BASE_CLASS}
          />
        </>
      )}
    </div>
  );
}
