import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronsUp,
  ChevronsDown,
  ChevronRight,
  Group as GroupIcon,
  Ungroup,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
// Phase 2 Slice C：图标注册收敛（registry/icons.ts 单一映射源，两个面板同源引用）
import { getIconForType } from '../registry/icons';
import {
  getVisibleLayerCommands,
  isLayerCommandEnabled,
  resolveLayerCommandIcon,
  resolveLayerCommandLabel,
  type LayerCommandContext,
  type LayerCommandStore,
} from '../lib/layer-commands';

/**
 * 虚拟滚动相关常量。
 *
 * - VIRTUALIZATION_THRESHOLD：扁平行数超过此阈值时启用虚拟滚动。
 *   阈值以下保持现有渲染路径（dnd-kit 拖拽全功能），避免引入复杂协同；
 *   阈值以上启用虚拟滚动并禁用拖拽排序，由右键菜单命令（置顶/上移/下移/置底）替代。
 * - ROW_ESTIMATE_SIZE：行高估算值（顶层组件与子组件 ~36px，分组行 ~44px，统一估算 40px）。
 *   实际高度通过 measureElement 动态测量修正。
 * - ROW_OVERSCAN：视口外预渲染行数，平衡滚动流畅度与 DOM 数量。
 */
const VIRTUALIZATION_THRESHOLD = 50;
const ROW_ESTIMATE_SIZE = 40;
const ROW_OVERSCAN = 8;

/**
 * 可拖拽图层行包装器（Task 3.23）。
 * 使用 dnd-kit 的 useSortable，拖拽时透明度降低，transform 由 dnd-kit 控制。
 * 仅顶层 component 节点（无 parentId）参与排序，分组与子组件保持原状（ChevronsUp/Down 兜底）。
 */
function SortableLayerRow({
  id,
  children,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      data-testid="layer-row"
      data-component-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: disabled ? undefined : 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/** 树节点：可能是单个组件，也可能是虚拟分组 */
type LayerNode =
  | { kind: 'component'; comp: ScreenComponent; depth: number }
  | { kind: 'group'; groupId: string; label: string; children: ScreenComponent[]; depth: number };

/** 将扁平 components 转换为带分组的树结构 */
function buildLayerTree(components: ScreenComponent[]): LayerNode[] {
  // 按 zIndex 降序（与原渲染顺序保持一致）
  const sorted = [...components].sort((a, b) => b.zIndex - a.zIndex);

  // 收集所有 parentId → 子组件映射，保留首次出现的顺序（按最高 zIndex 的子组件决定组的位置）
  const groupOrder: string[] = [];
  const groupChildren = new Map<string, ScreenComponent[]>();
  for (const c of sorted) {
    const pid = c.parentId;
    if (!pid) continue;
    if (!groupChildren.has(pid)) {
      groupChildren.set(pid, []);
      groupOrder.push(pid);
    }
    groupChildren.get(pid)!.push(c);
  }

  const nodes: LayerNode[] = [];
  // 渲染时跟踪已处理的组件 ID，避免子组件重复渲染
  const handled = new Set<string>();

  for (const c of sorted) {
    if (handled.has(c.id)) continue;
    if (c.parentId) {
      // 该组件属于某个分组，等待 groupOrder 迭代时统一渲染
      continue;
    }
    nodes.push({ kind: 'component', comp: c, depth: 0 });
    handled.add(c.id);
  }

  // 分组按首次出现顺序插入到树末尾（与无父组件的项同级）
  // 注：理想情况下分组应位于其最高 zIndex 子组件位置，但为简化实现并保持稳定排序，
  // 这里统一将分组渲染在所有顶层组件之后。如需更精确的位置匹配可后续扩展。
  groupOrder.forEach((gid, idx) => {
    const children = groupChildren.get(gid) ?? [];
    nodes.push({
      kind: 'group',
      groupId: gid,
      label: `组 ${idx + 1}`,
      children,
      depth: 0,
    });
    for (const c of children) handled.add(c.id);
  });

  return nodes;
}

/**
 * 扁平化图层行：用于虚拟滚动。
 *
 * - component 行：携带 depth（0=顶层，1=分组内子组件）
 * - group 行：携带分组节点（含 children 与 label），子组件作为独立的扁平行紧随其后
 *
 * 折叠的分组不展开子组件行。
 */
type FlatLayerRow =
  | { kind: 'component'; key: string; comp: ScreenComponent; depth: number }
  | { kind: 'group'; key: string; node: Extract<LayerNode, { kind: 'group' }> };

/** 将树结构扁平化为虚拟滚动所需的行数组 */
function flattenLayerTree(tree: LayerNode[], collapsed: Set<string>): FlatLayerRow[] {
  const rows: FlatLayerRow[] = [];
  for (const node of tree) {
    if (node.kind === 'component') {
      rows.push({ kind: 'component', key: node.comp.id, comp: node.comp, depth: 0 });
      continue;
    }
    rows.push({ kind: 'group', key: node.groupId, node });
    if (!collapsed.has(node.groupId)) {
      for (const child of node.children) {
        rows.push({ kind: 'component', key: child.id, comp: child, depth: 1 });
      }
    }
  }
  return rows;
}

/**
 * 图层行右键菜单内容（Phase 2 Slice A）。
 *
 * 基于命令描述符注册表 `LAYER_COMMANDS` 渲染：
 * - `when=false` 的命令不显示
 * - `enabled=false` 的命令置灰
 * - `separatorBefore` 的命令前插入分隔线（首项除外）
 * - `destructive` 命令套 destructive variant
 *
 * 调用方负责构造 LayerCommandContext（包含选区、目标、顶层序列与 store actions 子集）。
 */
function LayerRowMenu({ ctx, children }: { ctx: LayerCommandContext; children: React.ReactNode }) {
  const visible = getVisibleLayerCommands(ctx);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48" data-testid="layer-context-menu">
        {visible.map((cmd, idx) => {
          const label = resolveLayerCommandLabel(cmd, ctx);
          const Icon = resolveLayerCommandIcon(cmd, ctx);
          const enabled = isLayerCommandEnabled(cmd, ctx);
          return (
            <Fragment key={cmd.id}>
              {cmd.separatorBefore && idx > 0 && <ContextMenuSeparator />}
              <ContextMenuItem
                disabled={!enabled}
                variant={cmd.destructive ? 'destructive' : 'default'}
                onSelect={() => cmd.run(ctx)}
                data-testid={`layer-command-${cmd.id}`}
              >
                {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
                <span className="flex-1 truncate whitespace-nowrap">{label}</span>
              </ContextMenuItem>
            </Fragment>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * 行内重命名输入框（Phase 2 Slice A）。
 *
 * - 自动聚焦并全选当前名称
 * - Enter 提交（trim 后非空且与原名不同才入历史栈）
 * - Escape 取消，恢复原显示
 * - blur 时提交，但 Escape 触发的 blur 不重复提交（用 ref 标记 cancel 态）
 * - 阻止 pointerdown 冒泡，避免触发 dnd-kit 拖拽
 */
function InlineRenameInput({
  component,
  onCommit,
  onCancel,
}: {
  component: ScreenComponent;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const cancelledRef = useRef(false);

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const input = document.getElementById(
      `layer-rename-input-${component.id}`,
    ) as HTMLInputElement | null;
    const value = input?.value ?? '';
    onCommit(value);
  };

  return (
    <Input
      id={`layer-rename-input-${component.id}`}
      type="text"
      defaultValue={component.name}
      autoFocus
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelledRef.current = true;
          onCancel();
        }
      }}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="h-6 flex-1 px-1 text-xs"
      aria-label="重命名组件"
      data-testid="layer-rename-input"
    />
  );
}

export function LayerPanel() {
  const project = useScreenEditorStore((s) => s.project);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const selectComponent = useScreenEditorStore((s) => s.selectComponent);
  const selectComponents = useScreenEditorStore((s) => s.selectComponents);
  const setLocked = useScreenEditorStore((s) => s.setLocked);
  const setHidden = useScreenEditorStore((s) => s.setHidden);
  const reorderToTop = useScreenEditorStore((s) => s.reorderToTop);
  const reorderToBottom = useScreenEditorStore((s) => s.reorderToBottom);
  const reorderLayerToIndex = useScreenEditorStore((s) => s.reorderLayerToIndex);
  const groupSelected = useScreenEditorStore((s) => s.groupSelected);
  const ungroupSelected = useScreenEditorStore((s) => s.ungroupSelected);
  const renameComponent = useScreenEditorStore((s) => s.renameComponent);
  const copySelectedToClipboard = useScreenEditorStore((s) => s.copySelectedToClipboard);
  const duplicateSelected = useScreenEditorStore((s) => s.duplicateSelected);
  const removeSelectedComponents = useScreenEditorStore((s) => s.removeSelectedComponents);
  const activeGroupId = useScreenEditorStore((s) => s.activeGroupId);
  const setActiveGroupId = useScreenEditorStore((s) => s.setActiveGroupId);

  // 行内重命名目标（Phase 2 Slice A）：null 表示不在重命名态
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // dnd-kit 拖拽传感器：PointerSensor + 8px 激活距离，避免点击误触发拖拽
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // 折叠状态：默认所有分组展开。使用 Set<string> 存储已折叠的 groupId
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Memo 化：仅在 components 引用变化时重建树；选中状态用 Set 做 O(1) 查询
  const tree = useMemo(() => (project ? buildLayerTree(project.components) : []), [project]);
  const selectedIdSet = useMemo(() => new Set(selectedComponentIds), [selectedComponentIds]);
  // 仅顶层 component 节点参与 dnd-kit 排序（分组节点不在 SortableContext.items 中）
  const topLevelSortableIds = useMemo(
    () =>
      tree
        .filter((n): n is Extract<LayerNode, { kind: 'component' }> => n.kind === 'component')
        .map((n) => n.comp.id),
    [tree],
  );

  // 虚拟滚动：当扁平行数超过阈值时启用，仅渲染视口内 + overscan 的行。
  // 阈值以下保持原有 dnd-kit 拖拽全功能渲染路径；阈值以上禁用拖拽排序
  // （由右键菜单的置顶/上移/下移/置底命令替代），换取大列表下的渲染性能。
  const flatRows = useMemo(() => flattenLayerTree(tree, collapsed), [tree, collapsed]);
  const enableVirtualization = flatRows.length > VIRTUALIZATION_THRESHOLD;
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: enableVirtualization ? flatRows.length : 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => ROW_ESTIMATE_SIZE,
    overscan: ROW_OVERSCAN,
  });
  // 顶层组件按 zIndex 降序（与 buildLayerTree 内部排序一致），供命令描述符计算"上移/下移一层"
  const topLevelOrdered = useMemo<readonly ScreenComponent[]>(
    () =>
      project
        ? [...project.components].filter((c) => !c.parentId).sort((a, b) => b.zIndex - a.zIndex)
        : [],
    [project],
  );

  // 命令描述符所需的 store actions 子集（保持引用稳定，避免菜单每次渲染重建）
  const commandStore = useMemo<LayerCommandStore>(
    () => ({
      renameComponent,
      copySelectedToClipboard,
      duplicateSelected,
      setLocked,
      setHidden,
      reorderToTop,
      reorderToBottom,
      reorderLayerToIndex,
      groupSelected,
      ungroupSelected,
      removeSelectedComponents,
    }),
    [
      renameComponent,
      copySelectedToClipboard,
      duplicateSelected,
      setLocked,
      setHidden,
      reorderToTop,
      reorderToBottom,
      reorderLayerToIndex,
      groupSelected,
      ungroupSelected,
      removeSelectedComponents,
    ],
  );

  const canGroup = selectedComponentIds.length >= 2;
  const canUngroup = (() => {
    if (!project || selectedComponentIds.length === 0) return false;
    // O(1) 查询复用 selectedIdSet，避免 N×M 线性扫描
    return project.components.some((c) => c.parentId && selectedIdSet.has(c.id));
  })();

  // 选中组件快照：供命令上下文使用
  const selectedComponents = useMemo<readonly ScreenComponent[]>(() => {
    if (!project) return [];
    const idSet = selectedIdSet;
    return project.components.filter((c) => idSet.has(c.id));
  }, [project, selectedIdSet]);

  if (!project) return null;

  /**
   * 点击组件行：根据 activeGroupId 上下文决定选中单个组件还是整组。
   * - comp 无 parentId（顶层组件）：选中该组件，退出任何活动分组
   * - comp 在分组中且 activeGroupId === comp.parentId：仅选中该组件（已在组内编辑模式）
   * - comp 在分组中且 activeGroupId !== comp.parentId：选中整个分组，并退出当前活动分组
   */
  const handleComponentClick = (e: React.MouseEvent, comp: ScreenComponent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+点击：把该组件 ID 加入/移出当前选中
      const store = useScreenEditorStore.getState();
      const ids = store.selectedComponentIds;
      if (ids.includes(comp.id)) {
        store.selectComponents(ids.filter((sid) => sid !== comp.id));
      } else {
        store.selectComponents([...ids, comp.id]);
      }
      return;
    }

    if (!comp.parentId) {
      // 顶层组件：选中它并退出活动分组
      if (activeGroupId !== null) setActiveGroupId(null);
      selectComponent(comp.id);
      return;
    }

    if (activeGroupId === comp.parentId) {
      // 已在该组内：选中单个子组件
      selectComponent(comp.id);
    } else {
      // 不在该组内：选中整个分组并退出旧的活动分组
      const siblings = project.components.filter((c) => c.parentId === comp.parentId);
      selectComponents(siblings.map((c) => c.id));
      if (activeGroupId !== null) setActiveGroupId(null);
    }
  };

  /**
   * 右键组件行（Phase 2 Slice A）：实现"右键未选中行 → 先选中该行再弹菜单"的行业惯例。
   * - 若目标组件不在当前选区：单选该组件（避免误对其他组件批量操作）
   * - 若已在选区：保留选区不变（支持多选右键批量操作）
   */
  const handleComponentContextMenu = (comp: ScreenComponent) => {
    if (!selectedIdSet.has(comp.id)) {
      selectComponent(comp.id);
    }
  };

  /**
   * 点击分组行：选中整个分组（所有子组件）。
   */
  const handleGroupClick = (e: React.MouseEvent, groupId: string, children: ScreenComponent[]) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+点击：将所有子组件加入或移出当前选中
      const store = useScreenEditorStore.getState();
      const current = store.selectedComponentIds;
      const childIds = children.map((c) => c.id);
      if (childIds.every((id) => current.includes(id))) {
        store.selectComponents(current.filter((id) => !childIds.includes(id)));
      } else {
        store.selectComponents([...current, ...childIds.filter((id) => !current.includes(id))]);
      }
      return;
    }
    // 普通单击：选中整组，但不改变活动分组状态（用户可能正在编辑某分组）
    selectComponents(children.map((c) => c.id));
  };

  /**
   * 右键分组行（Phase 2 Slice A）：先选中所有子组件再弹菜单。
   * 与组件行同理：未选中状态下右键分组行 → 自动选中所有子组件。
   */
  const handleGroupContextMenu = (children: ScreenComponent[]) => {
    const childIds = children.map((c) => c.id);
    // 仅当当前选区不完整覆盖分组子组件时才覆盖选区
    const allSelected = childIds.every((id) => selectedIdSet.has(id));
    if (!allSelected) {
      selectComponents(childIds);
    }
  };

  /**
   * 提交重命名：trim 后为空或与原名相同则忽略；store action 已含相同检查，
   * 此处显式检查可避免空操作进入历史栈（与 store 实现一致，作为防御性兜底）。
   */
  const handleRenameCommit = (id: string, name: string) => {
    setRenamingId(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const target = project.components.find((c) => c.id === id);
    if (!target || target.name === trimmed) return;
    renameComponent(id, trimmed);
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
  };

  /**
   * dnd-kit 拖拽结束：根据 active/over 在顶层组件列表中的索引调用 reorderLayerToIndex。
   * over 为 null 表示未悬停在有效目标上，忽略。
   */
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const fromIdx = topLevelSortableIds.indexOf(activeId);
    const toIdx = topLevelSortableIds.indexOf(overId);
    if (fromIdx === -1 || toIdx === -1) return;
    reorderLayerToIndex(activeId, toIdx);
  };

  /** 构造单个组件行的 LayerCommandContext */
  const buildComponentCtx = (comp: ScreenComponent): LayerCommandContext => {
    // 调用方约定：onContextMenu 已保证选区包含 target；这里做防御性兜底
    // O(1) 查询复用 selectedIdSet，避免每行渲染线性扫描选中列表
    const ctxSelected = selectedIdSet.has(comp.id) ? selectedComponents : [comp];
    return {
      selectedComponents: ctxSelected,
      targetComponent: comp,
      topLevelOrdered,
      requestRename: setRenamingId,
      store: commandStore,
    };
  };

  /** 构造分组行的 LayerCommandContext */
  const buildGroupCtx = (groupId: string, children: ScreenComponent[]): LayerCommandContext => {
    // 分组行 onContextMenu 已保证选区为子组件集合；此处做防御性兜底
    const ctxSelected =
      selectedComponents.length === children.length &&
      children.every((c) => selectedIdSet.has(c.id))
        ? selectedComponents
        : children;
    return {
      selectedComponents: ctxSelected,
      targetGroup: { groupId, children },
      topLevelOrdered,
      store: commandStore,
    };
  };

  /** 渲染单个组件行（不含 key，由外层 SortableLayerRow 或直接 div 提供） */
  const renderComponent = (comp: ScreenComponent, depth: number) => {
    const Icon = getIconForType(comp.type);
    const isSelected = selectedIdSet.has(comp.id);
    // 在活动分组内的子组件使用更明显的选中态
    const inActiveGroup = comp.parentId !== null && comp.parentId === activeGroupId;
    // depth=0（顶层组件）由外层 SortableLayerRow 提供 data-testid="layer-row"，
    // depth>0（分组子组件）无外层包装，在此直接打 testid 供 E2E 定位
    const isRenaming = renamingId === comp.id;
    const row = (
      <div
        data-testid={depth > 0 ? 'layer-row' : undefined}
        data-component-id={depth > 0 ? comp.id : undefined}
        className={`group flex cursor-pointer items-center gap-2 border-b border-border/60 py-1.5 pr-3 text-sm transition-colors ${
          isSelected ? 'bg-primary/10' : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={(e) => handleComponentClick(e, comp)}
        onContextMenu={() => handleComponentContextMenu(comp)}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        {isRenaming ? (
          <InlineRenameInput
            component={comp}
            onCommit={(name) => handleRenameCommit(comp.id, name)}
            onCancel={handleRenameCancel}
          />
        ) : (
          <span
            className={`flex-1 truncate ${
              comp.status.hidden ? 'text-muted-foreground/40' : 'text-foreground'
            }`}
          >
            {comp.name}
          </span>
        )}
        {inActiveGroup && (
          <span className="rounded bg-blue-500/10 px-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
            组内
          </span>
        )}
        {!isRenaming && (
          <div
            className={`flex items-center gap-0.5 transition-opacity ${
              comp.status.hidden || comp.status.locked
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={comp.status.hidden ? '显示' : '隐藏'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHidden([comp.id], !comp.status.hidden);
                  }}
                >
                  {comp.status.hidden ? <EyeOff /> : <Eye />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{comp.status.hidden ? '显示' : '隐藏'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={comp.status.locked ? '解锁' : '锁定'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocked([comp.id], !comp.status.locked);
                  }}
                >
                  {comp.status.locked ? <Lock /> : <Unlock />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{comp.status.locked ? '解锁' : '锁定'}</TooltipContent>
            </Tooltip>
            <div className="flex gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="置顶"
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderToTop(comp.id);
                    }}
                  >
                    <ChevronsUp />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>置顶</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="置底"
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderToBottom(comp.id);
                    }}
                  >
                    <ChevronsDown />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>置底</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    );

    // Phase 2 Slice A：用 ContextMenu 包裹行，命令描述符驱动菜单内容
    // key 由调用方（tree.map / renderGroup children.map / SortableLayerRow）通过外层提供
    return (
      <LayerRowMenu key={comp.id} ctx={buildComponentCtx(comp)}>
        {row}
      </LayerRowMenu>
    );
  };

  /** 渲染分组头行（仅分组头，不含子组件；子组件由调用方单独渲染） */
  const renderGroupHeader = (node: Extract<LayerNode, { kind: 'group' }>) => {
    const { groupId, label, children } = node;
    const isCollapsed = collapsed.has(groupId);
    const allHidden = children.every((c) => c.status.hidden);
    const allLocked = children.every((c) => c.status.locked);
    const allSelected = children.every((c) => selectedIdSet.has(c.id));
    const someSelected = children.some((c) => selectedIdSet.has(c.id));
    // 当前分组是否处于"编辑中"状态（双击进入）
    const isActiveGroup = activeGroupId === groupId;

    const groupRow = (
      <div
        className={`flex cursor-pointer items-center gap-1 border-b border-border/60 py-2 pr-3 text-sm font-medium transition-colors ${
          isActiveGroup
            ? 'border-l-2 border-l-blue-500 bg-blue-500/10'
            : allSelected
              ? 'bg-primary/10'
              : someSelected
                ? 'bg-primary/5'
                : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: isActiveGroup ? `${10}px` : `${12}px` }}
        onClick={(e) => handleGroupClick(e, groupId, children)}
        onContextMenu={() => handleGroupContextMenu(children)}
      >
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
          aria-label={isCollapsed ? '展开' : '折叠'}
          onClick={(e) => {
            e.stopPropagation();
            toggleGroupCollapse(groupId);
          }}
        >
          <ChevronRight
            className={`size-3.5 text-muted-foreground transition-transform ${
              isCollapsed ? '' : 'rotate-90'
            }`}
          />
        </button>
        <GroupIcon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        <span
          className={`flex-1 truncate ${allHidden ? 'text-muted-foreground/40' : 'text-foreground'}`}
        >
          {label}
        </span>
        {isActiveGroup && (
          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
            编辑中
          </span>
        )}
        <span className="text-xs text-muted-foreground">{children.length}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={allHidden ? '显示全部' : '隐藏全部'}
              onClick={(e) => {
                e.stopPropagation();
                setHidden(
                  children.map((c) => c.id),
                  !allHidden,
                );
              }}
            >
              {allHidden ? <EyeOff /> : <Eye />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{allHidden ? '显示全部' : '隐藏全部'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={allLocked ? '解锁全部' : '锁定全部'}
              onClick={(e) => {
                e.stopPropagation();
                setLocked(
                  children.map((c) => c.id),
                  !allLocked,
                );
              }}
            >
              {allLocked ? <Lock /> : <Unlock />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{allLocked ? '解锁全部' : '锁定全部'}</TooltipContent>
        </Tooltip>
      </div>
    );

    // Phase 2 Slice A：分组行同样用 ContextMenu 包裹，命令描述符的 when/enabled 已适配分组场景
    return <LayerRowMenu ctx={buildGroupCtx(groupId, children)}>{groupRow}</LayerRowMenu>;
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            图层 ({project.components.length})
          </span>
          <div className="flex gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="成组"
                  disabled={!canGroup}
                  onClick={() => groupSelected()}
                >
                  <GroupIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>成组 (Ctrl+G)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="解组"
                  disabled={!canUngroup}
                  onClick={() => ungroupSelected()}
                >
                  <Ungroup />
                </Button>
              </TooltipTrigger>
              <TooltipContent>解组 (Ctrl+Shift+G)</TooltipContent>
            </Tooltip>
            {activeGroupId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="退出分组"
                    onClick={() => setActiveGroupId(null)}
                  >
                    <ChevronsUp />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>退出分组 (Esc)</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {activeGroupId && (
          <div className="border-b border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs text-blue-600 dark:text-blue-400">
            正在编辑分组内部 — 按 Esc 退出
          </div>
        )}
        <div ref={scrollParentRef} className="flex-1 overflow-y-auto">
          {enableVirtualization ? (
            // 虚拟滚动路径：仅渲染视口内 + overscan 的行，禁用 dnd-kit 拖拽排序。
            // 外层相对定位容器高度 = virtualizer 总尺寸，保持滚动条与实际内容一致；
            // 每个虚拟行绝对定位，通过 transform: translateY 偏移到目标位置。
            // 顶层组件行（depth=0）由外层 div 提供 data-testid/data-component-id，
            // 与非虚拟化路径下 SortableLayerRow 的属性保持一致，便于 E2E/单元测试定位。
            <div
              style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
              data-testid="layer-virtual-list"
            >
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const row = flatRows[vi.index];
                const isTopComponent = row.kind === 'component' && row.depth === 0;
                return (
                  <div
                    key={row.key}
                    data-index={vi.index}
                    ref={(el: HTMLElement | null) => {
                      // jsdom 等环境无 ResizeObserver 时跳过测量，依赖 estimateSize 估算
                      if (el && typeof ResizeObserver !== 'undefined') {
                        rowVirtualizer.measureElement(el);
                      }
                    }}
                    data-testid={isTopComponent ? 'layer-row' : undefined}
                    data-component-id={isTopComponent ? row.comp.id : undefined}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    {row.kind === 'component'
                      ? renderComponent(row.comp, row.depth)
                      : renderGroupHeader(row.node)}
                  </div>
                );
              })}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={topLevelSortableIds} strategy={verticalListSortingStrategy}>
                {tree.map((node) => {
                  if (node.kind === 'group') {
                    return (
                      <Fragment key={node.groupId}>
                        {renderGroupHeader(node)}
                        {!collapsed.has(node.groupId) &&
                          node.children.map((c) => renderComponent(c, 1))}
                      </Fragment>
                    );
                  }
                  return (
                    <SortableLayerRow key={node.comp.id} id={node.comp.id}>
                      {renderComponent(node.comp, 0)}
                    </SortableLayerRow>
                  );
                })}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
