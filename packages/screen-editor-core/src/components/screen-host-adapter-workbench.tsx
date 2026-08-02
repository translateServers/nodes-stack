import {
  type ScreenDocumentV1,
  type ScreenHostAdapter,
  type ScreenProjectDraft,
  type ScreenSdkDiagnostic,
  validateScreenSdkCapabilities,
} from '@nebula/screen-editor-core/internal';
import {
  ScreenHostController,
  type ScreenHostControllerState,
} from '../host/screen-host-controller.js';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { createScreenHostSessionPort } from '../lib/screen-host-session';
import { createV1ScreenImportControllerPort } from '../host/screen-import-controller-port.js';
import type { ScreenComponentInstanceRegistry } from '../registry/instance-registry';
import { useScreenEditorStoreApi } from '../stores/editor-store';
import {
  ScreenEditorWorkbench,
  type ScreenEditorWorkbenchHandle,
  type ScreenEditorWorkbenchOperationController,
} from './screen-editor-workbench';
import type { ScreenEditorTheme } from './screen-editor-environment';

export interface ScreenHostAdapterWorkbenchProps {
  adapter?: ScreenHostAdapter;
  /**
   * 注入的实例注册表（Spec §13.2 Phase 6, Task 6.2）。
   *
   * 缺省时由 `ScreenEditorWorkbench` 使用 `DEFAULT_BUILTIN_REGISTRY`（仅 6 个内置组件）。
   * SDK 通过 `<nebula-screen-editor>` element 的 `componentRegistry` property 透传，
   * 确保 React runtime mount 前 registry 已就绪，project parser、Workbench 和
   * Host Controller 共享同一 snapshot（Requirement 4, 8）。
   *
   * 公共 `ScreenComponentRegistry`（spec §8.2）结构化兼容此类型，可直接赋值。
   */
  componentRegistry?: ScreenComponentInstanceRegistry;
  portalRoot?: HTMLElement | null;
  projectId?: string;
  isActive?: () => boolean;
  readonly?: boolean;
  setTheme: (theme: ScreenEditorTheme) => void;
  theme: ScreenEditorTheme;
}

export interface ScreenHostAdapterWorkbenchHandle {
  readonly controller: ScreenHostController;
  dispose(): void;
  fitToScreen(): void;
  focusComponent(componentId: string): boolean;
  getDocument(): ScreenDocumentV1 | null;
  getDraft(): ScreenProjectDraft | null;
  redo(): void;
  undo(): void;
  validate(): ScreenSdkDiagnostic[];
}

export const ScreenHostAdapterWorkbench = forwardRef<
  ScreenHostAdapterWorkbenchHandle,
  ScreenHostAdapterWorkbenchProps
>(function ScreenHostAdapterWorkbench(
  {
    adapter,
    componentRegistry,
    isActive = () => true,
    portalRoot = null,
    projectId,
    readonly = false,
    setTheme,
    theme,
  },
  ref,
) {
  const store = useScreenEditorStoreApi();
  const workbenchRef = useRef<ScreenEditorWorkbenchHandle>(null);
  const controllerRef = useRef<ScreenHostController | null>(null);
  const applyingEnvelopeRef = useRef(false);
  const mountedRef = useRef(false);
  if (controllerRef.current === null) {
    const session = createScreenHostSessionPort(store);
    controllerRef.current = new ScreenHostController({
      session: {
        ...session,
        applyEnvelope: (command) => {
          applyingEnvelopeRef.current = true;
          try {
            session.applyEnvelope(command);
          } finally {
            applyingEnvelopeRef.current = false;
          }
        },
      },
    });
  }
  const controller = controllerRef.current;
  const state = useSyncExternalStore<ScreenHostControllerState>(
    (listener) => controller.subscribe(listener),
    () => controller.getState(),
    () => controller.getState(),
  );

  useEffect(
    () =>
      store.subscribe((state, previousState) => {
        if (applyingEnvelopeRef.current) return;
        if (state.selectedComponentIds !== previousState.selectedComponentIds) {
          controller.notifySelection(state.selectedComponentIds);
        }
        if (state.blueprintGesture.active) return;
        if (state.project === previousState.project) {
          if (previousState.blueprintGesture.active && !state.blueprintGesture.active) {
            controller.notifyChange('blueprint');
          }
          return;
        }

        let reason: Parameters<ScreenHostController['notifyChange']>[0] = 'history';
        if (state.project !== null && previousState.project !== null) {
          if (
            state.project.name !== previousState.project.name ||
            state.project.description !== previousState.project.description
          ) {
            reason = 'project-metadata';
          } else if (state.project.canvas !== previousState.project.canvas) {
            reason = 'canvas';
          } else if (state.project.components !== previousState.project.components) {
            reason = 'component';
          } else if (state.project.blueprint !== previousState.project.blueprint) {
            reason = 'blueprint';
          } else if (state.project.globalVariables !== previousState.project.globalVariables) {
            reason = 'global-variable';
          }
        }
        controller.notifyChange(reason);
      }),
    [controller, store],
  );

  useEffect(() => {
    controller.setBinding(projectId, adapter);
  }, [adapter, controller, projectId]);

  useEffect(() => {
    controller.setReadonly(readonly);
  }, [controller, readonly]);

  useImperativeHandle(
    ref,
    () => ({
      controller,
      dispose: () => controller.dispose(),
      fitToScreen: () => workbenchRef.current?.fitToScreen(),
      focusComponent: (componentId) => workbenchRef.current?.focusComponent(componentId) ?? false,
      getDocument: () => {
        const snapshot = createScreenHostSessionPort(store).getSnapshot();
        return snapshot === null ? null : structuredClone(snapshot.draft.document);
      },
      getDraft: () => {
        const snapshot = createScreenHostSessionPort(store).getSnapshot();
        return snapshot === null ? null : structuredClone(snapshot.draft);
      },
      redo: () => {
        if (!readonly) store.getState().redo();
      },
      undo: () => {
        if (!readonly) store.getState().undo();
      },
      validate: () => {
        const snapshot = createScreenHostSessionPort(store).getSnapshot();
        return snapshot === null ? [] : validateScreenSdkCapabilities(snapshot.draft.document);
      },
    }),
    [controller, readonly, store],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) controller.dispose();
      });
    };
  }, [controller]);

  const operations = useMemo<ScreenEditorWorkbenchOperationController>(
    () => ({
      host: { controller, state },
      importController: createV1ScreenImportControllerPort(controller),
      navigate: () => undefined,
      preview: () => undefined,
      projectId: projectId ?? '',
      snapshotController: controller,
    }),
    [controller, projectId, state],
  );

  return (
    <ScreenEditorWorkbench
      ref={workbenchRef}
      operations={operations}
      capabilityProfile="static"
      componentRegistry={componentRegistry}
      isActive={isActive}
      portalRoot={portalRoot}
      project={undefined}
      readonly={readonly}
      setTheme={setTheme}
      theme={theme}
    />
  );
});
