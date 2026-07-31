/**
 * V2 蓝图剪贴板 hook
 *
 * 与 V1 useBlueprintClipboard 平行存在，使用 V2 schema：
 * - BlueprintClipboardV2Schema / BlueprintNodeV2 / BlueprintEdgeV2
 * - RF type 'global' 映射回 V2 kind 'component'（保留 globalType / config）
 * - V2 component 节点额外保留 componentId / globalType / config 字段
 *
 * 交互与 V1 一致：
 * - Ctrl+C/X/V/D：复制/剪切/粘贴/就地复制
 * - 粘贴时重新生成节点/边 ID，偏移位置
 * - 跨项目粘贴时 Zod Schema 校验
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  BlueprintClipboardV2Schema,
  BLUEPRINT_CLIPBOARD_KIND,
  GLOBAL_COMPONENT_ID,
  type BlueprintClipboardV2,
  type BlueprintNodeV2,
  type BlueprintEdgeV2,
  type CommentNodeConfig,
  type ConditionNodeConfig,
  type GlobalNodeConfig,
} from '@nebula/shared';
import { isFormElementFocused } from '../../hooks/use-modifier-keys';
import { EXEC_EDGE_MARKER_END } from '../edges';
import { useScreenEditorNotifications } from '../../components/screen-editor-notifications';
import { useOptionalScreenEditorEnvironment } from '../../components/screen-editor-environment';

const PASTE_OFFSET = 20;
const STATIC_SOURCE_HANDLES = new Set([
  'evt:click',
  'evt:hover',
  'evt:pageLoad',
  'evt:interval',
  'then',
  'else',
  'out',
]);
const STATIC_TARGET_HANDLES = new Set([
  'act:show',
  'act:hide',
  'act:toggleVisibility',
  'act:navigate',
  'act:scrollTo',
  'in',
]);

export function isStaticClipboardPayload(payload: BlueprintClipboardV2): boolean {
  return (
    payload.nodes.every((node) => node.kind !== 'component' || node.globalType !== 'requestApi') &&
    payload.edges.every(
      (edge) =>
        STATIC_SOURCE_HANDLES.has(edge.sourceHandle) &&
        STATIC_TARGET_HANDLES.has(edge.targetHandle),
    )
  );
}

function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * V2 RF Node data 结构（用于剪贴板序列化时读取 data 字段）。
 *
 * 与 v2-node-data-types 的 *NodeData 一致，但剪贴板只需保留持久化字段
 * （componentId / globalType / config / componentType 用于粘贴后重建）。
 */
interface V2RFNodeData extends Record<string, unknown> {
  config?: unknown;
  componentId?: string;
  componentType?: string;
  globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
  label?: string;
  dangling?: boolean;
  inCycle?: boolean;
}

/**
 * 从 ReactFlow Node 数组中提取选中节点及其之间的边，
 * 转换为 BlueprintClipboardV2 载荷。
 *
 * RF type → V2 kind 映射：
 * - 'component' → kind: 'component'
 * - 'global' → kind: 'component'（globalType / config 从 data 读取）
 * - 'condition' → kind: 'condition'
 * - 'delay' → kind: 'delay'
 * - 'comment' → kind: 'comment'
 */
function buildClipboardPayloadV2(nodes: Node[], edges: Edge[]): BlueprintClipboardV2 | null {
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length === 0) return null;

  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const selectedEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));

  const blueprintNodes: BlueprintNodeV2[] = selectedNodes.map((n): BlueprintNodeV2 => {
    const data = n.data as V2RFNodeData;
    const rfType = n.type ?? 'component';
    const position = { x: n.position.x, y: n.position.y };

    // 全局节点：RF type 'global' → V2 kind 'component' + globalType + config
    if (rfType === 'global') {
      const globalType = data.globalType ?? 'pageLoad';
      // pageLoad 全局节点无 config；其他全局节点必有 config
      if (globalType === 'pageLoad') {
        return {
          id: n.id,
          kind: 'component',
          position,
          componentId: GLOBAL_COMPONENT_ID,
          globalType: 'pageLoad',
        };
      }
      return {
        id: n.id,
        kind: 'component',
        position,
        componentId: GLOBAL_COMPONENT_ID,
        globalType,
        config: data.config as GlobalNodeConfig,
      };
    }

    // 普通组件节点
    if (rfType === 'component') {
      return {
        id: n.id,
        kind: 'component',
        position,
        componentId: data.componentId ?? '',
      };
    }

    // delay 节点
    if (rfType === 'delay') {
      return {
        id: n.id,
        kind: 'delay',
        position,
        config: data.config as { delayMs: number },
      };
    }

    // condition 节点
    if (rfType === 'condition') {
      return {
        id: n.id,
        kind: 'condition',
        position,
        config: data.config as ConditionNodeConfig,
      };
    }

    // comment 节点
    return {
      id: n.id,
      kind: 'comment',
      position,
      config: data.config as CommentNodeConfig,
    };
  });

  const blueprintEdges: BlueprintEdgeV2[] = selectedEdges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle ?? 'out',
    target: e.target,
    targetHandle: e.targetHandle ?? 'in',
  }));

  return {
    kind: BLUEPRINT_CLIPBOARD_KIND,
    nodes: blueprintNodes,
    edges: blueprintEdges,
  };
}

/**
 * 重新生成节点/边 ID 并更新边的 source/target 引用。
 */
function regenerateIdsV2(
  nodes: BlueprintNodeV2[],
  edges: BlueprintEdgeV2[],
): { nodes: BlueprintNodeV2[]; edges: BlueprintEdgeV2[] } {
  const idMap = new Map<string, string>();
  const newNodes = nodes.map((n) => {
    const newId = generateNodeId();
    idMap.set(n.id, newId);
    return { ...n, id: newId };
  });
  const newEdges = edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...e,
      id: generateEdgeId(),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));
  return { nodes: newNodes, edges: newEdges };
}

/** 检查是否有原生文本选区（浏览器原生 copy 应优先） */
function hasNativeSelection(): boolean {
  if (typeof window === 'undefined') return false;
  const selection = window.getSelection();
  return !!selection && selection.toString().length > 0;
}

interface UseBlueprintClipboardV2Options {
  nodes: Node[];
  edges: Edge[];
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
  /**
   * 当前实例是否处于活跃状态（拥有焦点）。
   * 多实例场景下，仅活跃实例的蓝图剪贴板响应键盘快捷键。
   * 默认为 () => true，保留单实例向后兼容行为。
   */
  isActive?: () => boolean;
}

interface UseBlueprintClipboardV2Result {
  copy: () => Promise<void>;
  cut: () => Promise<void>;
  paste: () => Promise<void>;
  duplicate: () => void;
}

/**
 * V2 蓝图剪贴板 hook。
 *
 * 与 V1 useBlueprintClipboard 接口签名一致，便于 Sheet 内无感替换。
 * 内部使用 BlueprintClipboardV2Schema 做粘贴校验。
 */
export function useBlueprintClipboardV2(
  options: UseBlueprintClipboardV2Options,
): UseBlueprintClipboardV2Result {
  const { nodes, edges, setNodes, setEdges, isActive = () => true } = options;
  const { notify } = useScreenEditorNotifications();
  const staticOnly = useOptionalScreenEditorEnvironment()?.capabilityProfile === 'static';
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const setNodesRef = useRef(setNodes);
  const setEdgesRef = useRef(setEdges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  setNodesRef.current = setNodes;
  setEdgesRef.current = setEdges;

  const copy = useCallback(async () => {
    const payload = buildClipboardPayloadV2(nodesRef.current, edgesRef.current);
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      notify('error', '复制到剪贴板失败，请检查浏览器权限');
    }
  }, [notify]);

  const cut = useCallback(async () => {
    const currentNodes = nodesRef.current;
    const payload = buildClipboardPayloadV2(currentNodes, edgesRef.current);
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      notify('error', '复制到剪贴板失败，请检查浏览器权限');
      return;
    }
    const selectedIds = new Set(currentNodes.filter((n) => n.selected).map((n) => n.id));
    setNodesRef.current((nds) => nds.filter((n) => !selectedIds.has(n.id)));
    setEdgesRef.current((eds) =>
      eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)),
    );
  }, [notify]);

  const paste = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      notify('error', '读取剪贴板失败，请检查浏览器权限');
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      notify('error', '剪贴板内容不是有效的 JSON');
      return;
    }

    const result = BlueprintClipboardV2Schema.safeParse(json);
    if (!result.success) {
      notify('error', '剪贴板内容不是有效的 V2 蓝图数据');
      return;
    }
    if (staticOnly && !isStaticClipboardPayload(result.data)) {
      notify('error', '剪贴板内容包含当前 SDK 不支持的蓝图能力');
      return;
    }

    const { nodes: newBpNodes, edges: newBpEdges } = regenerateIdsV2(
      result.data.nodes,
      result.data.edges,
    );

    // 将 V2 蓝图节点转回 RF 节点（保留 data 中的渲染字段）
    // 粘贴后选中新增节点，取消原有选中
    const rfNodes: Node[] = newBpNodes.map((n) =>
      v2NodeToRFNodeForPaste(n, { x: PASTE_OFFSET, y: PASTE_OFFSET }),
    );
    const rfEdges: Edge[] = newBpEdges.map((e) => ({
      id: e.id,
      type: 'exec',
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
      markerEnd: EXEC_EDGE_MARKER_END,
      data: {},
    }));

    setNodesRef.current((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      ...rfNodes.map((n) => ({ ...n, selected: true })),
    ]);
    setEdgesRef.current((eds) => [...eds, ...rfEdges]);
  }, [notify, staticOnly]);

  const duplicate = useCallback(() => {
    const payload = buildClipboardPayloadV2(nodesRef.current, edgesRef.current);
    if (!payload) return;

    const { nodes: newBpNodes, edges: newBpEdges } = regenerateIdsV2(payload.nodes, payload.edges);

    const rfNodes: Node[] = newBpNodes.map((n) =>
      v2NodeToRFNodeForPaste(n, { x: PASTE_OFFSET, y: PASTE_OFFSET }),
    );
    const rfEdges: Edge[] = newBpEdges.map((e) => ({
      id: e.id,
      type: 'exec',
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
      markerEnd: EXEC_EDGE_MARKER_END,
      data: {},
    }));

    setNodesRef.current((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      ...rfNodes.map((n) => ({ ...n, selected: true })),
    ]);
    setEdgesRef.current((eds) => [...eds, ...rfEdges]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!isActiveRef.current()) return;
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      if (isFormElementFocused()) return;
      if (hasNativeSelection()) return;

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          void copy();
          break;
        case 'x':
          e.preventDefault();
          void cut();
          break;
        case 'v':
          e.preventDefault();
          void paste();
          break;
        case 'd':
          e.preventDefault();
          duplicate();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copy, cut, paste, duplicate]);

  return { copy, cut, paste, duplicate };
}

/**
 * 将 V2 蓝图节点转换为 RF 节点（粘贴/复制场景）。
 * 应用偏移量，保留渲染所需的 data 字段。
 *
 * 注意：粘贴后 componentType / dangling / inCycle 等渲染字段由 Sheet 的
 * blueprint→RF 同步 effect 重新派生，这里只保留最小信息避免重复计算。
 */
function v2NodeToRFNodeForPaste(node: BlueprintNodeV2, offset: { x: number; y: number }): Node {
  const rfType = node.kind === 'component' && node.globalType !== undefined ? 'global' : node.kind;
  const data: V2RFNodeData = {};

  if (node.kind === 'component') {
    data.componentId = node.componentId;
    data.globalType = node.globalType;
    if (node.config !== undefined) {
      data.config = node.config;
    }
  } else if (node.kind === 'delay') {
    data.config = node.config;
  } else {
    // condition / comment
    data.config = node.config;
  }

  return {
    id: node.id,
    type: rfType,
    position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
    data,
  };
}

export type { UseBlueprintClipboardV2Options, UseBlueprintClipboardV2Result };
