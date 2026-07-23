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
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  EventBlueprint,
  ScreenComponent,
  BlueprintTriggerConfig,
  BlueprintActionConfig,
  CommentNodeConfig,
  ConditionNodeConfig,
} from '@nebula/shared';

import { useScreenEditorStore } from '../../stores/editor-store';
import { ActionNode, CommentNode, ConditionNode, TriggerNode } from '../nodes';
import { ExecEdge } from '../edges';
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
import { SearchPanel, type NodeOption, type PendingConnection } from '../panels/search-panel';
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
export function getNodeLabel(
  kind: 'trigger' | 'condition' | 'action' | 'comment',
  config: Record<string, unknown>,
  components: ScreenComponent[],
): string {
  const findComponentName = (id: string | undefined): string => {
    if (!id) return '未配置';
    const comp = components.find((c) => c.id === id);
    return comp?.name ?? id;
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

/**
 * 检查节点是否 dangling（关联的 componentId 在项目中不存在）。
 */
function isNodeDangling(
  kind: 'trigger' | 'condition' | 'action' | 'comment',
  config: Record<string, unknown>,
  components: ScreenComponent[],
): boolean {
  if (kind === 'trigger') {
    const triggerConfig = config as { type: string; componentId?: string };
    if (triggerConfig.type === 'componentClick' && triggerConfig.componentId) {
      return !components.some((c) => c.id === triggerConfig.componentId);
    }
    return false;
  }

  if (kind === 'action') {
    const actionConfig = config as { type: string; targetComponentId?: string };
    if (actionConfig.targetComponentId) {
      return !components.some((c) => c.id === actionConfig.targetComponentId);
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
    return !components.some((c) => c.id === sourceComponentId);
  }

  return false;
}

/**
 * 将蓝图节点转换为 ReactFlow Node。
 */
function blueprintNodeToRFNode(
  blueprintNode: EventBlueprint['nodes'][number],
  components: ScreenComponent[],
): Node {
  const config = blueprintNode.config as Record<string, unknown>;
  const label = getNodeLabel(blueprintNode.kind, config, components);
  const dangling = isNodeDangling(blueprintNode.kind, config, components);

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
  /** 蓝图→画布高亮联动：点击节点时调用，由 screen-editor 注入 flashComponent */
  onLocateComponent?: (componentId: string) => void;
  /** 画布→蓝图过滤联动：当前选中组件 id（null 表示不过滤） */
  filterComponentId?: string | null;
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
}: BlueprintSheetProps): JSX.Element | null {
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
          filterComponentId={filterComponentId}
        />
      </ReactFlowProvider>
    </div>
  );
}

interface BlueprintSheetInnerProps {
  onOpenChange: (open: boolean) => void;
  onLocateComponent?: (componentId: string) => void;
  filterComponentId?: string | null;
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
}: BlueprintSheetInnerProps): JSX.Element {
  const project = useScreenEditorStore((s) => s.project);
  const updateBlueprint = useScreenEditorStore((s) => s.updateBlueprint);
  const beginBlueprintGesture = useScreenEditorStore((s) => s.beginBlueprintGesture);
  const endBlueprintGesture = useScreenEditorStore((s) => s.endBlueprintGesture);

  const blueprint = project?.blueprint;
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

  // 保持 ref 与最新 state 同步（拖拽结束提交时读取的是最终位置）
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // blueprint → ReactFlow 同步（外部变化：undo/redo/load）
  useEffect(() => {
    skipNextBlueprintSync.current = true;
    if (!blueprint) {
      setNodes([]);
      setEdges([]);
      initialized.current = true;
      return;
    }
    setNodes(blueprint.nodes.map((n) => blueprintNodeToRFNode(n, components)));
    setEdges(blueprint.edges.map((e) => blueprintEdgeToRFEdge(e)));
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
    if (!project) return;
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

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const newEdge: Edge = {
      id: generateEdgeId(),
      type: 'exec',
      source: connection.source,
      sourceHandle: connection.sourceHandle ?? 'out',
      target: connection.target,
      targetHandle: connection.targetHandle ?? 'in',
      data: {},
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, []);

  // 任务 5.4：追踪连线拖拽状态，供 Esc 分层判断
  const handleConnectStart = useCallback(() => {
    isConnectingRef.current = true;
  }, []);

  const handleConnectEnd = useCallback(() => {
    isConnectingRef.current = false;
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
      if (project) {
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
    [snapNodeDragStop, project, updateBlueprint, endBlueprintGesture],
  );

  // 视口控制
  const viewport = useBlueprintViewport();

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
      const position = searchPanelState.position;
      const newNode = createNodeFromOption(option, position);
      const rfNode = blueprintNodeToRFNode(newNode, components);

      setNodes((nds) => [...nds, rfNode]);

      // connect 模式：自动连线（M1 预留，当前仅 create 模式触发）
      if (searchPanelState.mode === 'connect' && searchPanelState.pendingConnection) {
        const newEdge: Edge = {
          id: generateEdgeId(),
          type: 'exec',
          source: searchPanelState.pendingConnection.sourceNodeId,
          sourceHandle: searchPanelState.pendingConnection.sourceHandle,
          target: rfNode.id,
          targetHandle: 'in',
          data: {},
        };
        setEdges((eds) => [...eds, newEdge]);
      }

      setSearchPanelState((s) => ({ ...s, visible: false }));
    },
    [searchPanelState, components],
  );

  // 任务 5.4：快捷键分层 —— Ctrl+Z/Shift+Z 走全局历史，Esc 分层
  useBlueprintShortcuts({
    onClose: () => onOpenChange(false),
    searchPanelVisible: searchPanelState.visible,
    onCloseSearchPanel: () => setSearchPanelState((s) => ({ ...s, visible: false })),
    nodes,
    edges,
    setNodes,
    setEdges,
    isConnectingRef,
  });

  // 任务 5.5：跨项目剪贴板 —— Ctrl+C/X/V/D
  useBlueprintClipboard({ nodes, edges, setNodes, setEdges });

  // 任务 6.1：实时诊断订阅
  const componentIds = new Set(components.map((c) => c.id));
  const { diagnostics, errorCount, warningCount, infoCount } = useBlueprintDiagnostics({
    blueprint,
    componentIds,
  });
  const diagnosticMap = buildDiagnosticMap(diagnostics);

  // 任务 6.2：问题面板点击定位节点
  const reactFlowInstance = useReactFlow();
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLocateNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find((n) => n.id === nodeId);
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
    [nodes, reactFlowInstance, setNodes],
  );

  // 清理定位计时器
  useEffect(() => {
    return () => {
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
    };
  }, []);

  // 任务 9.4：多选对齐与分布
  // 选中节点（ReactFlow Node 的 selected 字段）转换为 AlignNode 输入
  const selectedAlignNodes: AlignNode[] = nodes
    .filter((n) => n.selected)
    .map((n) => ({
      id: n.id,
      position: { x: n.position.x, y: n.position.y },
      width: n.measured?.width ?? 0,
      height: n.measured?.height ?? 0,
    }));

  const selectedCount = selectedAlignNodes.length;

  // 对齐：调用纯函数计算新位置，应用到 nodes 并写回 blueprint（一次提交一条历史）
  const handleAlign = useCallback(
    (mode: AlignMode) => {
      const result = alignNodes(selectedAlignNodes, mode);
      if (!result.hasChange) return;
      const nextNodes = applyAlignResultToNodes(nodes, result.items);
      setNodes(nextNodes);
      // nodes/edges→blueprint useEffect 会在下一帧自动同步
      // 但为了避免 dragActive 误判（此处不是拖拽），直接同步更新 blueprint
      if (project) {
        const nextBlueprint: EventBlueprint = {
          version: 1,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
    },
    [selectedAlignNodes, nodes, project, updateBlueprint],
  );

  // 分布：等距分布逻辑，与 handleAlign 同模式
  const handleDistribute = useCallback(
    (mode: DistributeMode) => {
      const result = distributeNodes(selectedAlignNodes, mode);
      if (!result.hasChange) return;
      const nextNodes = applyAlignResultToNodes(nodes, result.items);
      setNodes(nextNodes);
      if (project) {
        const nextBlueprint: EventBlueprint = {
          version: 1,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
    },
    [selectedAlignNodes, nodes, project, updateBlueprint],
  );

  // 任务 4.8：选中单个节点时展示节点参数配置面板
  // 从 nodes 中找出 selected 为 true 的节点（ReactFlow 通过 onNodesChange 更新 selected 字段）
  // 多选时不展示配置面板（恰好一个节点选中时才展示）
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const showConfigPanel = selectedNode !== null;

  // 配置变更回调：更新该节点的 data.config，由既有 useEffect[nodes,edges] 同步到 updateBlueprint
  const handleConfigChange = useCallback(
    (
      next:
        | BlueprintTriggerConfig
        | BlueprintActionConfig
        | CommentNodeConfig
        | ConditionNodeConfig,
    ) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id ? { ...n, data: { ...n.data, config: next } } : n,
        ),
      );
      // nodes/edges->blueprint useEffect 会在下一帧自动同步，updateBlueprint 内部有深比较守卫
      // 但为避免 dragActive 误判（此处非拖拽），直接同步更新 blueprint
      if (project) {
        const nextNodes = nodesRef.current.map((n) =>
          n.id === selectedNode.id ? { ...n, data: { ...n.data, config: next } } : n,
        );
        nodesRef.current = nextNodes;
        const nextBlueprint: EventBlueprint = {
          version: 1,
          nodes: nextNodes.map(rfNodeToBlueprintNode),
          edges: edgesRef.current.map(rfEdgeToBlueprintEdge),
        };
        updateBlueprint(nextBlueprint);
      }
    },
    [selectedNode, project, updateBlueprint],
  );

  // 空蓝图空态
  const isEmpty = nodes.length === 0;

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
  const handleSimulateTrigger = useCallback(async () => {
    if (!selectedNode || selectedNode.type !== 'trigger') return;
    const result = await sandbox.simulateTrigger(selectedNode.id);
    setLastSimResult(result);
  }, [selectedNode, sandbox]);

  // 任务 8.1：重置沙盒
  const handleResetSandbox = useCallback(() => {
    sandbox.resetSandbox();
    setLastSimResult(null);
  }, [sandbox]);

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
        {isFiltering ? (
          <span
            className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700"
            data-testid="blueprint-filter-badge"
          >
            过滤模式
          </span>
        ) : null}
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
            onFitViewToSelection={() => void viewport.fitViewToNodes([])}
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
        {isEmpty && !searchPanelState.visible ? (
          <div className="absolute inset-0 z-10 flex flex-col bg-background">
            <EmptyBlueprintState
              onInsertTemplate={(templateBlueprint) => {
                if (!project) return;
                updateBlueprint(templateBlueprint);
              }}
              onError={(error) => {
                toast.error(`模板插入失败：${error}`);
              }}
              onStartFromScratch={() => {
                if (!project) return;
                // 创建空蓝图状态（无节点无边）进入自由编排
                updateBlueprint({ version: 1, nodes: [], edges: [] });
              }}
            />
          </div>
        ) : null}
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
          {...viewport.config}
          zoomOnDoubleClick={false}
          className="bg-background"
          data-testid="blueprint-reactflow"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-background" data-testid="blueprint-minimap" />
        </ReactFlow>

        {/* 搜索面板 */}
        {searchPanelState.visible ? (
          <div
            className="pointer-events-auto absolute z-10"
            style={{ left: searchPanelState.position.x, top: searchPanelState.position.y }}
          >
            <SearchPanel
              position={searchPanelState.position}
              mode={searchPanelState.mode}
              pendingConnection={searchPanelState.pendingConnection}
              onInsert={handleInsertNode}
              onClose={() => setSearchPanelState((s) => ({ ...s, visible: false }))}
            />
          </div>
        ) : null}

        {/* 任务 9.4：多选对齐与分布工具条（左下角悬浮，selectedCount >= 2 时显示） */}
        {selectedCount >= 2 ? (
          <div className="pointer-events-auto absolute bottom-4 left-4 z-10">
            <AlignDistributeToolbar
              selectedCount={selectedCount}
              onAlign={handleAlign}
              onDistribute={handleDistribute}
            />
          </div>
        ) : null}

        {/* 任务 4.8：节点参数配置面板（右侧悬浮，选中单个节点时显示） */}
        {showConfigPanel && selectedNode ? (
          <div className="pointer-events-auto absolute right-4 top-4 z-10 w-64 max-h-[70%] overflow-y-auto rounded border border-border bg-background shadow-md">
            <NodeConfigPanel
              kind={selectedNode.type as 'trigger' | 'condition' | 'action' | 'comment'}
              config={(selectedNode.data as { config: NodeConfigPanelProps['config'] }).config}
              components={components}
              onChange={handleConfigChange}
            />
          </div>
        ) : null}
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
      {sandbox.executionLogs.length > 0 || sandbox.isSimulating || lastSimResult ? (
        <ExecutionLogPanel
          executionLogs={sandbox.executionLogs}
          isSimulating={sandbox.isSimulating}
          refusalReason={lastSimResult?.refused ? lastSimResult.refusalReason : undefined}
          triggerNotFound={lastSimResult?.triggerNotFound ?? false}
          onLocateNode={handleLocateNode}
          onClear={handleResetSandbox}
        />
      ) : null}
    </BlueprintDiagnosticMapProvider>
  );
}
