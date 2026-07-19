/**
 * 项目菜单栏（顶部横向菜单）
 *
 * 包含 4 个 DropdownMenu：文件 / 编辑 / 视图 / 工具
 *
 * 设计原则：
 * - 项目级操作（保存/发布/导入/导出/快照/事件蓝图/代码编辑）通过 props 传入回调
 * - 画布级 store 操作（undo/redo/copy/paste/对齐/参考线）直接从 useScreenEditorStore 取
 * - 快捷键提示从 shortcuts-registry 取，与帮助面板同源
 * - 禁用态基于 store 状态精确计算
 */

import { memo, useMemo } from 'react';
import {
  Save,
  Upload,
  Eye,
  FileDown,
  FileUp,
  History,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  CopyPlus,
  BoxSelect,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Ruler,
  Lock,
  Unlock,
  Eraser,
  Square,
  Sun,
  Moon,
  Settings,
  Workflow,
  Code2,
  Keyboard,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useScreenEditorStore } from '../stores/editor-store';
import { useUiStore } from '@/store';
import { ShortcutBadge } from './shortcut-badge';
import { getShortcutKeys } from '../hooks/shortcuts-registry';

interface ProjectMenubarProps {
  /** 文件级操作回调（在父组件接入 mutation） */
  onSave: () => void;
  onPublish: () => void;
  onPreview: () => void;
  onShowImport: () => void;
  /** 直接触发 JSON 导出下载（不再通过 Dialog） */
  onExport: () => void;
  onShowSnapshotManager: () => void;
  onShowCanvasSettings: () => void;
  onShowEventBlueprint: () => void;
  onShowCodeEditor: () => void;
  onShowShortcutsHelp: () => void;
  /** 视图操作回调 */
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  /** 异步操作进行中状态（用于禁用对应菜单项） */
  isSaving?: boolean;
  isPublishing?: boolean;
}

/** 菜单项的图标 + 文本 + 快捷键徽章组合 */
function MenuItemContent({
  icon: Icon,
  label,
  shortcutId,
}: {
  icon: LucideIcon;
  label: string;
  shortcutId?: string;
}) {
  const keys = shortcutId ? getShortcutKeys(shortcutId) : null;
  return (
    <>
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {keys && <ShortcutBadge keys={keys} />}
    </>
  );
}

export const ProjectMenubar = memo(function ProjectMenubar({
  onSave,
  onPublish,
  onPreview,
  onShowImport,
  onExport,
  onShowSnapshotManager,
  onShowCanvasSettings,
  onShowEventBlueprint,
  onShowCodeEditor,
  onShowShortcutsHelp,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  isSaving = false,
  isPublishing = false,
}: ProjectMenubarProps) {
  // store 状态与 action
  const project = useScreenEditorStore((s) => s.project);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const clipboard = useScreenEditorStore((s) => s.clipboard);
  const canUndo = useScreenEditorStore((s) => s.history.past.length > 0);
  const canRedo = useScreenEditorStore((s) => s.history.future.length > 0);
  const guides = useScreenEditorStore((s) => s.guides);
  const showBorderGuides = useScreenEditorStore((s) => s.showBorderGuides);

  const undo = useScreenEditorStore((s) => s.undo);
  const redo = useScreenEditorStore((s) => s.redo);
  const copySelectedToClipboard = useScreenEditorStore((s) => s.copySelectedToClipboard);
  const pasteFromClipboard = useScreenEditorStore((s) => s.pasteFromClipboard);
  const duplicateSelected = useScreenEditorStore((s) => s.duplicateSelected);
  const removeSelectedComponents = useScreenEditorStore((s) => s.removeSelectedComponents);
  const selectComponents = useScreenEditorStore((s) => s.selectComponents);
  const toggleGuidesVisibility = useScreenEditorStore((s) => s.toggleGuidesVisibility);
  const toggleGuidesLock = useScreenEditorStore((s) => s.toggleGuidesLock);
  const clearGuides = useScreenEditorStore((s) => s.clearGuides);
  const toggleBorderGuides = useScreenEditorStore((s) => s.toggleBorderGuides);

  // 主题
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const hasSelection = selectedComponentIds.length > 0;
  const hasGuides = guides.vertical.length > 0 || guides.horizontal.length > 0;

  const handleSelectAll = useMemo(() => {
    return () => {
      if (!project) return;
      // 与快捷键 selectAll 行为一致：过滤锁定和隐藏组件
      const selectableIds = project.components
        .filter((c) => !c.status.locked && !c.status.hidden)
        .map((c) => c.id);
      selectComponents(selectableIds);
    };
  }, [project, selectComponents]);

  return (
    <div className="flex items-center gap-1">
      {/* 文件菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="cursor-pointer px-2.5 py-1 text-sm">
            文件
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onSave} disabled={isSaving}>
              <MenuItemContent icon={Save} label="保存项目" shortcutId="save" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onPublish} disabled={isPublishing}>
              <Upload className="size-4 text-muted-foreground" />
              <span className="flex-1">发布项目</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onPreview}>
              <Eye className="size-4 text-muted-foreground" />
              <span className="flex-1">预览项目</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onShowImport}>
              <FileUp className="size-4 text-muted-foreground" />
              <span className="flex-1">导入 JSON...</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExport} disabled={!project}>
              <FileDown className="size-4 text-muted-foreground" />
              <span className="flex-1">导出 JSON</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onShowSnapshotManager} disabled={!project}>
            <History className="size-4 text-muted-foreground" />
            <span className="flex-1">本地快照管理...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 编辑菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="cursor-pointer px-2.5 py-1 text-sm">
            编辑
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={undo} disabled={!canUndo}>
              <MenuItemContent icon={Undo2} label="撤销" shortcutId="undo" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={redo} disabled={!canRedo}>
              <MenuItemContent icon={Redo2} label="重做" shortcutId="redo" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={copySelectedToClipboard} disabled={!hasSelection}>
              <MenuItemContent icon={Copy} label="复制" shortcutId="copy" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={pasteFromClipboard} disabled={!clipboard}>
              <MenuItemContent icon={ClipboardPaste} label="粘贴" shortcutId="paste" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={duplicateSelected} disabled={!hasSelection}>
              <MenuItemContent icon={CopyPlus} label="创建副本" shortcutId="duplicate" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleSelectAll} disabled={!project}>
              <MenuItemContent icon={BoxSelect} label="全选" shortcutId="selectAll" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={removeSelectedComponents}
            disabled={!hasSelection}
            variant="destructive"
          >
            <MenuItemContent icon={Trash2} label="删除选中" shortcutId="delete" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 视图菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="cursor-pointer px-2.5 py-1 text-sm">
            视图
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onZoomIn}>
              <MenuItemContent icon={ZoomIn} label="放大" shortcutId="zoomIn" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onZoomOut}>
              <MenuItemContent icon={ZoomOut} label="缩小" shortcutId="zoomOut" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onFitToScreen}>
              <MenuItemContent icon={Maximize} label="适应屏幕" shortcutId="fitToScreen" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem
              checked={guides.visible}
              onCheckedChange={toggleGuidesVisibility}
            >
              <Ruler className="size-4 text-muted-foreground" />
              <span className="flex-1">显示参考线</span>
              <ShortcutBadge keys={getShortcutKeys('toggleGuides') ?? ''} />
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={guides.locked}
              onCheckedChange={toggleGuidesLock}
              disabled={!guides.visible}
            >
              {guides.locked ? (
                <Lock className="size-4 text-muted-foreground" />
              ) : (
                <Unlock className="size-4 text-muted-foreground" />
              )}
              <span className="flex-1">锁定参考线</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onSelect={clearGuides} disabled={!guides.visible || !hasGuides}>
              <Eraser className="size-4 text-muted-foreground" />
              <span className="flex-1">清除参考线</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={showBorderGuides} onCheckedChange={toggleBorderGuides}>
            <Square className="size-4 text-muted-foreground" />
            <span className="flex-1">组件边框参考线</span>
            <ShortcutBadge keys={getShortcutKeys('toggleBorderGuides') ?? ''} />
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <span className="px-1.5 py-1 text-xs font-medium text-muted-foreground">主题</span>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(v) => setTheme(v as 'light' | 'dark')}
            >
              <DropdownMenuRadioItem value="light">
                <Sun className="size-4 text-muted-foreground" />
                <span className="flex-1">亮色</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="size-4 text-muted-foreground" />
                <span className="flex-1">暗色</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onShowCanvasSettings} disabled={!project}>
            <Settings className="size-4 text-muted-foreground" />
            <span className="flex-1">画布设置...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 工具菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="cursor-pointer px-2.5 py-1 text-sm">
            工具
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onShowEventBlueprint}>
              <Workflow className="size-4 text-muted-foreground" />
              <span className="flex-1">事件蓝图</span>
              <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Beta
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShowCodeEditor}>
              <Code2 className="size-4 text-muted-foreground" />
              <span className="flex-1">代码编辑</span>
              <span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Beta
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onShowShortcutsHelp}>
            <MenuItemContent icon={Keyboard} label="快捷键帮助" shortcutId="showHelp" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
