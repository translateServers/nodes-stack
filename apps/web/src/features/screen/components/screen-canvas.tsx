import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { useModifierKeys } from '../hooks/use-modifier-keys';
import { resolveComponentContainerStyle } from '../registry/component-container-style';
import { ComponentRenderer } from '../registry/renderer';
import { handleSelectEnd, zoomAtPoint, type ClickRecord } from '../lib/canvas-event-router';
import { findAlignmentLines, snapPosition, type AlignmentRect } from '../lib/smart-guides';
import { SmartGuidesOverlay, useAlignmentLinesStore } from './smart-guides-overlay';

interface DimensionInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  visible: boolean;
  /** 模式提示（如 Alt 中心变换），空时不显示 */
  mode?: string;
}

/**
 * Moveable 事件 datas 袋的类型化描述。
 *
 * react-moveable 0.56 中 `e.datas` 类型为 `IObject<any>`、`e.lastEvent` 为 `any`，
 * 直接读取会触发 `@typescript-eslint/no-unsafe-*` 系列规则。这里以 interface
 * 形式声明各 handler 写入 / 读取的字段，handler 内统一通过 `as unknown as` 单点
 * 转换后访问，避免 `any` 在调用链中扩散。
 */
interface DragDatas {
  id: string;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  isAltCopy: boolean;
}

interface ResizeDatas {
  id: string;
  origW: number;
  origH: number;
  origX: number;
  origY: number;
  keepRatio: boolean;
  isAltCenter: boolean;
}

interface RotateDatas {
  id: string;
  snapRotate: boolean;
}

interface GroupDragDatas {
  ids: string[];
}

/** OnDragEnd / OnResizeEnd 中 `e.lastEvent` 的最小形状（left/top/width/height/isDrag） */
interface MoveableLastEvent {
  left: number;
  top: number;
  width?: number;
  height?: number;
  isDrag: boolean;
}

/**
 * 从 Moveable 的 `e.target`（HTMLElement | SVGElement）中提取 data-component-id。
 *
 * react-moveable 的 target 类型包含 SVGElement，但画布组件一律为 HTMLDivElement，
 * 通过类型守卫收敛到 HTMLElement 后再向上查找，避免对 SVGElement 调用 getAttribute
 * 时行为差异（实际两者都支持，但收敛类型让 TS 更安全）。
 */
function getComponentIdFromTarget(target: HTMLElement | SVGElement): string | null {
  let current: Element | null = target;
  while (current) {
    const id = current.getAttribute('data-component-id');
    if (id) return id;
    current = current.parentElement;
  }
  return null;
}

/** 安全读取 inputEvent 的 altKey，兼容 MouseEvent / PointerEvent / TouchEvent */
function readAltKey(inputEvent: unknown): boolean {
  if (inputEvent && typeof inputEvent === 'object' && 'altKey' in inputEvent) {
    return inputEvent.altKey === true;
  }
  return false;
}

const initialDimension: DimensionInfo = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  rotate: 0,
  visible: false,
  mode: undefined,
};

/**
 * 独立的 dimension 状态 store。
 * 将拖拽过程中的尺寸/位置提示信息从画布主组件中剥离，
 * 避免 onDrag 高频回调触发整个画布重渲染导致拖拽抖动。
 */
const useDimensionStore = create<{
  dimension: DimensionInfo;
  setDimension: (updater: (d: DimensionInfo) => DimensionInfo) => void;
}>((set) => ({
  dimension: initialDimension,
  setDimension: (updater) => set((state) => ({ dimension: updater(state.dimension) })),
}));

/** 尺寸/位置提示浮层，仅订阅 dimension store，不随画布重渲染 */
const DimensionTooltip = memo(function DimensionTooltip() {
  const dimension = useDimensionStore((s) => s.dimension);
  if (!dimension.visible) return null;
  return (
    <div
      className="pointer-events-none fixed z-[9999] rounded bg-black/80 px-2 py-1 font-mono text-xs text-white"
      style={{ left: 10, bottom: 10 }}
    >
      X:{dimension.x}px Y:{dimension.y}px
      {dimension.w > 0 && ` W:${dimension.w}px`}
      {dimension.h > 0 && ` H:${dimension.h}px`}
      {dimension.rotate !== 0 && ` R:${dimension.rotate}°`}
      {dimension.mode && ` [${dimension.mode}]`}
    </div>
  );
});

interface ActiveGroupOutlineProps {
  groupId: string | null;
  components: ScreenComponent[];
}

/**
 * 活动分组包围盒：当 activeGroupId 被设置时（用户已双击进入分组），
 * 在画布上以虚线框高亮当前分组所有成员的并集包围盒，提示用户"正在编辑此分组内部"。
 */
const ActiveGroupOutline = memo(function ActiveGroupOutline({
  groupId,
  components,
}: ActiveGroupOutlineProps) {
  if (!groupId) return null;
  const siblings = components.filter((c) => c.parentId === groupId);
  if (siblings.length === 0) return null;
  const minX = Math.min(...siblings.map((c) => c.position.x));
  const minY = Math.min(...siblings.map((c) => c.position.y));
  const maxX = Math.max(...siblings.map((c) => c.position.x + c.position.width));
  const maxY = Math.max(...siblings.map((c) => c.position.y + c.position.height));
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: minX - 4,
        top: minY - 4,
        width: maxX - minX + 8,
        height: maxY - minY + 8,
        border: '1.5px dashed rgb(59 130 246 / 0.7)',
        borderRadius: 4,
      }}
    />
  );
});

interface CanvasComponentWrapperProps {
  component: ScreenComponent;
  selected: boolean;
  showBorderGuides: boolean;
  registerRef: (id: string, el: HTMLElement | null) => void;
}

/**
 * Memo 化的画布组件容器。
 * 拖拽过程中 Moveable 直接操作 DOM style，若父组件重渲染导致此处重新渲染，
 * React 的 style 对象 diff 会覆盖 Moveable 的直接 DOM 操作，造成视觉抖动。
 * 通过 memo 确保仅在 component 数据实际变化时才重新渲染。
 */
const CanvasComponentWrapper = memo(function CanvasComponentWrapper({
  component,
  selected,
  showBorderGuides,
  registerRef,
}: CanvasComponentWrapperProps) {
  return (
    <div
      ref={(el) => registerRef(component.id, el)}
      data-component-id={component.id}
      className="absolute"
      style={{
        ...resolveComponentContainerStyle(component),
        // 编辑器专用叠加：未选中态下显示辅助边框；选中态由 Moveable 控制点接管
        outline: showBorderGuides && !selected ? '1px dashed rgba(147, 197, 253, 0.5)' : undefined,
      }}
    >
      <ComponentRenderer component={component} />
    </div>
  );
});

export function ScreenCanvas({
  onDrop,
  onDragOver,
}: {
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const project = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const canvasOffset = useScreenEditorStore((s) => s.canvasOffset);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const showBorderGuides = useScreenEditorStore((s) => s.showBorderGuides);
  const selectComponents = useScreenEditorStore((s) => s.selectComponents);
  const clearSelection = useScreenEditorStore((s) => s.clearSelection);
  const activeGroupId = useScreenEditorStore((s) => s.activeGroupId);
  const setActiveGroupId = useScreenEditorStore((s) => s.setActiveGroupId);
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);
  const updateComponentsBatch = useScreenEditorStore((s) => s.updateComponentsBatch);
  // Alt+拖拽复制（适配表 #12）：onDragEnd 时调用，复制选中到光标位置
  const duplicateSelectedToPosition = useScreenEditorStore((s) => s.duplicateSelectedToPosition);
  const setCanvasScaleAndOffset = useScreenEditorStore((s) => s.setCanvasScaleAndOffset);
  const guides = useScreenEditorStore((s) => s.guides);
  const snapEnabled = useScreenEditorStore((s) => s.snapEnabled);
  const smartGuidesEnabled = useScreenEditorStore((s) => s.smartGuidesEnabled);
  const gridEnabled = useScreenEditorStore((s) => s.gridEnabled);
  const gridSize = useScreenEditorStore((s) => s.gridSize);

  // 从独立 store 获取 setDimension，避免拖拽高频回调触发画布重渲染
  const setDimension = useDimensionStore((s) => s.setDimension);
  // Smart Guides：从独立 store 获取 setLines / clear，避免 onDrag 高频回调触发画布重渲染
  const setAlignmentLines = useAlignmentLinesStore((s) => s.setLines);
  const clearAlignmentLines = useAlignmentLinesStore((s) => s.clear);

  const componentRefs = useRef<Map<string, HTMLElement>>(new Map());
  const moveableRef = useRef<Moveable>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // 手动双击检测：Selecto 在 click 事件上调用 preventDefault 会抑制原生 dblclick，
  // 因此这里记录上一次单击的 componentId 与时间戳，自行判定双击。
  const lastClickRef = useRef<ClickRecord | null>(null);
  const panState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  const [isPanning, setIsPanning] = useState(false);
  // 修饰键状态由 useModifierKeys 集中管理（替换原独立的 keydown/keyup 监听）
  // spaceHeld 重命名为 spaceHeldUI 保持原 UI 状态语义
  // altHeld 用于切换 copy 光标（Alt+拖拽复制，适配表 #12）
  const { spaceRef, shiftRef, spaceHeld: spaceHeldUI, shiftHeld, altHeld } = useModifierKeys();

  /** 稳定的 ref 注册回调，避免作为 prop 传入 memo 组件时引起重渲染 */
  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) componentRefs.current.set(id, el);
    else componentRefs.current.delete(id);
  }, []);

  /** 选中 ID 集合，O(1) 查询选中状态 */
  const selectedIdSet = useMemo(() => new Set(selectedComponentIds), [selectedComponentIds]);

  /**
   * Memo 化 targets 数组。
   * 依赖包含 project?.components：新增组件并立即选中时，selectedComponentIds 可能
   * 先于 ref 注册变化，加入 components 依赖可在组件挂载后再次重算 targets。
   */
  const targets = useMemo(
    () =>
      selectedComponentIds
        .map((id) => componentRefs.current.get(id))
        .filter((el): el is HTMLElement => el != null),
    [selectedComponentIds, project?.components],
  );

  useEffect(() => {
    if (moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [selectedComponentIds, project?.components]);

  const handlePanStart = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !spaceRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: canvasOffset.x,
        origY: canvasOffset.y,
      };
    },
    [canvasOffset],
  );

  const handlePanMove = useCallback(
    (e: React.PointerEvent) => {
      if (!panState.current) return;
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      setCanvasScaleAndOffset(canvasScale, {
        x: panState.current.origX + dx,
        y: panState.current.origY + dy,
      });
    },
    [canvasScale, setCanvasScaleAndOffset],
  );

  const handlePanEnd = useCallback((e: React.PointerEvent) => {
    if (!panState.current) return;
    panState.current = null;
    setIsPanning(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // 缩放手势：Alt+滚轮（原有）或 Ctrl/Cmd+滚轮（主流编辑器习惯）
      // 拦截浏览器原生页面缩放
      const isZoomGesture = e.altKey || e.ctrlKey || e.metaKey;
      if (!isZoomGesture) return;
      e.preventDefault();
      const state = useScreenEditorStore.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      // 计算原始 factor 并对最终 scale 做 [0.1, 5] 边界限制，
      // 用 clampedScale / canvasScale 得到实际 factor，确保 offset 与 scale 一致
      const rawFactor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      const rawNewScale = state.canvasScale * rawFactor;
      const clampedScale = Math.min(5, Math.max(0.1, rawNewScale));
      const actualFactor = clampedScale / state.canvasScale;
      const result = zoomAtPoint({
        currentScale: state.canvasScale,
        currentOffset: state.canvasOffset,
        cursorX,
        cursorY,
        factor: actualFactor,
      });
      setCanvasScaleAndOffset(result.scale, result.offset);
      // TODO: Z 工具点击放大接入点：复用 zoomAtPoint 计算，factor 固定 1.5
      // TODO: Ctrl+= / Ctrl+- 快捷键接入点：复用 zoomAtPoint，factor 1.1 / 1/1.1
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setCanvasScaleAndOffset, project]);

  const components = project?.components ?? [];
  const canvas = project?.canvas;

  /**
   * Memo 化可见组件列表（过滤 + 按 zIndex 排序）。
   * 避免每次渲染都重新 filter+sort 产生新数组与新 component 引用，
   * 否则会使 CanvasComponentWrapper 的 memo 失效。
   */
  const visibleComponents = useMemo(
    () =>
      components
        .filter((c: ScreenComponent) => !c.status.hidden)
        .sort((a: ScreenComponent, b: ScreenComponent) => a.zIndex - b.zIndex),
    [components],
  );

  /**
   * 根据画布尺寸与 gridSize 生成网格线坐标数组（数值数组）。
   * 当 gridEnabled=true 时合并到 Moveable guidelines 中作为吸附目标。
   * 仅包含 [0, canvas.width/height] 区间内的整数倍 gridSize 点。
   */
  const gridVerticalLines = useMemo<number[]>(() => {
    if (!canvas || !gridEnabled || gridSize < 1) return [];
    const lines: number[] = [];
    for (let x = gridSize; x < canvas.width; x += gridSize) {
      lines.push(x);
    }
    return lines;
  }, [canvas, gridEnabled, gridSize]);
  const gridHorizontalLines = useMemo<number[]>(() => {
    if (!canvas || !gridEnabled || gridSize < 1) return [];
    const lines: number[] = [];
    for (let y = gridSize; y < canvas.height; y += gridSize) {
      lines.push(y);
    }
    return lines;
  }, [canvas, gridEnabled, gridSize]);

  /** Memo 化 Moveable 的 snap 参考线，避免每次渲染产生新数组引用触发 Moveable 内部重算 */
  const verticalGuidelines = useMemo(
    () =>
      canvas
        ? [
            '0',
            `${canvas.width}`,
            ...(guides.visible ? guides.vertical.map(String) : []),
            ...(gridEnabled ? gridVerticalLines.map(String) : []),
          ]
        : [],
    [canvas, guides.visible, guides.vertical, gridEnabled, gridVerticalLines],
  );
  const horizontalGuidelines = useMemo(
    () =>
      canvas
        ? [
            '0',
            `${canvas.height}`,
            ...(guides.visible ? guides.horizontal.map(String) : []),
            ...(gridEnabled ? gridHorizontalLines.map(String) : []),
          ]
        : [],
    [canvas, guides.visible, guides.horizontal, gridEnabled, gridHorizontalLines],
  );

  /**
   * Smart Guides 参考矩形数组：所有可见且未选中的组件位置（画布坐标系）。
   * 在 onDrag 中用于 findAlignmentLines 计算，避免每次拖拽都重新 filter。
   * 排除当前选中的组件（自身不需要与自己对齐）。
   */
  const smartGuidesReferenceRects = useMemo<AlignmentRect[]>(
    () =>
      visibleComponents
        .filter((c: ScreenComponent) => !selectedIdSet.has(c.id))
        .map((c: ScreenComponent) => ({
          x: c.position.x,
          y: c.position.y,
          width: c.position.width,
          height: c.position.height,
          id: c.id,
        })),
    [visibleComponents, selectedIdSet],
  );

  /**
   * 在拖拽过程中计算并更新 Smart Guides 对齐线，并返回吸附后的坐标。
   * 仅当 smartGuidesEnabled 为 true 且有参考组件时计算。
   * 返回的 snappedLeft / snappedTop 为吸附后坐标（若无可吸附线则等于输入值）。
   */
  const updateAlignmentLines = useCallback(
    (
      movedX: number,
      movedY: number,
      movedW: number,
      movedH: number,
    ): { snappedLeft: number; snappedTop: number } => {
      if (!smartGuidesEnabled || smartGuidesReferenceRects.length === 0) {
        if (useAlignmentLinesStore.getState().lines.length > 0) {
          clearAlignmentLines();
        }
        return { snappedLeft: movedX, snappedTop: movedY };
      }
      const movedRect: AlignmentRect = {
        x: movedX,
        y: movedY,
        width: movedW,
        height: movedH,
      };
      const lines = findAlignmentLines(movedRect, smartGuidesReferenceRects);
      // 吸附：对距离 < 3px 的对齐线应用吸附
      const snapped = snapPosition(movedX, movedY, movedW, movedH, lines);
      // 更新 overlay 中显示的 movedRect 为吸附后位置，保持辅助线与实际位置同步
      const snappedRect: AlignmentRect = {
        x: snapped.left,
        y: snapped.top,
        width: movedW,
        height: movedH,
      };
      // 重新计算吸附后的对齐线（使 distance=0 的吸附线高亮显示）
      const snappedLines = findAlignmentLines(snappedRect, smartGuidesReferenceRects);
      setAlignmentLines(snappedLines, snappedRect);
      return { snappedLeft: snapped.left, snappedTop: snapped.top };
    },
    [smartGuidesEnabled, smartGuidesReferenceRects, setAlignmentLines, clearAlignmentLines],
  );

  if (!project || !canvas) return null;

  const isGroupSelect = selectedComponentIds.length > 1;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-muted"
      style={{
        cursor: isPanning ? 'grabbing' : spaceHeldUI ? 'grab' : altHeld ? 'copy' : undefined,
      }}
      onPointerDown={handlePanStart}
      onPointerMove={handlePanMove}
      onPointerUp={handlePanEnd}
    >
      <div
        className="absolute"
        style={{
          transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${canvasScale})`,
          transformOrigin: 'top left',
        }}
      >
        <div
          ref={contentRef}
          className="relative"
          style={{
            width: canvas.width,
            height: canvas.height,
            backgroundColor: canvas.backgroundColor,
            backgroundImage: canvas.backgroundImage ? `url(${canvas.backgroundImage})` : undefined,
            backgroundSize: 'cover',
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              // 点击空白画布：退出当前活动分组并清空选中
              if (activeGroupId !== null) {
                setActiveGroupId(null);
              }
              clearSelection();
            }
          }}
        >
          {visibleComponents.map((component: ScreenComponent) => (
            <CanvasComponentWrapper
              key={component.id}
              component={component}
              selected={selectedIdSet.has(component.id)}
              showBorderGuides={showBorderGuides}
              registerRef={registerRef}
            />
          ))}

          {/* 活动分组包围盒：双击进入分组后高亮 */}
          <ActiveGroupOutline groupId={activeGroupId} components={visibleComponents} />

          {/* Smart Guides 智能对齐线浮层 */}
          <SmartGuidesOverlay canvasWidth={canvas.width} canvasHeight={canvas.height} />
        </div>

        <Moveable
          ref={moveableRef}
          target={targets}
          container={contentRef.current}
          draggable
          resizable
          rotatable
          snappable={snapEnabled || gridEnabled}
          keepRatio={shiftHeld}
          throttleRotate={shiftHeld ? 15 : 0}
          hideChildMoveableDefaultLines={isGroupSelect}
          snapDirections={{
            top: true,
            bottom: true,
            left: true,
            right: true,
            center: true,
            middle: true,
          }}
          elementSnapDirections={{
            top: true,
            bottom: true,
            left: true,
            right: true,
            center: true,
            middle: true,
          }}
          verticalGuidelines={verticalGuidelines}
          horizontalGuidelines={horizontalGuidelines}
          zoom={1 / canvasScale}
          origin={false}
          renderDirections={['n', 'nw', 'ne', 's', 'se', 'sw', 'e', 'w']}
          // --- Single target events ---
          onDragStart={(e) => {
            const id = getComponentIdFromTarget(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            const datas = e.datas as unknown as DragDatas;
            datas.id = id;
            datas.startX = comp?.position.x ?? 0;
            datas.startY = comp?.position.y ?? 0;
            datas.origW = comp?.position.width ?? 0;
            datas.origH = comp?.position.height ?? 0;
            // Alt+拖拽复制（适配表 #12）：按下 Alt 启动拖拽时标记，
            // onDragEnd 时复制选中组件到拖拽位置，原件保持原位
            datas.isAltCopy = readAltKey(e.inputEvent);
            // 同步 W/H 到 dimension store，使拖拽过程中也显示尺寸
            setDimension((d) => ({
              ...d,
              w: Math.round(comp?.position.width ?? 0),
              h: Math.round(comp?.position.height ?? 0),
            }));
          }}
          onDrag={(e) => {
            const datas = e.datas as unknown as DragDatas;
            // Smart Guides：计算对齐线 + 吸附（距离 < 3px 自动吸附）
            const { snappedLeft, snappedTop } = updateAlignmentLines(
              e.left,
              e.top,
              datas.origW || 0,
              datas.origH || 0,
            );
            e.target.style.left = `${snappedLeft}px`;
            e.target.style.top = `${snappedTop}px`;
            setDimension((d) => ({
              ...d,
              x: Math.round(snappedLeft),
              y: Math.round(snappedTop),
              visible: true,
            }));
          }}
          onDragEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<DragDatas>;
            const id = datas.id;
            if (!id) return;
            const last = e.lastEvent as unknown as MoveableLastEvent | undefined;
            if (!last) return;
            // Alt+拖拽复制：拖拽结束时复制选中组件到光标位置，原件保持原位
            if (datas.isAltCopy) {
              duplicateSelectedToPosition(Math.round(last.left), Math.round(last.top));
            } else {
              const comp = components.find((c: ScreenComponent) => c.id === id);
              if (!comp) return;
              updateComponent(id, {
                position: {
                  ...comp.position,
                  x: Math.round(last.left),
                  y: Math.round(last.top),
                },
              });
            }
            setDimension((d) => ({ ...d, visible: false }));
            clearAlignmentLines();
          }}
          onResizeStart={(e) => {
            const id = getComponentIdFromTarget(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            const datas = e.datas as unknown as ResizeDatas;
            datas.id = id;
            datas.origW = comp?.position.width ?? 0;
            datas.origH = comp?.position.height ?? 0;
            datas.origX = comp?.position.x ?? 0;
            datas.origY = comp?.position.y ?? 0;
            datas.keepRatio = shiftRef.current;
            // Alt 中心变换（适配表 #11）：以组件中心为原点对称缩放，
            // 调整 left/top 抵消 width/height 变化使中心点位置不变
            datas.isAltCenter = readAltKey(e.inputEvent);
            if (datas.isAltCenter) {
              setDimension((d) => ({ ...d, mode: '中心变换' }));
            }
          }}
          onResize={(e) => {
            const datas = e.datas as unknown as ResizeDatas;
            let w = e.width;
            let h = e.height;
            if (datas.keepRatio && datas.origW && datas.origH) {
              const ratio = datas.origW / datas.origH;
              const [dx, dy] = e.direction;
              if (dx !== 0 && dy !== 0) {
                const newH = w / ratio;
                const newW = h * ratio;
                if (Math.abs(w - datas.origW) > Math.abs(h - datas.origH)) {
                  h = newH;
                } else {
                  w = newW;
                }
              } else if (dx !== 0) {
                h = w / ratio;
              } else if (dy !== 0) {
                w = h * ratio;
              }
            }
            e.target.style.width = `${w}px`;
            e.target.style.height = `${h}px`;
            if (datas.isAltCenter) {
              // 中心变换：左上角 = 原左上 + (origSize - newSize) / 2
              const newX = datas.origX + (datas.origW - w) / 2;
              const newY = datas.origY + (datas.origH - h) / 2;
              e.target.style.left = `${newX}px`;
              e.target.style.top = `${newY}px`;
            } else if (e.drag) {
              e.target.style.left = `${e.drag.left}px`;
              e.target.style.top = `${e.drag.top}px`;
            }
            setDimension((d) => ({
              ...d,
              x: Math.round(Number.parseInt(e.target.style.left || '0')),
              y: Math.round(Number.parseInt(e.target.style.top || '0')),
              w: Math.round(w),
              h: Math.round(h),
              visible: true,
            }));
          }}
          onResizeEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<ResizeDatas>;
            const id = datas.id;
            if (!id) return;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (!comp) return;
            // lastEvent 仅用于 guard，实际值从 e.target.style 读取以避免 any 扩散
            const last = e.lastEvent as unknown as MoveableLastEvent | undefined;
            if (!last) return;
            updateComponent(id, {
              position: {
                ...comp.position,
                x: Math.round(Number.parseInt(e.target.style.left)),
                y: Math.round(Number.parseInt(e.target.style.top)),
                width: Math.round(Number.parseInt(e.target.style.width)),
                height: Math.round(Number.parseInt(e.target.style.height)),
              },
            });
            setDimension((d) => ({ ...d, visible: false, mode: undefined }));
          }}
          onRotateStart={(e) => {
            const id = getComponentIdFromTarget(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            const datas = e.datas as unknown as RotateDatas;
            datas.id = id;
            datas.snapRotate = shiftRef.current;
          }}
          onRotate={(e) => {
            const datas = e.datas as unknown as RotateDatas;
            let rotation = e.rotation;
            if (datas.snapRotate) {
              rotation = Math.round(rotation / 15) * 15;
            }
            const currentTransform = e.target.style.transform || '';
            const rotateMatch = currentTransform.match(/rotate\([^)]*\)/);
            if (rotateMatch) {
              e.target.style.transform = currentTransform.replace(
                rotateMatch[0],
                `rotate(${rotation}deg)`,
              );
            } else {
              e.target.style.transform = `${currentTransform} rotate(${rotation}deg)`.trim();
            }
            setDimension((d) => ({ ...d, rotate: Math.round(rotation), visible: true }));
          }}
          onRotateEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<RotateDatas>;
            const id = datas.id;
            if (!id) return;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (!comp) return;
            const transform = e.target.style.transform || '';
            const match = transform.match(/rotate\(([^)]+)deg\)/);
            const rotation = match ? Number.parseFloat(match[1]) : 0;
            updateComponent(id, {
              position: { ...comp.position, rotation: Math.round(rotation) },
            });
            setDimension((d) => ({ ...d, visible: false }));
          }}
          // --- Group target events ---
          onDragGroupStart={(e) => {
            const ids: string[] = [];
            for (const t of e.targets) {
              const id = getComponentIdFromTarget(t);
              if (id) {
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (comp?.status.locked) return false;
                ids.push(id);
              }
            }
            const datas = e.datas as unknown as GroupDragDatas;
            datas.ids = ids;
          }}
          onDragGroup={(e) => {
            for (const ev of e.events) {
              ev.target.style.left = `${ev.left}px`;
              ev.target.style.top = `${ev.top}px`;
            }
          }}
          onDragGroupEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<GroupDragDatas>;
            const ids = datas.ids;
            if (!ids) return;
            const updates = e.events
              .map((ev) => {
                const id = getComponentIdFromTarget(ev.target);
                if (!id) return null;
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (!comp) return null;
                return {
                  id,
                  changes: {
                    position: {
                      ...comp.position,
                      x: Math.round(Number.parseInt(ev.target.style.left)),
                      y: Math.round(Number.parseInt(ev.target.style.top)),
                    },
                  },
                };
              })
              .filter((u): u is NonNullable<typeof u> => u != null);
            updateComponentsBatch(updates);
          }}
          onResizeGroupStart={(e) => {
            for (const t of e.targets) {
              const id = getComponentIdFromTarget(t);
              if (id) {
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (comp?.status.locked) return false;
              }
            }
          }}
          onResizeGroup={(e) => {
            for (const ev of e.events) {
              ev.target.style.width = `${ev.width}px`;
              ev.target.style.height = `${ev.height}px`;
              if (ev.drag) {
                ev.target.style.left = `${ev.drag.left}px`;
                ev.target.style.top = `${ev.drag.top}px`;
              }
            }
          }}
          onResizeGroupEnd={(e) => {
            if (!e.isDrag) return;
            const updates = e.events
              .map((ev) => {
                const id = getComponentIdFromTarget(ev.target);
                if (!id) return null;
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (!comp) return null;
                return {
                  id,
                  changes: {
                    position: {
                      ...comp.position,
                      x: Math.round(Number.parseInt(ev.target.style.left)),
                      y: Math.round(Number.parseInt(ev.target.style.top)),
                      width: Math.round(Number.parseInt(ev.target.style.width)),
                      height: Math.round(Number.parseInt(ev.target.style.height)),
                    },
                  },
                };
              })
              .filter((u): u is NonNullable<typeof u> => u != null);
            updateComponentsBatch(updates);
          }}
          onChangeTargets={() => {}}
        />
      </div>

      <Selecto
        dragContainer={containerRef.current}
        selectableTargets={['[data-component-id]']}
        selectByClick
        selectFromInside={false}
        hitRate={0}
        toggleContinueSelect={['ctrl']}
        onDragStart={(e) => {
          if (moveableRef.current) {
            // Selecto inputEvent 为 any，可能是 MouseEvent / TouchEvent / PointerEvent。
            // 通过 instanceof 收敛到 HTMLElement 后再使用，避免 as HTMLElement 越过类型检查
            const rawTarget = (e.inputEvent as { target?: unknown } | null)?.target;
            const target = rawTarget instanceof HTMLElement ? rawTarget : null;
            if (target && moveableRef.current.isMoveableElement(target)) {
              e.stop();
            }
            if (target) {
              const targetId = getComponentIdFromTarget(target);
              if (targetId && selectedComponentIds.includes(targetId)) {
                e.stop();
              }
            }
          }
        }}
        onSelectEnd={(e) => {
          const selected = e.selected
            .map((el) => getComponentIdFromTarget(el))
            .filter((id): id is string => id != null);

          // Selecto 的 inputEvent 可能是 MouseEvent / TouchEvent / PointerEvent。
          // handleSelectEnd 需要 MouseEvent（读 ctrlKey/metaKey/shiftKey），
          // 非 MouseEvent 时退化为无修饰键的合成事件，保证类型安全。
          const rawEvent: unknown = e.inputEvent;
          const inputEvent: MouseEvent =
            rawEvent instanceof MouseEvent
              ? rawEvent
              : new MouseEvent('mousedown', { bubbles: true });

          // 委托纯函数计算决策（归一化 spec.md 热点 5）
          const result = handleSelectEnd({
            selected,
            inputEvent,
            lastClick: lastClickRef.current,
            activeGroupId,
            components,
            isDragStart: e.isDragStart,
          });

          // 应用副作用：lastClick → activeGroupId → selection → Moveable dragStart
          lastClickRef.current = result.newLastClick;
          if (result.newActiveGroupId !== activeGroupId) {
            setActiveGroupId(result.newActiveGroupId);
          }
          selectComponents(result.selection);
          if (!result.isDoubleClick && e.isDragStart) {
            // Moveable dragStart 期望 MouseEvent；TouchEvent 不支持，跳过以避免运行时错误
            if (inputEvent instanceof MouseEvent) {
              setTimeout(() => {
                moveableRef.current?.dragStart(inputEvent);
              }, 0);
            }
          }
        }}
      />

      <DimensionTooltip />
    </div>
  );
}
