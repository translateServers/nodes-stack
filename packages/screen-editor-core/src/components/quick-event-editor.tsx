/**
 * 快速事件编辑器（任务 4.1-4.6）
 *
 * 在右侧属性面板「事件」tab 渲染，从 blueprint 派生当前选中组件相关的事件规则列表。
 *
 * 设计要点：
 * - 派生两组规则：「触发器（本组件作为源）」与「动作（本组件作为目标）」
 * - 顶部「打开事件蓝图」按钮调用 `editor-store.openBlueprintSheet({ focusComponentId })`
 *   拉起全屏蓝图编辑器并自动进入过滤模式
 * - 「+ 添加触发器」下拉提供 3 个常见快速规则模板，选择后通过 `updateBlueprint`
 *   新增 trigger + action + edge 三个节点/边，进入历史栈
 * - 每条规则右侧「删除」按钮通过 AlertDialog 二次确认，删除 trigger 节点及其下游所有节点和边
 *
 * 数据来源：editor-store 的 `project.blueprint`（项目级，与组件解耦）
 * 写回方式：editor-store.updateBlueprint（入历史栈，支持 undo/redo）
 */

import { useMemo, useState, type JSX } from 'react';
import { ExternalLink, Eye, MousePointerClick, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type {
  BlueprintActionConfig,
  BlueprintEdge,
  BlueprintNode,
  BlueprintTriggerConfig,
  EventBlueprint,
} from '@nebula/shared';
import { EVENT_BLUEPRINT_VERSION } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { PanelSection } from './ui-primitives';
import { Button } from '@nebula/screen-editor-core/internal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@nebula/screen-editor-core/internal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@nebula/screen-editor-core/internal';

interface QuickEventEditorProps {
  /** 当前选中组件 id */
  componentId: string;
}

// ===== 派生规则类型 =====

/** 触发器规则摘要：trigger 节点 + 下游 action 链 */
interface TriggerRuleSummary {
  triggerNodeId: string;
  triggerConfig: BlueprintTriggerConfig;
  /** 下游 action 节点 id + 配置（按 BFS 顺序） */
  actions: Array<{ nodeId: string; config: BlueprintActionConfig }>;
}

/** 动作规则摘要：action 节点 + 上游 trigger 来源（可能为 null，表示未连触发器） */
interface ActionRuleSummary {
  actionNodeId: string;
  actionConfig: BlueprintActionConfig;
  triggerNodeId: string | null;
  triggerConfig: BlueprintTriggerConfig | null;
}

// ===== 蓝图派生纯函数 =====

/**
 * 沿 edges BFS 找出从 startNodeId 出发可达的所有 action 节点。
 * 穿过 condition 等中间节点（不收集 condition/comment，仅作为路径中转）。
 * 防环：visited 集合。
 */
function findDownstreamActions(
  blueprint: EventBlueprint,
  startNodeId: string,
): Array<{ nodeId: string; config: BlueprintActionConfig }> {
  const visited = new Set<string>([startNodeId]);
  const queue: string[] = [startNodeId];
  const result: Array<{ nodeId: string; config: BlueprintActionConfig }> = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const nextIds = blueprint.edges.filter((e) => e.source === currentId).map((e) => e.target);

    for (const nextId of nextIds) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const nextNode = blueprint.nodes.find((n) => n.id === nextId);
      if (!nextNode) continue;
      if (nextNode.kind === 'action') {
        result.push({ nodeId: nextNode.id, config: nextNode.config });
      }
      // 继续向下扩展（action 也可能链到下一个 action / condition）
      queue.push(nextId);
    }
  }

  return result;
}

/**
 * 沿 edges 反向 BFS 找到 startNodeId 的上游 trigger 节点。
 * 找到第一个 trigger 即返回（多源场景取首个），无则返回 null。
 */
function findUpstreamTrigger(
  blueprint: EventBlueprint,
  startNodeId: string,
): { nodeId: string; config: BlueprintTriggerConfig } | null {
  const visited = new Set<string>([startNodeId]);
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const prevIds = blueprint.edges.filter((e) => e.target === currentId).map((e) => e.source);

    for (const prevId of prevIds) {
      if (visited.has(prevId)) continue;
      visited.add(prevId);
      const prevNode = blueprint.nodes.find((n) => n.id === prevId);
      if (!prevNode) continue;
      if (prevNode.kind === 'trigger') {
        return { nodeId: prevNode.id, config: prevNode.config };
      }
      // 继续向上扩展（穿过 condition / action 等中间节点）
      queue.push(prevId);
    }
  }

  return null;
}

/**
 * 派生「触发器（本组件作为源）」规则列表。
 * 触发器节点 config.componentId === componentId（componentClick / componentHover / dataLoaded / dataError）。
 * pageLoad / interval 不涉及具体组件，不在此列。
 */
function deriveTriggerRules(blueprint: EventBlueprint, componentId: string): TriggerRuleSummary[] {
  const triggers = blueprint.nodes.filter(
    (n): n is Extract<BlueprintNode, { kind: 'trigger' }> =>
      n.kind === 'trigger' && 'componentId' in n.config && n.config.componentId === componentId,
  );

  return triggers.map((trigger) => ({
    triggerNodeId: trigger.id,
    triggerConfig: trigger.config,
    actions: findDownstreamActions(blueprint, trigger.id),
  }));
}

/**
 * 派生「动作（本组件作为目标）」规则列表。
 * action 节点 config.targetComponentId === componentId（setVisibility / scrollToComponent / refreshDataSource）。
 * navigate / requestApi 无 targetComponentId，不在此列。
 */
function deriveActionRules(blueprint: EventBlueprint, componentId: string): ActionRuleSummary[] {
  const actions = blueprint.nodes.filter(
    (n): n is Extract<BlueprintNode, { kind: 'action' }> =>
      n.kind === 'action' &&
      'targetComponentId' in n.config &&
      n.config.targetComponentId === componentId,
  );

  return actions.map((action) => {
    const upstream = findUpstreamTrigger(blueprint, action.id);
    return {
      actionNodeId: action.id,
      actionConfig: action.config,
      triggerNodeId: upstream?.nodeId ?? null,
      triggerConfig: upstream?.config ?? null,
    };
  });
}

// ===== 显示标签 =====

/** 触发器类型显示名称 */
function getTriggerLabel(config: BlueprintTriggerConfig): string {
  switch (config.type) {
    case 'componentClick':
      return '点击组件';
    case 'pageLoad':
      return '页面加载';
    case 'componentHover':
      return '悬停组件';
    case 'dataLoaded':
      return '数据加载完成';
    case 'dataError':
      return '数据加载错误';
    case 'interval':
      return '定时触发';
    default:
      return '触发器';
  }
}

/** 动作类型显示名称 + 摘要 */
function getActionLabel(config: BlueprintActionConfig): string {
  switch (config.type) {
    case 'setVisibility':
      return `${config.visible === 'hide' ? '隐藏' : config.visible === 'toggle' ? '切换显隐' : '显示'}组件`;
    case 'navigate':
      return `跳转 ${config.url || 'URL'}`;
    case 'scrollToComponent':
      return '滚动至组件';
    case 'refreshDataSource':
      return '刷新组件数据';
    case 'requestApi':
      return `请求 API (${config.method})`;
    default:
      return '动作';
  }
}

// ===== 模板新增 =====

/** 生成唯一节点 id（与蓝图 sheet 内 createNodeFromOption 风格一致） */
function generateNodeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 生成唯一边 id */
function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 快速规则模板类型 */
type QuickTemplateKind = 'navigate' | 'setVisibility' | 'refreshDataSource';

/**
 * 基于模板构造新增节点与边，返回新的 blueprint（不可变更新）。
 *
 * - trigger(componentClick) 节点：config.componentId = 当前 componentId
 * - action 节点：类型与初始配置由模板决定（targetComponentId 留空，由用户在蓝图内补全）
 * - edge：trigger.out → action.in
 *
 * 节点位置简单递增排列（避免重叠），具体位置由用户在蓝图内拖拽调整。
 */
function applyTemplateToBlueprint(
  blueprint: EventBlueprint | undefined,
  componentId: string,
  template: QuickTemplateKind,
): EventBlueprint {
  const baseNodes: BlueprintNode[] = blueprint?.nodes ?? [];
  const baseEdges: BlueprintEdge[] = blueprint?.edges ?? [];

  // 节点位置：在现有最大 x 基础上递增 240，避免重叠
  const maxX = baseNodes.reduce((max, n) => Math.max(max, n.position.x), 0);
  const triggerX = maxX + 240;
  const actionX = triggerX + 240;

  const triggerNode: BlueprintNode = {
    id: generateNodeId('node'),
    kind: 'trigger',
    position: { x: triggerX, y: 0 },
    config: { type: 'componentClick', componentId },
  };

  let actionConfig: BlueprintActionConfig;
  switch (template) {
    case 'navigate':
      actionConfig = { type: 'navigate', url: '', target: '_blank' };
      break;
    case 'setVisibility':
      actionConfig = { type: 'setVisibility', targetComponentId: '', visible: 'toggle' };
      break;
    case 'refreshDataSource':
      actionConfig = { type: 'refreshDataSource', targetComponentId: '' };
      break;
  }

  const actionNode: BlueprintNode = {
    id: generateNodeId('node'),
    kind: 'action',
    position: { x: actionX, y: 0 },
    config: actionConfig,
  };

  const edge: BlueprintEdge = {
    id: generateEdgeId(),
    source: triggerNode.id,
    sourceHandle: 'out',
    target: actionNode.id,
    targetHandle: 'in',
  };

  return {
    version: 1,
    nodes: [...baseNodes, triggerNode, actionNode],
    edges: [...baseEdges, edge],
  };
}

// ===== 删除规则 =====

/**
 * 删除 trigger 节点及其所有下游节点（BFS）和相关边。
 * - 收集 trigger + 所有下游节点 id
 * - 过滤掉这些节点 + 任意一端在删除集合中的边
 */
function deleteTriggerSubgraph(blueprint: EventBlueprint, triggerNodeId: string): EventBlueprint {
  // BFS 收集 trigger 及其所有下游节点
  const toDelete = new Set<string>([triggerNodeId]);
  const queue: string[] = [triggerNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const nextIds = blueprint.edges.filter((e) => e.source === currentId).map((e) => e.target);

    for (const nextId of nextIds) {
      if (toDelete.has(nextId)) continue;
      toDelete.add(nextId);
      queue.push(nextId);
    }
  }

  return {
    version: 1,
    nodes: blueprint.nodes.filter((n) => !toDelete.has(n.id)),
    edges: blueprint.edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)),
  };
}

/**
 * 仅删除单个 action 节点（用于「动作」分区中的删除）。
 * 仅移除该节点 + 直接相连的边（不递归删除其下游，因为可能影响其他链路）。
 */
function deleteActionNode(blueprint: EventBlueprint, actionNodeId: string): EventBlueprint {
  return {
    version: 1,
    nodes: blueprint.nodes.filter((n) => n.id !== actionNodeId),
    edges: blueprint.edges.filter((e) => e.source !== actionNodeId && e.target !== actionNodeId),
  };
}

// ===== 待删除规则上下文（AlertDialog 二次确认用） =====

interface PendingDelete {
  kind: 'trigger' | 'action';
  nodeId: string;
  /** 显示在确认弹窗中的提示文案 */
  description: string;
}

// ===== 主组件 =====

/**
 * 快速事件编辑器：在属性面板 events tab 渲染当前组件相关的事件规则。
 *
 * 内部使用两个 PanelSection（可折叠）分别展示「触发器」与「动作」两组规则；
 * 顶部「打开事件蓝图」按钮拉起全屏蓝图编辑器并自动进入过滤模式。
 */
export function QuickEventEditor({ componentId }: QuickEventEditorProps): JSX.Element {
  const project = useScreenEditorStore((s) => s.project);
  const updateBlueprint = useScreenEditorStore((s) => s.updateBlueprint);
  const openBlueprintSheet = useScreenEditorStore((s) => s.openBlueprintSheet);

  const blueprint = project?.blueprint;

  // V1 蓝图才能使用快速事件编辑器；V2 蓝图请使用全屏事件蓝图编辑器
  const v1Blueprint =
    blueprint !== undefined && blueprint.version === EVENT_BLUEPRINT_VERSION
      ? blueprint
      : undefined;

  // 派生两组规则列表（blueprint / componentId 变化时重算）
  const triggerRules = useMemo(
    () => (v1Blueprint ? deriveTriggerRules(v1Blueprint, componentId) : []),
    [v1Blueprint, componentId],
  );
  const actionRules = useMemo(
    () => (v1Blueprint ? deriveActionRules(v1Blueprint, componentId) : []),
    [v1Blueprint, componentId],
  );

  // 待删除的规则（用于 AlertDialog 二次确认）
  // 点击删除按钮时立即记录上下文，确认时直接读取
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const hasBlueprint = v1Blueprint !== undefined;
  const isV2Blueprint = blueprint !== undefined && blueprint.version !== EVENT_BLUEPRINT_VERSION;
  const hasAnyRule = triggerRules.length > 0 || actionRules.length > 0;

  // 空态提示文案：V2 蓝图引导用户使用全屏事件蓝图编辑器
  const emptyHint = isV2Blueprint
    ? '请使用事件蓝图编辑器配置'
    : hasBlueprint
      ? '当前组件暂无事件规则'
      : '事件蓝图未初始化';

  /** 添加触发器模板 */
  const handleAddTemplate = (template: QuickTemplateKind): void => {
    if (!v1Blueprint) return;
    const next = applyTemplateToBlueprint(v1Blueprint, componentId, template);
    updateBlueprint(next);
  };

  /** 确认删除规则 */
  const handleConfirmDelete = (): void => {
    if (!pendingDelete || !v1Blueprint) {
      setPendingDelete(null);
      return;
    }
    const next =
      pendingDelete.kind === 'trigger'
        ? deleteTriggerSubgraph(v1Blueprint, pendingDelete.nodeId)
        : deleteActionNode(v1Blueprint, pendingDelete.nodeId);
    updateBlueprint(next);
    setPendingDelete(null);
  };

  /** 打开事件蓝图（聚焦当前组件） */
  const handleOpenBlueprint = (): void => {
    openBlueprintSheet({ focusComponentId: componentId });
  };

  return (
    <div data-testid="quick-events-section">
      {/* 顶部工具栏：打开事件蓝图 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">事件蓝图</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleOpenBlueprint}
          data-testid="quick-events-open-blueprint"
        >
          <ExternalLink className="size-3.5" />
          打开事件蓝图
        </Button>
      </div>

      {!hasBlueprint || !hasAnyRule ? (
        <div
          className="px-3 py-6 text-center text-xs text-muted-foreground"
          data-testid="quick-events-empty"
        >
          {emptyHint}
        </div>
      ) : null}

      {/* 触发器（本组件作为源）分区 —— 仅 V1 蓝图显示，V2 请使用事件蓝图编辑器 */}
      {hasBlueprint && (
        <PanelSection
          title="触发器（本组件作为源）"
          collapsible
          defaultOpen
          testId="quick-events-triggers-section"
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="添加触发器"
                  data-testid="quick-events-add-trigger"
                >
                  <Plus className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => handleAddTemplate('navigate')}
                  data-testid="quick-events-template-navigate"
                >
                  <MousePointerClick className="size-3.5" />
                  点击本组件 → 跳转 URL
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => handleAddTemplate('setVisibility')}
                  data-testid="quick-events-template-set-visibility"
                >
                  <Eye className="size-3.5" />
                  点击本组件 → 显示/隐藏目标组件
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => handleAddTemplate('refreshDataSource')}
                  data-testid="quick-events-template-refresh-data-source"
                >
                  <RefreshCw className="size-3.5" />
                  点击本组件 → 刷新目标组件数据
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        >
          {triggerRules.length === 0 ? (
            <div className="py-3 text-center text-xs text-muted-foreground">本组件未作为触发源</div>
          ) : (
            <ul className="space-y-1.5" data-testid="quick-events-trigger-list">
              {triggerRules.map((rule) => (
                <li
                  key={rule.triggerNodeId}
                  className="flex items-start gap-1.5 rounded border border-border bg-background px-2 py-1.5"
                  data-testid="quick-events-trigger-item"
                >
                  <MousePointerClick className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">
                      {getTriggerLabel(rule.triggerConfig)}
                    </div>
                    {rule.actions.length > 0 ? (
                      <div className="mt-0.5 space-y-0.5">
                        {rule.actions.map((action) => (
                          <div
                            key={action.nodeId}
                            className="truncate text-[11px] text-muted-foreground"
                          >
                            → {getActionLabel(action.config)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">→ 未配置动作</div>
                    )}
                  </div>
                  <DeleteConfirmDialog
                    testId="quick-events-delete-trigger"
                    cancelTestId="quick-events-delete-cancel"
                    confirmTestId="quick-events-delete-confirm"
                    title="删除事件规则？"
                    description="将删除该触发器及其下游所有动作节点和连线，操作可通过历史栈撤销。"
                    onOpen={() =>
                      setPendingDelete({
                        kind: 'trigger',
                        nodeId: rule.triggerNodeId,
                        description: '将删除该触发器及其下游所有动作节点和连线。',
                      })
                    }
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={handleConfirmDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      )}

      {/* 动作（本组件作为目标）分区 —— 仅 V1 蓝图显示 */}
      {hasBlueprint && (
        <PanelSection
          title="动作（本组件作为目标）"
          collapsible
          defaultOpen
          testId="quick-events-actions-section"
        >
          {actionRules.length === 0 ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              本组件未作为动作目标
            </div>
          ) : (
            <ul className="space-y-1.5" data-testid="quick-events-action-list">
              {actionRules.map((rule) => (
                <li
                  key={rule.actionNodeId}
                  className="flex items-start gap-1.5 rounded border border-border bg-background px-2 py-1.5"
                  data-testid="quick-events-action-item"
                >
                  <Eye className="mt-0.5 size-3.5 shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">
                      {getActionLabel(rule.actionConfig)}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      ← {rule.triggerConfig ? getTriggerLabel(rule.triggerConfig) : '未连接触发器'}
                    </div>
                  </div>
                  <DeleteConfirmDialog
                    testId="quick-events-delete-action"
                    cancelTestId="quick-events-delete-action-cancel"
                    confirmTestId="quick-events-delete-action-confirm"
                    title="删除动作节点？"
                    description="将从蓝图中移除该动作节点及其直接连线，操作可通过历史栈撤销。"
                    onOpen={() =>
                      setPendingDelete({
                        kind: 'action',
                        nodeId: rule.actionNodeId,
                        description: '将从蓝图中移除该动作节点及其直接连线。',
                      })
                    }
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={handleConfirmDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      )}
    </div>
  );
}

// ===== 内部组件：删除确认弹窗 =====

interface DeleteConfirmDialogProps {
  /** 删除按钮的 data-testid */
  testId: string;
  /** 取消按钮的 data-testid */
  cancelTestId: string;
  /** 确认按钮的 data-testid */
  confirmTestId: string;
  /** 弹窗标题 */
  title: string;
  /** 弹窗描述 */
  description: string;
  /** 点击删除按钮（弹窗打开前）回调，用于记录待删除上下文 */
  onOpen: () => void;
  /** 取消按钮回调 */
  onCancel: () => void;
  /** 确认按钮回调 */
  onConfirm: () => void;
}

/**
 * 删除确认弹窗。
 *
 * 由 AlertDialogTrigger 拉起，触发前先调用 `onOpen` 记录待删除节点上下文，
 * 确认时调用 `onConfirm`（内部读取最新 pendingDelete 状态）。
 *
 * 注意：onOpen 在 onClick 中执行（先于 Radix 内部状态更新），保证弹窗打开时
 * 上下文已就绪；onConfirm 通过闭包读取最新 handleConfirmDelete（每次渲染都重新创建）。
 */
function DeleteConfirmDialog({
  testId,
  cancelTestId,
  confirmTestId,
  title,
  description,
  onOpen,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps): JSX.Element {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="删除"
          data-testid={testId}
          onClick={onOpen}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} data-testid={cancelTestId}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid={confirmTestId}>
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
