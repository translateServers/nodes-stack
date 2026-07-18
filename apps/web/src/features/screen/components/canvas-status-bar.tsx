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
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import type { EditorSessionApi } from '../hooks/use-editor-session';
import { getToolById } from '../hooks/tool-registry';
import { Button } from '@/components/ui/button';
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
  editorSession: Pick<EditorSessionApi, 'activeTool' | 'interactionState' | 'activeColor'>;
}

/** 状态栏开关按钮（VSCode 风格） */
function StatusBarToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
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
  );
}

/** 分隔符 */
function Divider() {
  return <span className="mx-1 h-3 w-px bg-border" />;
}

export const CanvasStatusBar = memo(function CanvasStatusBar({
  editorSession,
}: CanvasStatusBarProps) {
  const project = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const snapEnabled = useScreenEditorStore((s) => s.snapEnabled);
  const guidesVisible = useScreenEditorStore((s) => s.guides.visible);

  const toggleSnap = useScreenEditorStore((s) => s.toggleSnap);
  const toggleGuidesVisibility = useScreenEditorStore((s) => s.toggleGuidesVisibility);

  const activeTool = editorSession.activeTool;
  const toolDef = getToolById(activeTool);
  // activeTool 受 ToolStateMachine 约束，必然能在注册表中找到；防御性回退到选择工具
  const toolMeta = toolDef ?? getToolById('select')!;
  const ToolIcon = toolMeta.icon;
  const toolName = toolMeta.name;

  // 任务 9.4：吸管工具活动时显示当前活动颜色，作为采样结果反馈
  const activeColor = editorSession.activeColor;
  const isEyedropperActive = activeTool === 'eyedropper';

  const selectedCount = selectedComponentIds.length;
  const selectedComponentName =
    selectedCount === 1 && project
      ? project.components.find((c: ScreenComponent) => c.id === selectedComponentIds[0])?.name
      : null;

  const canvasWidth = project?.canvas.width ?? 1920;
  const canvasHeight = project?.canvas.height ?? 1080;
  const zoomPercent = Math.round(canvasScale * 100);

  return (
    <div
      className="flex h-7 items-center justify-between border-t border-border bg-card px-2 text-xs text-muted-foreground"
      data-testid="canvas-status-bar"
    >
      {/* 左侧：工具 + 选中信息 + 吸管采样颜色 */}
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
        {isEyedropperActive && (
          <>
            <Divider />
            <span
              className="flex items-center gap-1.5"
              aria-label="当前活动颜色"
              data-testid="active-color"
            >
              <span
                className="size-3 rounded-sm border border-border"
                style={{ backgroundColor: activeColor }}
                aria-hidden="true"
              />
              <span className="font-mono uppercase">{activeColor}</span>
            </span>
          </>
        )}
      </div>

      {/* 中间：画布尺寸 */}
      <div className="flex items-center gap-2">
        <span>
          {canvasWidth} × {canvasHeight}
        </span>
      </div>

      {/* 右侧：开关 + 缩放 */}
      <div className="flex items-center">
        <StatusBarToggle label="Snap" active={snapEnabled} onClick={toggleSnap} />
        <StatusBarToggle label="Guide" active={guidesVisible} onClick={toggleGuidesVisibility} />
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
  );
});
