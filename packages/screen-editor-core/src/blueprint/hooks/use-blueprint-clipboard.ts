import { useCallback, useEffect, useRef } from 'react';
import type { Edge, Node } from '@xyflow/react';
import {
  BLUEPRINT_CLIPBOARD_KIND,
  BlueprintClipboardSchema,
  GLOBAL_COMPONENT_ID,
  type BlueprintClipboard,
  type BlueprintEdge,
  type BlueprintNode,
} from '@nebula/shared';

import { useScreenEditorNotifications } from '../../components/screen-editor-notifications.js';
import { useOptionalScreenEditorEnvironment } from '../../components/screen-editor-environment.js';
import { isFormElementFocused } from '../../hooks/use-modifier-keys.js';
import { EXEC_EDGE_MARKER_END } from '../edges/index.js';

const pasteOffset = 20;
const staticSourceHandles = new Set([
  'evt:click',
  'evt:hover',
  'evt:pageLoad',
  'evt:interval',
  'then',
  'else',
  'out',
]);
const staticTargetHandles = new Set([
  'act:show',
  'act:hide',
  'act:toggleVisibility',
  'act:navigate',
  'act:scrollTo',
  'in',
]);

interface ClipboardNodeData extends Record<string, unknown> {
  componentId?: string;
  componentType?: string;
  config?: unknown;
  globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
  label?: string;
}

export interface UseBlueprintClipboardOptions {
  readonly nodes: Node[];
  readonly edges: Edge[];
  readonly setNodes: (updater: (nodes: Node[]) => Node[]) => void;
  readonly setEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  readonly isActive?: () => boolean;
}

export interface UseBlueprintClipboardResult {
  readonly copy: () => Promise<void>;
  readonly cut: () => Promise<void>;
  readonly paste: () => Promise<void>;
  readonly duplicate: () => void;
}

export function isStaticClipboardPayload(payload: BlueprintClipboard): boolean {
  return (
    payload.nodes.every((node) => node.kind !== 'component' || node.globalType !== 'requestApi') &&
    payload.edges.every(
      (edge) =>
        staticSourceHandles.has(edge.sourceHandle) && staticTargetHandles.has(edge.targetHandle),
    )
  );
}

export function useBlueprintClipboard(
  options: UseBlueprintClipboardOptions,
): UseBlueprintClipboardResult {
  const { nodes, edges, setNodes, setEdges, isActive = () => true } = options;
  const { notify } = useScreenEditorNotifications();
  const staticOnly = useOptionalScreenEditorEnvironment()?.capabilityProfile === 'static';
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const setNodesRef = useRef(setNodes);
  const setEdgesRef = useRef(setEdges);
  const isActiveRef = useRef(isActive);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  setNodesRef.current = setNodes;
  setEdgesRef.current = setEdges;
  isActiveRef.current = isActive;

  const copy = useCallback(async (): Promise<void> => {
    const payload = buildClipboardPayload(nodesRef.current, edgesRef.current);
    if (payload === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      notify('error', '复制到剪贴板失败，请检查浏览器权限');
    }
  }, [notify]);

  const cut = useCallback(async (): Promise<void> => {
    const payload = buildClipboardPayload(nodesRef.current, edgesRef.current);
    if (payload === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      notify('error', '复制到剪贴板失败，请检查浏览器权限');
      return;
    }
    const selectedIds = new Set(
      nodesRef.current.filter((node) => node.selected).map((node) => node.id),
    );
    setNodesRef.current((current) => current.filter((node) => !selectedIds.has(node.id)));
    setEdgesRef.current((current) =>
      current.filter((edge) => !selectedIds.has(edge.source) && !selectedIds.has(edge.target)),
    );
  }, [notify]);

  const addPayload = useCallback(
    (payload: BlueprintClipboard): void => {
      if (staticOnly && !isStaticClipboardPayload(payload)) {
        notify('error', '剪贴板内容包含当前 SDK 不支持的蓝图能力');
        return;
      }
      const regenerated = regenerateIds(payload.nodes, payload.edges);
      const pastedNodes = regenerated.nodes.map((node) => ({
        ...toReactFlowNode(node),
        position: {
          x: node.position.x + pasteOffset,
          y: node.position.y + pasteOffset,
        },
        selected: true,
      }));
      const pastedEdges = regenerated.edges.map(toReactFlowEdge);
      setNodesRef.current((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        ...pastedNodes,
      ]);
      setEdgesRef.current((current) => [...current, ...pastedEdges]);
    },
    [notify, staticOnly],
  );

  const paste = useCallback(async (): Promise<void> => {
    try {
      const parsed = BlueprintClipboardSchema.safeParse(
        JSON.parse(await navigator.clipboard.readText()),
      );
      if (!parsed.success) {
        notify('error', '剪贴板内容不是有效的蓝图数据');
        return;
      }
      addPayload(parsed.data);
    } catch {
      notify('error', '读取剪贴板失败，请检查浏览器权限');
    }
  }, [addPayload, notify]);

  const duplicate = useCallback((): void => {
    const payload = buildClipboardPayload(nodesRef.current, edgesRef.current);
    if (payload !== null) {
      addPayload(payload);
    }
  }, [addPayload]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        !isActiveRef.current() ||
        !(event.ctrlKey || event.metaKey) ||
        isFormElementFocused() ||
        hasNativeSelection()
      ) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'c':
          event.preventDefault();
          void copy();
          break;
        case 'x':
          event.preventDefault();
          void cut();
          break;
        case 'v':
          event.preventDefault();
          void paste();
          break;
        case 'd':
          event.preventDefault();
          duplicate();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copy, cut, duplicate, paste]);

  return { copy, cut, paste, duplicate };
}

function buildClipboardPayload(nodes: Node[], edges: Edge[]): BlueprintClipboard | null {
  const selectedNodes = nodes.filter((node) => node.selected);
  if (selectedNodes.length === 0) {
    return null;
  }
  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const rawNodes = selectedNodes.map(toBlueprintNode);
  const rawEdges = edges
    .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? 'out',
      target: edge.target,
      targetHandle: edge.targetHandle ?? 'in',
    }));
  const parsed = BlueprintClipboardSchema.safeParse({
    kind: BLUEPRINT_CLIPBOARD_KIND,
    nodes: rawNodes,
    edges: rawEdges,
  });
  return parsed.success ? parsed.data : null;
}

function toBlueprintNode(node: Node): unknown {
  const data = asClipboardNodeData(node.data);
  const position = { x: node.position.x, y: node.position.y };
  if (node.type === 'global') {
    const globalType = data.globalType ?? 'pageLoad';
    return {
      id: node.id,
      kind: 'component',
      position,
      componentId: GLOBAL_COMPONENT_ID,
      globalType,
      ...(globalType === 'pageLoad' ? {} : { config: data.config }),
    };
  }
  if (node.type === 'component') {
    return {
      id: node.id,
      kind: 'component',
      position,
      componentId: data.componentId ?? '',
    };
  }
  if (node.type === 'delay') {
    return { id: node.id, kind: 'delay', position, config: data.config };
  }
  if (node.type === 'condition') {
    return { id: node.id, kind: 'condition', position, config: data.config };
  }
  return { id: node.id, kind: 'comment', position, config: data.config };
}

function asClipboardNodeData(value: unknown): ClipboardNodeData {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function regenerateIds(
  nodes: readonly BlueprintNode[],
  edges: readonly BlueprintEdge[],
): { readonly nodes: BlueprintNode[]; readonly edges: BlueprintEdge[] } {
  const idMap = new Map<string, string>();
  const regeneratedNodes = nodes.map((node) => {
    const id = createId('node');
    idMap.set(node.id, id);
    return { ...node, id };
  });
  const regeneratedEdges = edges.flatMap((edge) => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    return source === undefined || target === undefined
      ? []
      : [{ ...edge, id: createId('edge'), source, target }];
  });
  return { nodes: regeneratedNodes, edges: regeneratedEdges };
}

function toReactFlowNode(node: BlueprintNode): Node {
  const data: ClipboardNodeData = { label: '' };
  if (node.kind === 'component') {
    data.componentId = node.componentId;
    data.globalType = node.globalType;
    if (node.config !== undefined) {
      data.config = node.config;
    }
  } else {
    data.config = node.config;
  }
  return {
    id: node.id,
    type: node.kind === 'component' && node.globalType !== undefined ? 'global' : node.kind,
    position: node.position,
    data,
  };
}

function toReactFlowEdge(edge: BlueprintEdge): Edge {
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

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasNativeSelection(): boolean {
  return typeof window !== 'undefined' && (window.getSelection()?.toString().length ?? 0) > 0;
}
