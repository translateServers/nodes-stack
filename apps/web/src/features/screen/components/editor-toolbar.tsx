/**
 * 编辑器顶部工具栏（三段式）
 *
 * - 左段：返回 / 项目名（双击重命名）/ 保存状态徽标
 * - 中段：工具选择器 + 撤销/重做
 * - 右段：缩放控件组 / 项目菜单 / 预览 / 保存 / 发布
 *
 * 视觉：h-12，bg-card + border-b，图标按钮统一走 ToolbarButton（带 Tooltip + 快捷键提示）。
 */

import { memo, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  LoaderCircle,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Save,
  Undo2,
  Upload,
} from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import type { EditorSessionApi } from '../hooks/use-editor-session';
import { getShortcutKeys } from '../hooks/shortcuts-registry';
import { ToolSelector } from './tool-selector';
import { ProjectMenubar } from './project-menubar';
import { ToolbarButton } from './ui-primitives';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ZOOM_PRESETS = [50, 100, 200];

/** 项目名：双击进入内联编辑，Enter/失焦提交，Escape 取消 */
function ProjectName() {
  const name = useScreenEditorStore((s) => s.project?.name);
  const renameProject = useScreenEditorStore((s) => s.renameProject);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (name == null) {
    return <span className="text-sm text-muted-foreground">加载中...</span>;
  }

  const commit = () => {
    renameProject(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label="项目名称"
        className="h-7 w-48 rounded-md border border-ring bg-transparent px-2 text-sm font-medium outline-none ring-3 ring-ring/50"
      />
    );
  }

  return (
    <span
      className="max-w-56 cursor-text truncate rounded px-1 py-0.5 text-sm font-medium text-foreground hover:bg-accent"
      title={`${name}（双击重命名）`}
      onDoubleClick={() => {
        setDraft(name);
        setEditing(true);
      }}
    >
      {name}
    </span>
  );
}

/** 保存状态徽标：未保存更改 / 保存中 / 已保存 HH:mm */
function SaveStatusBadge({
  isSaving,
  lastSavedAt,
}: {
  isSaving: boolean;
  lastSavedAt: Date | null;
}) {
  const isDirty = useScreenEditorStore((s) => s.isDirty);

  if (isSaving) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <LoaderCircle className="size-3 animate-spin" />
        保存中...
      </span>
    );
  }
  if (isDirty) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-500" />
        未保存更改
      </span>
    );
  }
  if (lastSavedAt) {
    const hhmm = `${String(lastSavedAt.getHours()).padStart(2, '0')}:${String(
      lastSavedAt.getMinutes(),
    ).padStart(2, '0')}`;
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3 text-emerald-500" />
        已保存 {hhmm}
      </span>
    );
  }
  return null;
}

/** 缩放控件组：- / 百分比下拉（含预设与适应屏幕）/ + */
function ZoomControls({
  onZoomIn,
  onZoomOut,
  onFitToScreen,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
}) {
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);
  const zoomPercent = Math.round(canvasScale * 100);

  return (
    <div className="flex items-center rounded-md border border-border bg-background p-0.5">
      <ToolbarButton
        tooltip="缩小"
        shortcut={getShortcutKeys('zoomOut') ?? undefined}
        onClick={onZoomOut}
        aria-label="缩小"
        className="size-6"
      >
        <Minus className="size-3.5" />
      </ToolbarButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="缩放比例"
            className="h-6 w-14 cursor-pointer rounded text-center text-xs text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {zoomPercent}%
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-24">
          {ZOOM_PRESETS.map((z) => (
            <DropdownMenuItem
              key={z}
              onSelect={() => setCanvasScale(z / 100)}
              className={cn(z === zoomPercent && 'bg-accent')}
            >
              {z}%
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={onFitToScreen}>
            <Maximize className="size-3.5 text-muted-foreground" />
            适应屏幕
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton
        tooltip="放大"
        shortcut={getShortcutKeys('zoomIn') ?? undefined}
        onClick={onZoomIn}
        aria-label="放大"
        className="size-6"
      >
        <Plus className="size-3.5" />
      </ToolbarButton>
    </div>
  );
}

interface EditorToolbarProps {
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  onPreview: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  isSaving: boolean;
  isPublishing: boolean;
  /** 最近一次保存成功时间（用于状态徽标展示） */
  lastSavedAt: Date | null;
  editorSession: Pick<EditorSessionApi, 'activeTool' | 'setTool'>;
  /** ProjectMenubar 的回调集合（除去 isSaving/isPublishing，由本组件注入） */
  menubarProps: Omit<
    Parameters<typeof ProjectMenubar>[0],
    | 'isSaving'
    | 'isPublishing'
    | 'onSave'
    | 'onPublish'
    | 'onPreview'
    | 'onZoomIn'
    | 'onZoomOut'
    | 'onFitToScreen'
  >;
}

export const EditorToolbar = memo(function EditorToolbar({
  onBack,
  onSave,
  onPublish,
  onPreview,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  isSaving,
  isPublishing,
  lastSavedAt,
  editorSession,
  menubarProps,
}: EditorToolbarProps) {
  const canUndo = useScreenEditorStore((s) => s.history.past.length > 0);
  const canRedo = useScreenEditorStore((s) => s.history.future.length > 0);
  const undo = useScreenEditorStore((s) => s.undo);
  const redo = useScreenEditorStore((s) => s.redo);

  return (
    <header className="flex h-12 items-center gap-2 border-b border-border bg-card px-3">
      {/* 左段：返回 + 项目名 + 保存状态 */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <ToolbarButton tooltip="返回列表" onClick={onBack} aria-label="返回列表">
          <ArrowLeft className="size-4" />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ProjectName />
        <SaveStatusBadge isSaving={isSaving} lastSavedAt={lastSavedAt} />
      </div>

      {/* 中段：工具选择 + 撤销重做（居中） */}
      <div className="flex items-center gap-2">
        <ToolSelector editorSession={editorSession} />
        <div className="flex items-center rounded-md border border-border bg-background p-0.5">
          <ToolbarButton
            tooltip="撤销"
            shortcut={getShortcutKeys('undo') ?? undefined}
            onClick={undo}
            disabled={!canUndo}
            aria-label="撤销"
            className="size-7"
          >
            <Undo2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            tooltip="重做"
            shortcut={getShortcutKeys('redo') ?? undefined}
            onClick={redo}
            disabled={!canRedo}
            aria-label="重做"
            className="size-7"
          >
            <Redo2 className="size-3.5" />
          </ToolbarButton>
        </div>
      </div>

      {/* 右段：缩放 + 菜单 + 操作按钮 */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFitToScreen={onFitToScreen} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ProjectMenubar
          {...menubarProps}
          onSave={onSave}
          onPublish={onPublish}
          onPreview={onPreview}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFitToScreen={onFitToScreen}
          isSaving={isSaving}
          isPublishing={isPublishing}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button variant="ghost" size="sm" onClick={onPreview} className="cursor-pointer">
          <Eye />
          预览
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="cursor-pointer"
        >
          {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
          保存
        </Button>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPublishing}
          className="cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          {isPublishing ? <LoaderCircle className="animate-spin" /> : <Upload />}
          发布
        </Button>
      </div>
    </header>
  );
});
