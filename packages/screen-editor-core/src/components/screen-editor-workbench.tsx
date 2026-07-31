import { EVENT_BLUEPRINT_VERSION_V2 } from '@nebula/shared';
import {
  downloadScreenExportFile,
  dispatchScreenEditorRequestEvent,
  parseScreenDocument,
  SCREEN_DOCUMENT_VERSION,
  ScreenSdkPortalRootProvider,
  Spinner,
  toScreenPublicError,
  TooltipProvider,
  type ScreenHostController,
  type ScreenHostControllerState,
  type ScreenProjectDraft,
} from '@nebula/screen-editor-core/internal';
import {
  lazy,
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react';
import type { ScreenSnapshotHostAdapter } from '../adapters/screen-editor-host-adapter';
import type { ScreenEditorRuntimeProfile } from '../runtime-profile.js';
import { compileBlueprint } from '../blueprint/compiler';
import { compileBlueprintV2 } from '../blueprint/compiler/v2-compile';
import type { BaseDiagnostic } from '../blueprint/hooks';
import { useCanvasFlash } from '../hooks/use-canvas-flash';
import { useEditorSession } from '../hooks/use-editor-session';
import { useInteractionStateMachine } from '../hooks/use-interaction-state-machine';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { useToolStateMachine } from '../hooks/use-tool-state-machine';
import type { TextEditExitKind } from '../lib/text-editing-contract';
import {
  createScreenEditorWorkbenchProject,
  type ScreenEditorWorkbenchEnvelope,
} from '../lib/screen-editor-workbench-project';
import {
  useScreenEditorDebugHandle,
  useScreenEditorStore,
  useScreenEditorStoreApi,
} from '../stores/editor-store';
import { CanvasContextMenu } from './canvas-context-menu';
import { CanvasFlashOverlay } from './canvas-flash-overlay';
import { CanvasGuides } from './canvas-guides';
import { CanvasRulers, type RulersHandle } from './canvas-rulers';
import { CanvasSettingsDialog } from './canvas-settings-dialog';
import { CanvasStatusBar } from './canvas-status-bar';
import { CodeEditorSheet } from './code-editor-sheet';
import { useCanvasDrop } from './component-library';
import { EditorLeftPanel } from './editor-left-panel';
import { EditorRightPanel } from './editor-right-panel';
import { EditorToolbar } from './editor-toolbar';
import { ImportDialog } from './import-dialog';
import { PublishConfirmDialog } from './publish-confirm-dialog';
import { SaveConflictDialog } from './save-conflict-dialog';
import {
  ScreenEditorEnvironmentProvider,
  type ScreenEditorCapabilityProfile,
  type ScreenEditorTheme,
  useScreenEditorEnvironment,
} from './screen-editor-environment';
import {
  ScreenEditorNotificationProvider,
  useScreenEditorNotifications,
} from './screen-editor-notifications';
import { ScreenCanvas } from './screen-canvas';
import { ShortcutsHelpDialog } from './shortcuts-help-dialog';
import { SnapshotManagerDialog } from './snapshot-manager-dialog';
import { TextEditorOverlay } from './text-editor-overlay';

const LazyBlueprintSheetV2 = lazy(() =>
  import('../blueprint/sheet/blueprint-sheet-v2').then((module) => ({
    default: module.BlueprintSheetV2,
  })),
);

export interface ScreenEditorWorkbenchMutationCallbacks {
  onConflict: () => void;
  onError: (message: string) => void;
  onSuccess: () => void;
}

export interface ScreenEditorWorkbenchOperationResult {
  message: string;
  success: boolean;
}

export interface ScreenEditorWorkbenchOperationController {
  exportProject?: () => ScreenEditorWorkbenchOperationResult;
  host?: {
    controller: ScreenHostController;
    state: ScreenHostControllerState;
  };
  isLoading?: boolean;
  isPublishing?: boolean;
  isSaving?: boolean;
  navigate: (url: string, target: '_blank' | '_self') => void;
  preview: () => void;
  projectId: string;
  publish?: (callbacks: ScreenEditorWorkbenchMutationCallbacks) => void;
  reload?: () => Promise<boolean>;
  save?: (callbacks: ScreenEditorWorkbenchMutationCallbacks) => void;
  snapshots?: ScreenSnapshotHostAdapter;
}

export type { ScreenEditorWorkbenchEnvelope } from '../lib/screen-editor-workbench-project';

export interface ScreenEditorWorkbenchProps {
  operations: ScreenEditorWorkbenchOperationController;
  capabilityProfile?: ScreenEditorCapabilityProfile;
  isActive?: () => boolean;
  portalRoot?: HTMLElement | null;
  project: ScreenEditorWorkbenchEnvelope | null | undefined;
  readonly?: boolean;
  runtimeProfile?: ScreenEditorRuntimeProfile;
  setTheme: (theme: ScreenEditorTheme) => void;
  theme: ScreenEditorTheme;
}

export interface ScreenEditorWorkbenchHandle {
  fitToScreen(): void;
  focusComponent(componentId: string): boolean;
}

export const ScreenEditorWorkbench = forwardRef<
  ScreenEditorWorkbenchHandle,
  ScreenEditorWorkbenchProps
>(function ScreenEditorWorkbench(
  {
    operations,
    isActive = () => true,
    portalRoot = null,
    project,
    readonly = false,
    runtimeProfile,
    setTheme,
    theme,
    capabilityProfile = 'static',
  },
  ref,
) {
  const resolvedCapabilityProfile = runtimeProfile?.capabilityProfile ?? capabilityProfile;
  const eventTargetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    operations.host?.controller.setEventTarget(eventTargetRef.current ?? undefined);
    return () => operations.host?.controller.setEventTarget(undefined);
  }, [operations.host?.controller]);
  const requestNavigate = useCallback(
    (url: string, target: '_blank' | '_self'): void => {
      if (resolvedCapabilityProfile === 'static' && eventTargetRef.current !== null) {
        dispatchScreenEditorRequestEvent(eventTargetRef.current, 'nebula-navigate-request', {
          projectId: operations.projectId,
          target,
          url,
        });
        return;
      }
      operations.navigate(url, target);
    },
    [operations, resolvedCapabilityProfile],
  );

  return (
    <ScreenSdkPortalRootProvider portalRoot={portalRoot}>
      <ScreenEditorEnvironmentProvider
        capabilityProfile={resolvedCapabilityProfile}
        isActive={isActive}
        portalRoot={portalRoot}
        readonly={readonly}
        requestNavigate={requestNavigate}
        runtimeProfile={runtimeProfile}
        setTheme={setTheme}
        theme={theme}
      >
        <ScreenEditorNotificationProvider>
          <div ref={eventTargetRef} className="h-full min-h-0 w-full">
            <ScreenEditorWorkbenchContent
              eventTarget={eventTargetRef}
              imperativeRef={ref}
              operations={operations}
              project={project}
            />
          </div>
        </ScreenEditorNotificationProvider>
      </ScreenEditorEnvironmentProvider>
    </ScreenSdkPortalRootProvider>
  );
});

interface ScreenEditorWorkbenchContentProps {
  eventTarget: RefObject<HTMLDivElement | null>;
  imperativeRef: Ref<ScreenEditorWorkbenchHandle>;
  operations: ScreenEditorWorkbenchOperationController;
  project: ScreenEditorWorkbenchEnvelope | null | undefined;
}

function ScreenEditorWorkbenchContent({
  eventTarget,
  imperativeRef,
  operations,
  project,
}: ScreenEditorWorkbenchContentProps) {
  const store = useScreenEditorStoreApi();
  const debugHandle = useScreenEditorDebugHandle();
  const { notify } = useScreenEditorNotifications();
  const { capabilityProfile, isActive, portalRoot, readonly } = useScreenEditorEnvironment();
  const loadProject = useScreenEditorStore((state) => state.loadProject);
  const loadedProject = useScreenEditorStore((state) => state.project);
  const canvasConfig = useScreenEditorStore((state) => state.project?.canvas);
  const canvasScale = useScreenEditorStore((state) => state.canvasScale);
  const canvasOffset = useScreenEditorStore((state) => state.canvasOffset);
  const setCanvasScale = useScreenEditorStore((state) => state.setCanvasScale);
  const setCanvasScaleAndOffset = useScreenEditorStore((state) => state.setCanvasScaleAndOffset);
  const uiVisible = useScreenEditorStore((state) => state.uiVisible);
  const screenMode = useScreenEditorStore((state) => state.screenMode);
  const updateComponent = useScreenEditorStore((state) => state.updateComponent);
  const removeComponent = useScreenEditorStore((state) => state.removeComponent);
  const clearSelection = useScreenEditorStore((state) => state.clearSelection);
  const blueprintSheetOpen = useScreenEditorStore((state) => state.blueprintSheetOpen);
  const blueprintFocusComponentId = useScreenEditorStore(
    (state) => state.blueprintFocusComponentId,
  );
  const closeBlueprintSheet = useScreenEditorStore((state) => state.closeBlueprintSheet);

  const showToolbar = uiVisible && screenMode !== 'fullscreen';
  const showPanels = uiVisible && screenMode === 'standard';
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rulersRef = useRef<RulersHandle>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSnapshotManager, setShowSnapshotManager] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showEventBlueprint, setShowEventBlueprint] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishDiagnostics, setPublishDiagnostics] = useState<BaseDiagnostic[]>([]);
  const { flashingComponentId, flashComponent } = useCanvasFlash();
  const ownerWindow = portalRoot?.ownerDocument.defaultView ?? undefined;
  const toolStateMachine = useToolStateMachine({ ownerWindow });
  const interactionStateMachine = useInteractionStateMachine({ ownerWindow });
  const editorSession = useEditorSession({ toolStateMachine, interactionStateMachine });

  useEffect(() => {
    if (operations.host !== undefined) return;
    if (project === null || project === undefined) return;
    const result = createScreenEditorWorkbenchProject(project, capabilityProfile);
    if (!result.success) {
      notify('error', '项目包含当前 SDK 不支持的功能');
      return;
    }
    loadProject(result.project);
  }, [capabilityProfile, loadProject, notify, operations.host, project]);

  useEffect(() => {
    if (operations.host?.state.phase !== 'awaiting-render' || loadedProject === null) return;
    operations.host.controller.markRendered();
  }, [loadedProject, operations.host]);

  const handleTextEditorExit = useCallback(
    (result: {
      exitKind: TextEditExitKind;
      content: string;
      shouldCommitHistory: boolean;
      shouldDeleteComponent: boolean;
    }): void => {
      const context = editorSession.textEditing;
      if (context === null) return;
      const { componentId, isNewlyCreated } = context;

      if (result.exitKind === 'cancel') {
        if (isNewlyCreated) removeComponent(componentId);
        editorSession.endTextEditing();
        editorSession.dispatchInteraction('escape');
        return;
      }

      if (result.shouldDeleteComponent) {
        removeComponent(componentId);
      } else if (result.shouldCommitHistory) {
        updateComponent(componentId, {
          props: { content: result.content },
        });
      }
      editorSession.endTextEditing();
      editorSession.dispatchInteraction('commit');
    },
    [editorSession, removeComponent, updateComponent],
  );

  const previousToolRef = useRef(editorSession.currentTool);
  useEffect(() => {
    if (previousToolRef.current === editorSession.currentTool) return;
    previousToolRef.current = editorSession.currentTool;
    clearSelection();
  }, [clearSelection, editorSession.currentTool]);

  useEffect(() => {
    if (editorSession.interactionState === 'text-editing') return;
    const context = editorSession.textEditing;
    if (context === null) return;
    if (context.isNewlyCreated) removeComponent(context.componentId);
    editorSession.endTextEditing();
  }, [
    editorSession.endTextEditing,
    editorSession.interactionState,
    editorSession.textEditing,
    removeComponent,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const startTextEditing = (componentId: string): void => {
      const component = store
        .getState()
        .project?.components.find((candidate) => candidate.id === componentId);
      if (component?.type !== 'text') return;
      const content = (component.props as { content?: unknown }).content;
      editorSession.beginTextEditing({
        componentId,
        initialContent: typeof content === 'string' ? content : '请输入文本',
        isNewlyCreated: false,
      });
      editorSession.dispatchInteraction('double-click');
    };
    if (debugHandle !== null) debugHandle.startTextEditing = startTextEditing;
    return () => {
      if (debugHandle?.startTextEditing === startTextEditing) {
        delete debugHandle.startTextEditing;
      }
    };
  }, [debugHandle, editorSession, store]);

  const handleSave = useCallback((): void => {
    if (operations.host !== undefined && editorSession.isInteracting) {
      notify('warning', '请先结束当前编辑操作');
      return;
    }
    if (operations.host !== undefined) {
      void operations.host.controller.save().then(
        () => setLastSavedAt(new Date()),
        (error: unknown) => {
          const publicError = toScreenPublicError(error);
          if (publicError.code === 'CONFLICT') {
            setShowConflictDialog(true);
            return;
          }
          notify('error', publicError.message);
        },
      );
      return;
    }
    operations.save?.({
      onConflict: () => setShowConflictDialog(true),
      onError: (message) => notify('error', message),
      onSuccess: () => setLastSavedAt(new Date()),
    });
  }, [editorSession.isInteracting, notify, operations]);

  const handleReloadFromConflict = useCallback(async (): Promise<void> => {
    if (operations.host !== undefined) {
      try {
        await operations.host.controller.reload({ discardChanges: true });
        setShowConflictDialog(false);
      } catch (error) {
        notify('error', toScreenPublicError(error).message);
      }
      return;
    }
    const reloaded = (await operations.reload?.()) ?? false;
    if (!reloaded) {
      notify('error', '重新加载失败，请重试');
      return;
    }
    setShowConflictDialog(false);
  }, [notify, operations]);

  const doPublish = useCallback((): void => {
    if (operations.host !== undefined) {
      void operations.host.controller.publish().then(
        () => notify('success', '发布成功'),
        (error: unknown) => {
          const publicError = toScreenPublicError(error);
          if (publicError.code === 'CONFLICT') {
            setShowConflictDialog(true);
            return;
          }
          notify('error', publicError.message);
        },
      );
      return;
    }
    operations.publish?.({
      onConflict: () => setShowConflictDialog(true),
      onError: (message) => notify('error', message),
      onSuccess: () => notify('success', '发布成功'),
    });
  }, [notify, operations]);

  const handlePublish = useCallback((): void => {
    if (operations.host !== undefined && editorSession.isInteracting) {
      notify('warning', '请先结束当前编辑操作');
      return;
    }
    const currentProject = store.getState().project;
    if (currentProject === null) return;
    if (store.getState().isDirty) {
      notify('warning', '请先保存修改后再发布');
      return;
    }
    const blueprint = currentProject.blueprint;
    if (blueprint !== undefined) {
      const componentIds = new Set(currentProject.components.map((component) => component.id));
      const diagnostics =
        blueprint.version === EVENT_BLUEPRINT_VERSION_V2
          ? compileBlueprintV2(blueprint, { componentIds }).diagnostics
          : compileBlueprint(blueprint, { componentIds }).diagnostics;
      const errors = diagnostics.filter((diagnostic) => diagnostic.level === 'error');
      if (errors.length > 0) {
        setPublishDiagnostics(errors);
        setShowPublishConfirm(true);
        return;
      }
    }
    doPublish();
  }, [doPublish, editorSession.isInteracting, notify, operations.host, store]);

  const handlePublishConfirm = useCallback((): void => {
    setShowPublishConfirm(false);
    setPublishDiagnostics([]);
    doPublish();
  }, [doPublish]);

  const handleExport = useCallback((): void => {
    if (operations.host !== undefined) {
      void operations.host.controller.exportProject().then(
        (file) => {
          downloadScreenExportFile(file, eventTarget.current?.ownerDocument);
          notify('success', `已导出 ${file.fileName}`);
        },
        (error: unknown) => notify('error', toScreenPublicError(error).message),
      );
      return;
    }
    const result = operations.exportProject?.() ?? { success: false, message: '导出能力不可用' };
    notify(result.success ? 'success' : 'error', result.message);
  }, [notify, operations]);

  const handlePreview = useCallback((): void => {
    if (capabilityProfile === 'dynamic') {
      operations.preview();
      return;
    }
    const currentProject = store.getState().project;
    if (currentProject === null) return;
    const documentResult = parseScreenDocument({
      schemaVersion: SCREEN_DOCUMENT_VERSION,
      canvas: currentProject.canvas,
      components: currentProject.components,
      blueprint: currentProject.blueprint,
      globalVariables: currentProject.globalVariables,
    });
    if (!documentResult.success) {
      notify('error', '项目包含当前 SDK 不支持的功能');
      return;
    }

    const draft: ScreenProjectDraft = {
      name: currentProject.name,
      description: currentProject.description,
      document: documentResult.data,
    };
    if (eventTarget.current !== null) {
      dispatchScreenEditorRequestEvent(eventTarget.current, 'nebula-preview-request', {
        projectId: operations.projectId,
        revision: currentProject.updatedAt,
        draft,
      });
    }
  }, [capabilityProfile, eventTarget, notify, operations, store]);

  const { handleDrop, handleDragOver } = useCanvasDrop();
  const textEditing = editorSession.textEditing;
  const editingComponent = useMemo(() => {
    if (textEditing === null) return undefined;
    return store
      .getState()
      .project?.components.find((component) => component.id === textEditing.componentId);
  }, [store, textEditing]);
  const flashComponents = useMemo(
    () => (flashingComponentId ? store.getState().project?.components : undefined),
    [flashingComponentId, store],
  );

  const handleZoomIn = useCallback((): void => {
    setCanvasScale(Math.min(5, store.getState().canvasScale + 0.1));
  }, [setCanvasScale, store]);
  const handleZoomOut = useCallback((): void => {
    setCanvasScale(Math.max(0.1, store.getState().canvasScale - 0.1));
  }, [setCanvasScale, store]);
  const handleFitToScreen = useCallback((): void => {
    const currentProject = store.getState().project;
    if (canvasContainerRef.current === null || currentProject === null) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const { canvas } = currentProject;
    const scale = Math.min((rect.width - 60) / canvas.width, (rect.height - 60) / canvas.height, 1);
    setCanvasScaleAndOffset(scale, {
      x: (rect.width - canvas.width * scale) / 2,
      y: (rect.height - canvas.height * scale) / 2,
    });
  }, [setCanvasScaleAndOffset, store]);

  useImperativeHandle(
    imperativeRef,
    () => ({
      fitToScreen: handleFitToScreen,
      focusComponent: (componentId) => {
        const component = store
          .getState()
          .project?.components.find((candidate) => candidate.id === componentId);
        if (component === undefined) return false;
        store.getState().selectComponent(componentId);
        const element = Array.from(
          eventTarget.current?.querySelectorAll<HTMLElement>('[data-component-id]') ?? [],
        ).find((candidate) => candidate.dataset['componentId'] === componentId);
        element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return true;
      },
    }),
    [eventTarget, handleFitToScreen, store],
  );

  const hostState = operations.host?.state;
  const hostMutationPending = (hostState?.pendingMutations.length ?? 0) > 0;
  useKeyboardShortcuts({
    onSave: readonly ? () => undefined : handleSave,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitToScreen: handleFitToScreen,
    onShowHelp: () => setShowHelp(true),
    editorSession,
    isActive,
    readonly,
    focusRoot: portalRoot?.getRootNode() as Document | ShadowRoot | undefined,
    suspended: showEventBlueprint || blueprintSheetOpen || showCodeEditor || hostMutationPending,
  });

  const isInitialLoading =
    hostState?.phase === 'loading' ? !hostState.retainedProject : operations.isLoading === true;
  if (hostState?.phase === 'waiting') {
    return <div className="h-full w-full bg-background" aria-label="等待项目配置" />;
  }
  if (isInitialLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground/70" />
      </div>
    );
  }

  if (hostState?.phase === 'error' || hostState?.phase === 'unsupported') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-foreground">{hostState.error?.message ?? '项目加载失败'}</p>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          onClick={() => void operations.host?.controller.retry().catch(() => undefined)}
        >
          重试
        </button>
      </div>
    );
  }

  const canvasWidth = canvasConfig?.width ?? 1920;
  const canvasHeight = canvasConfig?.height ?? 1080;
  const blueprintOpen = showEventBlueprint || blueprintSheetOpen;
  const capabilities = hostState?.capabilities;
  const canPublish =
    operations.host === undefined ? operations.publish !== undefined : capabilities?.publish;
  const canImport = operations.host === undefined ? true : capabilities?.import;
  const canExport =
    operations.host === undefined ? operations.exportProject !== undefined : capabilities?.export;
  const canUseSnapshots =
    operations.host === undefined ? operations.snapshots !== undefined : capabilities?.snapshots;
  const isSaving =
    operations.host === undefined
      ? operations.isSaving === true
      : hostState?.pendingMutations.includes('save') === true;
  const isPublishing =
    operations.host === undefined
      ? operations.isPublishing === true
      : hostState?.pendingMutations.includes('publish') === true;

  return (
    <TooltipProvider>
      <div
        className="relative flex h-full min-h-0 w-full flex-col bg-background text-foreground"
        data-nebula-readonly={readonly ? '' : undefined}
      >
        {showToolbar && (
          <EditorToolbar
            onSave={readonly ? undefined : handleSave}
            onPublish={!readonly && canPublish === true ? handlePublish : undefined}
            onPreview={handlePreview}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            isSaving={isSaving}
            isPublishing={isPublishing}
            lastSavedAt={lastSavedAt}
            editorSession={editorSession}
            menubarProps={{
              onShowImport: !readonly && canImport === true ? () => setShowImport(true) : undefined,
              onExport: canExport === true ? handleExport : undefined,
              onShowSnapshotManager:
                canUseSnapshots === true ? () => setShowSnapshotManager(true) : undefined,
              onShowCanvasSettings: () => setShowCanvasSettings(true),
              onShowEventBlueprint: () => setShowEventBlueprint(true),
              onShowCodeEditor: () => setShowCodeEditor(true),
              onShowShortcutsHelp: () => setShowHelp(true),
            }}
          />
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {showPanels && <EditorLeftPanel readonly={readonly} />}
          <CanvasContextMenu
            onShowCanvasSettings={() => setShowCanvasSettings(true)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            dispatchInteraction={editorSession.dispatchInteraction}
            interactionState={editorSession.interactionState}
          >
            <div
              ref={canvasContainerRef}
              className="relative flex-1 overflow-hidden bg-muted/40"
              style={{
                backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              <CanvasRulers
                ref={rulersRef}
                scale={canvasScale}
                offset={canvasOffset}
                containerRef={canvasContainerRef}
              />
              <div className="absolute inset-0" style={{ top: 20, left: 20 }}>
                <ScreenCanvas
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  editorSession={editorSession}
                  readonly={readonly}
                  rulersRef={rulersRef}
                />
              </div>
              <CanvasGuides
                containerRef={canvasContainerRef}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
              {editingComponent !== undefined && editorSession.textEditing !== null && (
                <TextEditorOverlay
                  component={editingComponent}
                  isNewlyCreated={editorSession.textEditing.isNewlyCreated}
                  canvasScale={canvasScale}
                  canvasOffset={canvasOffset}
                  onExit={handleTextEditorExit}
                />
              )}
              {flashComponents !== undefined && (
                <CanvasFlashOverlay
                  flashingComponentId={flashingComponentId}
                  components={flashComponents}
                />
              )}
            </div>
          </CanvasContextMenu>
          {showPanels && <EditorRightPanel readonly={readonly} />}
        </div>
        {showPanels && <CanvasStatusBar editorSession={editorSession} />}
        {hostState?.phase === 'loading' && hostState.retainedProject && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60">
            <Spinner className="size-6 text-muted-foreground/70" />
          </div>
        )}
        {hostState !== undefined && hostState.pendingMutations.length > 0 && (
          <div
            className="absolute inset-0 z-30 cursor-wait bg-background/10"
            aria-label="项目操作进行中"
          />
        )}
      </div>

      <ShortcutsHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <CanvasSettingsDialog open={showCanvasSettings} onOpenChange={setShowCanvasSettings} />
      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        currentProjectId={operations.projectId}
        onConflict={() => setShowConflictDialog(true)}
        {...(operations.host === undefined ? {} : { hostController: operations.host.controller })}
      />
      {canUseSnapshots === true && (
        <SnapshotManagerDialog
          open={showSnapshotManager}
          onOpenChange={setShowSnapshotManager}
          projectId={operations.projectId}
          onConflict={() => setShowConflictDialog(true)}
          readonly={readonly}
          {...(operations.snapshots === undefined ? {} : { adapter: operations.snapshots })}
          {...(operations.host === undefined ? {} : { hostController: operations.host.controller })}
        />
      )}
      {blueprintOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90">
              <Spinner className="size-6 text-muted-foreground/70" />
            </div>
          }
        >
          <LazyBlueprintSheetV2
            open
            onOpenChange={(next) => {
              setShowEventBlueprint(next);
              if (!next) closeBlueprintSheet();
            }}
            onLocateComponent={flashComponent}
            filterComponentId={blueprintFocusComponentId}
            onSave={handleSave}
            onShowHelp={() => setShowHelp(true)}
          />
        </Suspense>
      )}
      <CodeEditorSheet open={showCodeEditor} onOpenChange={setShowCodeEditor} />
      <SaveConflictDialog
        open={showConflictDialog}
        onReload={() => void handleReloadFromConflict()}
        onCancel={() => setShowConflictDialog(false)}
      />
      <PublishConfirmDialog
        open={showPublishConfirm}
        diagnostics={publishDiagnostics}
        onConfirm={handlePublishConfirm}
        onCancel={() => {
          setShowPublishConfirm(false);
          setPublishDiagnostics([]);
        }}
      />
    </TooltipProvider>
  );
}
