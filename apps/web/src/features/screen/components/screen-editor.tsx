import {
  STATIC_SCREEN_EDITOR_RUNTIME_PROFILE,
  createScreenEditorStore,
  isSaveConflictError,
  ScreenEditorStoreProvider,
  ScreenEditorWorkbench,
  useScreenEditorStoreApi,
  type ScreenEditorCapabilityProfile,
  type ScreenEditorHostAdapter,
  type ScreenEditorStore,
  type ScreenEditorTheme,
  type ScreenEditorWorkbenchEnvelope,
  type ScreenEditorWorkbenchMutationCallbacks,
  type ScreenEditorWorkbenchOperationController,
  type ScreenEditorWorkbenchOperationResult,
  type ScreenNavigateRequestDetail,
} from '@nebula/screen-editor-core';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from '@tanstack/react-router';
import { usePublishScreenProject, useScreenProject, useUpdateScreenProject } from '../hooks';
import { openNebulaScreenEditorPreview } from '../adapters/nebula-screen-host-adapter';
import { DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE } from '../runtime/dynamic-runtime-profile';

export interface ScreenEditorProps {
  debug?: boolean;
  capabilityProfile?: ScreenEditorCapabilityProfile;
  hostAdapter?: ScreenEditorHostAdapter;
  instanceId?: string;
  onThemeChange?: (theme: ScreenEditorTheme) => void;
  persistPreferences?: boolean;
  portalRoot?: HTMLElement | null;
  preferenceNamespace?: string;
  store?: ScreenEditorStore;
  theme?: ScreenEditorTheme;
}

declare global {
  interface Window {
    __screenEditorStore?: ScreenEditorStore;
  }
}

export function ScreenEditor({
  debug = import.meta.env.DEV,
  hostAdapter,
  capabilityProfile = 'dynamic',
  instanceId = 'nebula-web-screen-editor',
  onThemeChange = () => undefined,
  persistPreferences = true,
  portalRoot = null,
  preferenceNamespace,
  store: providedStore,
  theme = 'light',
}: ScreenEditorProps = {}) {
  const storeRef = useRef<ScreenEditorStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current =
      providedStore ??
      createScreenEditorStore({ instanceId, persistPreferences, preferenceNamespace });
  }

  useEffect(() => {
    const store = storeRef.current;
    if (!debug || store === null) return;
    window.__screenEditorStore = store;
    return () => {
      if (window.__screenEditorStore === store) delete window.__screenEditorStore;
    };
  }, [debug]);

  return (
    <ScreenEditorStoreProvider
      store={storeRef.current}
      debug={debug}
      instanceId={instanceId}
      preferenceNamespace={preferenceNamespace}
    >
      <NebulaScreenEditorHost
        capabilityProfile={capabilityProfile}
        hostAdapter={hostAdapter}
        onThemeChange={onThemeChange}
        portalRoot={portalRoot}
        theme={theme}
      />
    </ScreenEditorStoreProvider>
  );
}

interface NebulaScreenEditorHostProps {
  capabilityProfile: ScreenEditorCapabilityProfile;
  hostAdapter?: ScreenEditorHostAdapter;
  onThemeChange: (theme: ScreenEditorTheme) => void;
  portalRoot: HTMLElement | null;
  theme: ScreenEditorTheme;
}

function NebulaScreenEditorHost({
  capabilityProfile,
  hostAdapter,
  onThemeChange,
  portalRoot,
  theme,
}: NebulaScreenEditorHostProps) {
  const { id } = useParams({ from: '/_app/screen/$id' });
  const store = useScreenEditorStoreApi();
  const { data: project, isLoading, refetch } = useScreenProject(id);
  const updateMutation = useUpdateScreenProject();
  const publishMutation = usePublishScreenProject();

  const save = useCallback(
    (callbacks: ScreenEditorWorkbenchMutationCallbacks): void => {
      const currentProject = store.getState().project;
      if (currentProject === null) {
        callbacks.onError('当前项目尚未加载');
        return;
      }
      updateMutation.mutate(
        {
          id: currentProject.id,
          params: {
            name: currentProject.name,
            description: currentProject.description ?? undefined,
            canvas: currentProject.canvas,
            components: currentProject.components,
            blueprint: currentProject.blueprint,
            expectedUpdatedAt: currentProject.updatedAt,
          },
        },
        {
          onSuccess: (response) => {
            store.getState().loadProject(response);
            callbacks.onSuccess();
          },
          onError: (error) => {
            if (isSaveConflictError(error)) {
              callbacks.onConflict();
              return;
            }
            callbacks.onError('保存失败，请重试');
          },
        },
      );
    },
    [store, updateMutation],
  );

  const reload = useCallback(async (): Promise<boolean> => {
    try {
      const result = await refetch();
      if (result.data === undefined) return false;
      store.getState().loadProject(result.data);
      return true;
    } catch {
      return false;
    }
  }, [refetch, store]);

  const publish = useCallback(
    (callbacks: ScreenEditorWorkbenchMutationCallbacks): void => {
      const currentProject = store.getState().project;
      if (currentProject === null) {
        callbacks.onError('当前项目尚未加载');
        return;
      }
      publishMutation.mutate(
        {
          id: currentProject.id,
          expectedUpdatedAt: currentProject.updatedAt,
        },
        {
          onSuccess: (response) => {
            store.getState().loadProject(response);
            callbacks.onSuccess();
          },
          onError: (error) => {
            if (isSaveConflictError(error)) {
              callbacks.onConflict();
              return;
            }
            callbacks.onError('发布失败，请重试');
          },
        },
      );
    },
    [publishMutation, store],
  );

  const preview = useCallback((): void => {
    openNebulaScreenEditorPreview({ projectId: id });
  }, [id]);

  const navigate = useCallback((url: string, target: '_blank' | '_self'): void => {
    if (target === '_blank') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.assign(url);
  }, []);

  const exportProject = useCallback((): ScreenEditorWorkbenchOperationResult => {
    const currentProject = store.getState().project;
    if (currentProject === null) {
      return { success: false, message: '当前项目尚未加载' };
    }
    try {
      const blob = new Blob([JSON.stringify(currentProject, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentProject.name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, message: `已导出 ${currentProject.name}.json` };
    } catch {
      return { success: false, message: '导出失败' };
    }
  }, [store]);

  const operations = useMemo<ScreenEditorWorkbenchOperationController>(
    () => ({
      exportProject,
      isLoading,
      isPublishing: publishMutation.isPending,
      isSaving: updateMutation.isPending,
      navigate,
      preview,
      projectId: id,
      publish,
      reload,
      save,
      snapshots: hostAdapter?.snapshots,
    }),
    [
      exportProject,
      hostAdapter?.snapshots,
      id,
      isLoading,
      navigate,
      preview,
      publish,
      publishMutation.isPending,
      reload,
      save,
      updateMutation.isPending,
    ],
  );
  const envelope = useMemo<ScreenEditorWorkbenchEnvelope | null | undefined>(() => {
    if (project === null || project === undefined) return project;
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      revision: project.updatedAt,
      document: {
        schemaVersion: 1,
        canvas: project.canvas,
        components: project.components,
        blueprint: project.blueprint,
        globalVariables: project.globalVariables,
      },
    };
  }, [project]);

  const workbenchHostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const workbenchHost = workbenchHostRef.current;
    if (workbenchHost === null) return;
    const handlePreviewRequest = (): void => preview();
    const handleNavigateRequest = (event: Event): void => {
      const { url, target } = (event as CustomEvent<ScreenNavigateRequestDetail>).detail;
      navigate(url, target);
    };
    workbenchHost.addEventListener('nebula-preview-request', handlePreviewRequest);
    workbenchHost.addEventListener('nebula-navigate-request', handleNavigateRequest);
    return () => {
      workbenchHost.removeEventListener('nebula-preview-request', handlePreviewRequest);
      workbenchHost.removeEventListener('nebula-navigate-request', handleNavigateRequest);
    };
  }, [navigate, preview]);

  return (
    <div ref={workbenchHostRef} className="h-full min-h-0 w-full">
      <ScreenEditorWorkbench
        operations={operations}
        capabilityProfile={capabilityProfile}
        portalRoot={portalRoot}
        project={envelope}
        runtimeProfile={
          capabilityProfile === 'static'
            ? STATIC_SCREEN_EDITOR_RUNTIME_PROFILE
            : DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE
        }
        setTheme={onThemeChange}
        theme={theme}
      />
    </div>
  );
}
