/**
 * 蓝图剪贴板 hook（任务 5.5）
 *
 * 跨项目剪贴板：
 * - Ctrl+C：复制选中节点及其之间的边到系统剪贴板（JSON 格式）
 * - Ctrl+X：剪切（复制后删除）
 * - Ctrl+V：从剪贴板粘贴，重新生成节点/边 ID，偏移位置
 * - Ctrl+D：就地复制选中节点（不经过系统剪贴板）
 *
 * 剪贴板格式：BlueprintClipboardSchema（kind + nodes + edges）
 * 粘贴校验：Zod Schema 校验，非法内容给出可读提示
 * ID 重生成：粘贴/复制时重新生成所有节点和边的 ID，
 *   并更新边的 source/target 引用，防止跨项目 ID 冲突
 */

import { useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  BlueprintClipboardSchema,
  BLUEPRINT_CLIPBOARD_KIND,
  type BlueprintClipboard,
  type BlueprintNode,
  type BlueprintEdge,
} from '@nebula/shared';
import { isFormElementFocused } from '../../hooks/use-modifier-keys';
import { toast } from 'sonner';

const PASTE_OFFSET = 20;

function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 从 ReactFlow Node 数组中提取选中节点及其之间的边，
 * 转换为 BlueprintClipboard 载荷。
 */
function buildClipboardPayload(nodes: Node[], edges: Edge[]): BlueprintClipboard | null {
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length === 0) return null;

  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const selectedEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));

  const blueprintNodes: BlueprintNode[] = selectedNodes.map((n) => ({
    id: n.id,
    kind: n.type as BlueprintNode['kind'],
    position: { x: n.position.x, y: n.position.y },
    config: (n.data as { config: BlueprintNode['config'] }).config,
  }));

  const blueprintEdges: BlueprintEdge[] = selectedEdges.map((e) => ({
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
 * 返回新的节点/边数组及 ID 映射表。
 */
function regenerateIds(
  nodes: BlueprintNode[],
  edges: BlueprintEdge[],
): { nodes: BlueprintNode[]; edges: BlueprintEdge[]; idMap: Map<string, string> } {
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
  return { nodes: newNodes, edges: newEdges, idMap };
}

/** 将 BlueprintNode/Edge 转换为 ReactFlow Node/Edge */
function toRFNodes(nodes: BlueprintNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: n.position.x, y: n.position.y },
    data: { config: n.config, label: '', dangling: false },
  }));
}

function toRFEdges(edges: BlueprintEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    type: 'exec',
    source: e.source,
    sourceHandle: e.sourceHandle,
    target: e.target,
    targetHandle: e.targetHandle,
    data: {},
  }));
}

/** 检查是否有原生文本选区（浏览器原生 copy 应优先） */
function hasNativeSelection(): boolean {
  if (typeof window === 'undefined') return false;
  const selection = window.getSelection();
  return !!selection && selection.toString().length > 0;
}

interface UseBlueprintClipboardOptions {
  nodes: Node[];
  edges: Edge[];
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
}

interface UseBlueprintClipboardResult {
  copy: () => Promise<void>;
  cut: () => Promise<void>;
  paste: () => Promise<void>;
  duplicate: () => void;
}

export function useBlueprintClipboard(
  options: UseBlueprintClipboardOptions,
): UseBlueprintClipboardResult {
  const { nodes, edges, setNodes, setEdges } = options;

  const copy = useCallback(async () => {
    const payload = buildClipboardPayload(nodes, edges);
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      toast.error('复制到剪贴板失败，请检查浏览器权限');
    }
  }, [nodes, edges]);

  const cut = useCallback(async () => {
    const payload = buildClipboardPayload(nodes, edges);
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      toast.error('复制到剪贴板失败，请检查浏览器权限');
      return;
    }
    const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    setNodes((nds) => nds.filter((n) => !selectedIds.has(n.id)));
    setEdges((eds) => eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
  }, [nodes, edges, setNodes, setEdges]);

  const paste = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error('读取剪贴板失败，请检查浏览器权限');
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      toast.error('剪贴板内容不是有效的 JSON');
      return;
    }

    const result = BlueprintClipboardSchema.safeParse(json);
    if (!result.success) {
      toast.error('剪贴板内容不是有效的蓝图数据');
      return;
    }

    const { nodes: newBpNodes, edges: newBpEdges } = regenerateIds(
      result.data.nodes,
      result.data.edges,
    );

    const rfNodes = toRFNodes(newBpNodes).map((n) => ({
      ...n,
      position: { x: n.position.x + PASTE_OFFSET, y: n.position.y + PASTE_OFFSET },
      selected: true,
    }));
    const rfEdges = toRFEdges(newBpEdges);

    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...rfNodes]);
    setEdges((eds) => [...eds, ...rfEdges]);
  }, [setNodes, setEdges]);

  const duplicate = useCallback(() => {
    const payload = buildClipboardPayload(nodes, edges);
    if (!payload) return;

    const { nodes: newBpNodes, edges: newBpEdges } = regenerateIds(payload.nodes, payload.edges);

    const rfNodes = toRFNodes(newBpNodes).map((n) => ({
      ...n,
      position: { x: n.position.x + PASTE_OFFSET, y: n.position.y + PASTE_OFFSET },
      selected: true,
    }));
    const rfEdges = toRFEdges(newBpEdges);

    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...rfNodes]);
    setEdges((eds) => [...eds, ...rfEdges]);
  }, [nodes, edges, setNodes, setEdges]);

  // 键盘监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
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

export type { UseBlueprintClipboardOptions, UseBlueprintClipboardResult };
