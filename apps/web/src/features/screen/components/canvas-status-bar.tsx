/**
 * 画布状态栏（底部）
 *
 * VSCode/Figma 风格的 IDE 状态栏，分三段：
 * - 左侧：当前工具 + 选中信息
 * - 中间：画布尺寸
 * - 右侧：Snap/Guide/Native 开关 + 缩放百分比
 *
 * 高度 28px（h-7），bg-card + border-t，紧凑信息密度。
 */

import { memo } from 'react';
import {
  MousePointer2,
  Hand,
  Type,
  Square,
  Circle,
  Image as ImageIcon,
  ZoomIn,
  Pipette,
  type LucideIcon,
} from 'lucide-react';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import type { ToolStateMachineApi, EditorTool } from '../hooks/use-tool-state-machine';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];

/** 工具名称 + 图标映射 */
const TOOL_META: Record<EditorTool, { label: string; icon: LucideIcon }> = {
  select: { label: '选择', icon: MousePointer2 },
  hand: { label: '抓手', icon: Hand },
  text: { label: '文本', icon: Type },
  rect: { label: '矩形', icon: Square },
  ellipse: { label: '椭圆', icon: Circle },
  image: { label: '图片', icon: ImageIcon },
  zoom: { label: '缩放', icon: ZoomIn },
  eyedropper: { label: '吸管', icon: Pipette },
};

interface CanvasStatusBarProps {
  toolStateMachine: ToolStateMachineApi;
}

/** 状态栏开关按钮（VSCode 风格） */
function StatusBarToggle({
  label,
  active,
  onClick,
  warning = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  warning?: boolean;
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
        warning && active ? 'text-amber-500' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          active ? (warning ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-muted-foreground/40',
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
  toolStateMachine,
}: CanvasStatusBarProps) {
  const project = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const snapEnabled = useScreenEditorStore((s) => s.snapEnabled);
  const nativeEventEnabled = useScreenEditorStore((s) => s.nativeEventEnabled);
  const guidesVisible = useScreenEditorStore((s) => s.guides.visible);

  const toggleSnap = useScreenEditorStore((s) => s.toggleSnap);
  const toggleNativeEvent = useScreenEditorStore((s) => s.toggleNativeEvent);
  const toggleGuidesVisibility = useScreenEditorStore((s) => s.toggleGuidesVisibility);

  const activeTool = toolStateMachine.activeTool;
  const toolMeta = TOOL_META[activeTool];
  const ToolIcon = toolMeta.icon;

  const selectedCount = selectedComponentIds.length;
  const selectedComponentName =
    selectedCount === 1 && project
      ? project.components.find((c: ScreenComponent) => c.id === selectedComponentIds[0])?.name
      : null;

  const canvasWidth = project?.canvas.width ?? 1920;
  const canvasHeight = project?.canvas.height ?? 1080;
  const zoomPercent = Math.round(canvasScale * 100);

  return (
    <div className="flex h-7 items-center justify-between border-t border-border bg-card px-2 text-xs text-muted-foreground">
      {/* 左侧：工具 + 选中信息 */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-foreground">
          <ToolIcon className="size-3.5" />
          {toolMeta.label}
        </span>
        <Divider />
        <span>
          {selectedCount === 0
            ? '未选中'
            : selectedCount === 1
              ? (selectedComponentName ?? '已选中 1 个')
              : `已选中 ${selectedCount} 个组件`}
        </span>
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
        <StatusBarToggle
          label="Native"
          active={nativeEventEnabled}
          onClick={toggleNativeEvent}
          warning
        />
        <Divider />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 cursor-pointer px-1.5 text-xs"
              aria-label="缩放"
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
