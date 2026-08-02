/**
 * 执行流边渲染（任务 4.3）
 *
 * ExecEdge 是事件蓝图编辑器中执行流的统一边样式：
 * - 平滑贝塞尔曲线（React Flow 默认 BezierEdge）
 * - 带方向箭头（markerEnd）
 * - hover 态：描边加深，提示可点选
 * - 选中态：蓝色高亮 + 加粗，中点浮出「删除连线」按钮（点击即删）
 * - 模拟调试态（M2）：animated=true 时显示流动虚线
 *
 * 设计要点：
 * - 不在边渲染层做兼容判定（由 React Flow isValidConnection 回调处理）
 * - 边选中态由 React Flow 通过 selected prop 注入
 * - 删除通过 useReactFlow().deleteElements 触发，走标准 onEdgesChange 链路，
 *   不需要额外接线
 */

import type { JSX, MouseEvent } from 'react';
import type { Edge, EdgeMarker, EdgeProps } from '@xyflow/react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';
import { X } from 'lucide-react';

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
  const { deleteElements } = useReactFlow();

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

  // 默认颜色 slate-400（深色主题），hover 加深；选中态 blue-500
  const strokeClass = selected
    ? 'stroke-blue-500'
    : 'stroke-slate-400 transition-[stroke] duration-150 hover:stroke-slate-600 dark:hover:stroke-slate-300';
  const strokeWidth = selected ? 2.5 : 1.5;

  const handleDelete = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    void deleteElements({ edges: [{ id }] });
  };

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
        {/* 选中态下在边中点浮出删除按钮 */}
        {selected && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
            data-testid="exec-edge-label"
            data-edge-id={id}
          >
            <button
              type="button"
              aria-label="删除连线"
              title="删除连线"
              className="flex size-5 cursor-pointer items-center justify-center rounded-full border border-blue-500/50 bg-background text-blue-500 shadow-md transition-colors hover:bg-blue-500 hover:text-white"
              onClick={handleDelete}
            >
              <X className="size-3" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
