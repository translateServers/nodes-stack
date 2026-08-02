/**
 * Event blueprint sheet using the component-node model.
 * - 节点 kind：component / condition / delay / comment
 * - 全局节点为 component 的子类型（componentId === 'global' + globalType）
 * - 锚点语义化：evt:* 输出 / act:* 输入 / in / out / then / else
 * - Compiler, connection validation, sandbox runtime, and clipboard share one model
 *
 * 数据流：
 * - editor-store.project.blueprint -> ReactFlow nodes/edges
 * - ReactFlow nodes/edges -> updateBlueprint
 *
 * History semantics:
 * - 离散编辑经 updateBlueprint 入历史栈
 * - 拖拽经 begin/endBlueprintGesture 合并为一条历史
 * - 文本类编辑经 600ms debounce 合并为一条历史
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, MouseEvent as ReactMouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
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
import { Cable, Filter, MousePointerClick, Play, RotateCcw, Workflow, X } from 'lucide-react';
import type {
  BlueprintNode,
  CommentNodeConfig,
  ConditionNodeConfig,
  EventBlueprint,
  GlobalNodeConfig,
  GlobalScrollToConfig,
  ScreenComponent,
} from '@nebula/shared';
import { GLOBAL_COMPONENT_ID } from '@nebula/shared';

import { useScreenEditorStore } from '../../stores/editor-store';
import { ComponentNode } from '../nodes/component-node';
import { GlobalNode } from '../nodes/global-node';
import { DelayNode } from '../nodes/delay-node';
import { CommentNode } from '../nodes/comment-node';
import { ConditionNode } from '../nodes/condition-node';
import { ExecEdge, EXEC_EDGE_MARKER_END } from '../edges';
import { ViewportToolbar } from '../panels/viewport-toolbar';
import { AlignDistributeToolbar } from '../panels/align-distribute-toolbar';
import {
  useBlueprintViewport,
  useBlueprintDrag,
  useBlueprintShortcuts,
  useBlueprintClipboard,
  useAnchorSnap,
  BlueprintDiagnosticMapProvider,
  buildDiagnosticMap,
} from '../hooks';
import { SearchPanel } from '../panels/search-panel';
import {
  buildAllNodeOptions,
  isConnectableTarget,
  type NodeOption,
  type PendingConnection,
} from '../panels/node-options';
import { ProblemsPanel } from '../panels/problems-panel';
import { ExecutionLogPanel } from '../panels/execution-log-panel';
import { NodeConfigPanel, type NodeConfigChange } from '../panels/node-config-panel';
import { ToolbarButton } from '../../components/ui-primitives';
import { useOptionalScreenEditorEnvironment } from '../../components/screen-editor-environment';
import {
  alignNodes,
  applyAlignResultToNodes,
  distributeNodes,
  type AlignMode,
  type AlignNode,
  type DistributeMode,
} from '../lib/align-distribute';
import {
  isConnectionValid,
  type BlueprintNodeIndex,
  type BlueprintNodeIndexEntry,
  type ConnectionCandidate,
  type ConnectionValidationResult,
} from '../lib/pin-compatibility';
import { BlueprintContextMenu, type BlueprintContextMenuMode } from './blueprint-context-menu';
import { filterBlueprintByComponent } from '../compiler/filter-by-component';
import type { BlueprintDiagnostic } from '../compiler/types';
import {
  getNodeLocateComponentId,
  useBlueprintSandboxHighlight,
  useBlueprintSandboxRuntime,
  type SandboxSimulationResult,
} from '../runtime';

// ===== ReactFlow 类型映射 =====

const nodeTypes: NodeTypes = {
  component: ComponentNode,
  global: GlobalNode,
  delay: DelayNode,
  comment: CommentNode,
  condition: ConditionNode,
};

const edgeTypes: EdgeTypes = {
  exec: ExecEdge,
};

const ALWAYS_ACTIVE = (): boolean => true;

// ===== 蓝图 ↔ ReactFlow 转换 =====

function buildComponentMap(components: readonly ScreenComponent[]): Map<string, ScreenComponent> {
  const map = new Map<string, ScreenComponent>();
  for (const c of components) map.set(c.id, c);
  return map;
}

/**
 * Build a display label for a blueprint node.
 *
 * - 普通组件节点：组件实例名（找不到时显示 '未配置组件'）
 * - 全局节点：子类型标签（'页面加载' / '导航跳转' / '请求接口' / '滚动定位'）
 * - condition：'条件分支' + 运算符摘要
 * - delay：'延时 {delayMs}ms'
 * - comment：注释文本（空时显示 '注释'）
 */
function getNodeLabel(node: BlueprintNode, componentMap: Map<string, ScreenComponent>): string {
  if (node.kind === 'component') {
    // 全局节点
    if (node.componentId === GLOBAL_COMPONENT_ID) {
      switch (node.globalType) {
        case 'pageLoad':
          return '页面加载';
        case 'navigate':
          return '导航跳转';
        case 'requestApi':
          return '请求接口';
        case 'scrollTo':
          return '滚动定位';
        case 'interval':
          return '定时触发';
        default:
          return '全局节点';
      }
    }
    // 普通组件节点
    if (node.componentId === '') return '未配置组件';
    return componentMap.get(node.componentId)?.name ?? node.componentId;
  }

  if (node.kind === 'condition') {
    const op = node.config.expression?.operator ?? '';
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
    return `条件：${opLabelMap[op] ?? op}`;
  }

  if (node.kind === 'delay') {
    return `延时 ${node.config.delayMs}ms`;
  }

  // comment
  return node.config.text || '注释';
}

/**
 * Check whether a blueprint node references a missing component.
 *
 * - 普通组件节点：componentId 不在项目中
 * - 全局 scrollTo 节点：config.targetComponentId 不在项目中
 * - 其他节点不 dangling
 */
function isNodeDangling(node: BlueprintNode, componentMap: Map<string, ScreenComponent>): boolean {
  if (node.kind === 'component') {
    if (node.componentId === GLOBAL_COMPONENT_ID) {
      // 全局 scrollTo 节点检查目标组件
      if (node.globalType === 'scrollTo' && node.config) {
        const cfg = node.config as GlobalScrollToConfig;
        return cfg.targetComponentId !== '' && !componentMap.has(cfg.targetComponentId);
      }
      return false;
    }
    return node.componentId !== '' && !componentMap.has(node.componentId);
  }
  if (node.kind === 'condition') {
    const sourceComponentId = node.config.expression?.source?.componentId;
    if (!sourceComponentId) return false;
    return !componentMap.has(sourceComponentId);
  }
  return false;
}

/**
 * 推导组件节点的 componentType（用于派生事件/动作锚点）。
 *
 * 普通组件节点从 componentMap 读取 type；全局节点无 componentType。
 */
function getComponentType(
  node: BlueprintNode,
  componentMap: Map<string, ScreenComponent>,
): string | undefined {
  if (node.kind !== 'component') return undefined;
  if (node.componentId === GLOBAL_COMPONENT_ID) return undefined;
  return componentMap.get(node.componentId)?.type;
}

/**
 * Convert a blueprint node to a React Flow node.
 *
 * RF type 映射：
 * - component + globalType !== undefined -> 'global'
 * - component -> 'component'
 * - condition / delay / comment retain their kind
 */
function blueprintNodeToRFNode(
  blueprintNode: BlueprintNode,
  componentMap: Map<string, ScreenComponent>,
): Node {
  const label = getNodeLabel(blueprintNode, componentMap);
  const dangling = isNodeDangling(blueprintNode, componentMap);
  const componentType = getComponentType(blueprintNode, componentMap);

  // RF type：全局节点用 'global'，普通 component 用 'component'
  const rfType =
    blueprintNode.kind === 'component' && blueprintNode.globalType !== undefined
      ? 'global'
      : blueprintNode.kind;

  // data fields match the node renderer contracts.
  const data: Record<string, unknown> = { label, dangling };

  if (blueprintNode.kind === 'component') {
    data.componentId = blueprintNode.componentId;
    if (componentType !== undefined) {
      data.componentType = componentType;
    }
    if (blueprintNode.globalType !== undefined) {
      data.globalType = blueprintNode.globalType;
    }
    if (blueprintNode.config !== undefined) {
      data.config = blueprintNode.config;
    }
  } else if (blueprintNode.kind === 'delay') {
    data.config = blueprintNode.config;
  } else {
    // condition / comment
    data.config = blueprintNode.config;
  }

  return {
    id: blueprintNode.id,
    type: rfType,
    position: { x: blueprintNode.position.x, y: blueprintNode.position.y },
    data,
  };
}

/**
 * Convert a React Flow node to a blueprint node.
 *
 * 使用判别联合 narrowing 保证 kind 与 config 一致性。
 * 运行时由 Zod Schema 在持久化时校验。
 */
function rfNodeToBlueprintNode(node: Node): BlueprintNode {
  const data = node.data as {
    config?: unknown;
    componentId?: string;
    globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
  };
  const position = { x: node.position.x, y: node.position.y };
  const rfType = node.type ?? 'component';

  if (rfType === 'global') {
    // 全局节点
    const globalType = data.globalType ?? 'pageLoad';
    if (globalType === 'pageLoad') {
      return {
        id: node.id,
        kind: 'component',
        position,
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'pageLoad',
      };
    }
    return {
      id: node.id,
      kind: 'component',
      position,
      componentId: GLOBAL_COMPONENT_ID,
      globalType,
      config: data.config as GlobalNodeConfig,
    };
  }

  if (rfType === 'component') {
    return {
      id: node.id,
      kind: 'component',
      position,
      componentId: data.componentId ?? '',
    };
  }

  if (rfType === 'delay') {
    return {
      id: node.id,
      kind: 'delay',
      position,
      config: data.config as { delayMs: number },
    };
  }

  if (rfType === 'condition') {
    return {
      id: node.id,
      kind: 'condition',
      position,
      config: data.config as ConditionNodeConfig,
    };
  }

  // comment
  return {
    id: node.id,
    kind: 'comment',
    position,
    config: data.config as CommentNodeConfig,
  };
}

function blueprintEdgeToRFEdge(edge: EventBlueprint['edges'][number]): Edge {
  return {
    id: edge.id,
    type: 'exec',
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
    markerEnd: EXEC_EDGE_MARKER_END,
    data: {},
  };
}

function rfEdgeToBlueprintEdge(edge: Edge): EventBlueprint['edges'][number] {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? 'out',
    target: edge.target,
    targetHandle: edge.targetHandle ?? 'in',
  };
}

/** Build connection-validation inputs from React Flow state. */
function buildConnectionContext(
  rfNodes: Node[],
  rfEdges: Edge[],
): { nodeIndex: BlueprintNodeIndex; existingEdges: EventBlueprint['edges'] } {
  const mutableIndex = new Map<string, BlueprintNodeIndexEntry>();
  for (const rfNode of rfNodes) {
    const data = rfNode.data as {
      componentId?: string;
      globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
    };
    const rfType = rfNode.type ?? 'component';
    const kind: BlueprintNodeIndexEntry['kind'] =
      rfType === 'global' ? 'component' : (rfType as BlueprintNodeIndexEntry['kind']);
    const entry: BlueprintNodeIndexEntry = {
      id: rfNode.id,
      kind,
    };
    if (kind === 'component') {
      entry.componentId = data.componentId;
      entry.globalType = data.globalType;
    }
    mutableIndex.set(rfNode.id, entry);
  }
  const nodeIndex: BlueprintNodeIndex = mutableIndex;
  const existingEdges = rfEdges.map(rfEdgeToBlueprintEdge);
  return { nodeIndex, existingEdges };
}

/** Normalize a React Flow connection for connection validation. */
function toConnectionCandidate(conn: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): ConnectionCandidate {
  return {
    source: conn.source,
    sourceHandle: conn.sourceHandle ?? 'out',
    target: conn.target,
    targetHandle: conn.targetHandle ?? 'in',
  };
}

/** 生成唯一边 ID */
function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build an initial blueprint node from a search option.
 *
 * - 全局节点：componentId='global' + globalType + (config?)
 * - 普通组件节点：componentId=''（由用户在属性面板选择）
 * - condition / delay / comment：默认 config
 */
function createNodeFromOption(
  option: NodeOption,
  position: { x: number; y: number },
): BlueprintNode {
  const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (option.kind === 'component') {
    // 普通画布组件节点（group === 'canvas-component'）
    if (option.group === 'canvas-component') {
      if (!option.componentId) {
        // 不应发生：canvas-component 选项必带 componentId
        throw new Error(`Canvas component option missing componentId: ${option.id}`);
      }
      return {
        id,
        kind: 'component',
        position,
        componentId: option.componentId,
        // 普通组件节点不应有 globalType / config（schema 强校验）
      };
    }

    // 全局节点
    const globalType = option.globalType;
    if (globalType === undefined) {
      // Component options outside the canvas group must identify a global node.
      throw new Error(`Component option missing globalType: ${option.id}`);
    }
    if (globalType === 'pageLoad') {
      return {
        id,
        kind: 'component',
        position,
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'pageLoad',
      };
    }
    // navigate / requestApi / scrollTo / interval 提供空 config 占位
    let config: GlobalNodeConfig;
    if (globalType === 'navigate') {
      config = { globalType: 'navigate', url: '', target: '_blank' };
    } else if (globalType === 'requestApi') {
      config = {
        globalType: 'requestApi',
        method: 'GET',
        url: '',
        headers: {},
        body: '',
        secretHeaderKeys: [],
        timeoutMs: 10_000,
      };
    } else if (globalType === 'interval') {
      config = { globalType: 'interval', intervalMs: 1000 };
    } else {
      config = { globalType: 'scrollTo', targetComponentId: '' };
    }
    return {
      id,
      kind: 'component',
      position,
      componentId: GLOBAL_COMPONENT_ID,
      globalType,
      config,
    };
  }

  if (option.kind === 'condition') {
    const config: ConditionNodeConfig = {
      type: 'condition',
      expression: {
        source: { kind: 'componentProp', componentId: '', key: '' },
        operator: 'eq',
        value: '',
      },
    };
    return { id, kind: 'condition', position, config };
  }

  if (option.kind === 'delay') {
    return { id, kind: 'delay', position, config: { delayMs: 500 } };
  }

  // comment
  return { id, kind: 'comment', position, config: { text: '' } };
}

// ===== 主组件 =====

interface BlueprintSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 蓝图->画布高亮联动：点击节点时调用 */
  onLocateComponent?: (componentId: string) => void;
  /** 画布->蓝图过滤联动：当前选中组件 id（null 表示不过滤） */
  filterComponentId?: string | null;
  /** 保存项目回调 */
  onSave?: () => void;
  /** 显示快捷键帮助 */
  onShowHelp?: () => void;
}

/**
 * Full-screen event blueprint editor.
 */
export function BlueprintSheet({
  open,
  onOpenChange,
  onLocateComponent,
  filterComponentId,
  onSave,
  onShowHelp,
}: BlueprintSheetProps): JSX.Element | null {
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
  const editorEnvironment = useOptionalScreenEditorEnvironment();
  const capabilityProfile = editorEnvironment?.capabilityProfile ?? 'dynamic';
  const isActive = editorEnvironment?.isActive ?? ALWAYS_ACTIVE;
  const project = useScreenEditorStore((s) => s.project);
  const updateBlueprint = useScreenEditorStore((s) => s.updateBlueprint);
  const beginBlueprintGesture = useScreenEditorStore((s) => s.beginBlueprintGesture);
  const endBlueprintGesture = useScreenEditorStore((s) => s.endBlueprintGesture);

  const blueprint = project?.blueprint;
  const components = project?.components ?? [];

  const isFiltering =
    filterComponentId !== undefined && filterComponentId !== null && filterComponentId !== '';

  // 任务 9.2：过滤后的节点 id 集合
  const filteredNodeIds = useMemo(() => {
    if (!isFiltering || !blueprint || !filterComponentId) return null;
    return filterBlueprintByComponent(blueprint, filterComponentId);
  }, [isFiltering, blueprint, filterComponentId]);

  const sandbox = useBlueprintSandboxRuntime(blueprint, components);
  const [lastSimResult, setLastSimResult] = useState<SandboxSimulationResult | null>(null);

  // 任务 8.2：链路高亮
  const highlight = useBlueprintSandboxHighlight(sandbox.executionLogs, blueprint);

  // ReactFlow 本地状态
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [searchPanelState, setSearchPanelState] = useState<SearchPanelState>({
    visible: false,
    mode: 'create',
    position: { x: 0, y: 0 },
  });
  const [emptyDismissed, setEmptyDismissed] = useState(false);
  const [ctxMenuMode, setCtxMenuMode] = useState<BlueprintContextMenuMode>('pane');
  const paneMenuPosRef = useRef({ x: 0, y: 0 });

  const skipNextBlueprintSync = useRef(false);
  const initialized = useRef(false);
  const dragActive = useRef(false);
  const isConnectingRef = useRef(false);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  // Canvas container for anchor-snap mousemove handling.
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ref 镜像高频变化的非 primitive state
  const projectRef = useRef(project);
  const componentsRef = useRef(components);
  const searchPanelStateRef = useRef(searchPanelState);
  const sandboxRef = useRef(sandbox);
  const selectedAlignNodesRef = useRef<AlignNode[]>([]);
  const selectedNodeRef = useRef<Node | null>(null);

  nodesRef.current = nodes;
  edgesRef.current = edges;
  projectRef.current = project;
  componentsRef.current = components;
  searchPanelStateRef.current = searchPanelState;
  sandboxRef.current = sandbox;

  // blueprint -> ReactFlow 同步（外部变化：undo/redo/load）
  useEffect(() => {
    skipNextBlueprintSync.current = true;
    if (!blueprint) {
      setNodes([]);
      setEdges([]);
      initialized.current = true;
      return;
    }
    const componentMap = buildComponentMap(components);
    const prevNodeById = new Map(nodesRef.current.map((n) => [n.id, n]));
    const prevEdgeById = new Map(edgesRef.current.map((e) => [e.id, e]));
    setNodes(
      blueprint.nodes.map((n) => {
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
      blueprint.edges.map((e) => {
        const rfEdge = blueprintEdgeToRFEdge(e);
        const prev = prevEdgeById.get(rfEdge.id);
        if (prev?.selected) rfEdge.selected = true;
        return rfEdge;
      }),
    );
    initialized.current = true;
  }, [blueprint]);

  // ReactFlow nodes/edges -> blueprint 同步
  useEffect(() => {
    if (!initialized.current) return;
    if (skipNextBlueprintSync.current) {
      skipNextBlueprintSync.current = false;
      return;
    }
    if (dragActive.current) return;
    if (!projectRef.current) return;
    const newBlueprint: EventBlueprint = {
      version: 2,
      nodes: nodes.map(rfNodeToBlueprintNode),
      edges: edges.map(rfEdgeToBlueprintEdge),
    };
    updateBlueprint(newBlueprint);
  }, [nodes, edges, updateBlueprint]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Connection validation
  const checkConnection = useCallback(
    (conn: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }): boolean => {
      const { nodeIndex, existingEdges } = buildConnectionContext(
        nodesRef.current,
        edgesRef.current,
      );
      const result: ConnectionValidationResult = isConnectionValid(
        toConnectionCandidate(conn),
        nodeIndex,
        existingEdges,
      );
      return result.valid;
    },
    [],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
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

  const handleConnectStart = useCallback(() => {
    isConnectingRef.current = true;
  }, []);

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
        sourceHandle: fromHandle.id ?? 'out',
      },
    });
  }, []);

  // Anchor snapping bypasses the search panel when a compatible target is found.
  const handleSnapConnect = useCallback(
    (conn: ConnectionCandidate) => {
      if (!checkConnection(conn)) return;
      const newEdge: Edge = {
        id: generateEdgeId(),
        type: 'exec',
        source: conn.source,
        sourceHandle: conn.sourceHandle,
        target: conn.target,
        targetHandle: conn.targetHandle,
        markerEnd: EXEC_EDGE_MARKER_END,
        data: {},
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [checkConnection],
  );

  const anchorSnap = useAnchorSnap({
    getNodes: () => nodesRef.current,
    getEdges: () => edgesRef.current,
    onSnapConnect: handleSnapConnect,
    getRoot: () => containerRef.current,
  });

  // 包装后的连线事件处理器：先经磁吸 hook，再回退到原有行为
  const wrappedConnectStart = useMemo(
    () => anchorSnap.wrapConnectStart(handleConnectStart),
    [anchorSnap, handleConnectStart],
  );
  const wrappedConnectEnd = useMemo(
    () => anchorSnap.wrapConnectEnd(handleConnectEnd),
    [anchorSnap, handleConnectEnd],
  );

  // 容器级别 mousemove：连线拖拽时更新磁吸命中
  // 使用 capture 阶段监听，避免被 ReactFlow 内部 mousemove 拦截
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = anchorSnap.handleMouseMove;
    container.addEventListener('mousemove', handler, { passive: true });
    return () => {
      container.removeEventListener('mousemove', handler);
    };
  }, [anchorSnap]);

  // 拖拽吸附
  const { onNodeDragStop: snapNodeDragStop } = useBlueprintDrag({
    nodes,
    onNodesChange: (nextNodes) => {
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    },
  });

  const handleNodeDragStart: OnNodeDrag = useCallback(() => {
    dragActive.current = true;
    beginBlueprintGesture();
  }, [beginBlueprintGesture]);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (event, node, draggedNodes) => {
      snapNodeDragStop(event, node, draggedNodes);
      const finalNodes = nodesRef.current;
      if (projectRef.current) {
        const finalBlueprint: EventBlueprint = {
          version: 2,
          nodes: finalNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(finalBlueprint);
      }
      endBlueprintGesture();
      dragActive.current = false;
    },
    [snapNodeDragStop, updateBlueprint, endBlueprintGesture],
  );

  const viewport = useBlueprintViewport();
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    viewport.restoreViewport();
  }, [viewport.restoreViewport]);

  const handleDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
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
      const position = reactFlowInstance.screenToFlowPosition({
        x: state.position.x,
        y: state.position.y,
      });
      const newNode = createNodeFromOption(option, position);
      const componentMap = buildComponentMap(componentsRef.current);
      const rfNode = blueprintNodeToRFNode(newNode, componentMap);

      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        { ...rfNode, selected: true },
      ]);

      // connect 模式：校验引脚兼容后自动连线
      if (state.mode === 'connect' && state.pendingConnection) {
        const candidate: ConnectionCandidate = {
          source: state.pendingConnection.sourceNodeId,
          sourceHandle: state.pendingConnection.sourceHandle,
          target: rfNode.id,
          // 普通组件节点 / 全局非 pageLoad 节点用首个 act:*；其他用 'in'
          targetHandle: deriveDefaultTargetHandle(newNode),
        };
        const { nodeIndex, existingEdges } = buildConnectionContext(
          nodesRef.current,
          edgesRef.current,
        );
        // NodeIndex 合并新节点
        const nextIndex: BlueprintNodeIndex = new Map([
          ...nodeIndex,
          [
            newNode.id,
            {
              id: newNode.id,
              kind: newNode.kind,
              componentId: newNode.kind === 'component' ? newNode.componentId : undefined,
              globalType: newNode.kind === 'component' ? newNode.globalType : undefined,
            },
          ],
        ]);
        if (isConnectionValid(candidate, nextIndex, existingEdges).valid) {
          const newEdge: Edge = {
            id: generateEdgeId(),
            type: 'exec',
            source: candidate.source,
            sourceHandle: candidate.sourceHandle,
            target: candidate.target,
            targetHandle: candidate.targetHandle,
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

  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((ed) => ({ ...ed, selected: true })));
  }, []);

  useBlueprintShortcuts({
    isActive,
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

  const blueprintClipboard = useBlueprintClipboard({
    nodes,
    edges,
    setNodes,
    setEdges,
    isActive,
  });

  const diagnostics: readonly BlueprintDiagnostic[] = sandbox.compileDiagnostics;
  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.level === 'error').length,
    [diagnostics],
  );
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.level === 'warning').length,
    [diagnostics],
  );
  const infoCount = useMemo(
    () => diagnostics.filter((d) => d.level === 'info').length,
    [diagnostics],
  );
  const diagnosticMap = useMemo(
    () => buildDiagnosticMap(sandbox.compileDiagnostics),
    [sandbox.compileDiagnostics],
  );

  // 节点定位（问题面板点击）
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLocateNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodesRef.current.find((n) => n.id === nodeId);
      if (!targetNode) return;
      void reactFlowInstance.setCenter(targetNode.position.x, targetNode.position.y, {
        zoom: 1,
        duration: 300,
      });
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, locating: true } } : n)),
      );
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
      locateTimerRef.current = setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, locating: false } } : n)),
        );
      }, 1000);
    },
    [reactFlowInstance, setNodes],
  );

  useEffect(() => {
    return () => {
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
    };
  }, []);

  // 多选对齐与分布
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

  const handleAlign = useCallback(
    (mode: AlignMode) => {
      const result = alignNodes(selectedAlignNodesRef.current, mode);
      if (!result.hasChange) return;
      const nextNodes = applyAlignResultToNodes(nodesRef.current, result.items);
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      if (projectRef.current) {
        const nextBlueprint: EventBlueprint = {
          version: 2,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
    },
    [updateBlueprint],
  );

  const handleDistribute = useCallback(
    (mode: DistributeMode) => {
      const result = distributeNodes(selectedAlignNodesRef.current, mode);
      if (!result.hasChange) return;
      const nextNodes = applyAlignResultToNodes(nodesRef.current, result.items);
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      if (projectRef.current) {
        const nextBlueprint: EventBlueprint = {
          version: 2,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
    },
    [updateBlueprint],
  );

  // 选中节点
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  selectedNodeRef.current = selectedNode;
  const showConfigPanel = selectedNode !== null;

  // 配置变更：编辑手势合并
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

  const selectedNodeId = selectedNode?.id ?? null;
  const prevSelectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    if (prevSelectedNodeIdRef.current !== selectedNodeId) {
      prevSelectedNodeIdRef.current = selectedNodeId;
      endConfigGesture();
    }
  }, [selectedNodeId, endConfigGesture]);

  useEffect(() => {
    return () => {
      if (configGestureTimerRef.current) clearTimeout(configGestureTimerRef.current);
      if (configGestureActiveRef.current) {
        configGestureActiveRef.current = false;
        endBlueprintGesture();
      }
    };
  }, [endBlueprintGesture]);

  /**
   * 配置变更回调：根据节点 kind 写回对应字段。
   *
   * Node configuration shape:
   * - component（普通）：仅 componentId 可编辑
   * - component（全局 navigate/requestApi/scrollTo）：写回 config
   * - component（全局 pageLoad）：无可编辑字段
   * - delay：写回 config.delayMs
   * - condition：写回 config（ConditionNodeConfig）
   * - comment：写回 config（CommentNodeConfig）
   */
  const handleConfigChange = useCallback(
    (next: NodeConfigChange) => {
      const selected = selectedNodeRef.current;
      if (!selected) return;

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selected.id) return n;
          const newData: Record<string, unknown> = { ...n.data };
          if (next.kind === 'component-id') {
            newData.componentId = next.componentId;
          } else if (next.kind === 'global-config') {
            newData.config = next.config;
          } else if (next.kind === 'delay-config') {
            newData.config = next.config;
          } else if (next.kind === 'condition-config') {
            newData.config = next.config;
          } else if (next.kind === 'comment-config') {
            newData.config = next.config;
          }
          return { ...n, data: newData };
        }),
      );

      if (!configGestureActiveRef.current) {
        configGestureActiveRef.current = true;
        beginBlueprintGesture();
      }
      if (projectRef.current) {
        const nextNodes = nodesRef.current.map((n) => {
          if (n.id !== selected.id) return n;
          const newData: Record<string, unknown> = { ...n.data };
          if (next.kind === 'component-id') {
            newData.componentId = next.componentId;
          } else if (next.kind === 'global-config') {
            newData.config = next.config;
          } else if (next.kind === 'delay-config') {
            newData.config = next.config;
          } else if (next.kind === 'condition-config') {
            newData.config = next.config;
          } else if (next.kind === 'comment-config') {
            newData.config = next.config;
          }
          return { ...n, data: newData };
        });
        nodesRef.current = nextNodes;
        const nextBlueprint: EventBlueprint = {
          version: 2,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
      if (configGestureTimerRef.current) clearTimeout(configGestureTimerRef.current);
      configGestureTimerRef.current = setTimeout(endConfigGesture, 600);
    },
    [updateBlueprint, beginBlueprintGesture, endConfigGesture],
  );

  const isEmpty = nodes.length === 0;

  // ===== 右键菜单 =====

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

  const handleNodeContextMenu: NodeMouseHandler<Node> = useCallback((_event, node) => {
    if (!node.selected) {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
      setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
    }
    setCtxMenuMode('node');
  }, []);

  const handleEdgeContextMenu: EdgeMouseHandler<Edge> = useCallback((_event, edge) => {
    if (!edge.selected) {
      setEdges((eds) => eds.map((ed) => ({ ...ed, selected: ed.id === edge.id })));
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    }
    setCtxMenuMode('edge');
  }, []);

  const handlePaneContextMenu = useCallback((event: MouseEvent | ReactMouseEvent) => {
    paneMenuPosRef.current = { x: event.clientX, y: event.clientY };
    setCtxMenuMode('pane');
  }, []);

  const handleAddNodeFromMenu = useCallback(() => {
    setSearchPanelState({
      visible: true,
      mode: 'create',
      position: { ...paneMenuPosRef.current },
    });
  }, []);

  const handleFitViewToSelection = useCallback(() => {
    const ids = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
    void viewport.fitViewToNodes(ids);
  }, [viewport]);

  // Locate the canvas component associated with the selected node.
  const handleLocateComponentFromMenu = useCallback(() => {
    if (!onLocateComponent) return;
    const node = selectedNodeRef.current;
    if (!node) return;
    const bpNode = rfNodeToBlueprintNode(node);
    const componentId = getNodeLocateComponentId(bpNode);
    if (componentId) {
      onLocateComponent(componentId);
    }
  }, [onLocateComponent]);

  // The configuration panel is visible for a selected node.
  // 配置面板在 selectedNode !== null 时已自动显示，这里通过 ref 守卫避免重复渲染
  // 当前实现仅作为菜单项触发器，未来可扩展为聚焦首个表单字段
  const handleConfigureGlobalFromMenu = useCallback(() => {
    // 配置面板已通过 showConfigPanel 自动显示，无需额外操作
    // 保留 hook 入口便于后续扩展（如聚焦 URL 输入框）
  }, []);

  // Node-specific context menu data is meaningful only for a single selection.
  const ctxMenuSelectedNodeKind = useMemo<
    'component' | 'global' | 'condition' | 'delay' | 'comment' | null
  >(() => {
    if (selectedNode?.type === 'component') return 'component';
    if (selectedNode?.type === 'global') return 'global';
    if (selectedNode?.type === 'condition') return 'condition';
    if (selectedNode?.type === 'delay') return 'delay';
    if (selectedNode?.type === 'comment') return 'comment';
    return null;
  }, [selectedNode]);

  const ctxMenuSelectedNodeHasComponentId = useMemo<boolean>(() => {
    if (selectedNode?.type !== 'component') return false;
    const data = selectedNode.data as { componentId?: string };
    // 普通组件节点（非 global）且 componentId 非空才允许「定位到画布组件」
    return Boolean(data.componentId) && data.componentId !== GLOBAL_COMPONENT_ID;
  }, [selectedNode]);

  // Merge canvas and static options; connect mode keeps eligible targets only.
  const searchPanelOptions = useMemo(() => {
    const allOptions = buildAllNodeOptions(componentsRef.current, capabilityProfile);
    return searchPanelState.mode === 'connect'
      ? allOptions.filter(isConnectableTarget)
      : allOptions;
  }, [capabilityProfile, searchPanelState.mode, components]);

  // 任务 8.2 + 9.2：链路高亮 + 过滤视图叠加
  const displayNodes = useMemo(() => {
    const filteredNodes = filteredNodeIds ? nodes.filter((n) => filteredNodeIds.has(n.id)) : nodes;
    if (highlight.highlightedNodeIds.size === 0) return filteredNodes;
    return filteredNodes.map((n) =>
      highlight.highlightedNodeIds.has(n.id)
        ? { ...n, className: `${n.className ?? ''} blueprint-node-highlighted`.trim() }
        : n,
    );
  }, [nodes, filteredNodeIds, highlight.highlightedNodeIds]);

  const displayEdges = useMemo(() => {
    const filteredEdges = filteredNodeIds
      ? edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
      : edges;
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
  }, [edges, filteredNodeIds, highlight.highlightedEdgeIds]);

  // 任务 8.1：模拟触发 - 对选中组件节点 + 其首个事件锚点执行沙盒模拟
  const handleSimulateTrigger = useCallback(async () => {
    const selected = selectedNodeRef.current;
    if (!selected) return;
    // 仅 component / global 节点可触发模拟
    if (selected.type !== 'component' && selected.type !== 'global') return;

    // 推导首个事件 id
    const eventId = deriveFirstEventId(selected);
    if (!eventId) return;

    const result = await sandboxRef.current.simulateEvent(selected.id, eventId);
    setLastSimResult(result);
  }, []);

  const handleResetSandbox = useCallback(() => {
    sandboxRef.current.resetSandbox();
    setLastSimResult(null);
  }, []);

  // 任务 9.1：节点点击 -> 提取关联 componentId -> 通知 screen-editor 闪烁
  const handleNodeClick = useCallback<NodeMouseHandler<Node>>(
    (_event, node) => {
      if (!onLocateComponent) return;
      const bpNode = rfNodeToBlueprintNode(node);
      const componentId = getNodeLocateComponentId(bpNode);
      if (componentId) {
        onLocateComponent(componentId);
      }
    },
    [onLocateComponent],
  );

  // 是否可触发模拟：选中单个 component / global 节点
  const canSimulate = selectedNode?.type === 'component' || selectedNode?.type === 'global';

  const executionLogsForPanel = sandbox.executionLogs;

  return (
    <BlueprintDiagnosticMapProvider value={diagnosticMap}>
      {/* 顶栏 */}
      <header
        className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4"
        data-testid="blueprint-sheet-header"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
            <Workflow className="size-3.5" />
          </span>
          <span className="text-sm font-semibold text-foreground">事件蓝图</span>
        </div>
        {isFiltering && (
          <span
            className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700 ring-1 ring-inset ring-blue-500/25 dark:text-blue-300"
            data-testid="blueprint-filter-badge"
          >
            <Filter className="size-3" />
            过滤模式
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton
            tooltip={canSimulate ? '模拟触发选中节点' : '请选中一个组件或全局节点'}
            onClick={() => void handleSimulateTrigger()}
            disabled={!canSimulate || sandbox.isSimulating}
            data-testid="blueprint-simulate-trigger"
          >
            <Play className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            tooltip="重置沙盒"
            onClick={handleResetSandbox}
            disabled={sandbox.executionLogs.length === 0 && !sandbox.isSimulating}
            data-testid="blueprint-reset-sandbox"
          >
            <RotateCcw className="size-4" />
          </ToolbarButton>
          <div className="mx-1.5 h-5 w-px bg-border" />
          <ViewportToolbar
            zoom={viewport.zoom}
            spacePressed={viewport.spacePressed}
            onZoomIn={() => void viewport.zoomIn()}
            onZoomOut={() => void viewport.zoomOut()}
            onFitView={() => void viewport.fitView()}
            onFitViewToSelection={handleFitViewToSelection}
            onReset={() => void viewport.resetViewport()}
          />
          <div className="mx-1.5 h-5 w-px bg-border" />
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
        ref={containerRef}
        className="relative flex-1"
        data-testid="blueprint-canvas"
        onDoubleClick={handleDoubleClick}
      >
        {isEmpty && !searchPanelState.visible && !emptyDismissed && (
          // pointer-events-none：让双击 / 右键直接穿透到画布，仅 CTA 按钮可点
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <div className="flex w-[min(92vw,460px)] flex-col items-center gap-5 rounded-2xl border border-border bg-card/95 px-10 py-8 text-center shadow-xl">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
                <Workflow className="size-7" />
              </span>
              <div>
                <p className="text-base font-semibold text-foreground">蓝图为空</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  通过事件编排，让组件之间产生联动
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 text-left">
                <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <MousePointerClick className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    双击空白处
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    呼出节点搜索面板，快速插入节点
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Cable className="size-3.5 text-sky-600 dark:text-sky-400" />
                    拖出锚点连线
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    松手到空白处，连线并创建目标节点
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="pointer-events-auto rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                onClick={() => {
                  if (!project) return;
                  updateBlueprint({ version: 2, nodes: [], edges: [] });
                  setEmptyDismissed(true);
                }}
                data-testid="blueprint-start-from-scratch"
              >
                从空白开始
              </button>
            </div>
          </div>
        )}
        <BlueprintContextMenu
          mode={ctxMenuMode}
          selectedNodeCount={selectedCount}
          selectedNodeKind={ctxMenuSelectedNodeKind}
          selectedNodeHasComponentId={ctxMenuSelectedNodeHasComponentId}
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
          onLocateComponent={onLocateComponent ? handleLocateComponentFromMenu : undefined}
          onConfigureGlobal={handleConfigureGlobalFromMenu}
        >
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={wrappedConnectStart}
            onConnectEnd={wrappedConnectEnd}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            isValidConnection={checkConnection}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            selectionMode={SelectionMode.Partial}
            deleteKeyCode={['Backspace', 'Delete']}
            {...viewport.config}
            onMoveEnd={viewport.onMoveEnd}
            zoomOnDoubleClick={false}
            className="bg-background"
            data-testid="blueprint-reactflow"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              className="opacity-70"
            />
            <MiniMap
              pannable
              zoomable
              className="!rounded-lg !border !border-border !bg-background !shadow-lg"
              data-testid="blueprint-minimap"
            />
          </ReactFlow>
        </BlueprintContextMenu>

        {/* Search panel */}
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

        {/* 多选对齐与分布工具条 */}
        {selectedCount >= 2 && (
          <div className="pointer-events-auto absolute bottom-4 left-4 z-10">
            <AlignDistributeToolbar
              selectedCount={selectedCount}
              onAlign={handleAlign}
              onDistribute={handleDistribute}
            />
          </div>
        )}

        {/* 节点参数配置面板 */}
        {showConfigPanel && selectedNode && (
          <div className="pointer-events-auto absolute right-4 top-4 z-10 max-h-[70%] w-72 overflow-y-auto rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur">
            <NodeConfigPanel
              node={selectedNode}
              components={components}
              onChange={handleConfigChange}
            />
          </div>
        )}
      </div>

      {/* 问题面板 */}
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={errorCount}
        warningCount={warningCount}
        infoCount={infoCount}
        onLocateNode={handleLocateNode}
      />

      {/* 执行日志面板 */}
      {(sandbox.executionLogs.length > 0 || sandbox.isSimulating || lastSimResult) && (
        <ExecutionLogPanel
          executionLogs={executionLogsForPanel}
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

// ===== 辅助函数 =====

/**
 * 推导新节点的默认 target handle。
 *
 * - 普通组件节点：'act:show'（若不存在则由引脚兼容判定拒绝）
 * - 全局 navigate/requestApi/scrollTo：对应 'act:navigate' / 'act:requestApi' / 'act:scrollTo'
 * - 全局 pageLoad：无 target handle（不应作为连线目标）
 * - condition / delay：'in'
 * - comment：无 target handle
 */
function deriveDefaultTargetHandle(node: BlueprintNode): string {
  if (node.kind === 'component') {
    if (node.globalType === 'navigate') return 'act:navigate';
    if (node.globalType === 'requestApi') return 'act:requestApi';
    if (node.globalType === 'scrollTo') return 'act:scrollTo';
    // pageLoad / interval 全局节点只有输出锚点，不作为连线目标
    // 普通组件节点：用首个 action（'act:show' 是常见默认）
    return 'act:show';
  }
  if (node.kind === 'condition' || node.kind === 'delay') return 'in';
  return 'in';
}

/**
 * 推导 RF 节点的首个事件 id（用于模拟触发）。
 *
 * - 全局 pageLoad 节点：'pageLoad'
 * - 普通组件节点：从 componentType 派生首个事件 id（默认 'click'）
 * - 其他：undefined
 */
function deriveFirstEventId(node: Node): string | undefined {
  if (node.type === 'global') {
    const data = node.data as { globalType?: string };
    if (data.globalType === 'pageLoad') return 'pageLoad';
    if (data.globalType === 'interval') return 'interval';
    return undefined;
  }
  if (node.type === 'component') {
    // 普通组件节点：默认用 'click' 事件
    // 实际事件 id 列表由组件注册表派生，这里取最常见默认值
    return 'click';
  }
  return undefined;
}
