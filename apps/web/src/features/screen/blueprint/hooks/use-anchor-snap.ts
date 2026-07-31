/**
 * V2 任务 5.3：锚点磁吸 Hook
 *
 * 在连线拖拽过程中，检测鼠标 20px 范围内最近的兼容目标锚点：
 * - `onConnectStart` 记录源节点 ID + 源 handle
 * - `onMouseMove`（容器级别）查询 DOM 中所有 `.react-flow__handle`，
 *   按 V2 引脚兼容性规则过滤，找到 20px 内最近的目标锚点
 * - 命中时给目标 handle DOM 添加 `blueprint-anchor-snap-target` 高亮类
 * - `onConnectEnd` 时若有命中目标，绕过搜索面板直接建立连线
 *
 * 设计要点：
 * - 纯函数式状态机：snapState 驱动 UI 高亮，副作用集中在 DOM class 切换
 * - DOM 查询走 `document.querySelectorAll`，避免对 React Flow 内部状态依赖
 * - 兼容性判定复用 `isConnectionValidV2`，与 isValidConnection 行为一致
 * - 高亮 class 由 CSS 定义（ring-2 ring-blue-400），不在 hook 内联样式
 * - 卸载时自动清理高亮 class，防止残留
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node, OnConnectEnd, OnConnectStart } from '@xyflow/react';
import {
  isConnectionValidV2,
  isInputHandle,
  type V2ConnectionCandidate,
  type V2Edge,
  type V2NodeIndex,
  type V2NodeIndexEntry,
} from '../lib/pin-compatibility-v2';

/** 磁吸阈值（像素） */
export const SNAP_THRESHOLD_PX = 20;

/** 命中目标 handle DOM 上添加的高亮 class（CSS 中定义 ring 效果） */
export const SNAP_HIGHLIGHT_CLASS = 'blueprint-anchor-snap-target';

/** 磁吸状态（驱动 UI 渲染与测试断言） */
export interface AnchorSnapState {
  /** 当前连线源节点 ID（无连线时为 null） */
  activeSourceNodeId: string | null;
  /** 当前连线源 handle ID（evt:* / out / then / else） */
  activeSourceHandle: string | null;
  /** 当前磁吸命中的目标节点 ID（无命中时为 null） */
  snappedTargetNodeId: string | null;
  /** 当前磁吸命中的目标 handle ID（act:* / in） */
  snappedTargetHandle: string | null;
}

/** Hook 入参 */
export interface UseAnchorSnapOptions {
  /** 获取最新 nodes（ref-style getter，避免依赖数组抖动） */
  getNodes: () => Node[];
  /** 获取最新 edges */
  getEdges: () => Edge[];
  /**
   * 磁吸命中时建立连线的回调。
   * 调用方在此处执行 setEdges(addEdge(...))，与 onConnect 路径一致。
   */
  onSnapConnect: (conn: V2ConnectionCandidate) => void;
  /**
   * DOM 查询根节点：限定磁吸 handle 查询范围，避免多实例互相干扰。
   * 返回 null 时回退到 document（保留向后兼容行为）。
   */
  getRoot?: () => ParentNode | null;
}

/** Hook 返回值 */
export interface UseAnchorSnapResult {
  /** 当前磁吸状态（用于测试断言与可选 UI 反馈） */
  snapState: AnchorSnapState;
  /** 包装后的 onConnectStart：记录源信息后调用现有 handler */
  wrapConnectStart: (existing?: OnConnectStart) => OnConnectStart;
  /** 包装后的 onConnectEnd：若有命中目标则建立连线，否则调用现有 handler */
  wrapConnectEnd: (existing?: OnConnectEnd) => OnConnectEnd;
  /** 容器级别 mousemove 处理器：连线拖拽时更新磁吸命中 */
  handleMouseMove: (event: MouseEvent) => void;
  /** 重置磁吸状态（清理高亮 class + 清空 state） */
  resetSnap: () => void;
}

/**
 * 从 RF nodes/edges 构建 V2 节点索引 + 已有边（用于兼容性判定）。
 *
 * 复用 blueprint-sheet-v2.tsx 的 buildV2ConnectionContext 逻辑（保持单一数据源），
 * 但在本 hook 内独立实现以避免循环依赖。
 */
function buildSnapContext(
  rfNodes: Node[],
  rfEdges: Edge[],
): { nodeIndex: V2NodeIndex; existingEdges: V2Edge[] } {
  const mutableIndex = new Map<string, V2NodeIndexEntry>();
  for (const rfNode of rfNodes) {
    const data = rfNode.data as {
      componentId?: string;
      globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
    };
    const rfType = rfNode.type ?? 'component';
    const kind: V2NodeIndexEntry['kind'] =
      rfType === 'global' ? 'component' : (rfType as V2NodeIndexEntry['kind']);
    const entry: V2NodeIndexEntry = { id: rfNode.id, kind };
    if (kind === 'component') {
      entry.componentId = data.componentId;
      entry.globalType = data.globalType;
    }
    mutableIndex.set(rfNode.id, entry);
  }
  const existingEdges: V2Edge[] = rfEdges.map((e) => ({
    id: e.id,
    source: e.source,
    sourceHandle: e.sourceHandle ?? 'out',
    target: e.target,
    targetHandle: e.targetHandle ?? 'in',
  }));
  return { nodeIndex: mutableIndex, existingEdges };
}

/**
 * 在 DOM 中查找距离鼠标最近的兼容目标 handle。
 *
 * 查找规则：
 * - 遍历 root 下所有 `.react-flow__handle` 元素
 * - 跳过无 data-nodeid / data-handleid 的元素
 * - 跳过 handleId 不是输入锚点的元素（act:* / in）
 * - 跳过源节点自身（避免逻辑节点自环；组件节点自环虽合法但磁吸不感知，由用户手动连线）
 * - 用 isConnectionValidV2 做完整兼容性校验（含重复边检测）
 * - 计算鼠标到 handle 中心点的欧氏距离，返回 20px 内最近者
 *
 * root 默认为 document，多实例场景应传入实例容器 ref 以限定查询范围。
 */
function findNearestCompatibleHandle(
  event: MouseEvent,
  sourceNodeId: string,
  sourceHandle: string,
  nodeIndex: V2NodeIndex,
  existingEdges: readonly V2Edge[],
  root: ParentNode = document,
): { nodeId: string; handleId: string } | null {
  const handles = root.querySelectorAll<HTMLElement>('.react-flow__handle');
  let nearest: { nodeId: string; handleId: string; distance: number } | null = null;

  for (const handle of handles) {
    const nodeId = handle.dataset.nodeid;
    const handleId = handle.dataset.handleid;
    if (!nodeId || !handleId) continue;
    if (nodeId === sourceNodeId) continue;
    if (!isInputHandle(handleId)) continue;

    const candidate: V2ConnectionCandidate = {
      source: sourceNodeId,
      sourceHandle,
      target: nodeId,
      targetHandle: handleId,
    };
    if (!isConnectionValidV2(candidate, nodeIndex, existingEdges).valid) continue;

    const rect = handle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= SNAP_THRESHOLD_PX && (nearest === null || distance < nearest.distance)) {
      nearest = { nodeId, handleId, distance };
    }
  }

  return nearest ? { nodeId: nearest.nodeId, handleId: nearest.handleId } : null;
}

/**
 * 移除 root 下所有 handle 上的磁吸高亮 class。
 *
 * 卸载、状态重置、命中变化时调用，防止残留高亮。
 */
function clearAllSnapHighlights(root: ParentNode = document): void {
  const highlighted = root.querySelectorAll<HTMLElement>(`.${SNAP_HIGHLIGHT_CLASS}`);
  for (const el of highlighted) {
    el.classList.remove(SNAP_HIGHLIGHT_CLASS);
  }
}

/**
 * 给指定 handle DOM 添加高亮 class（先清理其他高亮，确保唯一）。
 */
function highlightHandle(nodeId: string, handleId: string, root: ParentNode = document): void {
  clearAllSnapHighlights(root);
  const selector = `.react-flow__handle[data-nodeid="${nodeId}"][data-handleid="${handleId}"]`;
  const target = root.querySelector<HTMLElement>(selector);
  if (target) {
    target.classList.add(SNAP_HIGHLIGHT_CLASS);
  }
}

/**
 * 锚点磁吸 Hook 实现。
 *
 * 使用 ref 跟踪连线源信息（避免 mousemove 高频回调触发 re-render），
 * 仅在 snappedTarget 发生变化时更新 state（驱动测试断言与可选 UI）。
 */
export function useAnchorSnap({
  getNodes,
  getEdges,
  onSnapConnect,
  getRoot,
}: UseAnchorSnapOptions): UseAnchorSnapResult {
  const [snapState, setSnapState] = useState<AnchorSnapState>({
    activeSourceNodeId: null,
    activeSourceHandle: null,
    snappedTargetNodeId: null,
    snappedTargetHandle: null,
  });

  // ref 镜像：mousemove 高频回调读取最新值，避免 closure 捕获旧值
  const sourceRef = useRef<{ nodeId: string; handleId: string } | null>(null);
  const snappedRef = useRef<{ nodeId: string; handleId: string } | null>(null);
  const onSnapConnectRef = useRef(onSnapConnect);
  onSnapConnectRef.current = onSnapConnect;

  /** 读取当前 DOM 查询根：getRoot 返回 null 时回退到 document */
  const resolveRoot = useCallback((): ParentNode => {
    const root = getRoot?.();
    return root ?? document;
  }, [getRoot]);

  /** 内部：更新 snapped state + DOM 高亮 */
  const updateSnapped = useCallback(
    (next: { nodeId: string; handleId: string } | null): void => {
      const prev = snappedRef.current;
      // 命中未变化时跳过 state 更新（高频 mousemove 优化）
      if (prev && next && prev.nodeId === next.nodeId && prev.handleId === next.handleId) {
        return;
      }
      if (!prev && !next) return;

      snappedRef.current = next;
      const root = resolveRoot();
      if (next) {
        highlightHandle(next.nodeId, next.handleId, root);
      } else {
        clearAllSnapHighlights(root);
      }
      setSnapState((s) => ({
        ...s,
        snappedTargetNodeId: next?.nodeId ?? null,
        snappedTargetHandle: next?.handleId ?? null,
      }));
    },
    [resolveRoot],
  );

  /** 容器级别 mousemove：连线拖拽时查找磁吸目标 */
  const handleMouseMove = useCallback(
    (event: MouseEvent): void => {
      const source = sourceRef.current;
      if (!source) return;
      const { nodeIndex, existingEdges } = buildSnapContext(getNodes(), getEdges());
      const next = findNearestCompatibleHandle(
        event,
        source.nodeId,
        source.handleId,
        nodeIndex,
        existingEdges,
        resolveRoot(),
      );
      updateSnapped(next);
    },
    [getNodes, getEdges, updateSnapped, resolveRoot],
  );

  /** 包装 onConnectStart：记录源信息 */
  const wrapConnectStart = useCallback((existing?: OnConnectStart): OnConnectStart => {
    return (event, payload) => {
      const nodeId = payload.nodeId;
      const handleId = payload.handleId;
      const handleType = payload.handleType;
      if (nodeId && handleId && handleType === 'source') {
        sourceRef.current = { nodeId, handleId };
        setSnapState((s) => ({
          ...s,
          activeSourceNodeId: nodeId,
          activeSourceHandle: handleId,
        }));
      }
      existing?.(event, payload);
    };
  }, []);

  /** 包装 onConnectEnd：若有磁吸命中则建立连线，否则回退到现有行为 */
  const wrapConnectEnd = useCallback(
    (existing?: OnConnectEnd): OnConnectEnd => {
      return (event, connectionState) => {
        const snapped = snappedRef.current;
        const source = sourceRef.current;
        const root = resolveRoot();

        // 清理磁吸状态（无论是否命中，连线结束都重置）
        sourceRef.current = null;
        snappedRef.current = null;
        clearAllSnapHighlights(root);
        setSnapState({
          activeSourceNodeId: null,
          activeSourceHandle: null,
          snappedTargetNodeId: null,
          snappedTargetHandle: null,
        });

        // 若 RF 已识别到目标节点（用户直接命中 handle），走原有 onConnect 路径
        if (connectionState.toNode) {
          existing?.(event, connectionState);
          return;
        }

        // 磁吸命中：手动建立连线
        if (snapped && source) {
          onSnapConnectRef.current({
            source: source.nodeId,
            sourceHandle: source.handleId,
            target: snapped.nodeId,
            targetHandle: snapped.handleId,
          });
          return;
        }

        // 未命中：回退到原有行为（如打开搜索面板）
        existing?.(event, connectionState);
      };
    },
    [resolveRoot],
  );

  /** 重置磁吸状态（外部清理用） */
  const resetSnap = useCallback((): void => {
    sourceRef.current = null;
    snappedRef.current = null;
    clearAllSnapHighlights(resolveRoot());
    setSnapState({
      activeSourceNodeId: null,
      activeSourceHandle: null,
      snappedTargetNodeId: null,
      snappedTargetHandle: null,
    });
  }, [resolveRoot]);

  // 卸载时清理 DOM 高亮 class，防止残留
  useEffect((): (() => void) => {
    const root = resolveRoot();
    return () => {
      clearAllSnapHighlights(root);
    };
  }, [resolveRoot]);

  return {
    snapState,
    wrapConnectStart,
    wrapConnectEnd,
    handleMouseMove,
    resetSnap,
  };
}
