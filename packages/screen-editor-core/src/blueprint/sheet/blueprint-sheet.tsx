/**
 * 事件蓝图 Sheet（任务 4.7）
 *
 * 容器形态：全屏弹层（full-overlay，带顶栏），与
 * docs/screen-designer-panels-architecture.md §7.4 一致。
 *
 * 职责：
 * - 从 editor-store 读取/写回 `blueprint`
 * - 渲染 ReactFlow 画布，复用既有节点/边/面板/primitives
 * - 顶栏含标题、视口工具栏、关闭按钮
 * - 入口与 onOpenChange 契约不变（screen-editor.tsx 调用方无感）
 *
 * 数据流（单向）：
 * - blueprint → ReactFlow nodes/edges：blueprint 引用变化（undo/redo/load）时重建本地状态
 * - ReactFlow nodes/edges → blueprint：本地状态变化时通过 updateBlueprint 写回（含 ref 守卫避免循环）
 *
 * 历史语义（任务 5.2）：
 * - 节点增删、连线增删、参数修改等离散编辑经 updateBlueprint 入历史栈（单条历史）
 * - 节点拖拽经 begin/endBlueprintGesture 手势合并：拖拽中间态不自动写回，
 *   拖拽结束吸附后提交一次，一次拖拽只产生一条历史记录（undo 回到拖拽前）
 *
 * 注意：编辑器画布不执行蓝图（预览专用），本组件仅做可视化编排。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, MouseEvent as ReactMouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type EdgeTypes,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X } from 'lucide-react';
import type {
  EventBlueprint,
  ScreenComponent,
  BlueprintTriggerConfig,
  BlueprintActionConfig,
  CommentNodeConfig,
  ConditionNodeConfig,
} from '@nebula/shared';
import { EVENT_BLUEPRINT_VERSION } from '@nebula/shared';

import { useScreenEditorStore } from '../../stores/editor-store';
import { useOptionalScreenEditorNotifications } from '../../components/screen-editor-notifications';
import { ActionNode, CommentNode, ConditionNode, TriggerNode } from '../nodes';
import { ExecEdge, EXEC_EDGE_MARKER_END } from '../edges';
import { ViewportToolbar } from '../panels/viewport-toolbar';
import { AlignDistributeToolbar } from '../panels/align-distribute-toolbar';
import {
  useBlueprintViewport,
  useBlueprintDrag,
  useBlueprintShortcuts,
  useBlueprintClipboard,
  useBlueprintDiagnostics,
  BlueprintDiagnosticMapProvider,
  buildDiagnosticMap,
} from '../hooks';
import {
  SearchPanel,
  NODE_OPTIONS,
  type NodeOption,
  type PendingConnection,
} from '../panels/search-panel';
import { ProblemsPanel, ExecutionLogPanel } from '../panels';
import { NodeConfigPanel, type NodeConfigPanelProps } from '../panels/node-config-panel';
import { EmptyBlueprintState } from '../templates';
import {
  useBlueprintSandboxRuntime,
  useBlueprintSandboxHighlight,
  getNodeLocateComponentId,
  type SandboxSimulationResult,
} from '../runtime';
import { filterBlueprintByComponent } from '../compiler';
import { ToolbarButton } from '../../components/ui-primitives';
import { Play, RotateCcw } from 'lucide-react';
import {
  alignNodes,
  applyAlignResultToNodes,
  distributeNodes,
  type AlignMode,
  type AlignNode,
  type DistributeMode,
} from '../lib/align-distribute';
import {
  INPUT_PINS,
  isConnectionValid,
  type ConnectionCandidate,
  type NodeIndex,
  type PinId,
} from '../lib/pin-compatibility';
import { BlueprintContextMenu, type BlueprintContextMenuMode } from './blueprint-context-menu';

// ===== ReactFlow 类型映射 =====

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  comment: CommentNode,
  condition: ConditionNode,
};

const edgeTypes: EdgeTypes = {
  exec: ExecEdge,
};

// ===== 蓝图 ↔ ReactFlow 转换 =====

/**
 * 根据 config 类型生成节点显示标签。
 *
 * 标签规则：
 * - trigger.componentClick：点击：<componentName>
 * - trigger.pageLoad：页面加载
 * - action.setVisibility：显示/隐藏：<componentName>
 * - action.navigate：跳转：<url>
 * - action.scrollToComponent：滚动至：<componentName>
 * - action.refreshDataSource：刷新数据：<componentName>
 * - comment：config.text
 */
function buildComponentMap(components: ScreenComponent[]): Map<string, ScreenComponent> {
  const map = new Map<string, ScreenComponent>();
  for (const c of components) map.set(c.id, c);
  return map;
}

/** 内部：基于 Map 做 O(1) 查询，供批量转换使用 */
function getNodeLabelWithMap(
  kind: 'trigger' | 'condition' | 'action' | 'comment',
  config: Record<string, unknown>,
  componentMap: Map<string, ScreenComponent>,
): string {
  const findComponentName = (id: string | undefined): string => {
    if (!id) return '未配置';
    return componentMap.get(id)?.name ?? id;
  };

  if (kind === 'trigger') {
    const triggerConfig = config as { type: string; componentId?: string };
    if (triggerConfig.type === 'componentClick') {
      return `点击：${findComponentName(triggerConfig.componentId)}`;
    }
    if (triggerConfig.type === 'pageLoad') {
      return '页面加载';
    }
    return '触发器';
  }

  if (kind === 'action') {
    const actionConfig = config as {
      type: string;
      targetComponentId?: string;
      url?: string;
      visible?: string;
    };
    switch (actionConfig.type) {
      case 'setVisibility':
        return `${actionConfig.visible === 'hide' ? '隐藏' : '显示'}：${findComponentName(actionConfig.targetComponentId)}`;
      case 'navigate':
        return `跳转：${actionConfig.url || '未设置'}`;
      case 'scrollToComponent':
        return `滚动至：${findComponentName(actionConfig.targetComponentId)}`;
      case 'refreshDataSource':
        return `刷新数据：${findComponentName(actionConfig.targetComponentId)}`;
      default:
        return '动作';
    }
  }

  if (kind === 'comment') {
    const commentConfig = config as { text: string };
    return commentConfig.text || '注释';
  }

  if (kind === 'condition') {
    const condConfig = config as { type: string; expression?: { operator?: string } };
    if (condConfig.type !== 'condition' || !condConfig.expression) {
      return '条件分支';
    }
    const opLabelMap: Record<string, string> = {
      eq: '等于',
      ne: '不等于',
      gt: '大于',
      gte: '大于等于',
      lt: '小于',
      lte: '小于等于',
      contains: '包含',
      empty: '为空',
      notEmpty: '非空',
    };
    const op = condConfig.expression.operator ?? '';
    return `条件：${opLabelMap[op] ?? op}`;
  }

  return '节点';
}

/** 公共：保持数组签名兼容现有调用方与单测，内部转 Map 后委托 */
export function getNodeLabel(
  kind: 'trigger' | 'condition' | 'action' | 'comment',
  config: Record<string, unknown>,
  components: ScreenComponent[],
): string {
  return getNodeLabelWithMap(kind, config, buildComponentMap(components));
}

/**
 * 检查节点是否 dangling（关联的 componentId 在项目中不存在）。
 * 基于 Map 做 O(1) 存在性查询；调用方批量转换时只需构建一次 Map。
 */
function isNodeDangling(
  kind: 'trigger' | 'condition' | 'action' | 'comment',
  config: Record<string, unknown>,
  componentMap: Map<string, ScreenComponent>,
): boolean {
  if (kind === 'trigger') {
    const triggerConfig = config as { type: string; componentId?: string };
    if (triggerConfig.type === 'componentClick' && triggerConfig.componentId) {
      return !componentMap.has(triggerConfig.componentId);
    }
    return false;
  }

  if (kind === 'action') {
    const actionConfig = config as { type: string; targetComponentId?: string };
    if (actionConfig.targetComponentId) {
      return !componentMap.has(actionConfig.targetComponentId);
    }
    return false;
  }

  if (kind === 'condition') {
    // condition 节点 dangling：表达式 source.componentId 不存在
    const condConfig = config as {
      type: string;
      expression?: { source?: { componentId?: string } };
    };
    if (condConfig.type !== 'condition' || !condConfig.expression?.source) return false;
    const sourceComponentId = condConfig.expression.source.componentId;
    if (!sourceComponentId) return false;
    return !componentMap.has(sourceComponentId);
  }

  return false;
}

/**
 * 将蓝图节点转换为 ReactFlow Node。
 * 批量调用方应传入预构建的 componentMap 以避免每节点重复线性扫描（O(N×M) → O(N+M)）。
 */
function blueprintNodeToRFNode(
  blueprintNode: EventBlueprint['nodes'][number],
  componentMap: Map<string, ScreenComponent>,
): Node {
  const config = blueprintNode.config as Record<string, unknown>;
  const label = getNodeLabelWithMap(blueprintNode.kind, config, componentMap);
  const dangling = isNodeDangling(blueprintNode.kind, config, componentMap);

  const data: Record<string, unknown> = {
    config: blueprintNode.config,
    label,
    dangling,
  };

  // trigger 和 action 节点额外字段（与 node-data-types 对齐）
  if (blueprintNode.kind === 'trigger') {
    const triggerConfig = blueprintNode.config as { componentId?: string };
    if (triggerConfig.componentId) {
      data.componentId = triggerConfig.componentId;
    }
  } else if (blueprintNode.kind === 'action') {
    const actionConfig = blueprintNode.config as { targetComponentId?: string };
    if (actionConfig.targetComponentId) {
      data.targetComponentId = actionConfig.targetComponentId;
    }
  }

  return {
    id: blueprintNode.id,
    type: blueprintNode.kind,
    position: { x: blueprintNode.position.x, y: blueprintNode.position.y },
    data,
  };
}

/**
 * 将 ReactFlow Node 转换回蓝图节点。
 * 使用类型断言将 data.config 还原为判别联合类型（由编译器/Schema 在持久化时校验）。
 * ReactFlow 的 Node.type/data 是宽类型，无法在编译期保证 kind 与 config 的判别联合一致性，
 * 此处整体断言为 BlueprintNode（非 any），运行时由 Zod Schema 在持久化时校验。
 */
function rfNodeToBlueprintNode(node: Node): EventBlueprint['nodes'][number] {
  const data = node.data as { config: EventBlueprint['nodes'][number]['config'] };
  return {
    id: node.id,
    kind: node.type as 'trigger' | 'condition' | 'action' | 'comment',
    position: { x: node.position.x, y: node.position.y },
    config: data.config,
  } as EventBlueprint['nodes'][number];
}

/**
 * 将蓝图边转换为 ReactFlow Edge。
 */
function blueprintEdgeToRFEdge(blueprintEdge: EventBlueprint['edges'][number]): Edge {
  return {
    id: blueprintEdge.id,
    type: 'exec',
    source: blueprintEdge.source,
    sourceHandle: blueprintEdge.sourceHandle,
    target: blueprintEdge.target,
    targetHandle: blueprintEdge.targetHandle,
    markerEnd: EXEC_EDGE_MARKER_END,
    data: {},
  };
}

/**
 * 将 ReactFlow Edge 转换回蓝图边。
 */
function rfEdgeToBlueprintEdge(edge: Edge): EventBlueprint['edges'][number] {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? 'out',
    target: edge.target,
    targetHandle: edge.targetHandle ?? 'in',
  };
}

/** 基于当前 RF 状态构建引脚兼容判定输入（NodeIndex + 既有蓝图边） */
function buildConnectionContext(
  rfNodes: Node[],
  rfEdges: Edge[],
): { nodeIndex: NodeIndex; bpEdges: EventBlueprint['edges'] } {
  const bpNodes = rfNodes.map(rfNodeToBlueprintNode);
  const nodeIndex: NodeIndex = new Map(bpNodes.map((n) => [n.id, n]));
  return { nodeIndex, bpEdges: rfEdges.map(rfEdgeToBlueprintEdge) };
}

/** 将 RF Connection/Edge 归一化为引脚兼容判定候选 */
function toConnectionCandidate(conn: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): ConnectionCandidate {
  return {
    sourceNodeId: conn.source,
    sourceHandle: (conn.sourceHandle ?? 'out') as PinId,
    targetNodeId: conn.target,
    targetHandle: (conn.targetHandle ?? 'in') as PinId,
  };
}

/**
 * 根据 NodeOption 的 kind/subtype 构造初始 config（空参数，由后续属性面板填充）。
 * 节点 ID 使用时间戳 + 随机数生成（M1 简化方案，M2 可换为短 ID）。
 */
function createNodeFromOption(
  option: NodeOption,
  position: { x: number; y: number },
): EventBlueprint['nodes'][number] {
  const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let config: EventBlueprint['nodes'][number]['config'];

  if (option.kind === 'trigger') {
    if (option.subtype === 'componentClick') {
      config = { type: 'componentClick', componentId: '' };
    } else {
      config = { type: 'pageLoad' };
    }
  } else if (option.kind === 'action') {
    switch (option.subtype) {
      case 'setVisibility':
        config = { type: 'setVisibility', targetComponentId: '', visible: 'show' };
        break;
      case 'navigate':
        config = { type: 'navigate', url: '', target: '_blank' };
        break;
      case 'scrollToComponent':
        config = { type: 'scrollToComponent', targetComponentId: '' };
        break;
      case 'refreshDataSource':
        config = { type: 'refreshDataSource', targetComponentId: '' };
        break;
      default:
        throw new Error(`Unknown action subtype: ${option.subtype}`);
    }
  } else if (option.kind === 'condition') {
    // condition 默认表达式：componentProp 空比较（待属性面板填充）
    config = {
      type: 'condition',
      expression: {
        source: { kind: 'componentProp', componentId: '', key: '' },
        operator: 'eq',
        value: '',
      },
    };
  } else {
    config = { text: '' };
  }

  return {
    id,
    kind: option.kind,
    position,
    config,
  } as EventBlueprint['nodes'][number];
}

/** 生成唯一边 ID（时间戳 + 随机数） */
function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ===== 主组件 =====

interface BlueprintSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 蓝图->画布高亮联动：点击节点时调用，由 screen-editor 注入 flashComponent */
  onLocateComponent?: (componentId: string) => void;
  /**
   * 画布->蓝图过滤联动：当前选中组件 id（null 表示不过滤）。
   *
   * 优化（2026-07-26）：若调用方未显式传入（undefined），组件内部会通过
   * useScreenEditorStore 订阅 selectedComponentIds 自动派生。
   * 这样 ScreenEditor 不必为 BlueprintSheet 而订阅 selectedComponentIds，
   * 避免选中变化时 ScreenEditor 重渲染导致整个外壳（左/右面板、画布、上下文菜单）
   * 一起重渲染，从而消除控制框延迟。
   *
   * 调用方仍可显式传入优先级更高的值（如 QuickEventEditor 的 focusComponentId）。
   */
  filterComponentId?: string | null;
  /** 保存项目回调（缺口 1：Ctrl+S 接管） */
  onSave?: () => void;
  /** 显示快捷键帮助（缺口 2：Ctrl+/ 接管） */
  onShowHelp?: () => void;
}

/**
 * 事件蓝图全屏弹层编辑器。
 *
 * 容器形态：full-overlay（全屏弹层，带顶栏）。
 * 数据流：editor-store.blueprint → ReactFlow nodes/edges → editor-store.updateBlueprint
 */
export function BlueprintSheet({
  open,
  onOpenChange,
  onLocateComponent,
  filterComponentId,
  onSave,
  onShowHelp,
}: BlueprintSheetProps): JSX.Element | null {
  // 内部派生 filterComponentId（仅当调用方未显式传入时）。
  // 在 Sheet 关闭时（open=false）提前 return null，订阅不会触发重渲染。
  // 在 Sheet 打开后才订阅 selectedComponentIds，此时用户在 Sheet 内部交互，
  // 选中变化由 Sheet 自身消化，不再回流到 ScreenEditor。
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const effectiveFilterComponentId =
    filterComponentId !== undefined
      ? filterComponentId
      : selectedComponentIds.length === 1
        ? selectedComponentIds[0]
        : null;

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="blueprint-sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="事件蓝图"
    >
      <ReactFlowProvider>
        <BlueprintSheetInner
          onOpenChange={onOpenChange}
          onLocateComponent={onLocateComponent}
          filterComponentId={effectiveFilterComponentId}
          onSave={onSave}
          onShowHelp={onShowHelp}
        />
      </ReactFlowProvider>
    </div>
  );
}

interface BlueprintSheetInnerProps {
  onOpenChange: (open: boolean) => void;
  onLocateComponent?: (componentId: string) => void;
  filterComponentId?: string | null;
  onSave?: () => void;
  onShowHelp?: () => void;
}

interface SearchPanelState {
  visible: boolean;
  mode: 'create' | 'connect';
  position: { x: number; y: number };
  pendingConnection?: PendingConnection;
}

function BlueprintSheetInner({
  onOpenChange,
  onLocateComponent,
  filterComponentId,
  onSave,
  onShowHelp,
}: BlueprintSheetInnerProps): JSX.Element {
  const notifications = useOptionalScreenEditorNotifications();
  const project = useScreenEditorStore((s) => s.project);
  const updateBlueprint = useScreenEditorStore((s) => s.updateBlueprint);
  const beginBlueprintGesture = useScreenEditorStore((s) => s.beginBlueprintGesture);
  const endBlueprintGesture = useScreenEditorStore((s) => s.endBlueprintGesture);

  // V1 蓝图窄化：本组件为 V1 编辑器，仅处理 version=1 的蓝图；
  // V2 蓝图由 BlueprintSheetV2 处理。这里通过类型守卫将 BlueprintField 收敛为 EventBlueprint。
  const projectBlueprint = project?.blueprint;
  const blueprint =
    projectBlueprint !== undefined && projectBlueprint.version === EVENT_BLUEPRINT_VERSION
      ? projectBlueprint
      : undefined;
  const components = project?.components ?? [];

  // 任务 9.2：画布选中组件 → 蓝图过滤联动
  // 当 filterComponentId 为非空字符串时，Sheet 内 ReactFlow 切换到过滤视图
  const isFiltering =
    filterComponentId !== undefined && filterComponentId !== null && filterComponentId !== '';

  // 任务 9.2：过滤后的蓝图节点/边 id 集合（仅 isFiltering 时计算）
  const filteredIds = useMemo(() => {
    if (!isFiltering || !blueprint || !filterComponentId) return null;
    const filtered = filterBlueprintByComponent(blueprint, filterComponentId);
    return {
      nodeIds: new Set(filtered.nodes.map((n) => n.id)),
      edgeIds: new Set(filtered.edges.map((e) => e.id)),
    };
  }, [isFiltering, blueprint, filterComponentId]);

  // 任务 8.1：沙盒运行时（独立于预览/画布真实状态）
  const sandbox = useBlueprintSandboxRuntime(blueprint, components);

  // 任务 8.3：最近一次模拟结果（用于 ExecutionLogPanel 显示拒绝/未找到原因）
  const [lastSimResult, setLastSimResult] = useState<SandboxSimulationResult | null>(null);

  // 任务 8.2：链路高亮状态机（基于沙盒 executionLogs 驱动）
  const highlight = useBlueprintSandboxHighlight(sandbox.executionLogs, blueprint);

  // ReactFlow 本地状态（从 blueprint 派生）
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [searchPanelState, setSearchPanelState] = useState<SearchPanelState>({
    visible: false,
    mode: 'create',
    position: { x: 0, y: 0 },
  });
  // 空态引导关闭标记：用户点击"从空白开始"后置 true，避免空蓝图仍被空态遮罩死锁
  const [emptyDismissed, setEmptyDismissed] = useState(false);
  // 右键菜单模式：由 ReactFlow 的 node/edge/pane 右键处理器驱动
  const [ctxMenuMode, setCtxMenuMode] = useState<BlueprintContextMenuMode>('pane');
  // 空白处右键时的屏幕坐标（供"添加节点..."在右键位置呼出搜索面板）
  const paneMenuPosRef = useRef({ x: 0, y: 0 });

  // ref 守卫：标记下一次 blueprint→nodes/edges 同步是内部触发，nodes/edges→blueprint 应跳过
  const skipNextBlueprintSync = useRef(false);
  // 标记是否已初始化（避免首次渲染时用空 nodes/edges 覆盖已有 blueprint）
  const initialized = useRef(false);
  // 拖拽手势进行中标记：期间 nodes/edges→blueprint 的自动写回被抑制，
  // 拖拽结束时由 handleNodeDragStop 统一提交一次（任务 5.2：中间态不入栈）
  const dragActive = useRef(false);
  // 连线进行中标记：Esc 分层第二层检查（任务 5.4）
  const isConnectingRef = useRef(false);
  // 最新 nodes/edges 的 ref 快照，供拖拽结束时同步读取（setNodes 异步，不能依赖闭包中的 state）
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  /**
   * P0 性能优化：ref 镜像高频变化的非 primitive state。
   *
   * 原 useEffect[nodes, edges] 同步 ref 会在每次 nodes/edges 变化时额外触发一次
   * effect 执行；React 官方推荐在 render 期直接赋值 ref（无需 effect）。
   * 以下 ref 用于 callback 内读取最新值，使 callback 依赖最小化、避免重建。
   */
  const projectRef = useRef(project);
  const componentsRef = useRef(components);
  const searchPanelStateRef = useRef(searchPanelState);
  const sandboxRef = useRef(sandbox);
  const selectedAlignNodesRef = useRef<AlignNode[]>([]);
  const selectedNodeRef = useRef<Node | null>(null);

  // render 期直接同步 ref（React 官方模式，避免 useEffect 额外渲染周期）
  nodesRef.current = nodes;
  edgesRef.current = edges;
  projectRef.current = project;
  componentsRef.current = components;
  searchPanelStateRef.current = searchPanelState;
  sandboxRef.current = sandbox;

  // blueprint → ReactFlow 同步（外部变化：undo/redo/load）
  useEffect(() => {
    skipNextBlueprintSync.current = true;
    if (!blueprint) {
      setNodes([]);
      setEdges([]);
      initialized.current = true;
      return;
    }
    // 预构建 component 查询 Map，批量转换避免每节点重复线性扫描（O(N×M) → O(N+M)）
    const componentMap = buildComponentMap(components);
    // 合并 ephemeral 字段：blueprint 重建节点会丢失 selected / measured，
    // 导致配置面板每次编辑后选中态闪烁、对齐面板丢失已测量尺寸。
    // 按 id 从当前 RF 状态中继承这些纯 UI 态字段（不参与 blueprint 持久化）。
    const prevNodeById = new Map(nodesRef.current.map((n) => [n.id, n]));
    const prevEdgeById = new Map(edgesRef.current.map((e) => [e.id, e]));
    setNodes(
      blueprint.nodes.map((n: EventBlueprint['nodes'][number]) => {
        const rfNode = blueprintNodeToRFNode(n, componentMap);
        const prev = prevNodeById.get(rfNode.id);
        if (prev) {
          if (prev.selected) rfNode.selected = true;
          if (prev.measured) rfNode.measured = prev.measured;
        }
        return rfNode;
      }),
    );
    setEdges(
      blueprint.edges.map((e: EventBlueprint['edges'][number]) => {
        const rfEdge = blueprintEdgeToRFEdge(e);
        const prev = prevEdgeById.get(rfEdge.id);
        if (prev?.selected) rfEdge.selected = true;
        return rfEdge;
      }),
    );
    initialized.current = true;
    // 仅在 blueprint 引用变化时同步；components 变化由 dangling 在渲染时重算
  }, [blueprint]);

  // ReactFlow nodes/edges → blueprint 同步（本地状态变化时写回）
  useEffect(() => {
    if (!initialized.current) return;
    if (skipNextBlueprintSync.current) {
      skipNextBlueprintSync.current = false;
      return;
    }
    // 拖拽手势进行中不自动写回：中间态由 handleNodeDragStop 统一提交（任务 5.2）
    if (dragActive.current) return;
    if (!projectRef.current) return;
    const newBlueprint: EventBlueprint = {
      version: 1,
      nodes: nodes.map(rfNodeToBlueprintNode),
      edges: edges.map(rfEdgeToBlueprintEdge),
    };
    updateBlueprint(newBlueprint);
    // nodes/edges 变化时同步；updateBlueprint 内部有深比较守卫避免循环
  }, [nodes, edges, updateBlueprint]);

  // ReactFlow 变更处理：仅更新本地状态（→ 由 useEffect 同步到 blueprint）
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  /**
   * 引脚兼容判定（拖拽连线实时校验 + onConnect 兜底共用）。
   *
   * 规则见 lib/pin-compatibility.ts：comment 不参与执行流、不允许自环/重复边、
   * 源必须是输出引脚、目标必须是输入引脚。
   */
  const checkConnection = useCallback(
    (conn: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }): boolean => {
      const { nodeIndex, bpEdges } = buildConnectionContext(nodesRef.current, edgesRef.current);
      return isConnectionValid(toConnectionCandidate(conn), nodeIndex, bpEdges).valid;
    },
    [],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // isValidConnection 已在拖拽期拦截非法连线，此处兜底（程序化 addEdge 等路径）
      if (!checkConnection(connection)) return;
      const newEdge: Edge = {
        id: generateEdgeId(),
        type: 'exec',
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? 'out',
        target: connection.target,
        targetHandle: connection.targetHandle ?? 'in',
        markerEnd: EXEC_EDGE_MARKER_END,
        data: {},
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [checkConnection],
  );

  // 任务 5.4：追踪连线拖拽状态，供 Esc 分层判断
  const handleConnectStart = useCallback(() => {
    isConnectingRef.current = true;
  }, []);

  /**
   * 连线松手：
   * - 落在空白处（toNode=null）且从输出引脚拖出 → 呼出搜索面板（connect 模式），
   *   选中节点类型后在松手位置插入新节点并自动完成连线
   * - 其他情况仅复位连线中标记
   */
  const handleConnectEnd: OnConnectEnd = useCallback((event, connectionState) => {
    isConnectingRef.current = false;
    if (connectionState.toNode) return;
    const fromNode = connectionState.fromNode;
    const fromHandle = connectionState.fromHandle;
    if (!fromNode || !fromHandle || fromHandle.type !== 'source') return;

    const { clientX, clientY } =
      'changedTouches' in event
        ? { clientX: event.changedTouches[0].clientX, clientY: event.changedTouches[0].clientY }
        : { clientX: event.clientX, clientY: event.clientY };

    setSearchPanelState({
      visible: true,
      mode: 'connect',
      position: { x: clientX, y: clientY },
      pendingConnection: {
        sourceNodeId: fromNode.id,
        sourceHandle: (fromHandle.id ?? 'out') as PendingConnection['sourceHandle'],
      },
    });
  }, []);

  // 拖拽吸附：仅更新本地 nodes（拖拽结束由 handleNodeDragStop 统一提交 blueprint）
  // onNodesChange 回调同步更新 nodesRef，保证拖拽结束时能读到吸附后的最终位置
  const { onNodeDragStop: snapNodeDragStop } = useBlueprintDrag({
    nodes,
    onNodesChange: (nextNodes) => {
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    },
  });

  // 拖拽开始：开启蓝图编辑手势（任务 5.2），期间 updateBlueprint 合并为一次提交
  const handleNodeDragStart: OnNodeDrag = useCallback(() => {
    dragActive.current = true;
    beginBlueprintGesture();
  }, [beginBlueprintGesture]);

  // 拖拽结束：吸附后提交最终位置一次，并结束手势补一条历史（undo 回到拖拽前）
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (event, node, draggedNodes) => {
      // 应用网格/对齐吸附（内部经 onNodesChange 更新 nodesRef 与 setNodes）
      snapNodeDragStop(event, node, draggedNodes);
      const finalNodes = nodesRef.current;
      if (projectRef.current) {
        const finalBlueprint: EventBlueprint = {
          version: 1,
          nodes: finalNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        // 手势进行中 →  transient 更新（不入历史栈）
        updateBlueprint(finalBlueprint);
      }
      // 结束手势：有净变化则补一条历史（快照为拖拽前），无变化则不产生空历史
      endBlueprintGesture();
      dragActive.current = false;
    },
    [snapNodeDragStop, updateBlueprint, endBlueprintGesture],
  );

  // 视口控制
  const viewport = useBlueprintViewport();

  // ReactFlow 实例（屏幕坐标 → 流程坐标转换、视口定位共用）
  const reactFlowInstance = useReactFlow();

  // 首次挂载时恢复上次缓存的视口（避免每次打开都回到 {0,0,1}）
  useEffect(() => {
    viewport.restoreViewport();
  }, [viewport.restoreViewport]);

  // 双击空白呼出搜索面板（创建模式）
  const handleDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // 排除节点、边、控件、小地图、attribution 的双击
    if (
      target.closest('.react-flow__node') ||
      target.closest('.react-flow__edge') ||
      target.closest('.react-flow__controls') ||
      target.closest('.react-flow__minimap') ||
      target.closest('.react-flow__attribution')
    ) {
      return;
    }
    setSearchPanelState({
      visible: true,
      mode: 'create',
      position: { x: event.clientX, y: event.clientY },
    });
  }, []);

  // 搜索面板：插入节点
  const handleInsertNode = useCallback(
    (option: NodeOption) => {
      const state = searchPanelStateRef.current;
      // 面板位置是屏幕坐标（clientX/Y），必须转换为流程坐标，
      // 否则缩放/平移后新节点会偏离点击位置
      const position = reactFlowInstance.screenToFlowPosition({
        x: state.position.x,
        y: state.position.y,
      });
      const newNode = createNodeFromOption(option, position);
      const rfNode = blueprintNodeToRFNode(newNode, buildComponentMap(componentsRef.current));

      // 插入后单选新节点（配置面板立即就绪，符合"插入即配置"直觉）
      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        { ...rfNode, selected: true },
      ]);

      // connect 模式：校验引脚兼容后自动连线（无效则仅插入节点不连线）
      if (state.mode === 'connect' && state.pendingConnection) {
        const candidate: ConnectionCandidate = {
          sourceNodeId: state.pendingConnection.sourceNodeId,
          sourceHandle: state.pendingConnection.sourceHandle,
          targetNodeId: rfNode.id,
          targetHandle: 'in',
        };
        const { nodeIndex, bpEdges } = buildConnectionContext(nodesRef.current, edgesRef.current);
        // NodeIndex 是 ReadonlyMap：构造时合并新节点，而非事后 set
        const nextIndex: NodeIndex = new Map([...nodeIndex, [newNode.id, newNode]]);
        if (isConnectionValid(candidate, nextIndex, bpEdges).valid) {
          const newEdge: Edge = {
            id: generateEdgeId(),
            type: 'exec',
            source: state.pendingConnection.sourceNodeId,
            sourceHandle: state.pendingConnection.sourceHandle,
            target: rfNode.id,
            targetHandle: 'in',
            markerEnd: EXEC_EDGE_MARKER_END,
            data: {},
          };
          setEdges((eds) => [...eds, newEdge]);
        }
      }

      setSearchPanelState((s) => ({ ...s, visible: false }));
    },
    [reactFlowInstance],
  );

  // 全选：Ctrl+A 与右键菜单"全选"共用
  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((ed) => ({ ...ed, selected: true })));
  }, []);

  // 任务 5.4：快捷键分层 -- Ctrl+Z/Shift+Z 走全局历史，Esc 分层
  // 缺口 1/2：Ctrl+S 保存、Ctrl+=/-/0 视口缩放、Ctrl+/ 帮助
  useBlueprintShortcuts({
    onClose: () => onOpenChange(false),
    searchPanelVisible: searchPanelState.visible,
    onCloseSearchPanel: () => setSearchPanelState((s) => ({ ...s, visible: false })),
    nodes,
    edges,
    setNodes,
    setEdges,
    isConnectingRef,
    onSave,
    onZoomIn: () => void viewport.zoomIn(),
    onZoomOut: () => void viewport.zoomOut(),
    onFitView: () => void viewport.fitView(),
    onShowHelp,
    onSelectAll: handleSelectAll,
  });

  // 任务 5.5：跨项目剪贴板 —— Ctrl+C/X/V/D（返回值供右键菜单复用）
  const blueprintClipboard = useBlueprintClipboard({ nodes, edges, setNodes, setEdges });

  // 任务 6.1：实时诊断订阅
  // P0 优化：useMemo 避免每次渲染创建新 Set 导致 useBlueprintDiagnostics 内部 useCallback 重建
  const componentIds = useMemo(() => new Set(components.map((c) => c.id)), [components]);
  const { diagnostics, errorCount, warningCount, infoCount } = useBlueprintDiagnostics({
    blueprint,
    componentIds,
  });
  const diagnosticMap = buildDiagnosticMap(diagnostics);

  // 任务 6.2：问题面板点击定位节点
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLocateNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodesRef.current.find((n) => n.id === nodeId);
      if (!targetNode) return;

      // 居中到目标节点
      void reactFlowInstance.setCenter(targetNode.position.x, targetNode.position.y, {
        zoom: 1,
        duration: 300,
      });

      // 添加闪烁标记
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, locating: true } } : n)),
      );

      // 1s 后移除闪烁标记
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
      locateTimerRef.current = setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, locating: false } } : n)),
        );
      }, 1000);
    },
    [reactFlowInstance, setNodes],
  );

  // 清理定位计时器
  useEffect(() => {
    return () => {
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
    };
  }, []);

  // 任务 9.4：多选对齐与分布
  // 选中节点（ReactFlow Node 的 selected 字段）转换为 AlignNode 输入
  // P0 优化：useMemo 避免每次渲染重算；同步 ref 供 handleAlign/handleDistribute 读取
  const selectedAlignNodes = useMemo<AlignNode[]>(
    () =>
      nodes
        .filter((n) => n.selected)
        .map((n) => ({
          id: n.id,
          position: { x: n.position.x, y: n.position.y },
          width: n.measured?.width ?? 0,
          height: n.measured?.height ?? 0,
        })),
    [nodes],
  );
  selectedAlignNodesRef.current = selectedAlignNodes;

  const selectedCount = selectedAlignNodes.length;

  // 对齐：调用纯函数计算新位置，应用到 nodes 并写回 blueprint（一次提交一条历史）
  // P0 优化：通过 ref 读取最新值，callback 依赖仅 updateBlueprint（稳定），避免每次 nodes 变化重建
  const handleAlign = useCallback(
    (mode: AlignMode) => {
      const result = alignNodes(selectedAlignNodesRef.current, mode);
      if (!result.hasChange) return;
      // functional 模式：同步更新 ref 供 blueprint 写回，setNodes 触发重渲染
      const nextNodes = applyAlignResultToNodes(nodesRef.current, result.items);
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      if (projectRef.current) {
        const nextBlueprint: EventBlueprint = {
          version: 1,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
    },
    [updateBlueprint],
  );

  // 分布：等距分布逻辑，与 handleAlign 同模式
  const handleDistribute = useCallback(
    (mode: DistributeMode) => {
      const result = distributeNodes(selectedAlignNodesRef.current, mode);
      if (!result.hasChange) return;
      const nextNodes = applyAlignResultToNodes(nodesRef.current, result.items);
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      if (projectRef.current) {
        const nextBlueprint: EventBlueprint = {
          version: 1,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
    },
    [updateBlueprint],
  );

  // 任务 4.8：选中单个节点时展示节点参数配置面板
  // 从 nodes 中找出 selected 为 true 的节点（ReactFlow 通过 onNodesChange 更新 selected 字段）
  // 多选时不展示配置面板（恰好一个节点选中时才展示）
  // P0 优化：useMemo 避免每次渲染重算；同步 ref 供 handleConfigChange/handleSimulateTrigger 读取
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  selectedNodeRef.current = selectedNode;
  const showConfigPanel = selectedNode !== null;

  // 配置变更回调：更新该节点的 data.config，由既有 useEffect[nodes,edges] 同步到 updateBlueprint
  //
  // 历史合并（与拖拽手势同语义）：
  // 文本类输入（URL/注释/表达式值）每个键击都会触发 onChange，若每次 withHistory
  // 会产生数十条历史。改为：首次变更开启蓝图手势（期间 updateBlueprint 为 transient
  // 不入栈），停止输入 600ms 或切换选中节点/卸载时 endBlueprintGesture 补一条历史，
  // undo 一次回到本次编辑会话之前。
  const configGestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configGestureActiveRef = useRef(false);

  const endConfigGesture = useCallback(() => {
    if (configGestureTimerRef.current) {
      clearTimeout(configGestureTimerRef.current);
      configGestureTimerRef.current = null;
    }
    if (configGestureActiveRef.current) {
      configGestureActiveRef.current = false;
      endBlueprintGesture();
    }
  }, [endBlueprintGesture]);

  // 切换选中节点时立即结算当前编辑手势（避免跨节点合并历史）
  const selectedNodeId = selectedNode?.id ?? null;
  const prevSelectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    if (prevSelectedNodeIdRef.current !== selectedNodeId) {
      prevSelectedNodeIdRef.current = selectedNodeId;
      endConfigGesture();
    }
  }, [selectedNodeId, endConfigGesture]);

  // 卸载兜底：Sheet 关闭时结算未完成的编辑手势
  useEffect(() => {
    return () => {
      if (configGestureTimerRef.current) clearTimeout(configGestureTimerRef.current);
      if (configGestureActiveRef.current) {
        configGestureActiveRef.current = false;
        endBlueprintGesture();
      }
    };
  }, [endBlueprintGesture]);

  const handleConfigChange = useCallback(
    (
      next:
        | BlueprintTriggerConfig
        | BlueprintActionConfig
        | CommentNodeConfig
        | ConditionNodeConfig,
    ) => {
      const selected = selectedNodeRef.current;
      if (!selected) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, config: next } } : n)),
      );
      // 开启编辑手势（幂等：手势进行中重复 begin 为 no-op）
      if (!configGestureActiveRef.current) {
        configGestureActiveRef.current = true;
        beginBlueprintGesture();
      }
      // 手势期间 updateBlueprint 为 transient：只更新数据与脏标记，不入历史栈
      if (projectRef.current) {
        const nextNodes = nodesRef.current.map((n) =>
          n.id === selected.id ? { ...n, data: { ...n.data, config: next } } : n,
        );
        nodesRef.current = nextNodes;
        const nextBlueprint: EventBlueprint = {
          version: 1,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
      // 停止输入 600ms 后结算手势，补一条历史
      if (configGestureTimerRef.current) clearTimeout(configGestureTimerRef.current);
      configGestureTimerRef.current = setTimeout(endConfigGesture, 600);
    },
    [updateBlueprint, beginBlueprintGesture, endConfigGesture],
  );

  // 空蓝图空态
  const isEmpty = nodes.length === 0;

  // ===== 右键菜单 =====

  // 删除当前选中的节点与边（节点删除时级联删除关联边）
  const handleDeleteSelected = useCallback(() => {
    const selectedNodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id));
    const hasSelectedEdges = edgesRef.current.some((e) => e.selected);
    if (selectedNodeIds.size === 0 && !hasSelectedEdges) return;
    if (selectedNodeIds.size > 0) {
      setNodes((nds) => nds.filter((n) => !selectedNodeIds.has(n.id)));
    }
    setEdges((eds) =>
      eds.filter(
        (e) => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target),
      ),
    );
  }, []);

  // 节点右键：未选中则单选该节点（与主画布右键行为一致），切换菜单模式
  const handleNodeContextMenu: NodeMouseHandler<Node> = useCallback((_event, node) => {
    if (!node.selected) {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
      setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
    }
    setCtxMenuMode('node');
  }, []);

  // 边右键：未选中则单选该边，切换菜单模式
  const handleEdgeContextMenu: EdgeMouseHandler<Edge> = useCallback((_event, edge) => {
    if (!edge.selected) {
      setEdges((eds) => eds.map((ed) => ({ ...ed, selected: ed.id === edge.id })));
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    }
    setCtxMenuMode('edge');
  }, []);

  // 空白处右键：记录坐标（供"添加节点..."），切换菜单模式
  const handlePaneContextMenu = useCallback((event: MouseEvent | ReactMouseEvent) => {
    paneMenuPosRef.current = { x: event.clientX, y: event.clientY };
    setCtxMenuMode('pane');
  }, []);

  // 右键菜单"添加节点..."：在右键位置呼出搜索面板（create 模式）
  const handleAddNodeFromMenu = useCallback(() => {
    setSearchPanelState({
      visible: true,
      mode: 'create',
      position: { ...paneMenuPosRef.current },
    });
  }, []);

  // 缩放到选区：无选中节点时退化为 fitView（由 fitViewToNodes 内部处理）
  const handleFitViewToSelection = useCallback(() => {
    const ids = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
    void viewport.fitViewToNodes(ids);
  }, [viewport]);

  // 搜索面板选项：connect 模式过滤为仅含输入引脚的节点（action/condition），
  // trigger/comment 无输入引脚，选中也无法完成连线
  const searchPanelOptions = useMemo(
    () =>
      searchPanelState.mode === 'connect'
        ? NODE_OPTIONS.filter((o) => INPUT_PINS[o.kind].length > 0)
        : NODE_OPTIONS,
    [searchPanelState.mode],
  );

  // 任务 8.2 + 9.2：链路高亮 + 过滤视图叠加
  // 先过滤（9.2），再叠加高亮 className（8.2）
  const displayNodes = useMemo(() => {
    const filteredNodes = filteredIds ? nodes.filter((n) => filteredIds.nodeIds.has(n.id)) : nodes;
    if (highlight.highlightedNodeIds.size === 0) return filteredNodes;
    return filteredNodes.map((n) =>
      highlight.highlightedNodeIds.has(n.id)
        ? { ...n, className: `${n.className ?? ''} blueprint-node-highlighted`.trim() }
        : n,
    );
  }, [nodes, filteredIds, highlight.highlightedNodeIds]);

  // 任务 8.2 + 9.2：边流动高亮 + 过滤视图叠加
  const displayEdges = useMemo(() => {
    const filteredEdges = filteredIds ? edges.filter((e) => filteredIds.edgeIds.has(e.id)) : edges;
    if (highlight.highlightedEdgeIds.size === 0) return filteredEdges;
    return filteredEdges.map((e) =>
      highlight.highlightedEdgeIds.has(e.id)
        ? {
            ...e,
            className: `${e.className ?? ''} blueprint-edge-highlighted`.trim(),
            animated: true,
          }
        : e,
    );
  }, [edges, filteredIds, highlight.highlightedEdgeIds]);

  // 任务 8.1：模拟触发回调 — 对选中 trigger 节点执行沙盒模拟
  // P0 优化：通过 ref 读取 selectedNode/sandbox，callback 依赖为空，避免每次选择变化重建
  const handleSimulateTrigger = useCallback(async () => {
    const selected = selectedNodeRef.current;
    if (!selected || selected.type !== 'trigger') return;
    const result = await sandboxRef.current.simulateTrigger(selected.id);
    setLastSimResult(result);
  }, []);

  // 任务 8.1：重置沙盒
  const handleResetSandbox = useCallback(() => {
    sandboxRef.current.resetSandbox();
    setLastSimResult(null);
  }, []);

  // 任务 9.1：节点点击 → 提取关联 componentId → 通知 screen-editor 闪烁
  const handleNodeClick = useCallback<NodeMouseHandler<Node>>(
    (_event, node) => {
      if (!onLocateComponent) return;
      const componentId = getNodeLocateComponentId(node);
      if (componentId) {
        onLocateComponent(componentId);
      }
    },
    [onLocateComponent],
  );

  // 是否可触发模拟：选中单个 trigger 节点
  const canSimulate = selectedNode?.type === 'trigger';

  return (
    <BlueprintDiagnosticMapProvider value={diagnosticMap}>
      {/* 顶栏 */}
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4"
        data-testid="blueprint-sheet-header"
      >
        <span className="text-sm font-medium text-foreground">事件蓝图</span>
        {/* 任务 9.2：过滤模式提示标签 */}
        {isFiltering && (
          <span
            className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700"
            data-testid="blueprint-filter-badge"
          >
            过滤模式
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {/* 任务 8.1：模拟触发按钮（仅选中 trigger 节点时启用） */}
          <ToolbarButton
            tooltip={canSimulate ? '模拟触发选中触发器' : '请选中一个触发器节点'}
            onClick={() => void handleSimulateTrigger()}
            disabled={!canSimulate || sandbox.isSimulating}
            data-testid="blueprint-simulate-trigger"
          >
            <Play className="size-4" />
          </ToolbarButton>
          {/* 任务 8.1：重置沙盒状态 */}
          <ToolbarButton
            tooltip="重置沙盒"
            onClick={handleResetSandbox}
            disabled={sandbox.executionLogs.length === 0 && !sandbox.isSimulating}
            data-testid="blueprint-reset-sandbox"
          >
            <RotateCcw className="size-4" />
          </ToolbarButton>
          <ViewportToolbar
            zoom={viewport.zoom}
            spacePressed={viewport.spacePressed}
            onZoomIn={() => void viewport.zoomIn()}
            onZoomOut={() => void viewport.zoomOut()}
            onFitView={() => void viewport.fitView()}
            onFitViewToSelection={handleFitViewToSelection}
            onReset={() => void viewport.resetViewport()}
          />
          <ToolbarButton
            tooltip="关闭"
            onClick={() => onOpenChange(false)}
            data-testid="blueprint-sheet-close"
          >
            <X className="size-4" />
          </ToolbarButton>
        </div>
      </header>

      {/* 画布区域 */}
      <div
        className="relative flex-1"
        data-testid="blueprint-canvas"
        onDoubleClick={handleDoubleClick}
      >
        {isEmpty && !searchPanelState.visible && !emptyDismissed && (
          <div className="absolute inset-0 z-10 flex flex-col bg-background">
            <EmptyBlueprintState
              onInsertTemplate={(templateBlueprint) => {
                if (!project) return;
                updateBlueprint(templateBlueprint);
              }}
              onError={(error) => {
                notifications?.notify('error', `模板插入失败：${error}`);
              }}
              onStartFromScratch={() => {
                if (!project) return;
                // 创建空蓝图状态（无节点无边）进入自由编排
                updateBlueprint({ version: 1, nodes: [], edges: [] });
                // 关闭空态遮罩：否则 blueprint 为空时 isEmpty 恒真，遮罩永不消失形成死局
                setEmptyDismissed(true);
              }}
            />
          </div>
        )}
        <BlueprintContextMenu
          mode={ctxMenuMode}
          selectedNodeCount={selectedCount}
          onCopy={() => void blueprintClipboard.copy()}
          onCut={() => void blueprintClipboard.cut()}
          onPaste={() => void blueprintClipboard.paste()}
          onDuplicate={blueprintClipboard.duplicate}
          onDeleteSelected={handleDeleteSelected}
          onSelectAll={handleSelectAll}
          onAlign={handleAlign}
          onDistribute={handleDistribute}
          onAddNode={handleAddNodeFromMenu}
          onZoomIn={() => void viewport.zoomIn()}
          onZoomOut={() => void viewport.zoomOut()}
          onFitView={() => void viewport.fitView()}
          onFitViewToSelection={handleFitViewToSelection}
        >
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            isValidConnection={checkConnection}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            selectionMode={SelectionMode.Partial}
            // ReactFlow 默认仅 Backspace 删除；补齐 Delete 键（Windows 用户习惯）
            deleteKeyCode={['Backspace', 'Delete']}
            {...viewport.config}
            onMoveEnd={viewport.onMoveEnd}
            zoomOnDoubleClick={false}
            className="bg-background"
            data-testid="blueprint-reactflow"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-background" data-testid="blueprint-minimap" />
          </ReactFlow>
        </BlueprintContextMenu>

        {/* 搜索面板 */}
        {searchPanelState.visible && (
          <div
            className="pointer-events-auto absolute z-10"
            style={{ left: searchPanelState.position.x, top: searchPanelState.position.y }}
          >
            <SearchPanel
              position={searchPanelState.position}
              mode={searchPanelState.mode}
              pendingConnection={searchPanelState.pendingConnection}
              options={searchPanelOptions}
              onInsert={handleInsertNode}
              onClose={() => setSearchPanelState((s) => ({ ...s, visible: false }))}
            />
          </div>
        )}

        {/* 任务 9.4：多选对齐与分布工具条（左下角悬浮，selectedCount >= 2 时显示） */}
        {selectedCount >= 2 && (
          <div className="pointer-events-auto absolute bottom-4 left-4 z-10">
            <AlignDistributeToolbar
              selectedCount={selectedCount}
              onAlign={handleAlign}
              onDistribute={handleDistribute}
            />
          </div>
        )}

        {/* 任务 4.8：节点参数配置面板（右侧悬浮，选中单个节点时显示） */}
        {showConfigPanel && selectedNode && (
          <div className="pointer-events-auto absolute right-4 top-4 z-10 w-64 max-h-[70%] overflow-y-auto rounded border border-border bg-background shadow-md">
            <NodeConfigPanel
              kind={selectedNode.type as 'trigger' | 'condition' | 'action' | 'comment'}
              config={(selectedNode.data as { config: NodeConfigPanelProps['config'] }).config}
              components={components}
              onChange={handleConfigChange}
            />
          </div>
        )}
      </div>

      {/* 问题面板（任务 6.2） */}
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={errorCount}
        warningCount={warningCount}
        infoCount={infoCount}
        onLocateNode={handleLocateNode}
      />

      {/* 任务 8.3：执行日志面板（沙盒模拟触发后展示） */}
      {(sandbox.executionLogs.length > 0 || sandbox.isSimulating || lastSimResult) && (
        <ExecutionLogPanel
          executionLogs={sandbox.executionLogs}
          isSimulating={sandbox.isSimulating}
          refusalReason={lastSimResult?.refused ? lastSimResult.refusalReason : undefined}
          triggerNotFound={lastSimResult?.triggerNotFound ?? false}
          onLocateNode={handleLocateNode}
          onClear={handleResetSandbox}
        />
      )}
    </BlueprintDiagnosticMapProvider>
  );
}
