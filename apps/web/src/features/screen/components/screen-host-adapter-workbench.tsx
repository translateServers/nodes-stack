import {
  ScreenHostController,
  type ScreenDocumentV1,
  type ScreenHostAdapter,
  type ScreenHostControllerState,
  type ScreenProjectDraft,
  type ScreenSdkDiagnostic,
  validateScreenSdkCapabilities,
} from '@nebula/screen-sdk';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { createScreenHostSessionPort } from '../lib/screen-host-session';
import { useScreenEditorStoreApi } from '../stores/editor-store';
import {
  ScreenEditorWorkbench,
  type ScreenEditorWorkbenchHandle,
  type ScreenEditorWorkbenchOperationController,
} from './screen-editor-workbench';
import type { ScreenEditorTheme } from './screen-editor-environment';

export interface ScreenHostAdapterWorkbenchProps {
  adapter?: ScreenHostAdapter;
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
      navigate: () => undefined,
      preview: () => undefined,
      projectId: projectId ?? '',
    }),
    [controller, projectId, state],
  );

  return (
    <ScreenEditorWorkbench
      ref={workbenchRef}
      operations={operations}
      capabilityProfile="static"
      isActive={isActive}
      portalRoot={portalRoot}
      project={undefined}
      readonly={readonly}
      setTheme={setTheme}
      theme={theme}
    />
  );
});
