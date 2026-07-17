/**
 * 画布右键菜单（上下文菜单）
 *
 * 基于 Radix ContextMenu 实现双场景菜单：
 * - 组件菜单：右键命中组件时显示（7 组：剪贴板/删除/状态/层级/对齐/分布/成组）
 * - 画布菜单：右键画布空白处时显示（4 组：粘贴/全选/缩放/画布设置）
 *
 * 包裹式组件：用 ContextMenuTrigger asChild 包裹画布容器，
 * 在 onContextMenu 事件中判断目标是组件还是画布空白，切换 mode。
 */

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { MouseEventHandler, ReactElement } from 'react';
import {
  Copy,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  Lock,
  Unlock,
  EyeOff,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Group,
  Ungroup,
  BoxSelect,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { ShortcutBadge } from './shortcut-badge';
import { getShortcutKeys } from '../hooks/shortcuts-registry';
import {
  attachContextMenuRedistributor,
  findComponentIdAtPoint,
  getComponentIdFromElement,
} from '../lib/canvas-event-router';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface CanvasContextMenuProps {
  onShowCanvasSettings: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  children: React.ReactNode;
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
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate whitespace-nowrap">{label}</span>
      {keys && <ShortcutBadge keys={keys} />}
    </>
  );
}

/** 组件菜单：右键命中组件时显示 */
function ComponentMenuItems() {
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const project = useScreenEditorStore((s) => s.project);
  const clipboard = useScreenEditorStore((s) => s.clipboard);

  const copySelectedToClipboard = useScreenEditorStore((s) => s.copySelectedToClipboard);
  const pasteFromClipboard = useScreenEditorStore((s) => s.pasteFromClipboard);
  const duplicateSelected = useScreenEditorStore((s) => s.duplicateSelected);
  const removeSelectedComponents = useScreenEditorStore((s) => s.removeSelectedComponents);
  const setLocked = useScreenEditorStore((s) => s.setLocked);
  const setHidden = useScreenEditorStore((s) => s.setHidden);
  const reorderToTop = useScreenEditorStore((s) => s.reorderToTop);
  const reorderToBottom = useScreenEditorStore((s) => s.reorderToBottom);
  const alignSelectedHorizontal = useScreenEditorStore((s) => s.alignSelectedHorizontal);
  const alignSelectedVertical = useScreenEditorStore((s) => s.alignSelectedVertical);
  const distributeSelectedHorizontal = useScreenEditorStore((s) => s.distributeSelectedHorizontal);
  const distributeSelectedVertical = useScreenEditorStore((s) => s.distributeSelectedVertical);
  const groupSelected = useScreenEditorStore((s) => s.groupSelected);
  const ungroupSelected = useScreenEditorStore((s) => s.ungroupSelected);

  const selectedCount = selectedComponentIds.length;
  const hasSelection = selectedCount > 0;
  const canAlign = selectedCount >= 2;
  const canDistribute = selectedCount >= 3;
  const canGroup = selectedCount >= 2;

  const selectedComponents: ScreenComponent[] = project
    ? project.components.filter((c: ScreenComponent) => selectedComponentIds.includes(c.id))
    : [];
  const allLocked = selectedComponents.every((c: ScreenComponent) => c.status.locked);
  const hasGrouped = selectedComponents.some((c: ScreenComponent) => c.parentId);

  return (
    <>
      {/* 剪贴板 */}
      <ContextMenuGroup>
        <ContextMenuItem onSelect={copySelectedToClipboard} disabled={!hasSelection}>
          <MenuItemContent icon={Copy} label="复制" shortcutId="copy" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={pasteFromClipboard} disabled={!clipboard}>
          <MenuItemContent icon={ClipboardPaste} label="粘贴" shortcutId="paste" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={duplicateSelected} disabled={!hasSelection}>
          <MenuItemContent icon={CopyPlus} label="创建副本" shortcutId="duplicate" />
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      {/* 删除 */}
      <ContextMenuItem
        onSelect={removeSelectedComponents}
        disabled={!hasSelection}
        variant="destructive"
      >
        <MenuItemContent icon={Trash2} label="删除选中" shortcutId="delete" />
      </ContextMenuItem>
      <ContextMenuSeparator />
      {/* 状态 */}
      <ContextMenuGroup>
        <ContextMenuItem onSelect={() => setLocked(selectedComponentIds, !allLocked)}>
          {allLocked ? (
            <Unlock className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Lock className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="flex-1 truncate whitespace-nowrap">{allLocked ? '解锁' : '锁定'}</span>
          <ShortcutBadge keys={getShortcutKeys('lock') ?? ''} />
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setHidden(selectedComponentIds, true)}>
          <EyeOff className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate whitespace-nowrap">隐藏</span>
          <ShortcutBadge keys={getShortcutKeys('hide') ?? ''} />
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      {/* 层级 */}
      <ContextMenuGroup>
        <ContextMenuItem
          onSelect={() => {
            for (const id of selectedComponentIds) reorderToTop(id);
          }}
          disabled={allLocked}
        >
          <MenuItemContent icon={ArrowUpToLine} label="置于顶层" shortcutId="bringToFront" />
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            for (const id of selectedComponentIds) reorderToBottom(id);
          }}
          disabled={allLocked}
        >
          <MenuItemContent icon={ArrowDownToLine} label="置于底层" shortcutId="sendToBack" />
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      {/* 对齐子菜单 */}
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={!canAlign || allLocked}>
          <AlignLeft className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate whitespace-nowrap">对齐</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          <ContextMenuItem onSelect={() => alignSelectedHorizontal('left')}>
            <MenuItemContent icon={AlignLeft} label="左对齐" shortcutId="alignLeft" />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => alignSelectedHorizontal('center')}>
            <MenuItemContent icon={AlignCenter} label="水平居中" shortcutId="alignCenterH" />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => alignSelectedHorizontal('right')}>
            <MenuItemContent icon={AlignRight} label="右对齐" shortcutId="alignRight" />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => alignSelectedVertical('top')}>
            <MenuItemContent icon={AlignStartVertical} label="顶对齐" shortcutId="alignTop" />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => alignSelectedVertical('middle')}>
            <MenuItemContent
              icon={AlignCenterVertical}
              label="垂直居中"
              shortcutId="alignMiddleV"
            />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => alignSelectedVertical('bottom')}>
            <MenuItemContent icon={AlignEndVertical} label="底对齐" shortcutId="alignBottom" />
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      {/* 分布子菜单 */}
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={!canDistribute || allLocked}>
          <AlignHorizontalDistributeCenter className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate whitespace-nowrap">分布</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          <ContextMenuItem onSelect={distributeSelectedHorizontal}>
            <MenuItemContent
              icon={AlignHorizontalDistributeCenter}
              label="水平分布"
              shortcutId="distributeH"
            />
          </ContextMenuItem>
          <ContextMenuItem onSelect={distributeSelectedVertical}>
            <MenuItemContent
              icon={AlignVerticalDistributeCenter}
              label="垂直分布"
              shortcutId="distributeV"
            />
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      {/* 成组 */}
      <ContextMenuGroup>
        <ContextMenuItem onSelect={groupSelected} disabled={!canGroup || allLocked}>
          <MenuItemContent icon={Group} label="成组" shortcutId="group" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={ungroupSelected} disabled={!hasGrouped}>
          <MenuItemContent icon={Ungroup} label="解除成组" shortcutId="ungroup" />
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  );
}

/** 画布菜单：右键画布空白处时显示 */
function CanvasMenuItems({
  onShowCanvasSettings,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
}: {
  onShowCanvasSettings: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
}) {
  const clipboard = useScreenEditorStore((s) => s.clipboard);
  const project = useScreenEditorStore((s) => s.project);
  const selectComponents = useScreenEditorStore((s) => s.selectComponents);
  const pasteFromClipboard = useScreenEditorStore((s) => s.pasteFromClipboard);

  const handleSelectAll = useCallback(() => {
    if (!project) return;
    selectComponents(project.components.map((c: ScreenComponent) => c.id));
  }, [project, selectComponents]);

  return (
    <>
      {/* 剪贴板 */}
      <ContextMenuItem onSelect={pasteFromClipboard} disabled={!clipboard}>
        <MenuItemContent icon={ClipboardPaste} label="粘贴" shortcutId="paste" />
      </ContextMenuItem>
      <ContextMenuSeparator />
      {/* 选择 */}
      <ContextMenuItem onSelect={handleSelectAll} disabled={!project}>
        <MenuItemContent icon={BoxSelect} label="全选" shortcutId="selectAll" />
      </ContextMenuItem>
      <ContextMenuSeparator />
      {/* 视图 */}
      <ContextMenuGroup>
        <ContextMenuItem onSelect={onZoomIn}>
          <MenuItemContent icon={ZoomIn} label="放大" shortcutId="zoomIn" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onZoomOut}>
          <MenuItemContent icon={ZoomOut} label="缩小" shortcutId="zoomOut" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onFitToScreen}>
          <MenuItemContent icon={Maximize} label="适应屏幕" shortcutId="fitToScreen" />
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      {/* 画布配置 */}
      <ContextMenuItem onSelect={onShowCanvasSettings} disabled={!project}>
        <Settings className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate whitespace-nowrap">画布设置...</span>
      </ContextMenuItem>
    </>
  );
}

export function CanvasContextMenu({
  onShowCanvasSettings,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  children,
}: CanvasContextMenuProps) {
  const [mode, setMode] = useState<'component' | 'canvas'>('canvas');
  const [open, setOpen] = useState(false);
  const [menuKey, setMenuKey] = useState(0);
  const openRef = useRef(false);
  const selectComponent = useScreenEditorStore((s) => s.selectComponent);
  const clearSelection = useScreenEditorStore((s) => s.clearSelection);

  const handleOpenChange = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 优先从事件 target 向上查找；若被 Moveable 控制层等覆盖层拦截，
      // 回退到基于坐标的 hit-test 找到真实组件。
      const compId =
        getComponentIdFromElement(e.target as HTMLElement) ??
        findComponentIdAtPoint(e.clientX, e.clientY);
      const currentSelected = useScreenEditorStore.getState().selectedComponentIds;

      if (compId) {
        if (!currentSelected.includes(compId)) {
          selectComponent(compId);
        }
        setMode('component');
      } else {
        clearSelection();
        setMode('canvas');
      }
    },
    [selectComponent, clearSelection],
  );

  // 解决"菜单已打开时再次右键，菜单停留在旧位置/旧mode"的问题。
  //
  // 根因分析：
  // 1. 快速右键时 pointerdown→contextmenu 间隔约 30ms，Radix Presence 因退出动画
  //    （duration-100）保持旧 Content 在 DOM 中未卸载。
  // 2. DismissableLayer 在 pointerdown 捕获阶段触发异步关闭，与 Radix Trigger 的
  //    contextmenu 处理产生竞态——新 contextmenu 到达时 open 状态尚未完成切换，
  //    Radix 认为菜单仍处于 open=true 状态，跳过锚点坐标更新，直接复用旧位置。
  //
  // 修复策略（事件路由层归一化，详见 lib/canvas-event-router.ts）：
  // pointerdown 捕获阶段：仅视觉隐藏旧菜单，不阻止事件传播，
  //   让 DismissableLayer 自然接收 pointerdown 触发异步关闭。
  // contextmenu 捕获阶段：拦截事件，同步关闭菜单并递增 key 强制重建，
  //   等待双 rAF 确保 DOM 清理后重派完整事件序列。
  useEffect(() => {
    const cleanup = attachContextMenuRedistributor({
      isOpen: () => openRef.current,
      // 同步关闭菜单 + 递增 menuKey 强制 ContextMenu 重建（清空 DOM 状态）。
      // 两者合并到同一个 flushSync 内，等价于重构前的原子提交行为。
      onClose: () => {
        flushSync(() => {
          openRef.current = false;
          setOpen(false);
          setMenuKey((k) => k + 1);
        });
      },
      // menuKey 已在 onClose 的 flushSync 内更新，此处无需重复触发
      onMenuKeyBump: () => {},
      // 重派发后若菜单仍未打开（Radix 未接收到事件），主动恢复 open=true
      onReopenIfClosed: () => {
        flushSync(() => {
          openRef.current = true;
          setOpen(true);
        });
      },
    });
    return cleanup;
  }, []);

  const child = (isValidElement(children) ? children : <div>{children}</div>) as ReactElement<{
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
  }>;
  const originalHandler = child.props.onContextMenu;
  const trigger = cloneElement(child, {
    onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => {
      originalHandler?.(e);
      handleContextMenu(e);
    },
  });

  // modal=false：避免 Radix 在菜单打开时设置 body { pointer-events: none }，
  // 否则画布元素会继承 none 导致 Moveable 无法接收 pointerdown，用户右键菜单后无法直接拖拽组件。
  // 关闭 modal 同时取消 trapFocus/scrollLock/aria-hide，对画布上下文菜单场景可接受；
  // 仍保留 DismissableLayer 的外部点击关闭与 Esc 关闭。
  return (
    <ContextMenu key={menuKey} open={open} onOpenChange={handleOpenChange} modal={false}>
      <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {mode === 'component' ? (
          <ComponentMenuItems />
        ) : (
          <CanvasMenuItems
            onShowCanvasSettings={onShowCanvasSettings}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onFitToScreen={onFitToScreen}
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
