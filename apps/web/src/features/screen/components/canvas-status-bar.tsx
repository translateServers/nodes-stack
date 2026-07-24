/**
 * 画布状态栏（底部）
 *
 * VSCode/Figma 风格的 IDE 状态栏，分三段：
 * - 左侧：当前工具 + 选中信息
 * - 中间：画布尺寸
 * - 右侧：Snap/Guide 开关 + 缩放百分比
 *
 * 高度 28px（h-7），bg-card + border-t，紧凑信息密度。
 */

import { memo } from 'react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { EditorSessionApi } from '../hooks/use-editor-session';
import { getToolById } from '../hooks/tool-registry';
import { useDimensionStore } from './screen-canvas';
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
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);
  const snapEnabled = useScreenEditorStore((s) => s.snapEnabled);
  const guidesVisible = useScreenEditorStore((s) => s.guides.visible);
  const eventsEnabled = useScreenEditorStore((s) => s.eventsEnabled);

  const toggleSnap = useScreenEditorStore((s) => s.toggleSnap);
  const toggleGuidesVisibility = useScreenEditorStore((s) => s.toggleGuidesVisibility);
  const toggleEvents = useScreenEditorStore((s) => s.toggleEvents);

  const dimension = useDimensionStore((s) => s.dimension);

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
            {selectedCount === 0
              ? '未选中'
              : selectedCount === 1
                ? (selectedComponentName ?? '已选中 1 个')
                : `已选中 ${selectedCount} 个组件`}
          </span>
        </div>

        {/* 中间：拖拽时显示实时尺寸，空闲时显示画布尺寸 */}
        <div className="flex items-center gap-2 font-mono">
          {dimension.visible ? (
            <span className="text-primary">
              X:{dimension.x} Y:{dimension.y}
              {dimension.w > 0 && ` W:${dimension.w}`}
              {dimension.h > 0 && ` H:${dimension.h}`}
              {dimension.rotate !== 0 && ` R:${dimension.rotate}°`}
              {dimension.mode && ` [${dimension.mode}]`}
            </span>
          ) : (
            <span>
              {canvasWidth} × {canvasHeight}
            </span>
          )}
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
          <StatusBarToggle
            label="Event"
            tooltip="画布元素事件（蓝图 componentClick 派发）"
            active={eventsEnabled}
            onClick={toggleEvents}
          />
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
