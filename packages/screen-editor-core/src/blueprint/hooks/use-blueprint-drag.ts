/**
 * 蓝图节点拖拽吸附 Hook（任务 4.5）
 *
 * 封装 React Flow onNodeDragStop 处理器：
 * - 拖拽结束时计算网格吸附与对齐吸附
 * - 将吸附后的位置写回 nodes 数组
 * - 通过 onNodesChange 回调通知外部更新
 *
 * 拖拽中间态不入栈历史（由 Task 5.2 在历史层处理）。
 */

import { useCallback } from 'react';
import type { Node, OnNodeDrag } from '@xyflow/react';

import {
  applyAlignmentSnap,
  DEFAULT_ALIGNMENT_THRESHOLD,
  DEFAULT_GRID_SIZE,
  snapPositionToGrid,
  type AlignmentGuides,
  type NodeBounds,
} from '../lib/snap-utils';

export interface UseBlueprintDragOptions {
  /** 当前所有节点（用于计算对齐吸附） */
  nodes: Node[];
  /** 节点位置变更回调（写回 store / state） */
  onNodesChange: (nodes: Node[]) => void;
  /** 网格大小（默认 8px） */
  gridSize?: number;
  /** 对齐吸附阈值（默认 4px） */
  alignThreshold?: number;
  /** 是否启用网格吸附（默认 true） */
  enableGridSnap?: boolean;
  /** 是否启用对齐吸附（默认 true） */
  enableAlignSnap?: boolean;
}

export interface UseBlueprintDragResult {
  /** React Flow onNodeDragStop 处理器 */
  onNodeDragStop: OnNodeDrag;
  /** React Flow onNodeDrag 处理器（可选，用于实时显示吸附线） */
  onNodeDrag: OnNodeDrag;
}

/**
 * 从 React Flow Node 提取 NodeBounds（位置 + 测量尺寸）。
 *
 * React Flow 的 measured 字段在节点渲染后填充；测试或边缘场景可能为 undefined，
 * 此处做安全降级（width/height 缺失时按 0 处理，对齐吸附退化为仅网格吸附）。
 */
function toNodeBounds(node: Node): NodeBounds {
  const measured = node.measured;
  const width = measured?.width ?? 0;
  const height = measured?.height ?? 0;
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

/**
 * 蓝图拖拽吸附 Hook。
 *
 * 用法：
 * ```tsx
 * const { onNodeDragStop, onNodeDrag } = useBlueprintDrag({
 *   nodes,
 *   onNodesChange: setNodes,
 * });
 * return <ReactFlow nodes={nodes} onNodeDragStop={onNodeDragStop} onNodeDrag={onNodeDrag} />
 * ```
 */
export function useBlueprintDrag(options: UseBlueprintDragOptions): UseBlueprintDragResult {
  const {
    nodes,
    onNodesChange,
    gridSize = DEFAULT_GRID_SIZE,
    alignThreshold = DEFAULT_ALIGNMENT_THRESHOLD,
    enableGridSnap = true,
    enableAlignSnap = true,
  } = options;

  /**
   * 计算单个拖拽节点吸附后的最终位置。
   *
   * 优先级：
   * 1. 对齐吸附（更精确，命中后跳过网格吸附）
   * 2. 网格吸附（兜底）
   */
  const computeSnappedPosition = useCallback(
    (draggedNode: Node, allNodes: Node[]): { x: number; y: number; guides: AlignmentGuides } => {
      const draggedBounds = toNodeBounds(draggedNode);
      const otherBounds = allNodes.filter((n) => n.id !== draggedNode.id).map(toNodeBounds);

      // 对齐吸附优先
      if (enableAlignSnap && draggedBounds.width > 0 && draggedBounds.height > 0) {
        const snapped = applyAlignmentSnap(draggedBounds, otherBounds, alignThreshold);
        // 若命中对齐线，直接返回（不再做网格吸附）
        if (snapped.guides.vertical.length > 0 || snapped.guides.horizontal.length > 0) {
          return snapped;
        }
      }

      // 网格吸附兜底
      let { x, y } = draggedNode.position;
      if (enableGridSnap) {
        const gridSnapped = snapPositionToGrid(draggedNode.position, gridSize);
        x = gridSnapped.x;
        y = gridSnapped.y;
      }

      return {
        x,
        y,
        guides: { vertical: [], horizontal: [] },
      };
    },
    [alignThreshold, enableAlignSnap, enableGridSnap, gridSize],
  );

  /**
   * 应用拖拽结果到 nodes 数组并触发回调。
   *
   * 多选拖拽时，nodes 包含所有正在拖拽的节点，每个节点都做吸附计算。
   */
  const applyDragResult = useCallback(
    (draggedNodes: Node[]) => {
      if (draggedNodes.length === 0) return;

      const snappedMap = new Map<string, { x: number; y: number }>();
      for (const node of draggedNodes) {
        const snapped = computeSnappedPosition(node, nodes);
        snappedMap.set(node.id, { x: snapped.x, y: snapped.y });
      }

      // 仅在位置实际变化时写回，避免无变化的空更新
      let hasChange = false;
      const nextNodes = nodes.map((n) => {
        const snapped = snappedMap.get(n.id);
        if (!snapped) return n;
        if (n.position.x === snapped.x && n.position.y === snapped.y) return n;
        hasChange = true;
        return { ...n, position: { x: snapped.x, y: snapped.y } };
      });

      if (hasChange) {
        onNodesChange(nextNodes);
      }
    },
    [computeSnappedPosition, nodes, onNodesChange],
  );

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_event, _node, draggedNodes) => {
      applyDragResult(draggedNodes);
    },
    [applyDragResult],
  );

  // onNodeDrag 不写回状态（中间态不入栈），仅作为 placeholder 暴露
  // 后续可在 onNodeDrag 中通过 ref 暴露吸附线信息给 UI 渲染（M2）
  const onNodeDrag = useCallback<OnNodeDrag>(() => {
    // 拖拽中间态不更新 nodes，避免每帧 setState 与历史膨胀
    // 吸附线展示可由独立 Overlay 组件订阅 onNodeDrag 计算（不在本 hook 范围）
  }, []);

  return { onNodeDragStop, onNodeDrag };
}
