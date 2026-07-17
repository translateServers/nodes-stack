import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { useModifierKeys } from '../hooks/use-modifier-keys';
import { ComponentRenderer } from '../registry/renderer';

interface DimensionInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  visible: boolean;
}

const initialDimension: DimensionInfo = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  rotate: 0,
  visible: false,
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
      X:{dimension.x} Y:{dimension.y}
      {dimension.w > 0 && ` W:${dimension.w}`}
      {dimension.h > 0 && ` H:${dimension.h}`}
      {dimension.rotate !== 0 && ` R:${dimension.rotate}°`}
    </div>
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
        left: component.position.x,
        top: component.position.y,
        width: component.position.width,
        height: component.position.height,
        zIndex: component.zIndex,
        opacity: component.style.opacity ?? 1,
        borderRadius: component.style.borderRadius,
        borderWidth: component.style.borderWidth,
        borderColor: component.style.borderColor,
        borderStyle: component.style.borderStyle,
        backgroundColor: component.style.backgroundColor,
        overflow: component.style.overflow ?? 'hidden',
        transform: component.position.rotation
          ? `rotate(${component.position.rotation}deg)`
          : undefined,
        outline: showBorderGuides && !selected ? '1px dashed rgba(147, 197, 253, 0.5)' : undefined,
      }}
    >
      <ComponentRenderer component={component} />
    </div>
  );
});

function getComponentId(el: Element): string | null {
  let current: Element | null = el;
  while (current) {
    const id = current.getAttribute('data-component-id');
    if (id) return id;
    current = current.parentElement;
  }
  return null;
}

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
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);
  const updateComponentsBatch = useScreenEditorStore((s) => s.updateComponentsBatch);
  const setCanvasScaleAndOffset = useScreenEditorStore((s) => s.setCanvasScaleAndOffset);
  const guides = useScreenEditorStore((s) => s.guides);

  // 从独立 store 获取 setDimension，避免拖拽高频回调触发画布重渲染
  const setDimension = useDimensionStore((s) => s.setDimension);

  const componentRefs = useRef<Map<string, HTMLElement>>(new Map());
  const moveableRef = useRef<Moveable>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  const [isPanning, setIsPanning] = useState(false);
  // 修饰键状态由 useModifierKeys 集中管理（替换原独立的 keydown/keyup 监听）
  // spaceHeld 重命名为 spaceHeldUI 保持原 UI 状态语义
  const { spaceRef, shiftRef, spaceHeld: spaceHeldUI, shiftHeld } = useModifierKeys();

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
      if (!e.altKey) return;
      e.preventDefault();
      const state = useScreenEditorStore.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      const newScale = Math.min(5, Math.max(0.1, state.canvasScale * factor));
      const ratio = newScale / state.canvasScale;
      setCanvasScaleAndOffset(newScale, {
        x: cursorX - (cursorX - state.canvasOffset.x) * ratio,
        y: cursorY - (cursorY - state.canvasOffset.y) * ratio,
      });
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
        .filter((c: ScreenComponent) => !c.parentId && !c.status.hidden)
        .sort((a: ScreenComponent, b: ScreenComponent) => a.zIndex - b.zIndex),
    [components],
  );

  /** Memo 化 Moveable 的 snap 参考线，避免每次渲染产生新数组引用触发 Moveable 内部重算 */
  const verticalGuidelines = useMemo(
    () =>
      canvas
        ? ['0', `${canvas.width}`, ...(guides.visible ? guides.vertical.map(String) : [])]
        : [],
    [canvas, guides.visible, guides.vertical],
  );
  const horizontalGuidelines = useMemo(
    () =>
      canvas
        ? ['0', `${canvas.height}`, ...(guides.visible ? guides.horizontal.map(String) : [])]
        : [],
    [canvas, guides.visible, guides.horizontal],
  );

  if (!project || !canvas) return null;

  const isGroupSelect = selectedComponentIds.length > 1;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-muted"
      style={{ cursor: isPanning ? 'grabbing' : spaceHeldUI ? 'grab' : undefined }}
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
        </div>

        <Moveable
          ref={moveableRef}
          target={targets}
          container={contentRef.current}
          draggable
          resizable
          rotatable
          snappable
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
            const id = getComponentId(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            e.datas.id = id;
            e.datas.startX = comp?.position.x ?? 0;
            e.datas.startY = comp?.position.y ?? 0;
          }}
          onDrag={(e) => {
            e.target.style.left = `${e.left}px`;
            e.target.style.top = `${e.top}px`;
            setDimension((d) => ({
              ...d,
              x: Math.round(e.left),
              y: Math.round(e.top),
              visible: true,
            }));
          }}
          onDragEnd={(e) => {
            if (!e.isDrag) return;
            const id = e.datas.id;
            if (!id) return;
            const last = e.lastEvent;
            if (!last) return;
            updateComponent(id, {
              position: {
                ...components.find((c: ScreenComponent) => c.id === id)!.position,
                x: Math.round(last.left),
                y: Math.round(last.top),
              },
            });
            setDimension((d) => ({ ...d, visible: false }));
          }}
          onResizeStart={(e) => {
            const id = getComponentId(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            e.datas.id = id;
            e.datas.origW = comp?.position.width ?? 0;
            e.datas.origH = comp?.position.height ?? 0;
            e.datas.keepRatio = shiftRef.current;
          }}
          onResize={(e) => {
            let w = e.width;
            let h = e.height;
            if (e.datas.keepRatio && e.datas.origW && e.datas.origH) {
              const ratio = e.datas.origW / e.datas.origH;
              const [dx, dy] = e.direction;
              if (dx !== 0 && dy !== 0) {
                const newH = w / ratio;
                const newW = h * ratio;
                if (Math.abs(w - e.datas.origW) > Math.abs(h - e.datas.origH)) {
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
            if (e.drag) {
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
            const id = e.datas.id;
            if (!id) return;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (!comp) return;
            const last = e.lastEvent;
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
            setDimension((d) => ({ ...d, visible: false }));
          }}
          onRotateStart={(e) => {
            const id = getComponentId(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            e.datas.id = id;
            e.datas.snapRotate = shiftRef.current;
          }}
          onRotate={(e) => {
            let rotation = e.rotation;
            if (e.datas.snapRotate) {
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
            const id = e.datas.id;
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
              const id = getComponentId(t);
              if (id) {
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (comp?.status.locked) return false;
                ids.push(id);
              }
            }
            e.datas.ids = ids;
          }}
          onDragGroup={(e) => {
            for (const ev of e.events) {
              ev.target.style.left = `${ev.left}px`;
              ev.target.style.top = `${ev.top}px`;
            }
          }}
          onDragGroupEnd={(e) => {
            if (!e.isDrag) return;
            const ids = e.datas.ids as string[];
            if (!ids) return;
            const updates = e.events
              .map((ev) => {
                const id = getComponentId(ev.target);
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
              const id = getComponentId(t);
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
                const id = getComponentId(ev.target);
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
            const target = e.inputEvent?.target as HTMLElement;
            if (moveableRef.current.isMoveableElement(target)) {
              e.stop();
            }
            if (
              target &&
              getComponentId(target) &&
              selectedComponentIds.includes(getComponentId(target)!)
            ) {
              e.stop();
            }
          }
        }}
        onSelectEnd={(e) => {
          const selected = e.selected
            .map((el) => getComponentId(el))
            .filter((id): id is string => id != null);
          selectComponents(selected);
          if (e.isDragStart) {
            setTimeout(() => {
              moveableRef.current?.dragStart(e.inputEvent);
            }, 0);
          }
        }}
      />

      <DimensionTooltip />
    </div>
  );
}
