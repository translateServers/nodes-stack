/**
 * 动态大屏设计器工作台（screen-dynamic-sdk designer）。
 *
 * A1 契约切片形态：
 * - 画布渲染与 viewer 同源（绝对定位 + fit 缩放）
 * - 支持选择、拖拽移动、右下角缩放手柄
 * - 设计态组件以 placeholder 渲染（mode='design'、无数据执行）
 * - 保存/发布语义由宿主决定；本工作台只负责文档状态与校验
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { CustomElementRenderer } from '@nebula/screen-editor-core/experimental';
import type { ScreenComponentInstanceRegistry } from '@nebula/screen-editor-core/experimental';
import {
  getManifestDataCapability,
  parseDynamicScreenDocumentV3,
  type DynamicScreenDocumentV3,
  type ScreenSdkDiagnostic,
} from '@nebula/screen-editor-core/dynamic';

export interface ScreenDynamicDesignerHandle {
  getDocument(): DynamicScreenDocumentV3;
  redo(): void;
  save(): DynamicScreenDocumentV3;
  undo(): void;
  validate(): ScreenSdkDiagnostic[];
  whenReady(): Promise<void>;
}

export interface ScreenDynamicDesignerProps {
  readonly document: DynamicScreenDocumentV3;
  readonly onChange?: (document: DynamicScreenDocumentV3) => void;
  readonly onReady?: () => void;
  readonly readonly?: boolean;
  readonly registry: ScreenComponentInstanceRegistry;
}

const MIN_WIDTH = 32;
const MIN_HEIGHT = 24;

export const ScreenDynamicDesigner = forwardRef<
  ScreenDynamicDesignerHandle,
  ScreenDynamicDesignerProps
>(function ScreenDynamicDesigner({ document, onChange, onReady, readonly = false, registry }, ref) {
  const [current, setCurrent] = useState<DynamicScreenDocumentV3>(() => structuredClone(document));
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const undoStack = useRef<DynamicScreenDocumentV3[]>([]);
  const redoStack = useRef<DynamicScreenDocumentV3[]>([]);
  const dragState = useRef<{
    componentId: string;
    startX: number;
    startY: number;
    startPosition: DynamicScreenDocumentV3['components'][number]['position'];
    mode: 'move' | 'resize';
  } | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    update();
    const observer = window.ResizeObserver;
    if (observer === undefined) return;
    const instance = new observer(update);
    instance.observe(element);
    return () => instance.disconnect();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getDocument: () => structuredClone(currentRef.current),
      redo: () => {
        if (readonly) return;
        const snapshot = redoStack.current.pop();
        if (snapshot === undefined) return;
        undoStack.current.push(structuredClone(currentRef.current));
        setCurrent(snapshot);
        onChange?.(snapshot);
      },
      save: () => {
        const snapshot = structuredClone(currentRef.current);
        undoStack.current = [];
        redoStack.current = [];
        return snapshot;
      },
      undo: () => {
        if (readonly) return;
        const snapshot = undoStack.current.pop();
        if (snapshot === undefined) return;
        redoStack.current.push(structuredClone(currentRef.current));
        setCurrent(snapshot);
        onChange?.(snapshot);
      },
      validate: () => {
        const result = parseDynamicScreenDocumentV3(currentRef.current, registry);
        return result.success ? [] : result.diagnostics;
      },
      whenReady: () => Promise.resolve(),
    }),
    [onChange, readonly, registry],
  );

  const scale = Math.min(
    viewport.width > 0 ? viewport.width / current.canvas.width : 1,
    viewport.height > 0 ? viewport.height / current.canvas.height : 1,
    1,
  );

  const startInteraction = (
    componentId: string,
    event: React.PointerEvent,
    mode: 'move' | 'resize',
  ): void => {
    if (readonly) return;
    event.preventDefault();
    event.stopPropagation();
    const component = current.components.find((item) => item.id === componentId);
    if (component === undefined) return;
    dragState.current = {
      componentId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: structuredClone(component.position),
      mode,
    };
    setSelectedId(componentId);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handlePointerMove = (event: PointerEvent): void => {
    const drag = dragState.current;
    if (drag === null) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const next = structuredClone(currentRef.current);
    const target = next.components.find((item) => item.id === drag.componentId);
    if (target === undefined) return;
    if (drag.mode === 'move') {
      target.position.x = Math.max(0, Math.round(drag.startPosition.x + dx));
      target.position.y = Math.max(0, Math.round(drag.startPosition.y + dy));
    } else {
      target.position.width = Math.max(MIN_WIDTH, Math.round(drag.startPosition.width + dx));
      target.position.height = Math.max(MIN_HEIGHT, Math.round(drag.startPosition.height + dy));
    }
    setCurrent(next);
  };

  const handlePointerUp = (): void => {
    if (dragState.current !== null) {
      dragState.current = null;
      if (JSON.stringify(currentRef.current) !== JSON.stringify(undoStack.current.at(-1))) {
        onChange?.(currentRef.current);
      }
    }
    window.removeEventListener('pointermove', handlePointerMove);
  };

  return (
    <div ref={containerRef} style={designerRootStyle}>
      <div
        style={{
          ...canvasStyle,
          width: current.canvas.width,
          height: current.canvas.height,
          backgroundColor: current.canvas.backgroundColor,
          backgroundImage: current.canvas.backgroundImage ?? undefined,
          backgroundSize: '100% 100%',
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {current.components
          .filter((component) => component.status !== 'hidden')
          .map((component) => (
            <DesignComponent
              key={component.id}
              component={component}
              registry={registry}
              selected={selectedId === component.id}
              readonly={readonly}
              onPointerDown={(event, mode) => startInteraction(component.id, event, mode)}
              onSelect={() => setSelectedId(component.id)}
            />
          ))}
      </div>
      <div style={designerHintStyle}>
        {readonly ? '只读模式' : '拖动组件移动，右下角缩放；Ctrl+Z / Ctrl+Shift+Z 撤销重做'}
      </div>
    </div>
  );
});

function DesignComponent({
  component,
  onPointerDown,
  onSelect,
  readonly,
  registry,
  selected,
}: {
  component: DynamicScreenDocumentV3['components'][number];
  onPointerDown: (event: React.PointerEvent, mode: 'move' | 'resize') => void;
  onSelect: () => void;
  readonly: boolean;
  registry: ScreenComponentInstanceRegistry;
  selected: boolean;
}) {
  const registration = registry.get(component.type);
  const position = component.position;
  const frame = componentFrameStyle(position, component.zIndex);

  if (registration === undefined || registration.source !== 'host') {
    return (
      <div
        onClick={onSelect}
        onPointerDown={(event) => onPointerDown(event, 'move')}
        style={{
          ...frame,
          ...(selected ? selectionStyle : {}),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed rgba(148,163,184,0.6)',
          color: '#94a3b8',
          fontSize: 12,
          background: 'rgba(15,23,42,0.4)',
        }}
      >
        {component.type}
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      onPointerDown={(event) => onPointerDown(event, 'move')}
      style={{
        ...frame,
        ...(selected ? selectionStyle : {}),
        cursor: readonly ? 'default' : 'move',
      }}
    >
      <CustomElementRenderer
        tagName={registration.manifest.tagName}
        componentId={component.id}
        mode="design"
        interactive={false}
        props={component.props}
        style={component.style}
        size={{ width: position.width, height: position.height }}
        events={registration.manifest.events}
        dataCapability={getManifestDataCapability(registration.manifest)}
      />
      {!readonly && selected && (
        <div onPointerDown={(event) => onPointerDown(event, 'resize')} style={resizeHandleStyle} />
      )}
    </div>
  );
}

const designerRootStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: 'var(--nebula-screen-bg, #0b1220)',
  color: 'var(--nebula-screen-fg, #e5e7eb)',
  fontFamily: 'system-ui, sans-serif',
};

const canvasStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transformOrigin: 'center',
  overflow: 'hidden',
  boxShadow: '0 0 0 1px rgba(148,163,184,0.3)',
};

const designerHintStyle: CSSProperties = {
  position: 'absolute',
  bottom: 8,
  left: 12,
  color: 'rgba(148,163,184,0.8)',
  fontSize: 12,
};

const selectionStyle: CSSProperties = {
  outline: '2px solid #38bdf8',
  outlineOffset: -2,
};

const resizeHandleStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 0,
  width: 14,
  height: 14,
  borderRight: '2px solid #38bdf8',
  borderBottom: '2px solid #38bdf8',
  cursor: 'nwse-resize',
  touchAction: 'none',
};

function componentFrameStyle(
  position: DynamicScreenDocumentV3['components'][number]['position'],
  zIndex: number,
): CSSProperties {
  return {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: position.width,
    height: position.height,
    zIndex,
    transform: position.rotation !== undefined ? `rotate(${position.rotation}deg)` : undefined,
    overflow: 'hidden',
  };
}
