import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import type { ScreenHostAdapter } from '../contracts/adapter.js';
import {
  parseScreenDocument,
  type ScreenDocument,
  type ScreenProjectDraft,
} from '../contracts/document.js';
import type { ScreenSdkDiagnostic } from '../contracts/diagnostics.js';
import type { ScreenChangeReason } from '../events.js';
import { ScreenHostController } from '../host/screen-host-controller.js';
import { createScreenImportControllerPort } from '../host/screen-import-controller-port.js';
import { createScreenHostSessionPort } from '../lib/screen-host-session.js';
import type { ScreenComponentInstanceRegistry } from '../registry/instance-registry.js';
import { useScreenEditorStoreApi } from '../stores/editor-store.js';
import type { ScreenEditorTheme } from './screen-editor-environment.js';
import {
  ScreenEditorWorkbench,
  type ScreenEditorWorkbenchHandle,
  type ScreenEditorWorkbenchOperationController,
} from './screen-editor-workbench.js';

export interface ScreenHostAdapterWorkbenchProps {
  readonly adapter?: ScreenHostAdapter;
  readonly componentRegistry: ScreenComponentInstanceRegistry;
  readonly isActive?: () => boolean;
  readonly portalRoot?: HTMLElement | null;
  readonly projectId?: string;
  readonly readonly?: boolean;
  readonly setTheme: (theme: ScreenEditorTheme) => void;
  readonly theme: ScreenEditorTheme;
}

export interface ScreenHostAdapterWorkbenchHandle {
  readonly controller: ScreenHostController;
  readonly dispose: () => void;
  readonly fitToScreen: () => void;
  readonly focusComponent: (componentId: string) => boolean;
  readonly getDocument: () => ScreenDocument | null;
  readonly getDraft: () => ScreenProjectDraft | null;
  readonly redo: () => void;
  readonly undo: () => void;
  readonly validate: () => ScreenSdkDiagnostic[];
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
    const session = createScreenHostSessionPort(store, componentRegistry);
    controllerRef.current = new ScreenHostController({
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
        if (applyingEnvelopeRef.current) {
          return;
        }
        if (nextState.selectedComponentIds !== previousState.selectedComponentIds) {
          controller.notifySelection(nextState.selectedComponentIds);
        }
        if (nextState.blueprintGesture.active) {
          return;
        }
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
        const snapshot = createScreenHostSessionPort(store, componentRegistry).getSnapshot();
        return snapshot === null ? null : structuredClone(snapshot.draft.document);
      },
      getDraft: () => {
        const snapshot = createScreenHostSessionPort(store, componentRegistry).getSnapshot();
        return snapshot === null ? null : structuredClone(snapshot.draft);
      },
      redo: () => {
        if (!readonly) {
          store.getState().redo();
        }
      },
      undo: () => {
        if (!readonly) {
          store.getState().undo();
        }
      },
      validate: () => {
        const snapshot = createScreenHostSessionPort(store, componentRegistry).getSnapshot();
        if (snapshot === null) {
          return [];
        }
        const result = parseScreenDocument(snapshot.draft.document, componentRegistry);
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
        if (!mountedRef.current) {
          controller.dispose();
        }
      });
    };
  }, [controller]);

  const operations = useMemo<ScreenEditorWorkbenchOperationController>(
    () => ({
      host: { controller, state },
      importController: createScreenImportControllerPort(controller),
      navigate: () => undefined,
      preview: () => undefined,
      projectId: projectId ?? '',
      snapshotController: controller,
      staticPreviewAvailable: true,
    }),
    [controller, projectId, state],
  );

  return (
    <ScreenEditorWorkbench
      ref={workbenchRef}
      capabilityProfile="static"
      componentRegistry={componentRegistry}
      isActive={isActive}
      operations={operations}
      portalRoot={portalRoot}
      project={undefined}
      readonly={readonly}
      setTheme={setTheme}
      theme={theme}
    />
  );
});
