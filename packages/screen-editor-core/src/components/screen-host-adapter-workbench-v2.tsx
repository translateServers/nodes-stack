import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  parseScreenDocumentV2,
  type ScreenDocumentV2,
  type ScreenProjectDraftV2,
} from '../contracts/document.js';
import type { ScreenHostAdapterV2 } from '../contracts/adapter.js';
import type { ScreenSdkDiagnosticV2 } from '../contracts/diagnostics.js';
import type { ScreenChangeReason } from '../events.js';
import { ScreenHostControllerV2 } from '../host/screen-host-controller-v2.js';
import { createV2ScreenImportControllerPort } from '../host/screen-import-controller-port.js';
import { createScreenHostSessionPortV2 } from '../lib/screen-host-session-v2.js';
import type { ScreenComponentInstanceRegistry } from '../registry/instance-registry.js';
import { useScreenEditorStoreApi } from '../stores/editor-store.js';
import {
  ScreenEditorWorkbench,
  type ScreenEditorWorkbenchHandle,
  type ScreenEditorWorkbenchOperationController,
} from './screen-editor-workbench.js';
import type { ScreenEditorTheme } from './screen-editor-environment.js';

export interface ScreenHostAdapterWorkbenchV2Props {
  adapter?: ScreenHostAdapterV2;
  componentRegistry: ScreenComponentInstanceRegistry;
  isActive?: () => boolean;
  portalRoot?: HTMLElement | null;
  projectId?: string;
  readonly?: boolean;
  setTheme: (theme: ScreenEditorTheme) => void;
  theme: ScreenEditorTheme;
}

export interface ScreenHostAdapterWorkbenchV2Handle {
  readonly controller: ScreenHostControllerV2;
  dispose(): void;
  fitToScreen(): void;
  focusComponent(componentId: string): boolean;
  getDocument(): ScreenDocumentV2 | null;
  getDraft(): ScreenProjectDraftV2 | null;
  redo(): void;
  undo(): void;
  validate(): ScreenSdkDiagnosticV2[];
}

/** V2 static workbench: registry-aware external component lifecycle. */
export const ScreenHostAdapterWorkbenchV2 = forwardRef<
  ScreenHostAdapterWorkbenchV2Handle,
  ScreenHostAdapterWorkbenchV2Props
>(function ScreenHostAdapterWorkbenchV2(
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
  const controllerRef = useRef<ScreenHostControllerV2 | null>(null);
  const applyingEnvelopeRef = useRef(false);
  const mountedRef = useRef(false);
  if (controllerRef.current === null) {
    const session = createScreenHostSessionPortV2(store, componentRegistry);
    controllerRef.current = new ScreenHostControllerV2({
      registry: componentRegistry,
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
  const state = useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.getState(),
    () => controller.getState(),
  );

  useEffect(
    () =>
      store.subscribe((nextState, previousState) => {
        if (applyingEnvelopeRef.current) return;
        if (nextState.selectedComponentIds !== previousState.selectedComponentIds) {
          controller.notifySelection(nextState.selectedComponentIds);
        }
        if (nextState.blueprintGesture.active) return;
        if (nextState.project === previousState.project) {
          if (previousState.blueprintGesture.active && !nextState.blueprintGesture.active) {
            controller.notifyChange('blueprint');
          }
          return;
        }

        let reason: ScreenChangeReason = 'history';
        if (nextState.project !== null && previousState.project !== null) {
          if (
            nextState.project.name !== previousState.project.name ||
            nextState.project.description !== previousState.project.description
          ) {
            reason = 'project-metadata';
          } else if (nextState.project.canvas !== previousState.project.canvas) {
            reason = 'canvas';
          } else if (nextState.project.components !== previousState.project.components) {
            reason = 'component';
          } else if (nextState.project.blueprint !== previousState.project.blueprint) {
            reason = 'blueprint';
          } else if (nextState.project.globalVariables !== previousState.project.globalVariables) {
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
        const snapshot = createScreenHostSessionPortV2(store, componentRegistry).getSnapshot();
        return snapshot === null ? null : structuredClone(snapshot.draft.document);
      },
      getDraft: () => {
        const snapshot = createScreenHostSessionPortV2(store, componentRegistry).getSnapshot();
        return snapshot === null ? null : structuredClone(snapshot.draft);
      },
      redo: () => {
        if (!readonly) store.getState().redo();
      },
      undo: () => {
        if (!readonly) store.getState().undo();
      },
      validate: () => {
        const snapshot = createScreenHostSessionPortV2(store, componentRegistry).getSnapshot();
        if (snapshot === null) return [];
        const result = parseScreenDocumentV2(snapshot.draft.document, componentRegistry);
        return result.success ? [] : result.diagnostics;
      },
    }),
    [componentRegistry, controller, readonly, store],
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
      importController: createV2ScreenImportControllerPort(controller),
      navigate: () => undefined,
      preview: () => undefined,
      previewMode: 'v2',
      projectId: projectId ?? '',
      snapshotController: controller,
      staticPreviewAvailable: true,
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
