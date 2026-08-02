/**
 * Component Lab Host React 组件（Spec §13.2 Phase 2, Task 2.3）
 *
 * 渲染流程：
 * 1. 通过 buildLabRegistry() 异步构建 registry（内置 6 + 指标卡）
 * 2. 使用 RegistryProvider 注入 registry
 * 3. 渲染 ComponentRenderer 验证 design 模式（ComponentRenderer 内部硬编码 mode="design"）
 * 4. 渲染 CustomElementRenderer 验证 preview 模式（直接传入 mode="preview"）
 *
 * 这是验证用 host，不是生产编辑器：design/preview/event harness 保持最小化，
 * 另有一个真实 V2 editor section 验证组件库拖入画布和 registry-aware store 路径。
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import {
  BlueprintEventProvider,
  ComponentRenderer,
  ScreenEditorStoreProvider,
  ScreenHostAdapterWorkbenchV2,
  createScreenEditorStore,
  type ScreenHostAdapterV2,
  type ScreenProjectEnvelopeInputV2,
} from '@nebula/screen-editor-core';
import {
  CustomElementRenderer,
  RegistryProvider,
  type ScreenComponentInstanceRegistry,
} from '@nebula/screen-editor-core/experimental';
import {
  INDICATOR_CARD_TAG_NAME,
  INDICATOR_CARD_TYPE,
  indicatorCardManifest,
} from '@nebula-example/indicator-card-vanilla';
import { buildLabRegistry } from './lab-registry.js';
import { createIndicatorCardComponent } from './mock-component.js';

/**
 * Component Lab Host Props。
 */
export interface ComponentLabHostProps {
  /** 自定义 mock 组件（缺省使用 manifest defaultProps 构造） */
  component?: ScreenComponent;
  /** 自定义 children（用于调试） */
  children?: ReactNode;
}

/**
 * Component Lab Host 渲染状态。
 */
interface LabState {
  registry: ScreenComponentInstanceRegistry | null;
  error: Error | null;
}

function createLabEnvelope(projectId: string): ScreenProjectEnvelopeInputV2 {
  return {
    id: projectId,
    name: 'Component Lab V2',
    description: null,
    status: 'draft',
    revision: 'lab-revision-1',
    document: {
      schemaVersion: 2,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#ffffff',
        scaleMode: 'fit',
      },
      components: [createIndicatorCardComponent()],
      globalVariables: [],
    },
  };
}

const LAB_V2_ADAPTER: ScreenHostAdapterV2 = {
  documentVersion: 2,
  loadProject: ({ projectId }) => Promise.resolve(createLabEnvelope(projectId)),
  saveProject: ({ projectId, draft }) =>
    Promise.resolve({
      ...createLabEnvelope(projectId),
      revision: 'lab-revision-saved',
      ...draft,
    }),
};

/**
 * Component Lab Host：异步构建 registry 后渲染 design/preview 双模式。
 *
 * 渲染结构：
 * ```text
 * <RegistryProvider registry={labRegistry}>
 *   <section data-lab-section="design">
 *     <ComponentRenderer component={mockComponent} />
 *   </section>
 *   <section data-lab-section="preview">
 *     <CustomElementRenderer mode="preview" ... />
 *   </section>
 * </RegistryProvider>
 * ```
 *
 * design 模式通过 ComponentRenderer 走完整 registry 查询路径：
 *   useOptionalRegistry → getRendererFromRegistry → createHostElementRenderer
 *
 * preview 模式直接使用 CustomElementRenderer：
 *   ComponentRenderer 当前硬编码 mode="design"（Phase 5 接入预览时由上层透传），
 *   为验证 preview model，lab 直接渲染 CustomElementRenderer 并传入 mode="preview"。
 */
export function ComponentLabHost({
  component,
  children,
}: ComponentLabHostProps): React.JSX.Element {
  const [state, setState] = useState<LabState>({
    registry: null,
    error: null,
  });
  // Phase 4 Task 4.3: 事件 E2E 状态 — Card B 初始可见，Card A 每次点击 valueClick 切换其显隐
  const [cardBVisible, setCardBVisible] = useState(true);
  const [eventLog, setEventLog] = useState<string>('等待 valueClick 事件...');
  const [editorStore] = useState(() => createScreenEditorStore({ persistPreferences: false }));

  useEffect(() => {
    let cancelled = false;
    setState({ registry: null, error: null });
    buildLabRegistry()
      .then((registry) => {
        if (!cancelled) {
          setState({ registry, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            registry: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Phase 4 Task 4.3: nebula-component-event 桥接回调。
   *
   * 由 CustomElementRenderer 内部 listener 在校验通过后调用，参数：
   * - componentId: 来自 React 闭包中的可信 componentId（Spec §9.2.3）
   * - eventId:     通过 manifest.events allowlist 校验的事件 id
   * - payload:     detached JSON payload
   *
   * 本 demo 仅做最小可视化反馈：card-a 触发的 valueClick 切换 card-b 显隐，
   * 同时把最近一次事件写入日志区便于调试。生产编辑器应通过蓝图运行时驱动
   * 实际的 show/hide/toggleVisibility action。
   */
  const handleComponentEvent = useCallback(
    (componentId: string, eventId: string, payload?: unknown) => {
      if (eventId === 'valueClick' && componentId === 'card-a') {
        setCardBVisible((prev) => !prev);
      }
      const payloadStr = payload === undefined ? 'undefined' : JSON.stringify(payload);
      setEventLog(`[${new Date().toISOString()}] ${componentId}.${eventId} payload=${payloadStr}`);
    },
    [],
  );

  if (state.error !== null) {
    return (
      <div data-lab-state="error" role="alert">
        Registry 构建失败: {state.error.message}
      </div>
    );
  }

  if (state.registry === null) {
    return <div data-lab-state="loading">正在构建 component lab registry...</div>;
  }

  const mockComponent = component ?? createIndicatorCardComponent();
  const defaultSize = indicatorCardManifest.defaultSize;

  return (
    <RegistryProvider registry={state.registry}>
      <div data-lab-root>
        <section data-lab-section="design" aria-label="design 模式渲染">
          <h2>Design 模式（ComponentRenderer 全链路）</h2>
          <div
            style={{
              width: mockComponent.position.width,
              height: mockComponent.position.height,
            }}
          >
            <ComponentRenderer component={mockComponent} />
          </div>
        </section>

        <section data-lab-section="editor" aria-label="真实编辑器画布">
          <h2>真实编辑器画布（组件库拖入）</h2>
          <div style={{ height: 720, minHeight: 640 }}>
            <ScreenEditorStoreProvider store={editorStore}>
              <ScreenHostAdapterWorkbenchV2
                adapter={LAB_V2_ADAPTER}
                componentRegistry={state.registry}
                projectId="component-lab-v2"
                setTheme={() => undefined}
                theme="light"
              />
            </ScreenEditorStoreProvider>
          </div>
        </section>

        <section data-lab-section="preview" aria-label="preview 模式渲染">
          <h2>Preview 模式（CustomElementRenderer 直连）</h2>
          <div style={{ width: defaultSize.width, height: defaultSize.height }}>
            <CustomElementRenderer
              tagName={INDICATOR_CARD_TAG_NAME}
              componentId="lab-indicator-card-preview"
              mode="preview"
              interactive={false}
              props={{ ...indicatorCardManifest.defaultProps, title: '预览指标', value: 999 }}
              style={{ backgroundColor: '#1f2937' }}
              size={{ width: defaultSize.width, height: defaultSize.height }}
            />
          </div>
        </section>

        <section data-lab-section="events" aria-label="事件 E2E">
          <h2>事件 E2E（valueClick → toggle 目标卡）</h2>
          <p>
            点击 Card A 数值区域应派发 <code>valueClick</code>，蓝图回调切换 Card B 显隐。 Card A
            interactive=true；Card B interactive=false（仅作显隐目标）。
          </p>
          <BlueprintEventProvider value={handleComponentEvent}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div data-lab-card="a" style={{ width: 200, height: 120 }}>
                <CustomElementRenderer
                  tagName={INDICATOR_CARD_TAG_NAME}
                  componentId="card-a"
                  mode="preview"
                  interactive={true}
                  props={{ title: '触发卡', value: 100, color: '#4f46e5' }}
                  style={{}}
                  size={{ width: 200, height: 120 }}
                  events={indicatorCardManifest.events}
                />
              </div>
              <div
                data-lab-target="card-b"
                style={{
                  width: 200,
                  height: 120,
                  visibility: cardBVisible ? 'visible' : 'hidden',
                }}
              >
                <CustomElementRenderer
                  tagName={INDICATOR_CARD_TAG_NAME}
                  componentId="card-b"
                  mode="preview"
                  interactive={false}
                  props={{ title: '目标卡', value: 0, color: '#10b981' }}
                  style={{}}
                  size={{ width: 200, height: 120 }}
                />
              </div>
            </div>
            <p data-lab-event-log>{eventLog}</p>
          </BlueprintEventProvider>
        </section>

        <section data-lab-section="registry-info" aria-label="registry 投影信息">
          <h2>Registry 投影</h2>
          <ul>
            <li>
              type <code>{INDICATOR_CARD_TYPE}</code> 已注册:{' '}
              <strong>{String(state.registry.has(INDICATOR_CARD_TYPE))}</strong>
            </li>
            <li>
              注册表大小: <strong>{state.registry.size}</strong>（内置 6 + 指标卡 = 7）
            </li>
          </ul>
        </section>

        {children}
      </div>
    </RegistryProvider>
  );
}

export {
  buildLabRegistry,
  INDICATOR_CARD_TYPE,
  INDICATOR_CARD_TAG_NAME,
} from './lab-registry.js';
export { createIndicatorCardComponent } from './mock-component.js';
