import { create } from 'zustand';
import { memo } from 'react';

import type { AlignmentLine, AlignmentRect } from '../lib/smart-guides';

interface AlignmentLinesState {
  lines: AlignmentLine[];
  movedRect: AlignmentRect | null;
  setLines: (lines: AlignmentLine[], movedRect: AlignmentRect | null) => void;
  clear: () => void;
}

/**
 * 独立的 Smart Guides 状态 store。
 *
 * 与 DimensionTooltip 的 useDimensionStore 同模式：将拖拽过程中的对齐线
 * 数据从画布主组件中剥离，避免 onDrag 高频回调触发整个画布重渲染导致拖拽抖动。
 *
 * ScreenCanvas 仅获取 setLines / clear（稳定函数引用），不订阅 lines 值。
 * SmartGuidesOverlay 直接订阅 lines，自行重渲染。
 */
export const useAlignmentLinesStore = create<AlignmentLinesState>((set) => ({
  lines: [],
  movedRect: null,
  setLines: (lines, movedRect) => set({ lines, movedRect }),
  clear: () => set({ lines: [], movedRect: null }),
}));

interface SmartGuidesOverlayProps {
  /** 画布宽度（用于水平线长度，画布坐标系） */
  canvasWidth: number;
  /** 画布高度（用于垂直线长度，画布坐标系） */
  canvasHeight: number;
}

/**
 * 智能对齐线浮层（Canvas Rendering Component）。
 *
 * 在画布坐标系内绘制虚线辅助线 + 距离标签，提示用户当前可对齐的参考位置。
 * 直接订阅 useAlignmentLinesStore，避免 ScreenCanvas 在拖拽过程中重渲染。
 *
 * **不使用 shadcn/ui** —— 该组件在画布渲染层渲染，必须保持样式纯净，
 * 避免与用户可配置的组件样式冲突。仅使用 Tailwind 工具类 + 内联 style。
 *
 * 对应 spec.md 的"直接操作反馈层"。
 */
export const SmartGuidesOverlay = memo(function SmartGuidesOverlay({
  canvasWidth,
  canvasHeight,
}: SmartGuidesOverlayProps) {
  const lines = useAlignmentLinesStore((s) => s.lines);
  const movedRect = useAlignmentLinesStore((s) => s.movedRect);

  if (lines.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50" aria-hidden="true">
      {lines.map((line, index) => {
        const isSnappable = line.distance < 3;
        const lineColor = isSnappable ? 'rgb(236 72 153)' : 'rgb(236 72 153 / 0.7)';

        if (line.axis === 'horizontal') {
          return (
            <div
              key={`h-${index}-${line.position.toFixed(1)}`}
              className="absolute"
              style={{
                left: 0,
                top: line.position - 0.5,
                width: Math.max(canvasWidth, 1),
                height: 1,
                borderTop: `1px dashed ${lineColor}`,
              }}
            >
              {line.distance > 0 && movedRect && (
                <DistanceLabel
                  distance={line.distance}
                  axis="horizontal"
                  movedRect={movedRect}
                  linePosition={line.position}
                />
              )}
            </div>
          );
        }
        return (
          <div
            key={`v-${index}-${line.position.toFixed(1)}`}
            className="absolute"
            style={{
              left: line.position - 0.5,
              top: 0,
              width: 1,
              height: Math.max(canvasHeight, 1),
              borderLeft: `1px dashed ${lineColor}`,
            }}
          >
            {line.distance > 0 && movedRect && (
              <DistanceLabel
                distance={line.distance}
                axis="vertical"
                movedRect={movedRect}
                linePosition={line.position}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

interface DistanceLabelProps {
  distance: number;
  axis: 'horizontal' | 'vertical';
  movedRect: AlignmentRect;
  linePosition: number;
}

/**
 * 距离标签：在对齐线一端显示与参考组件的距离（px）。
 * 仅当 distance > 0 时渲染（完全重合时不需要距离标签）。
 */
function DistanceLabel({ distance, axis, movedRect, linePosition }: DistanceLabelProps) {
  const roundedDistance = Math.round(distance * 10) / 10;
  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    padding: '1px 4px',
    fontSize: 10,
    fontFamily: 'ui-monospace, monospace',
    color: 'white',
    background: 'rgb(236 72 153 / 0.9)',
    borderRadius: 2,
    whiteSpace: 'nowrap',
  };

  if (axis === 'horizontal') {
    const labelX = movedRect.x + movedRect.width + 4;
    const labelY = linePosition - 8;
    return <span style={{ ...labelStyle, left: labelX, top: labelY }}>{roundedDistance}px</span>;
  }

  const labelX = linePosition + 4;
  const labelY = movedRect.y + movedRect.height + 4;
  return <span style={{ ...labelStyle, left: labelX, top: labelY }}>{roundedDistance}px</span>;
}
