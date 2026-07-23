/**
 * 多选对齐与分布工具条（任务 9.4）
 *
 * 当画布存在多选节点时显示，提供：
 * - 6 种对齐方式：左/水平居中/右/顶/垂直居中/底
 * - 2 种等距分布：水平分布/垂直分布
 *
 * 启用规则：
 * - 对齐按钮：selectedCount >= 2 时可用
 * - 分布按钮：selectedCount >= 3 时可用
 *
 * 交互：
 * - 点击按钮触发 onAlign/onDistribute 回调，由调用方接入 editor-store（一次提交一条历史）
 * - 阻止事件冒泡到 ReactFlow（避免触发节点取消选择等副作用）
 */

import type { JSX, MouseEvent } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AlignMode, DistributeMode } from '../lib/align-distribute';

export interface AlignDistributeToolbarProps {
  /** 当前选中节点数量 */
  selectedCount: number;
  /** 对齐按钮回调（selectedCount >= 2 时触发） */
  onAlign: (mode: AlignMode) => void;
  /** 分布按钮回调（selectedCount >= 3 时触发） */
  onDistribute: (mode: DistributeMode) => void;
  /** 自定义类名 */
  className?: string;
}

/** 工具条按钮公共样式 */
const buttonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

/** 工具条按钮配置 */
interface AlignButtonConfig {
  mode: AlignMode;
  label: string;
  Icon: typeof AlignStartVertical;
}

interface DistributeButtonConfig {
  mode: DistributeMode;
  label: string;
  Icon: typeof AlignHorizontalSpaceBetween;
}

/** 6 个对齐按钮：水平（左/中/右） + 垂直（顶/中/底） */
const ALIGN_BUTTONS: readonly AlignButtonConfig[] = [
  { mode: 'left', label: '左对齐', Icon: AlignStartVertical },
  { mode: 'center-h', label: '水平居中', Icon: AlignCenterVertical },
  { mode: 'right', label: '右对齐', Icon: AlignEndVertical },
  { mode: 'top', label: '顶对齐', Icon: AlignStartHorizontal },
  { mode: 'middle-v', label: '垂直居中', Icon: AlignCenterHorizontal },
  { mode: 'bottom', label: '底对齐', Icon: AlignEndHorizontal },
] as const;

/** 2 个分布按钮：水平/垂直 */
const DISTRIBUTE_BUTTONS: readonly DistributeButtonConfig[] = [
  { mode: 'horizontal', label: '水平等距分布', Icon: AlignHorizontalSpaceBetween },
  { mode: 'vertical', label: '垂直等距分布', Icon: AlignVerticalSpaceBetween },
] as const;

/**
 * 多选对齐与分布工具条。
 *
 * 用法：
 * ```tsx
 * {selectedCount >= 2 && (
 *   <AlignDistributeToolbar
 *     selectedCount={selectedCount}
 *     onAlign={handleAlign}
 *     onDistribute={handleDistribute}
 *   />
 * )}
 * ```
 */
export function AlignDistributeToolbar({
  selectedCount,
  onAlign,
  onDistribute,
  className,
}: AlignDistributeToolbarProps): JSX.Element {
  const isAlignDisabled = selectedCount < 2;
  const isDistributeDisabled = selectedCount < 3;

  function handleStopPropagation(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-lg backdrop-blur',
        className,
      )}
      data-testid="align-distribute-toolbar"
      data-selected-count={selectedCount}
      role="toolbar"
      aria-label="对齐与分布"
    >
      {ALIGN_BUTTONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          title={label}
          className={buttonClassName}
          disabled={isAlignDisabled}
          onClick={(event) => {
            handleStopPropagation(event);
            if (!isAlignDisabled) {
              onAlign(mode);
            }
          }}
          data-align-mode={mode}
          data-align-disabled={isAlignDisabled ? 'true' : 'false'}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <div className="mx-1 h-5 w-px bg-slate-700" />

      {DISTRIBUTE_BUTTONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          aria-label={label}
          title={label}
          className={buttonClassName}
          disabled={isDistributeDisabled}
          onClick={(event) => {
            handleStopPropagation(event);
            if (!isDistributeDisabled) {
              onDistribute(mode);
            }
          }}
          data-distribute-mode={mode}
          data-distribute-disabled={isDistributeDisabled ? 'true' : 'false'}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
