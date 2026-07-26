/**
 * 执行流边渲染（任务 4.3）
 *
 * ExecEdge 是事件蓝图编辑器中执行流的统一边样式：
 * - 平滑贝塞尔曲线（React Flow 默认 BezierEdge）
 * - 带方向箭头（markerEnd）
 * - 选中态：蓝色高亮 + 加粗
 * - 默认态：slate 灰色（与编辑器深色主题一致）
 * - 模拟调试态（M2）：animated=true 时显示流动光点
 *
 * 设计要点：
 * - 不在边渲染层做兼容判定（由 React Flow isValidConnection 回调处理）
 * - 边选中态由 React Flow 通过 selected prop 注入
 */

import type { JSX } from 'react';
import type { Edge, EdgeMarker, EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';

/** 执行流边 data（M2 模拟调试时通过 data 注入 animated 标志） */
export interface ExecEdgeData extends Record<string, unknown> {
  /** 是否在模拟调试中（启用流动虚线动画） */
  animated?: boolean;
}

/**
 * 执行流边统一方向箭头（创建/转换边时赋给 edge.markerEnd）。
 *
 * ReactFlow 会扫描所有边的 markerEnd 并自动渲染 SVG marker defs，
 * 自定义边组件内通过 markerEnd prop 接收处理后的 url 引用。
 * 颜色与默认描边 slate-400（#94a3b8）保持一致。
 */
export const EXEC_EDGE_MARKER_END: EdgeMarker = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
  color: '#94a3b8',
};

/** React Flow 执行流边类型实例 */
export type ExecEdge = Edge<ExecEdgeData, 'exec'>;

/** 执行流边渲染组件 */
export function ExecEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  markerEnd,
}: EdgeProps<ExecEdge>): JSX.Element {
  // 是否在模拟调试中（M2 通过 data 注入）
  const animated = Boolean(data?.animated);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 默认颜色 slate-400（深色主题），选中态 blue-500
  const strokeClass = selected ? 'stroke-blue-500' : 'stroke-slate-400';
  const strokeWidth = selected ? 2.5 : 1.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={strokeClass}
        style={{
          strokeWidth,
          ...(animated ? { strokeDasharray: '5 5' } : null),
        }}
      />
      <EdgeLabelRenderer>
        {/* 选中态下在边中点显示删除按钮（M2 可扩展） */}
        {selected && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white shadow"
            data-testid="exec-edge-label"
            data-edge-id={id}
          >
            exec
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
