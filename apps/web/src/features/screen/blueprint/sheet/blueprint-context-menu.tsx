/**
 * 蓝图右键菜单（上下文菜单）
 *
 * 基于 Radix ContextMenu 实现三场景菜单：
 * - node：右键命中节点时显示（剪贴板/对齐/分布/删除 + V2 节点专属项）
 * - edge：右键命中边时显示（删除连线）
 * - pane：右键画布空白处时显示（添加节点/粘贴/全选/视图缩放）
 *
 * V2 适配（任务 5.5）：
 * - node 模式下，若选中节点为组件节点且关联了画布组件，新增「定位到画布组件」
 * - node 模式下，若选中节点为全局节点（globalType），新增「配置」打开配置面板
 *
 * 模式切换由调用方（blueprint-sheet）通过 ReactFlow 的
 * onNodeContextMenu / onEdgeContextMenu / onPaneContextMenu 驱动，
 * 这些处理器在事件冒泡到 ContextMenuTrigger 之前执行，保证菜单打开时 mode 已就绪。
 */

import type { JSX, MouseEventHandler, ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  BoxSelect,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Crosshair,
  Locate,
  Maximize,
  Plus,
  Scissors,
  Settings,
  Trash2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
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
import { ShortcutBadge } from '../../components/shortcut-badge';
import { getShortcutKeys } from '../../hooks/shortcuts-registry';
import type { AlignMode, DistributeMode } from '../lib/align-distribute';

/** 菜单模式：node=命中节点；edge=命中边；pane=空白处 */
export type BlueprintContextMenuMode = 'node' | 'edge' | 'pane';

/** 选中节点的 V2 类型（用于 node 模式下条件渲染专属菜单项） */
export type SelectedNodeKind = 'component' | 'global' | 'condition' | 'delay' | 'comment';

/** 全局节点的子类型（仅当选中节点 kind === 'global' 时有效） */
export type SelectedNodeGlobalType = 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo';

interface BlueprintContextMenuProps {
  /** 当前菜单模式（由 ReactFlow 右键事件处理器驱动） */
  mode: BlueprintContextMenuMode;
  /** 当前选中节点数（用于对齐/分布/删除项的禁用态） */
  selectedNodeCount: number;
  /** 复制选中节点及其之间的边 */
  onCopy: () => void;
  /** 剪切选中节点 */
  onCut: () => void;
  /** 从系统剪贴板粘贴 */
  onPaste: () => void;
  /** 就地创建选中节点副本 */
  onDuplicate: () => void;
  /** 删除当前选中的节点与边 */
  onDeleteSelected: () => void;
  /** 全选节点与边 */
  onSelectAll: () => void;
  /** 多选对齐 */
  onAlign: (mode: AlignMode) => void;
  /** 多选分布 */
  onDistribute: (mode: DistributeMode) => void;
  /** 在右键位置呼出搜索面板添加节点 */
  onAddNode: () => void;
  /** 视口放大 */
  onZoomIn: () => void;
  /** 视口缩小 */
  onZoomOut: () => void;
  /** 适应全部节点 */
  onFitView: () => void;
  /** 缩放到选区 */
  onFitViewToSelection: () => void;
  /** V2 任务 5.5：选中节点的 kind（仅 node 模式有效，单选时由调用方推导） */
  selectedNodeKind?: SelectedNodeKind | null;
  /** V2 任务 5.5：选中全局节点的 globalType（仅当 selectedNodeKind === 'global' 时有效） */
  selectedNodeGlobalType?: SelectedNodeGlobalType | null;
  /** V2 任务 5.5：选中组件节点是否关联了画布组件（决定「定位到画布组件」是否可用） */
  selectedNodeHasComponentId?: boolean;
  /** V2 任务 5.5：「定位到画布组件」回调（仅组件节点关联组件时显示） */
  onLocateComponent?: () => void;
  /** V2 任务 5.5：「配置」回调（仅全局节点显示，触发配置面板聚焦） */
  onConfigureGlobal?: () => void;
  children: ReactNode;
}

/** 菜单项的图标 + 文本 + 快捷键徽章组合 */
function MenuItemContent({
  icon: Icon,
  label,
  shortcutId,
  keys,
}: {
  icon: LucideIcon;
  label: string;
  /** shortcuts-registry 中的快捷键 id（优先） */
  shortcutId?: string;
  /** 直接给定快捷键表达式（registry 中不存在时使用，如 'mod+x'） */
  keys?: string;
}) {
  const resolvedKeys = shortcutId ? getShortcutKeys(shortcutId) : (keys ?? null);
  return (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate whitespace-nowrap">{label}</span>
      {resolvedKeys && <ShortcutBadge keys={resolvedKeys} />}
    </>
  );
}

/** 节点菜单：右键命中节点时显示 */
function NodeMenuItems({
  selectedNodeCount,
  selectedNodeKind,
  selectedNodeHasComponentId,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDeleteSelected,
  onAlign,
  onDistribute,
  onLocateComponent,
  onConfigureGlobal,
}: Pick<
  BlueprintContextMenuProps,
  | 'selectedNodeCount'
  | 'selectedNodeKind'
  | 'selectedNodeHasComponentId'
  | 'onCopy'
  | 'onCut'
  | 'onPaste'
  | 'onDuplicate'
  | 'onDeleteSelected'
  | 'onAlign'
  | 'onDistribute'
  | 'onLocateComponent'
  | 'onConfigureGlobal'
>): JSX.Element {
  const hasSelection = selectedNodeCount > 0;
  // 与 AlignDistributeToolbar 对齐：对齐需 >=2，分布需 >=3
  const canAlign = selectedNodeCount >= 2;
  const canDistribute = selectedNodeCount >= 3;
  // V2 任务 5.5：节点专属项仅在单选时显示（多选时节点类型混杂，专属操作语义不清）
  const isSingleSelection = selectedNodeCount === 1;
  // 「定位到画布组件」：仅组件节点（非 global）且关联了画布组件时显示
  const canLocateComponent =
    isSingleSelection &&
    selectedNodeKind === 'component' &&
    selectedNodeHasComponentId === true &&
    Boolean(onLocateComponent);
  // 「配置」：仅全局节点单选时显示
  const canConfigureGlobal =
    isSingleSelection && selectedNodeKind === 'global' && Boolean(onConfigureGlobal);

  return (
    <>
      {/* V2 任务 5.5：节点专属操作（顶部突出位置） */}
      {canLocateComponent && (
        <>
          <ContextMenuGroup>
            <ContextMenuItem onSelect={onLocateComponent}>
              <MenuItemContent icon={Locate} label="定位到画布组件" />
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
        </>
      )}
      {canConfigureGlobal && (
        <>
          <ContextMenuGroup>
            <ContextMenuItem onSelect={onConfigureGlobal}>
              <MenuItemContent icon={Settings} label="配置全局节点" />
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
        </>
      )}
      {/* 剪贴板 */}
      <ContextMenuGroup>
        <ContextMenuItem onSelect={onCopy} disabled={!hasSelection}>
          <MenuItemContent icon={Copy} label="复制" shortcutId="copy" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCut} disabled={!hasSelection}>
          <MenuItemContent icon={Scissors} label="剪切" keys="mod+x" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onPaste}>
          <MenuItemContent icon={ClipboardPaste} label="粘贴" shortcutId="paste" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate} disabled={!hasSelection}>
          <MenuItemContent icon={CopyPlus} label="创建副本" shortcutId="duplicate" />
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      {/* 对齐子菜单 */}
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={!canAlign}>
          <AlignLeft className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate whitespace-nowrap">对齐</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          <ContextMenuItem onSelect={() => onAlign('left')}>
            <MenuItemContent icon={AlignLeft} label="左对齐" shortcutId="alignLeft" />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onAlign('center-h')}>
            <MenuItemContent icon={AlignCenter} label="水平居中" shortcutId="alignCenterH" />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onAlign('right')}>
            <MenuItemContent icon={AlignRight} label="右对齐" shortcutId="alignRight" />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onAlign('top')}>
            <MenuItemContent icon={AlignStartVertical} label="顶对齐" shortcutId="alignTop" />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onAlign('middle-v')}>
            <MenuItemContent
              icon={AlignCenterVertical}
              label="垂直居中"
              shortcutId="alignMiddleV"
            />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onAlign('bottom')}>
            <MenuItemContent icon={AlignEndVertical} label="底对齐" shortcutId="alignBottom" />
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      {/* 分布子菜单 */}
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={!canDistribute}>
          <AlignHorizontalDistributeCenter className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate whitespace-nowrap">分布</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-48">
          <ContextMenuItem onSelect={() => onDistribute('horizontal')}>
            <MenuItemContent
              icon={AlignHorizontalDistributeCenter}
              label="水平分布"
              shortcutId="distributeH"
            />
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onDistribute('vertical')}>
            <MenuItemContent
              icon={AlignVerticalDistributeCenter}
              label="垂直分布"
              shortcutId="distributeV"
            />
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      {/* 删除 */}
      <ContextMenuItem onSelect={onDeleteSelected} disabled={!hasSelection} variant="destructive">
        <MenuItemContent icon={Trash2} label="删除选中" shortcutId="delete" />
      </ContextMenuItem>
    </>
  );
}

/** 边菜单：右键命中边时显示 */
function EdgeMenuItems({
  onDeleteSelected,
}: Pick<BlueprintContextMenuProps, 'onDeleteSelected'>): JSX.Element {
  return (
    <ContextMenuItem onSelect={onDeleteSelected} variant="destructive">
      <MenuItemContent icon={Trash2} label="删除连线" shortcutId="delete" />
    </ContextMenuItem>
  );
}

/** 空白处菜单：右键画布空白时显示 */
function PaneMenuItems({
  selectedNodeCount,
  onAddNode,
  onPaste,
  onSelectAll,
  onZoomIn,
  onZoomOut,
  onFitView,
  onFitViewToSelection,
}: Pick<
  BlueprintContextMenuProps,
  | 'selectedNodeCount'
  | 'onAddNode'
  | 'onPaste'
  | 'onSelectAll'
  | 'onZoomIn'
  | 'onZoomOut'
  | 'onFitView'
  | 'onFitViewToSelection'
>): JSX.Element {
  return (
    <>
      <ContextMenuItem onSelect={onAddNode}>
        <MenuItemContent icon={Plus} label="添加节点..." />
      </ContextMenuItem>
      <ContextMenuItem onSelect={onPaste}>
        <MenuItemContent icon={ClipboardPaste} label="粘贴" shortcutId="paste" />
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={onSelectAll}>
        <MenuItemContent icon={BoxSelect} label="全选" shortcutId="selectAll" />
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem onSelect={onZoomIn}>
          <MenuItemContent icon={ZoomIn} label="放大" shortcutId="zoomIn" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onZoomOut}>
          <MenuItemContent icon={ZoomOut} label="缩小" shortcutId="zoomOut" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onFitView}>
          <MenuItemContent icon={Maximize} label="适应屏幕" shortcutId="fitToScreen" />
        </ContextMenuItem>
        <ContextMenuItem onSelect={onFitViewToSelection} disabled={selectedNodeCount === 0}>
          <MenuItemContent icon={Crosshair} label="缩放到选区" />
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  );
}

/**
 * 蓝图右键菜单组件。
 *
 * 使用 ContextMenuTrigger asChild 包裹画布容器；
 * modal={false} 避免 Radix 在菜单打开时设置 body pointer-events:none 阻断画布交互。
 */
export function BlueprintContextMenu({
  mode,
  selectedNodeCount,
  selectedNodeKind,
  selectedNodeHasComponentId,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDeleteSelected,
  onSelectAll,
  onAlign,
  onDistribute,
  onAddNode,
  onZoomIn,
  onZoomOut,
  onFitView,
  onFitViewToSelection,
  onLocateComponent,
  onConfigureGlobal,
  children,
}: BlueprintContextMenuProps): JSX.Element {
  const child = (isValidElement(children) ? children : <div>{children}</div>) as ReactElement<{
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
  }>;
  const originalHandler = child.props.onContextMenu;
  const trigger = cloneElement(child, {
    onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => {
      originalHandler?.(e);
    },
  });

  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
      <ContextMenuContent className="w-56" data-testid="blueprint-context-menu">
        {mode === 'node' && (
          <NodeMenuItems
            selectedNodeCount={selectedNodeCount}
            selectedNodeKind={selectedNodeKind}
            selectedNodeHasComponentId={selectedNodeHasComponentId}
            onCopy={onCopy}
            onCut={onCut}
            onPaste={onPaste}
            onDuplicate={onDuplicate}
            onDeleteSelected={onDeleteSelected}
            onAlign={onAlign}
            onDistribute={onDistribute}
            onLocateComponent={onLocateComponent}
            onConfigureGlobal={onConfigureGlobal}
          />
        )}
        {mode === 'edge' && <EdgeMenuItems onDeleteSelected={onDeleteSelected} />}
        {mode === 'pane' && (
          <PaneMenuItems
            selectedNodeCount={selectedNodeCount}
            onAddNode={onAddNode}
            onPaste={onPaste}
            onSelectAll={onSelectAll}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onFitView={onFitView}
            onFitViewToSelection={onFitViewToSelection}
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
