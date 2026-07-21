import { useCallback, useMemo, useState } from 'react';
import {
  Type,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Image,
  Frame,
  Table,
  Box,
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
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Type,
  BarChart3,
  Image,
  Frame,
  Table,
  Box,
};

const KNOWN_TYPE_TO_ICON: Record<string, string> = {
  text: 'Type',
  'bar-chart': 'BarChart3',
};

function getIconForType(type: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[KNOWN_TYPE_TO_ICON[type]] ?? Box;
}

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
  const activeGroupId = useScreenEditorStore((s) => s.activeGroupId);
  const setActiveGroupId = useScreenEditorStore((s) => s.setActiveGroupId);

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

  const canGroup = selectedComponentIds.length >= 2;
  const canUngroup = (() => {
    if (!project || selectedComponentIds.length === 0) return false;
    return project.components.some((c) => c.parentId && selectedComponentIds.includes(c.id));
  })();

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
   * 双击组件行：进入该组件所属的分组（设置 activeGroupId + 选中该组件）。
   * 顶层组件双击：仅选中该组件，退出任何活动分组。
   */
  const handleComponentDoubleClick = (comp: ScreenComponent) => {
    if (comp.parentId) {
      const gid = comp.parentId;
      setActiveGroupId(gid);
      // 确保分组在面板中展开，便于看到双击的组件
      setCollapsed((prev) => {
        if (!prev.has(gid)) return prev;
        const next = new Set(prev);
        next.delete(gid);
        return next;
      });
    } else {
      // 顶层组件双击：退出活动分组
      if (activeGroupId !== null) setActiveGroupId(null);
    }
    selectComponent(comp.id);
  };

  /**
   * 点击分组行：选中整个分组（所有子组件）。
   * 双击分组行：进入该分组（setActiveGroupId + 选中全部子组件）。
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

  const handleGroupDoubleClick = (groupId: string, children: ScreenComponent[]) => {
    setActiveGroupId(groupId);
    selectComponents(children.map((c) => c.id));
    // 自动展开此分组
    setCollapsed((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
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

  /** 渲染单个组件行（不含 key，由外层 SortableLayerRow 或直接 div 提供） */
  const renderComponent = (comp: ScreenComponent, depth: number) => {
    const Icon = getIconForType(comp.type);
    const isSelected = selectedIdSet.has(comp.id);
    // 在活动分组内的子组件使用更明显的选中态
    const inActiveGroup = comp.parentId !== null && comp.parentId === activeGroupId;
    // depth=0（顶层组件）由外层 SortableLayerRow 提供 data-testid="layer-row"，
    // depth>0（分组子组件）无外层包装，在此直接打 testid 供 E2E 定位
    return (
      <div
        data-testid={depth > 0 ? 'layer-row' : undefined}
        data-component-id={depth > 0 ? comp.id : undefined}
        className={`group flex cursor-pointer items-center gap-2 border-b border-border/60 py-1.5 pr-3 text-sm transition-colors ${
          isSelected ? 'bg-primary/10' : 'hover:bg-accent'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={(e) => handleComponentClick(e, comp)}
        onDoubleClick={() => handleComponentDoubleClick(comp)}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        <span
          className={`flex-1 truncate ${
            comp.status.hidden ? 'text-muted-foreground/40' : 'text-foreground'
          }`}
        >
          {comp.name}
        </span>
        {inActiveGroup && (
          <span className="rounded bg-blue-500/10 px-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
            组内
          </span>
        )}
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
      </div>
    );
  };

  /** 渲染分组行（虚拟节点）+ 子组件 */
  const renderGroup = (node: Extract<LayerNode, { kind: 'group' }>) => {
    const { groupId, label, children } = node;
    const isCollapsed = collapsed.has(groupId);
    const allHidden = children.every((c) => c.status.hidden);
    const allLocked = children.every((c) => c.status.locked);
    const allSelected = children.every((c) => selectedIdSet.has(c.id));
    const someSelected = children.some((c) => selectedIdSet.has(c.id));
    // 当前分组是否处于"编辑中"状态（双击进入）
    const isActiveGroup = activeGroupId === groupId;

    return [
      <div
        key={groupId}
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
        onDoubleClick={() => handleGroupDoubleClick(groupId, children)}
      >
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
          aria-label={isCollapsed ? '展开' : '折叠'}
          onClick={(e) => {
            e.stopPropagation();
            toggleGroupCollapse(groupId);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
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
      </div>,
      // 子组件：仅在展开时渲染
      ...(!isCollapsed ? children.map((c) => renderComponent(c, 1)) : []),
    ];
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
        <div className="flex-1 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={topLevelSortableIds} strategy={verticalListSortingStrategy}>
              {tree.map((node) => {
                if (node.kind === 'group') return renderGroup(node);
                return (
                  <SortableLayerRow key={node.comp.id} id={node.comp.id}>
                    {renderComponent(node.comp, 0)}
                  </SortableLayerRow>
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </TooltipProvider>
  );
}
