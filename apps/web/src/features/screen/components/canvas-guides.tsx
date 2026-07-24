import { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useScreenEditorStore } from '../stores/editor-store';

const RULER_SIZE = 20;
/** 参考线拖出画布外多少距离后删除（屏幕像素） */
const REMOVE_THRESHOLD = 30;

/**
 * rendering-hoist-jsx：参考线 style 的静态部分提升到模块级。
 *
 * 原实现每次参考线 map 渲染都新建完整 style 对象，静态字段（top/bottom/width/
 * backgroundColor 等）每次都重新序列化。拆分后 spread 合并，静态字段引用稳定，
 * 仅动态字段（left/top 位置、pointerEvents 状态）每次计算。
 */
const VERTICAL_GUIDE_BASE_STYLE: CSSProperties = {
  top: RULER_SIZE,
  bottom: 0,
  width: 1,
  backgroundColor: 'rgb(56 132 209)',
};
const HORIZONTAL_GUIDE_BASE_STYLE: CSSProperties = {
  left: RULER_SIZE,
  right: 0,
  height: 1,
  backgroundColor: 'rgb(56 132 209)',
};
const VERTICAL_GUIDE_HIT_AREA_STYLE: CSSProperties = { left: -3, width: 7 };
const HORIZONTAL_GUIDE_HIT_AREA_STYLE: CSSProperties = { top: -3, height: 7 };
const PREVIEW_VERTICAL_BASE_STYLE: CSSProperties = {
  top: RULER_SIZE,
  bottom: 0,
  width: 1,
  backgroundColor: 'rgb(56 132 209)',
  opacity: 0.5,
};
const PREVIEW_HORIZONTAL_BASE_STYLE: CSSProperties = {
  left: RULER_SIZE,
  right: 0,
  height: 1,
  backgroundColor: 'rgb(56 132 209)',
  opacity: 0.5,
};

/**
 * 安全地设置指针捕获。
 *
 * 指针已不活跃时（同步 pointerup、触摸指针被系统取消等）setPointerCapture
 * 抛出 NotFoundError。参考线拖拽依赖 window 级 pointermove/pointerup 监听，
 * 捕获失败不影响拖拽主流程，降级为静默失败。
 */
function trySetPointerCapture(target: EventTarget, pointerId: number): void {
  if (!(target instanceof HTMLElement)) return;
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // 指针已不活跃：忽略，拖拽由 window 监听继续
  }
}

/**
 * 屏幕坐标 → 画布坐标换算（纯函数，导出供单元测试）。
 *
 * 几何约定（与 screen-editor 布局一致）：
 * - containerRef 指向含标尺的外层容器，标尺占据左/上各 RULER_SIZE px
 * - 画布内容在外层容器中的起点为 (RULER_SIZE + canvasOffset.x, RULER_SIZE + canvasOffset.y)
 * - 渲染参考线时 screenPos = RULER_SIZE + canvasOffset + canvasPos * scale（见下方渲染代码）
 *
 * 因此逆换算必须同时减去 RULER_SIZE 与 canvasOffset 再除以 scale。
 * 历史 bug：漏减 RULER_SIZE，导致拖拽参考线落点比鼠标位置偏移 20/scale 画布单位
 *（scale=1 时偏差 20 屏幕像素，缩放越小说差越大）。
 */
export function screenToCanvasPosition(
  screenX: number,
  screenY: number,
  containerRect: { readonly left: number; readonly top: number },
  canvasOffset: { readonly x: number; readonly y: number },
  canvasScale: number,
): { x: number; y: number } {
  return {
    x: (screenX - containerRect.left - RULER_SIZE - canvasOffset.x) / canvasScale,
    y: (screenY - containerRect.top - RULER_SIZE - canvasOffset.y) / canvasScale,
  };
}

type Orientation = 'vertical' | 'horizontal';

interface DraggingState {
  orientation: Orientation;
  /** -1 表示正在从标尺新建，>=0 表示拖动已有参考线的索引 */
  index: number;
  /** 起始屏幕坐标 */
  startScreen: number;
}

interface CanvasGuidesProps {
  /** 画布容器（含标尺），用于计算坐标和监听标尺拖出 */
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * 画布参考线层。
 *
 * 坐标约定：
 * - store 中存储画布坐标系值（原点画布左上角）
 * - 渲染时通过 screenPos = canvasPos * scale + offset + RULER_SIZE 转换为屏幕坐标
 * - 标尺区域 RULER_SIZE px 内为"拖出参考线"的触发区
 */
export function CanvasGuides({ containerRef, canvasWidth, canvasHeight }: CanvasGuidesProps) {
  const guides = useScreenEditorStore((s) => s.guides);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const canvasOffset = useScreenEditorStore((s) => s.canvasOffset);
  const addGuide = useScreenEditorStore((s) => s.addGuide);
  const updateGuide = useScreenEditorStore((s) => s.updateGuide);
  const removeGuide = useScreenEditorStore((s) => s.removeGuide);

  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [hoverPos, setHoverPos] = useState<{ orientation: Orientation; pos: number } | null>(null);
  const dragStateRef = useRef<DraggingState | null>(null);

  // 同步 dragging 到 ref，方便在 window 监听里取最新值
  useEffect(() => {
    dragStateRef.current = dragging;
  }, [dragging]);

  /** 屏幕坐标 → 画布坐标 */
  const toCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      return screenToCanvasPosition(screenX, screenY, rect, canvasOffset, canvasScale);
    },
    [containerRef, canvasOffset, canvasScale],
  );

  /** 处理标尺区域的 pointerdown —— 从标尺拖出参考线 */
  const handleRulerPointerDown = useCallback(
    (orientation: Orientation) => (e: React.PointerEvent) => {
      if (guides.locked) return;
      e.preventDefault();
      e.stopPropagation();
      trySetPointerCapture(e.target, e.pointerId);
      const startScreen = orientation === 'vertical' ? e.clientX : e.clientY;
      setDragging({ orientation, index: -1, startScreen });
    },
    [guides.locked],
  );

  /** 处理已有参考线的 pointerdown —— 拖动/删除 */
  const handleGuidePointerDown = useCallback(
    (orientation: Orientation, index: number) => (e: React.PointerEvent) => {
      if (guides.locked) return;
      e.preventDefault();
      e.stopPropagation();
      trySetPointerCapture(e.target, e.pointerId);
      const startScreen = orientation === 'vertical' ? e.clientX : e.clientY;
      setDragging({ orientation, index, startScreen });
    },
    [guides.locked],
  );

  /** 双击参考线删除 */
  const handleGuideDoubleClick = useCallback(
    (orientation: Orientation, index: number) => () => {
      removeGuide(orientation, index);
    },
    [removeGuide],
  );

  /** 全局 pointermove：拖出/拖动参考线 */
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const canvasPos = state.orientation === 'vertical' ? x : y;
      const screenPos = state.orientation === 'vertical' ? e.clientX : e.clientY;

      // 拖动过程中显示 hover 提示位置
      setHoverPos({ orientation: state.orientation, pos: canvasPos });

      // 拖动已有参考线：实时更新位置
      if (state.index >= 0) {
        // 判断是否拖出画布外（屏幕坐标系）
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const relative =
            state.orientation === 'vertical' ? screenPos - rect.left : screenPos - rect.top;
          // 超出容器边界（含标尺）一定距离则删除
          if (
            relative < RULER_SIZE - REMOVE_THRESHOLD ||
            relative > rect.width + REMOVE_THRESHOLD
          ) {
            removeGuide(state.orientation, state.index);
            setDragging(null);
            return;
          }
        }
        updateGuide(state.orientation, state.index, Math.round(canvasPos));
      }
    };

    const handleUp = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const canvasPos = Math.round(state.orientation === 'vertical' ? x : y);

      // 从标尺新建：松开时如果在画布范围内则创建
      if (state.index === -1) {
        if (
          canvasPos >= 0 &&
          canvasPos <= (state.orientation === 'vertical' ? canvasWidth : canvasHeight)
        ) {
          addGuide(state.orientation, canvasPos);
        }
      } else {
        // 拖动已有：最终位置由 updateGuide 已处理
      }
      setDragging(null);
      setHoverPos(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [
    dragging,
    toCanvas,
    containerRef,
    canvasWidth,
    canvasHeight,
    addGuide,
    updateGuide,
    removeGuide,
  ]);

  if (!guides.visible) return null;

  // 计算画布在容器中的屏幕位置（左上角）
  const canvasScreenLeft = canvasOffset.x + RULER_SIZE;
  const canvasScreenTop = canvasOffset.y + RULER_SIZE;

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {/* 标尺拖出热区：仅在未锁定时启用 */}
      {!guides.locked && (
        <>
          {/* 顶部标尺热区（拖出水平参考线） */}
          <div
            className="pointer-events-auto absolute cursor-ns-resize"
            style={{ left: RULER_SIZE, right: 0, top: 0, height: RULER_SIZE }}
            onPointerDown={handleRulerPointerDown('horizontal')}
          />
          {/* 左侧标尺热区（拖出垂直参考线） */}
          <div
            className="pointer-events-auto absolute cursor-ew-resize"
            style={{ top: RULER_SIZE, bottom: 0, left: 0, width: RULER_SIZE }}
            onPointerDown={handleRulerPointerDown('vertical')}
          />
        </>
      )}

      {/* 已有参考线 */}
      {guides.vertical.map((pos, i) => {
        const screenX = canvasScreenLeft + pos * canvasScale;
        const isDragging = dragging?.orientation === 'vertical' && dragging.index === i;
        return (
          <div
            key={`v-${pos}-${i}`}
            className={`pointer-events-auto absolute cursor-ew-resize ${
              isDragging ? 'opacity-100' : 'opacity-90'
            }`}
            style={{
              ...VERTICAL_GUIDE_BASE_STYLE,
              left: screenX,
              pointerEvents: guides.locked ? 'none' : 'auto',
            }}
            onPointerDown={handleGuidePointerDown('vertical', i)}
            onDoubleClick={handleGuideDoubleClick('vertical', i)}
          >
            {/* 加宽点击热区 */}
            <div className="absolute inset-y-0" style={VERTICAL_GUIDE_HIT_AREA_STYLE} />
          </div>
        );
      })}

      {guides.horizontal.map((pos, i) => {
        const screenY = canvasScreenTop + pos * canvasScale;
        const isDragging = dragging?.orientation === 'horizontal' && dragging.index === i;
        return (
          <div
            key={`h-${pos}-${i}`}
            className={`pointer-events-auto absolute cursor-ns-resize ${
              isDragging ? 'opacity-100' : 'opacity-90'
            }`}
            style={{
              ...HORIZONTAL_GUIDE_BASE_STYLE,
              top: screenY,
              pointerEvents: guides.locked ? 'none' : 'auto',
            }}
            onPointerDown={handleGuidePointerDown('horizontal', i)}
            onDoubleClick={handleGuideDoubleClick('horizontal', i)}
          >
            <div className="absolute inset-x-0" style={HORIZONTAL_GUIDE_HIT_AREA_STYLE} />
          </div>
        );
      })}

      {/* 拖动从标尺新建时的预览线 */}
      {hoverPos && dragging?.index === -1 && (
        <>
          {hoverPos.orientation === 'vertical' && (
            <div
              className="absolute"
              style={{
                ...PREVIEW_VERTICAL_BASE_STYLE,
                left: canvasScreenLeft + hoverPos.pos * canvasScale,
              }}
            />
          )}
          {hoverPos.orientation === 'horizontal' && (
            <div
              className="absolute"
              style={{
                ...PREVIEW_HORIZONTAL_BASE_STYLE,
                top: canvasScreenTop + hoverPos.pos * canvasScale,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
