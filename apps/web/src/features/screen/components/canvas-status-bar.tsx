/**
 * 画布状态栏（底部）
 *
 * VSCode/Figma 风格的 IDE 状态栏，分三段：
 * - 左侧：当前工具 + 选中信息
 * - 中间：画布尺寸（拖拽时 DimensionIndicator 通过 ref 直写 DOM，不走 React render）
 * - 右侧：Snap/Guide 开关 + 缩放百分比
 *
 * 高度 28px（h-7），bg-card + border-t，紧凑信息密度。
 */

import { memo, useDeferredValue, useEffect, useRef } from 'react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { EditorSessionApi } from '../hooks/use-editor-session';
import { getToolById } from '../hooks/tool-registry';
import { useDimensionStore } from './screen-canvas';
import type { DimensionInfo } from './screen-canvas';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];

interface CanvasStatusBarProps {
  /** 编辑器会话控制器（任务 2.2 起为唯一来源） */
  editorSession: Pick<EditorSessionApi, 'activeTool' | 'interactionState'>;
}

/** 状态栏开关按钮（VSCode 风格） */
function StatusBarToggle({
  label,
  tooltip,
  active,
  onClick,
}: {
  label: string;
  tooltip: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`${label}：${active ? '开启' : '关闭'}`}
          onClick={onClick}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors duration-150 hover:bg-accent',
            'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              active ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
          />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/** 分隔符 */
function Divider() {
  return <span className="mx-1 h-3 w-px bg-border" />;
}

/**
 * 独立尺寸指示器（性能优化）。
 *
 * 拖拽/缩放过程中 dimension 每帧变化，此组件通过 store.subscribe + ref 直接更新 DOM
 * textContent，完全绕过 React 渲染。只有 visible 状态变化（低频：拖拽开始/结束）才会
 * 触发 React render 切换 text-primary class。
 *
 * CanvasStatusBar 主体（工具、选中信息、开关、缩放）不会因拖拽每帧重渲染。
 */
const DimensionIndicator = memo(function DimensionIndicator({
  canvasWidth,
  canvasHeight,
}: {
  canvasWidth: number;
  canvasHeight: number;
}) {
  const dimensionRef = useRef<HTMLSpanElement>(null);
  // 仅订阅 visible（布尔值，引用稳定），拖拽开始/结束时才触发组件 render
  const dimensionVisible = useDimensionStore((s) => s.dimension.visible);

  // 挂载后订阅 dimension 变化，每帧直写 textContent，不走 React render
  useEffect(() => {
    const el = dimensionRef.current;
    if (!el) return;

    const updateText = (dim: DimensionInfo) => {
      if (dim.visible) {
        let text = `X:${dim.x} Y:${dim.y}`;
        if (dim.w > 0) text += ` W:${dim.w}`;
        if (dim.h > 0) text += ` H:${dim.h}`;
        if (dim.rotate !== 0) text += ` R:${dim.rotate}°`;
        if (dim.mode) text += ` [${dim.mode}]`;
        el.textContent = text;
      } else {
        el.textContent = `${canvasWidth} × ${canvasHeight}`;
      }
    };

    // 初始同步一次
    updateText(useDimensionStore.getState().dimension);

    // 订阅后续变化
    const unsubscribe = useDimensionStore.subscribe((state, prev) => {
      if (state.dimension !== prev.dimension) {
        updateText(state.dimension);
      }
    });

    return unsubscribe;
  }, [canvasWidth, canvasHeight]);

  return (
    <span
      ref={dimensionRef}
      className={cn('font-mono', dimensionVisible ? 'text-primary' : '')}
      data-testid="dimension-indicator"
    >
      {/* 初始内容仅在 SSR/hydration 时显示，useEffect 挂载后立即被 textContent 覆盖 */}
      {`${canvasWidth} × ${canvasHeight}`}
    </span>
  );
});

export const CanvasStatusBar = memo(function CanvasStatusBar({
  editorSession,
}: CanvasStatusBarProps) {
  // H3+M6 性能优化：拆分细粒度 selector，避免订阅整个 project 对象。
  // 原实现订阅 `s.project`，导致画布任何字段（组件位置、style、props 等）变化都
  // 触发状态栏重渲染；拆分后仅在 canvas.width/height 或选中组件名真正变化时重渲染。
  const canvasWidth = useScreenEditorStore((s) => s.project?.canvas.width ?? 1920);
  const canvasHeight = useScreenEditorStore((s) => s.project?.canvas.height ?? 1080);
  const selectedCount = useScreenEditorStore((s) => s.selectedComponentIds.length);
  // 仅在选中单个组件时查找其 name；返回 primitive（string | undefined | null），
  // zustand 使用 Object.is 比较避免不必要重渲染
  const selectedComponentName = useScreenEditorStore((s) => {
    if (s.selectedComponentIds.length !== 1) return null;
    const id = s.selectedComponentIds[0];
    if (!id) return null;
    return s.project?.components.find((c) => c.id === id)?.name ?? null;
  });
  // 性能优化（2026-07-26）：与 PropertyPanel/LayerPanel 一致，
  // 用 useDeferredValue 把状态栏对选中态的响应降级为 transition。
  // React 会先提交 Moveable 控制框的高优先级更新（store.targets），
  // 等主线程空闲后再渲染状态栏的选中信息（通常 <50ms，不可感知）。
  const deferredSelectedCount = useDeferredValue(selectedCount);
  const deferredSelectedName = useDeferredValue(selectedComponentName);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);
  const snapEnabled = useScreenEditorStore((s) => s.snapEnabled);
  const guidesVisible = useScreenEditorStore((s) => s.guides.visible);
  const interactionMode = useScreenEditorStore((s) => s.interactionMode);

  const toggleSnap = useScreenEditorStore((s) => s.toggleSnap);
  const toggleGuidesVisibility = useScreenEditorStore((s) => s.toggleGuidesVisibility);
  const setInteractionMode = useScreenEditorStore((s) => s.setInteractionMode);

  const activeTool = editorSession.activeTool;
  const toolDef = getToolById(activeTool);
  // activeTool 受 ToolStateMachine 约束，必然能在注册表中找到；防御性回退到选择工具
  const toolMeta = toolDef ?? getToolById('select')!;
  const ToolIcon = toolMeta.icon;
  const toolName = toolMeta.name;

  const zoomPercent = Math.round(canvasScale * 100);

  return (
    // 自包含 TooltipProvider：组件在单测等无外层 Provider 的场景也能渲染
    <TooltipProvider>
      <div
        className="flex h-7 items-center justify-between border-t border-border bg-card px-2 text-xs text-muted-foreground"
        data-testid="canvas-status-bar"
      >
        {/* 左侧：工具 + 选中信息 */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-foreground">
            <ToolIcon className="size-3.5" />
            {toolName}
          </span>
          <Divider />
          <span data-testid="selection-info">
            {deferredSelectedCount === 0
              ? '未选中'
              : deferredSelectedCount === 1
                ? (deferredSelectedName ?? '已选中 1 个')
                : `已选中 ${deferredSelectedCount} 个组件`}
          </span>
        </div>

        {/* 中间：拖拽时显示实时尺寸（DimensionIndicator 通过 ref 直写 DOM，不走 React render），空闲时显示画布尺寸 */}
        <div className="flex items-center gap-2">
          <DimensionIndicator canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
        </div>

        {/* 右侧：开关 + 缩放 */}
        <div className="flex items-center">
          <StatusBarToggle
            label="Snap"
            tooltip="组件吸附"
            active={snapEnabled}
            onClick={toggleSnap}
          />
          <StatusBarToggle
            label="Guide"
            tooltip="参考线显示"
            active={guidesVisible}
            onClick={toggleGuidesVisibility}
          />
          <Divider />
          {/* 画布交互模式切换：设计 / 交互调试 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="switch"
                aria-checked={interactionMode === 'interactive'}
                aria-label={`画布模式：${interactionMode === 'design' ? '设计' : '交互'}。点击切换到${interactionMode === 'design' ? '交互调试' : '设计'}模式`}
                onClick={() =>
                  setInteractionMode(interactionMode === 'design' ? 'interactive' : 'design')
                }
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors duration-150 hover:bg-accent',
                  interactionMode === 'interactive' ? 'text-amber-500' : 'text-muted-foreground',
                )}
                data-testid="interaction-mode-toggle"
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    interactionMode === 'interactive' ? 'bg-amber-500' : 'bg-muted-foreground/40',
                  )}
                />
                {interactionMode === 'design' ? '设计' : '交互'}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {interactionMode === 'design'
                ? '设计模式：用于选择和调整组件，组件交互与蓝图事件关闭'
                : '交互调试：画布编辑暂停，组件交互与蓝图运行时开启'}
            </TooltipContent>
          </Tooltip>
          <Divider />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 cursor-pointer px-1.5 text-xs"
                aria-label="缩放"
                data-testid="zoom-display"
              >
                {zoomPercent}%
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-20">
              {ZOOM_PRESETS.map((z) => (
                <DropdownMenuItem
                  key={z}
                  onSelect={() => setCanvasScale(z / 100)}
                  className={z === zoomPercent ? 'bg-accent' : ''}
                >
                  {z}%
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
});
