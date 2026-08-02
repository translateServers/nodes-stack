/**
 * 动态大屏查看器工作台（screen-dynamic-sdk viewer）。
 *
 * - 全屏画布 + fit 等比缩放
 * - 打开数据执行上下文，执行全部 host/xj-metric 组件
 * - 定时刷新（refreshIntervalSeconds）
 * - 组件渲染复用 editor-core CustomElementRenderer（mode='viewer'、model v2）
 * - 不提供任何编辑命令/设计选框/requestApi
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CustomElementRenderer } from '@nebula/screen-editor-core/experimental';
import type { ScreenComponentInstanceRegistry } from '@nebula/screen-editor-core/experimental';
import {
  getManifestDataCapability,
  ScreenDynamicDataProvider,
  useComponentDataState,
  useScreenDynamicData,
  type DynamicScreenDocumentV3,
  type ScreenDataContextSource,
  type ScreenDataAdapterPort,
  type ScreenDynamicDataRuntime,
} from '@nebula/screen-editor-core/dynamic';
import type { ScreenComponentDataState } from '@nebula/screen-component-sdk/dynamic';

export interface ScreenDynamicViewerWorkbenchProps {
  readonly dataAdapter?: ScreenDataAdapterPort;
  readonly document: DynamicScreenDocumentV3;
  readonly eventTarget?: HTMLElement;
  readonly projectId: string;
  readonly refreshIntervalSeconds: number;
  readonly registry: ScreenComponentInstanceRegistry;
  readonly source: ScreenDataContextSource;
}

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

function isHostMetricDataSource(component: DynamicScreenDocumentV3['components'][number]): boolean {
  return component.dataSource?.type === 'host/xj-metric';
}

function toHostMetricIntent(component: DynamicScreenDocumentV3['components'][number]) {
  if (component.dataSource?.type !== 'host/xj-metric') {
    throw new Error('component has no host/xj-metric data source');
  }
  return {
    type: component.dataSource.type,
    params: { metricId: component.dataSource.metricId, binding: component.dataSource.binding },
  };
}

function dispatchDataError(target: HTMLElement | undefined, componentId: string, message: string) {
  target?.dispatchEvent(
    new CustomEvent('nebula-data-error', {
      bubbles: false,
      composed: true,
      detail: { componentId, message },
    }),
  );
}

export function ScreenDynamicViewerWorkbench({
  dataAdapter,
  document,
  eventTarget,
  projectId,
  refreshIntervalSeconds,
  registry,
  source,
}: ScreenDynamicViewerWorkbenchProps) {
  if (dataAdapter === undefined) {
    return <UnavailableNotice message="viewer 需要 dataAdapter 才能执行数据" />;
  }
  return (
    <ScreenDynamicDataProvider adapter={dataAdapter}>
      <ViewerCanvas
        document={document}
        eventTarget={eventTarget}
        projectId={projectId}
        refreshIntervalSeconds={refreshIntervalSeconds}
        registry={registry}
        source={source}
      />
    </ScreenDynamicDataProvider>
  );
}

function ViewerCanvas({
  document,
  eventTarget,
  projectId,
  refreshIntervalSeconds,
  registry,
  source,
}: Omit<ScreenDynamicViewerWorkbenchProps, 'dataAdapter'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<CanvasSize>({ width: 0, height: 0 });
  const dynamicData = useScreenDynamicData();
  const openContext = useCallback(
    (context: Parameters<ScreenDynamicDataRuntime['openContext']>[0]) =>
      dynamicData.openContext(context),
    [dynamicData],
  );
  const closeContext = useCallback(() => dynamicData.closeContext(), [dynamicData]);
  const execute = useCallback(
    (
      componentId: Parameters<ScreenDynamicDataRuntime['execute']>[0],
      intent: Parameters<ScreenDynamicDataRuntime['execute']>[1],
    ) => dynamicData.execute(componentId, intent),
    [dynamicData],
  );
  const contextId = useMemo(
    () => `viewer-${projectId}-${Math.random().toString(36).slice(2, 10)}`,
    [projectId],
  );

  const dataComponents = useMemo(
    () => document.components.filter(isHostMetricDataSource),
    [document],
  );

  const executeAllRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    executeAllRef.current = () => {
      for (const component of dataComponents) {
        const intent = toHostMetricIntent(component);
        void execute(component.id, intent).then((state) => {
          if (state.status === 'error') {
            dispatchDataError(eventTarget, component.id, state.error.message);
          }
        });
      }
    };
  }, [dataComponents, execute, eventTarget]);

  useEffect(() => {
    let cancelled = false;
    void openContext({ contextId, projectId, source }).then(() => {
      if (cancelled) return;
      executeAllRef.current?.();
    });
    return () => {
      cancelled = true;
      void closeContext();
    };
  }, [closeContext, contextId, openContext, projectId, source]);

  useEffect(() => {
    if (refreshIntervalSeconds <= 0) return;
    const timer = setInterval(() => {
      executeAllRef.current?.();
    }, refreshIntervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [refreshIntervalSeconds]);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    update();
    const ResizeObserverConstructor = window.ResizeObserver;
    if (ResizeObserverConstructor === undefined) return;
    const observer = new ResizeObserverConstructor(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(
    viewport.width > 0 ? viewport.width / document.canvas.width : 1,
    viewport.height > 0 ? viewport.height / document.canvas.height : 1,
    1,
  );

  return (
    <div ref={containerRef} className="nebula-dynamic-viewer" style={viewerRootStyle}>
      <div
        className="nebula-dynamic-canvas"
        style={{
          ...canvasStyle,
          width: document.canvas.width,
          height: document.canvas.height,
          backgroundColor: document.canvas.backgroundColor,
          backgroundImage: document.canvas.backgroundImage ?? undefined,
          backgroundSize: '100% 100%',
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {document.components
          .filter((component) => component.status !== 'hidden')
          .map((component) => (
            <ViewerComponent key={component.id} component={component} registry={registry} />
          ))}
      </div>
    </div>
  );
}

function ViewerComponent({
  component,
  registry,
}: {
  component: DynamicScreenDocumentV3['components'][number];
  registry: ScreenComponentInstanceRegistry;
}) {
  const registration = registry.get(component.type);
  const dataState = useComponentDataState(component.id);
  const position = component.position;

  if (registration === undefined || registration.source !== 'host') {
    return (
      <div
        style={{
          ...componentFrameStyle(position, component.zIndex),
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
    <div style={componentFrameStyle(position, component.zIndex)}>
      <CustomElementRenderer
        tagName={registration.manifest.tagName}
        componentId={component.id}
        mode="viewer"
        interactive
        props={component.props}
        style={component.style}
        size={{ width: position.width, height: position.height }}
        events={registration.manifest.events}
        dataCapability={getManifestDataCapability(registration.manifest)}
        dataState={dataState}
      />
    </div>
  );
}

function UnavailableNotice({ message }: { message: string }) {
  return (
    <div style={noticeStyle}>
      <div>{message}</div>
    </div>
  );
}

export type { ScreenComponentDataState };

const viewerRootStyle: CSSProperties = {
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
};

const noticeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#f87171',
  fontSize: 14,
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
