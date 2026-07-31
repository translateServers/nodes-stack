import {
  ScreenHostController,
  type ScreenHostAdapter,
  type ScreenHostControllerState,
} from '@nebula/screen-sdk';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createScreenHostSessionPort } from '../lib/screen-host-session';
import { useScreenEditorStoreApi } from '../stores/editor-store';
import {
  ScreenEditorWorkbench,
  type ScreenEditorWorkbenchOperationController,
} from './screen-editor-workbench';
import type { ScreenEditorTheme } from './screen-editor-environment';

export interface ScreenHostAdapterWorkbenchProps {
  adapter?: ScreenHostAdapter;
  portalRoot?: HTMLElement | null;
  projectId?: string;
  setTheme: (theme: ScreenEditorTheme) => void;
  theme: ScreenEditorTheme;
}

export function ScreenHostAdapterWorkbench({
  adapter,
  portalRoot = null,
  projectId,
  setTheme,
  theme,
}: ScreenHostAdapterWorkbenchProps) {
  const store = useScreenEditorStoreApi();
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
      operations={operations}
      capabilityProfile="static"
      portalRoot={portalRoot}
      project={undefined}
      setTheme={setTheme}
      theme={theme}
    />
  );
}
