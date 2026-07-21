/**
 * 蓝图视口控制工具条（任务 4.6）
 *
 * 提供视口控制按钮：
 * - 放大（Zoom In）
 * - 缩小（Zoom Out）
 * - 重置（Reset）
 * - Fit View（适配所有节点）
 * - 缩放到选区（适配选中节点）
 * - 当前缩放百分比显示
 *
 * 不与画布全局快捷键冲突：仅响应点击事件。
 */

import type { JSX, MouseEvent } from 'react';
import { Maximize, Minus, Plus, Target, ZoomIn } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ViewportToolbarProps {
  /** 当前缩放级别 */
  zoom: number;
  /** Space 是否按下（用于高亮提示） */
  spacePressed: boolean;
  /** 放大按钮回调 */
  onZoomIn: () => void;
  /** 缩小按钮回调 */
  onZoomOut: () => void;
  /** Fit View 按钮 */
  onFitView: () => void;
  /** 缩放到选区按钮 */
  onFitViewToSelection: () => void;
  /** 重置视口按钮 */
  onReset: () => void;
  /** 选中的节点数量（用于禁用缩放到选区按钮） */
  selectedCount?: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 缩放百分比格式化（例如 1.0 → 100%，0.5 → 50%）。
 */
export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** 工具条按钮公共样式 */
const buttonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

/** 缩放百分比显示样式 */
const zoomLabelClassName =
  'inline-flex h-7 min-w-[3.5rem] items-center justify-center rounded bg-slate-800 px-2 text-xs font-medium text-slate-200';

/**
 * 蓝图视口控制工具条。
 *
 * 用法：
 * ```tsx
 * <ViewportToolbar
 *   zoom={zoom}
 *   spacePressed={spacePressed}
 *   onZoomIn={zoomIn}
 *   onZoomOut={zoomOut}
 *   onFitView={fitView}
 *   onFitViewToSelection={() => fitViewToNodes(selectedIds)}
 *   onReset={resetViewport}
 *   selectedCount={selectedIds.length}
 * />
 * ```
 */
export function ViewportToolbar({
  zoom,
  spacePressed,
  onZoomIn,
  onZoomOut,
  onFitView,
  onFitViewToSelection,
  onReset,
  selectedCount = 0,
  className,
}: ViewportToolbarProps): JSX.Element {
  const isFitViewToSelectionDisabled = selectedCount === 0;

  const handleStopPropagation = (event: MouseEvent<HTMLButtonElement>) => {
    // 阻止事件冒泡到 ReactFlow（避免触发节点选择取消等）
    event.stopPropagation();
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-lg backdrop-blur',
        spacePressed && 'ring-2 ring-blue-500/50',
        className,
      )}
      data-testid="viewport-toolbar"
      data-blueprint-viewport-toolbar="true"
      data-space-pressed={spacePressed ? 'true' : 'false'}
    >
      <button
        type="button"
        aria-label="放大"
        title="放大"
        className={buttonClassName}
        onClick={(event) => {
          handleStopPropagation(event);
          onZoomIn();
        }}
        data-zoom-action="zoom-in"
      >
        <Plus className="h-4 w-4" />
      </button>

      <span className={zoomLabelClassName} data-testid="zoom-label" data-zoom-label="true">
        {formatZoom(zoom)}
      </span>

      <button
        type="button"
        aria-label="缩小"
        title="缩小"
        className={buttonClassName}
        onClick={(event) => {
          handleStopPropagation(event);
          onZoomOut();
        }}
        data-zoom-action="zoom-out"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="mx-1 h-5 w-px bg-slate-700" />

      <button
        type="button"
        aria-label="适配视图"
        title="适配所有节点（Fit View）"
        className={buttonClassName}
        onClick={(event) => {
          handleStopPropagation(event);
          onFitView();
        }}
        data-zoom-action="fit-view"
      >
        <Maximize className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="缩放到选区"
        title="缩放到选区"
        className={buttonClassName}
        disabled={isFitViewToSelectionDisabled}
        onClick={(event) => {
          handleStopPropagation(event);
          onFitViewToSelection();
        }}
        data-zoom-action="fit-view-to-selection"
      >
        <Target className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="重置视口"
        title="重置到 100%"
        className={buttonClassName}
        onClick={(event) => {
          handleStopPropagation(event);
          onReset();
        }}
        data-zoom-action="reset"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
    </div>
  );
}
