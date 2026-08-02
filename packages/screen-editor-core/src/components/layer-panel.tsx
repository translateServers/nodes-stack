import { Fragment, memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
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
import { useScreenEditorStore, useScreenEditorStoreApi } from '../stores/editor-store';
import {
  Button,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@nebula/screen-editor-core/internal';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@nebula/screen-editor-core/internal';
// Phase 2 Slice C：图标注册收敛（registry/icons.ts 单一映射源，两个面板同源引用）
// Spec §13.2 Phase 1, Task 1.5：从实例注册表派生 icon（registry 为 null 时回退到 legacy）
import { getIconFromRegistry } from '../registry/registry-derive';
import { useOptionalRegistry } from '../registry/registry-context';
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

type GroupLayerNode = Extract<LayerNode, { kind: 'group' }>;

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
  | { kind: 'group'; key: string; node: GroupLayerNode };

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
 * 右键菜单目标（性能优化：单一共享菜单）。
 *
 * 原实现每行一个 ContextMenu：N 行 × 12 命令的描述符求值 + JSX 构建发生在
 * LayerPanel 每次渲染中，选中变更引发的 flushSync 同步帧里代价被放大，造成右键卡顿。
 * 现改为整面板共享一个 ContextMenu：行右键时仅记录目标（setMenuTarget），
 * 菜单内容（LayerCommandItems）仅在菜单真正打开挂载时才执行命令描述符求值。
 */
type LayerMenuTarget =
  | { kind: 'component'; comp: ScreenComponent }
  | { kind: 'group'; node: GroupLayerNode }
  | null;

interface LayerCommandItemsProps {
  target: NonNullable<LayerMenuTarget>;
  commandStore: LayerCommandStore;
  onRequestRename: (id: string) => void;
}

/**
 * 共享右键菜单的命令项渲染器。
 *
 * 关键性能设计：该组件被 ContextMenuContent 包裹，Radix 仅在菜单打开时才挂载内容，
 * 因此 getVisibleLayerCommands / when / enabled / label / icon 的全部求值
 * 只在用户真正右键的那个瞬间、针对那一个目标执行一次 —— 而非每行每次渲染都执行。
 *
 * 自身订阅 store（原始 selectedComponentIds，非 deferred）：
 * 右键未选中行会先同步选中再弹菜单，菜单语义必须基于最新选区。
 */
const LayerCommandItems = memo(function LayerCommandItems({
  target,
  commandStore,
  onRequestRename,
}: LayerCommandItemsProps) {
  const project = useScreenEditorStore((s) => s.project);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);

  const topLevelOrdered = useMemo<readonly ScreenComponent[]>(
    () =>
      project
        ? [...project.components].filter((c) => !c.parentId).sort((a, b) => b.zIndex - a.zIndex)
        : [],
    [project],
  );

  const selectedComponents = useMemo<readonly ScreenComponent[]>(() => {
    if (!project) return [];
    const idSet = new Set(selectedComponentIds);
    return project.components.filter((c) => idSet.has(c.id));
  }, [project, selectedComponentIds]);

  const ctx = useMemo<LayerCommandContext>(() => {
    if (target.kind === 'component') {
      const comp = target.comp;
      // 行 onContextMenu 已保证选区包含 target；这里做防御性兜底
      const inSelection = selectedComponentIds.includes(comp.id);
      return {
        selectedComponents: inSelection ? selectedComponents : [comp],
        targetComponent: comp,
        topLevelOrdered,
        requestRename: onRequestRename,
        store: commandStore,
      };
    }
    const children = target.node.children;
    // 分组行 onContextMenu 已保证选区为子组件集合；此处做防御性兜底
    const covers =
      selectedComponents.length === children.length &&
      children.every((c) => selectedComponentIds.includes(c.id));
    return {
      selectedComponents: covers ? selectedComponents : children,
      targetGroup: { groupId: target.node.groupId, children },
      topLevelOrdered,
      store: commandStore,
    };
  }, [
    target,
    selectedComponentIds,
    selectedComponents,
    topLevelOrdered,
    commandStore,
    onRequestRename,
  ]);

  const visible = getVisibleLayerCommands(ctx);
  return (
    <>
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
    </>
  );
});

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const value = inputRef.current?.value ?? '';
    onCommit(value);
  };

  return (
    <Input
      ref={inputRef}
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

/** 组件图层行 props。所有回调均为 LayerPanel 中的稳定引用（useCallback + getState）。 */
interface ComponentRowProps {
  comp: ScreenComponent;
  depth: number;
  isSelected: boolean;
  inActiveGroup: boolean;
  isRenaming: boolean;
  onRowClick: (comp: ScreenComponent, e: React.MouseEvent) => void;
  onRowContextMenu: (comp: ScreenComponent) => void;
  onToggleHidden: (comp: ScreenComponent) => void;
  onToggleLocked: (comp: ScreenComponent) => void;
  onReorderToTop: (comp: ScreenComponent) => void;
  onReorderToBottom: (comp: ScreenComponent) => void;
  onRenameCommit: (id: string, name: string) => void;
  onRenameCancel: () => void;
}

/**
 * 组件图层行（memo 化）。
 *
 * 性能优化核心：选中变更时 LayerPanel 重渲染，但只有 isSelected/isRenaming 等
 * 布尔 props 实际变化的行才会重新渲染；comp 引用在 store 不可变更新下保持稳定
 * （未变更的组件对象引用不变），因此绝大多数行在选中帧内完全跳过重渲染，
 * 同步帧（flushSync 选中冲刷）的工作量从 O(N 行) 降到 O(变更行)。
 */
const ComponentRow = memo(function ComponentRow({
  comp,
  depth,
  isSelected,
  inActiveGroup,
  isRenaming,
  onRowClick,
  onRowContextMenu,
  onToggleHidden,
  onToggleLocked,
  onReorderToTop,
  onReorderToBottom,
  onRenameCommit,
  onRenameCancel,
}: ComponentRowProps) {
  // Spec §13.2 Phase 1, Task 1.5：从实例注册表派生 icon，
  // registry 为 null（测试或无 Provider）时回退到模块级 getIconForType。
  const registry = useOptionalRegistry();
  const Icon = getIconFromRegistry(registry, comp.type);
  // depth=0（顶层组件）由外层 SortableLayerRow / 虚拟行包装提供 data-testid="layer-row"，
  // depth>0（分组子组件）无外层包装，在此直接打 testid 供 E2E 定位
  return (
    <div
      data-layer-row
      data-testid={depth > 0 ? 'layer-row' : undefined}
      data-component-id={depth > 0 ? comp.id : undefined}
      className={`group flex cursor-pointer items-center gap-2 border-b border-border/60 py-1.5 pr-3 text-sm transition-colors ${
        isSelected ? 'bg-primary/10' : 'hover:bg-accent'
      }`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={(e) => onRowClick(comp, e)}
      onContextMenu={() => onRowContextMenu(comp)}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      {isRenaming ? (
        <InlineRenameInput
          component={comp}
          onCommit={(name) => onRenameCommit(comp.id, name)}
          onCancel={onRenameCancel}
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
                  onToggleHidden(comp);
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
                  onToggleLocked(comp);
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
                    onReorderToTop(comp);
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
                    onReorderToBottom(comp);
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
});

/** 分组头行 props。node 引用随 tree 的 useMemo 稳定，仅在 components 变更时重建。 */
interface GroupHeaderRowProps {
  node: GroupLayerNode;
  isCollapsed: boolean;
  isActiveGroup: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onGroupClick: (node: GroupLayerNode, e: React.MouseEvent) => void;
  onGroupContextMenu: (node: GroupLayerNode) => void;
  onToggleCollapse: (groupId: string) => void;
  onSetHidden: (ids: string[], hidden: boolean) => void;
  onSetLocked: (ids: string[], locked: boolean) => void;
}

/** 分组头行（memo 化）：选中/折叠/活动分组状态变化只影响对应分组行。 */
const GroupHeaderRow = memo(function GroupHeaderRow({
  node,
  isCollapsed,
  isActiveGroup,
  allSelected,
  someSelected,
  onGroupClick,
  onGroupContextMenu,
  onToggleCollapse,
  onSetHidden,
  onSetLocked,
}: GroupHeaderRowProps) {
  const { groupId, label, children } = node;
  const allHidden = children.every((c) => c.status.hidden);
  const allLocked = children.every((c) => c.status.locked);

  return (
    <div
      data-layer-row
      data-group-id={groupId}
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
      onClick={(e) => onGroupClick(node, e)}
      onContextMenu={() => onGroupContextMenu(node)}
    >
      <button
        type="button"
        className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
        aria-label={isCollapsed ? '展开' : '折叠'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse(groupId);
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
              onSetHidden(
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
              onSetLocked(
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
});

export function LayerPanel() {
  const editorStore = useScreenEditorStoreApi();
  const project = useScreenEditorStore((s) => s.project);
  const rawSelectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const groupSelected = useScreenEditorStore((s) => s.groupSelected);
  const ungroupSelected = useScreenEditorStore((s) => s.ungroupSelected);
  const activeGroupId = useScreenEditorStore((s) => s.activeGroupId);
  const setActiveGroupId = useScreenEditorStore((s) => s.setActiveGroupId);
  const renameComponent = useScreenEditorStore((s) => s.renameComponent);
  const copySelectedToClipboard = useScreenEditorStore((s) => s.copySelectedToClipboard);
  const duplicateSelected = useScreenEditorStore((s) => s.duplicateSelected);
  const setLocked = useScreenEditorStore((s) => s.setLocked);
  const setHidden = useScreenEditorStore((s) => s.setHidden);
  const reorderToTop = useScreenEditorStore((s) => s.reorderToTop);
  const reorderToBottom = useScreenEditorStore((s) => s.reorderToBottom);
  const reorderLayerToIndex = useScreenEditorStore((s) => s.reorderLayerToIndex);
  const removeSelectedComponents = useScreenEditorStore((s) => s.removeSelectedComponents);

  // 性能优化：选中态响应降级为 transition，避免 flushSync 同步冲刷把图层树重建
  // 塞进点击帧（与 CanvasStatusBar、PropertyPanel useDeferredValue 模式一致）。
  // 选中控制框（MoveableContainer）立即同步渲染，图层选中高亮滞后一帧（<50ms 不可感知）。
  const selectedComponentIds = useDeferredValue(rawSelectedComponentIds);

  // 行内重命名目标（Phase 2 Slice A）：null 表示不在重命名态
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // 共享右键菜单目标：行右键时记录，菜单内容仅在打开时对单个目标求值
  const [menuTarget, setMenuTarget] = useState<LayerMenuTarget>(null);

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

  // 命令描述符所需的 store actions 子集（zustand actions 引用稳定，useMemo 一次构造）
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

  /**
   * 以下行级事件处理器全部使用 useCallback + useScreenEditorStore.getState()：
   * 处理器引用跨渲染稳定（配合 memo 化的行组件，选中变更不再导致全行重渲染），
   * 且事件触发时读取最新 store 状态，不受 deferred 选中值的滞后影响。
   */

  /**
   * 点击组件行：根据 activeGroupId 上下文决定选中单个组件还是整组。
   * - comp 无 parentId（顶层组件）：选中该组件，退出任何活动分组
   * - comp 在分组中且 activeGroupId === comp.parentId：仅选中该组件（已在组内编辑模式）
   * - comp 在分组中且 activeGroupId !== comp.parentId：选中整个分组，并退出当前活动分组
   */
  const handleComponentClick = useCallback(
    (comp: ScreenComponent, e: React.MouseEvent) => {
      const store = editorStore.getState();
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+点击：把该组件 ID 加入/移出当前选中
        const ids = store.selectedComponentIds;
        if (ids.includes(comp.id)) {
          store.selectComponents(ids.filter((sid) => sid !== comp.id));
        } else {
          store.selectComponents([...ids, comp.id]);
        }
        return;
      }

      const currentProject = store.project;
      if (!currentProject) return;

      if (!comp.parentId) {
        // 顶层组件：选中它并退出活动分组
        if (store.activeGroupId !== null) store.setActiveGroupId(null);
        store.selectComponent(comp.id);
        return;
      }

      if (store.activeGroupId === comp.parentId) {
        // 已在该组内：选中单个子组件
        store.selectComponent(comp.id);
      } else {
        // 不在该组内：选中整个分组并退出旧的活动分组
        const siblings = currentProject.components.filter((c) => c.parentId === comp.parentId);
        store.selectComponents(siblings.map((c) => c.id));
        if (store.activeGroupId !== null) store.setActiveGroupId(null);
      }
    },
    [editorStore],
  );

  /**
   * 右键组件行（Phase 2 Slice A）：实现"右键未选中行 → 先选中该行再弹菜单"的行业惯例。
   * - 若目标组件不在当前选区：单选该组件（避免误对其他组件批量操作）
   * - 若已在选区：保留选区不变（支持多选右键批量操作）
   * 同时记录共享菜单目标；事件继续冒泡到 ContextMenuTrigger 打开菜单。
   */
  const handleComponentContextMenu = useCallback(
    (comp: ScreenComponent) => {
      const store = editorStore.getState();
      if (!store.selectedComponentIds.includes(comp.id)) {
        store.selectComponent(comp.id);
      }
      setMenuTarget({ kind: 'component', comp });
    },
    [editorStore],
  );

  /**
   * 点击分组行：选中整个分组（所有子组件）。
   */
  const handleGroupClick = useCallback(
    (node: GroupLayerNode, e: React.MouseEvent) => {
      const store = editorStore.getState();
      const childIds = node.children.map((c) => c.id);
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+点击：将所有子组件加入或移出当前选中
        const current = store.selectedComponentIds;
        if (childIds.every((id) => current.includes(id))) {
          store.selectComponents(current.filter((id) => !childIds.includes(id)));
        } else {
          store.selectComponents([...current, ...childIds.filter((id) => !current.includes(id))]);
        }
        return;
      }
      // 普通单击：选中整组，但不改变活动分组状态（用户可能正在编辑某分组）
      store.selectComponents(childIds);
    },
    [editorStore],
  );

  /**
   * 右键分组行（Phase 2 Slice A）：先选中所有子组件再弹菜单。
   * 与组件行同理：未选中状态下右键分组行 → 自动选中所有子组件。
   */
  const handleGroupContextMenu = useCallback(
    (node: GroupLayerNode) => {
      const store = editorStore.getState();
      const childIds = node.children.map((c) => c.id);
      // 仅当当前选区不完整覆盖分组子组件时才覆盖选区
      const allSelected = childIds.every((id) => store.selectedComponentIds.includes(id));
      if (!allSelected) {
        store.selectComponents(childIds);
      }
      setMenuTarget({ kind: 'group', node });
    },
    [editorStore],
  );

  /** 行内按钮：隐藏/锁定/置顶/置底（稳定引用，内部读取最新 store） */
  const handleToggleHidden = useCallback(
    (comp: ScreenComponent) => {
      editorStore.getState().setHidden([comp.id], !comp.status.hidden);
    },
    [editorStore],
  );
  const handleToggleLocked = useCallback(
    (comp: ScreenComponent) => {
      editorStore.getState().setLocked([comp.id], !comp.status.locked);
    },
    [editorStore],
  );
  const handleReorderToTop = useCallback(
    (comp: ScreenComponent) => {
      editorStore.getState().reorderToTop(comp.id);
    },
    [editorStore],
  );
  const handleReorderToBottom = useCallback(
    (comp: ScreenComponent) => {
      editorStore.getState().reorderToBottom(comp.id);
    },
    [editorStore],
  );
  const handleSetHidden = useCallback(
    (ids: string[], hidden: boolean) => {
      editorStore.getState().setHidden(ids, hidden);
    },
    [editorStore],
  );
  const handleSetLocked = useCallback(
    (ids: string[], locked: boolean) => {
      editorStore.getState().setLocked(ids, locked);
    },
    [editorStore],
  );

  /**
   * 列表空白处右键：清空菜单目标（此时不渲染 ContextMenuContent，菜单不会出现）。
   * 行上的右键先记录目标，事件冒泡到此处时 closest('[data-layer-row]') 命中，不会误清。
   */
  const handleListContextMenu = useCallback((e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-layer-row]')) {
      setMenuTarget(null);
    }
  }, []);

  /**
   * 提交重命名：trim 后为空或与原名相同则忽略；store action 已含相同检查，
   * 此处显式检查可避免空操作进入历史栈（与 store 实现一致，作为防御性兜底）。
   */
  const handleRenameCommit = useCallback(
    (id: string, name: string) => {
      setRenamingId(null);
      const trimmed = name.trim();
      if (!trimmed) return;
      const store = editorStore.getState();
      const target = store.project?.components.find((c) => c.id === id);
      if (!target || target.name === trimmed) return;
      store.renameComponent(id, trimmed);
    },
    [editorStore],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
  }, []);

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

  if (!project) return null;

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
        {/*
          单一共享右键菜单：ContextMenuTrigger asChild 包裹整个列表容器，
          行右键时仅记录 menuTarget（与 canvas-context-menu 同一模式）。
          menuTarget 为 null（空白处右键）时不渲染 Content，菜单不出现。
        */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={scrollParentRef}
              className="flex-1 overflow-y-auto"
              onContextMenu={handleListContextMenu}
            >
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
                        {row.kind === 'component' ? (
                          <ComponentRow
                            comp={row.comp}
                            depth={row.depth}
                            isSelected={selectedIdSet.has(row.comp.id)}
                            inActiveGroup={
                              row.comp.parentId !== null && row.comp.parentId === activeGroupId
                            }
                            isRenaming={renamingId === row.comp.id}
                            onRowClick={handleComponentClick}
                            onRowContextMenu={handleComponentContextMenu}
                            onToggleHidden={handleToggleHidden}
                            onToggleLocked={handleToggleLocked}
                            onReorderToTop={handleReorderToTop}
                            onReorderToBottom={handleReorderToBottom}
                            onRenameCommit={handleRenameCommit}
                            onRenameCancel={handleRenameCancel}
                          />
                        ) : (
                          <GroupHeaderRow
                            node={row.node}
                            isCollapsed={collapsed.has(row.node.groupId)}
                            isActiveGroup={activeGroupId === row.node.groupId}
                            allSelected={row.node.children.every((c) => selectedIdSet.has(c.id))}
                            someSelected={row.node.children.some((c) => selectedIdSet.has(c.id))}
                            onGroupClick={handleGroupClick}
                            onGroupContextMenu={handleGroupContextMenu}
                            onToggleCollapse={toggleGroupCollapse}
                            onSetHidden={handleSetHidden}
                            onSetLocked={handleSetLocked}
                          />
                        )}
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
                  <SortableContext
                    items={topLevelSortableIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {tree.map((node) => {
                      if (node.kind === 'group') {
                        return (
                          <Fragment key={node.groupId}>
                            <GroupHeaderRow
                              node={node}
                              isCollapsed={collapsed.has(node.groupId)}
                              isActiveGroup={activeGroupId === node.groupId}
                              allSelected={node.children.every((c) => selectedIdSet.has(c.id))}
                              someSelected={node.children.some((c) => selectedIdSet.has(c.id))}
                              onGroupClick={handleGroupClick}
                              onGroupContextMenu={handleGroupContextMenu}
                              onToggleCollapse={toggleGroupCollapse}
                              onSetHidden={handleSetHidden}
                              onSetLocked={handleSetLocked}
                            />
                            {!collapsed.has(node.groupId) &&
                              node.children.map((c) => (
                                <ComponentRow
                                  key={c.id}
                                  comp={c}
                                  depth={1}
                                  isSelected={selectedIdSet.has(c.id)}
                                  inActiveGroup={c.parentId === activeGroupId}
                                  isRenaming={renamingId === c.id}
                                  onRowClick={handleComponentClick}
                                  onRowContextMenu={handleComponentContextMenu}
                                  onToggleHidden={handleToggleHidden}
                                  onToggleLocked={handleToggleLocked}
                                  onReorderToTop={handleReorderToTop}
                                  onReorderToBottom={handleReorderToBottom}
                                  onRenameCommit={handleRenameCommit}
                                  onRenameCancel={handleRenameCancel}
                                />
                              ))}
                          </Fragment>
                        );
                      }
                      return (
                        <SortableLayerRow key={node.comp.id} id={node.comp.id}>
                          <ComponentRow
                            comp={node.comp}
                            depth={0}
                            isSelected={selectedIdSet.has(node.comp.id)}
                            inActiveGroup={false}
                            isRenaming={renamingId === node.comp.id}
                            onRowClick={handleComponentClick}
                            onRowContextMenu={handleComponentContextMenu}
                            onToggleHidden={handleToggleHidden}
                            onToggleLocked={handleToggleLocked}
                            onReorderToTop={handleReorderToTop}
                            onReorderToBottom={handleReorderToBottom}
                            onRenameCommit={handleRenameCommit}
                            onRenameCancel={handleRenameCancel}
                          />
                        </SortableLayerRow>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </ContextMenuTrigger>
          {menuTarget && (
            <ContextMenuContent className="w-48" data-testid="layer-context-menu">
              <LayerCommandItems
                target={menuTarget}
                commandStore={commandStore}
                onRequestRename={setRenamingId}
              />
            </ContextMenuContent>
          )}
        </ContextMenu>
      </div>
    </TooltipProvider>
  );
}
