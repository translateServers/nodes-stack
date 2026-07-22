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

import { useCallback, useEffect, useRef, useState } from 'react';
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
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
} from '@xyflow/react';
import { X } from 'lucide-react';
import type { EventBlueprint, ScreenComponent } from '@nebula/shared';

import { useScreenEditorStore } from '../../stores/editor-store';
import { ActionNode, CommentNode, TriggerNode } from '../nodes';
import { ExecEdge } from '../edges';
import { ViewportToolbar } from '../panels/viewport-toolbar';
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
import { ProblemsPanel } from '../panels/problems-panel';
import { ToolbarButton } from '../../components/ui-primitives';

// ===== ReactFlow 类型映射 =====

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  comment: CommentNode,
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
function getNodeLabel(
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
}

/**
 * 事件蓝图全屏弹层编辑器。
 *
 * 容器形态：full-overlay（全屏弹层，带顶栏）。
 * 数据流：editor-store.blueprint → ReactFlow nodes/edges → editor-store.updateBlueprint
 */
export function BlueprintSheet({ open, onOpenChange }: BlueprintSheetProps): JSX.Element | null {
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
        <BlueprintSheetInner onOpenChange={onOpenChange} />
      </ReactFlowProvider>
    </div>
  );
}

interface BlueprintSheetInnerProps {
  onOpenChange: (open: boolean) => void;
}

interface SearchPanelState {
  visible: boolean;
  mode: 'create' | 'connect';
  position: { x: number; y: number };
  pendingConnection?: PendingConnection;
}

function BlueprintSheetInner({ onOpenChange }: BlueprintSheetInnerProps): JSX.Element {
  const project = useScreenEditorStore((s) => s.project);
  const updateBlueprint = useScreenEditorStore((s) => s.updateBlueprint);
  const beginBlueprintGesture = useScreenEditorStore((s) => s.beginBlueprintGesture);
  const endBlueprintGesture = useScreenEditorStore((s) => s.endBlueprintGesture);

  const blueprint = project?.blueprint;
  const components = project?.components ?? [];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

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
      reactFlowInstance.setCenter(targetNode.position.x, targetNode.position.y, {
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

  // 空蓝图空态
  const isEmpty = nodes.length === 0;

  return (
    <BlueprintDiagnosticMapProvider value={diagnosticMap}>
      {/* 顶栏 */}
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4"
        data-testid="blueprint-sheet-header"
      >
        <span className="text-sm font-medium text-foreground">事件蓝图</span>
        <div className="ml-auto flex items-center gap-1">
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
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <p className="text-sm">空蓝图</p>
            <p className="text-xs">双击画布添加节点，或从搜索面板选择节点类型</p>
          </div>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
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
      </div>

      {/* 问题面板（任务 6.2） */}
      <ProblemsPanel
        diagnostics={diagnostics}
        errorCount={errorCount}
        warningCount={warningCount}
        infoCount={infoCount}
        onLocateNode={handleLocateNode}
      />
    </BlueprintDiagnosticMapProvider>
  );
}
