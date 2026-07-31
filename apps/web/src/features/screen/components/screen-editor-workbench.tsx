import { EVENT_BLUEPRINT_VERSION_V2 } from '@nebula/shared';
import {
  dispatchScreenEditorRequestEvent,
  parseScreenDocument,
  SCREEN_DOCUMENT_VERSION,
  ScreenSdkPortalRootProvider,
  Spinner,
  TooltipProvider,
  type ScreenProjectDraft,
} from '@nebula/screen-sdk';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { ScreenSnapshotHostAdapter } from '../adapters/screen-editor-host-adapter';
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
  exportProject: () => ScreenEditorWorkbenchOperationResult;
  isLoading: boolean;
  isPublishing: boolean;
  isSaving: boolean;
  navigate: (url: string, target: '_blank' | '_self') => void;
  preview: () => void;
  projectId: string;
  publish: (callbacks: ScreenEditorWorkbenchMutationCallbacks) => void;
  reload: () => Promise<boolean>;
  save: (callbacks: ScreenEditorWorkbenchMutationCallbacks) => void;
  snapshots?: ScreenSnapshotHostAdapter;
}

export type { ScreenEditorWorkbenchEnvelope } from '../lib/screen-editor-workbench-project';

export interface ScreenEditorWorkbenchProps {
  operations: ScreenEditorWorkbenchOperationController;
  capabilityProfile?: ScreenEditorCapabilityProfile;
  portalRoot?: HTMLElement | null;
  project: ScreenEditorWorkbenchEnvelope | null | undefined;
  setTheme: (theme: ScreenEditorTheme) => void;
  theme: ScreenEditorTheme;
}

export function ScreenEditorWorkbench({
  operations,
  portalRoot = null,
  project,
  setTheme,
  theme,
  capabilityProfile = 'static',
}: ScreenEditorWorkbenchProps) {
  const eventTargetRef = useRef<HTMLDivElement>(null);
  const requestNavigate = useCallback(
    (url: string, target: '_blank' | '_self'): void => {
      if (capabilityProfile === 'static' && eventTargetRef.current !== null) {
        dispatchScreenEditorRequestEvent(eventTargetRef.current, 'nebula-navigate-request', {
          projectId: operations.projectId,
          target,
          url,
        });
        return;
      }
      operations.navigate(url, target);
    },
    [capabilityProfile, operations],
  );

  return (
    <ScreenSdkPortalRootProvider portalRoot={portalRoot}>
      <ScreenEditorEnvironmentProvider
        capabilityProfile={capabilityProfile}
        portalRoot={portalRoot}
        requestNavigate={requestNavigate}
        setTheme={setTheme}
        theme={theme}
      >
        <ScreenEditorNotificationProvider>
          <div ref={eventTargetRef} className="h-full min-h-0 w-full">
            <ScreenEditorWorkbenchContent
              eventTarget={eventTargetRef}
              operations={operations}
              project={project}
            />
          </div>
        </ScreenEditorNotificationProvider>
      </ScreenEditorEnvironmentProvider>
    </ScreenSdkPortalRootProvider>
  );
}

interface ScreenEditorWorkbenchContentProps {
  eventTarget: RefObject<HTMLDivElement | null>;
  operations: ScreenEditorWorkbenchOperationController;
  project: ScreenEditorWorkbenchEnvelope | null | undefined;
}

function ScreenEditorWorkbenchContent({
  eventTarget,
  operations,
  project,
}: ScreenEditorWorkbenchContentProps) {
  const store = useScreenEditorStoreApi();
  const debugHandle = useScreenEditorDebugHandle();
  const { notify } = useScreenEditorNotifications();
  const { capabilityProfile } = useScreenEditorEnvironment();
  const loadProject = useScreenEditorStore((state) => state.loadProject);
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
  const toolStateMachine = useToolStateMachine();
  const interactionStateMachine = useInteractionStateMachine();
  const editorSession = useEditorSession({ toolStateMachine, interactionStateMachine });

  useEffect(() => {
    if (project === null || project === undefined) return;
    const result = createScreenEditorWorkbenchProject(project, capabilityProfile);
    if (!result.success) {
      notify('error', '项目包含当前 SDK 不支持的功能');
      return;
    }
    loadProject(result.project);
  }, [capabilityProfile, loadProject, notify, project]);

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
    operations.save({
      onConflict: () => setShowConflictDialog(true),
      onError: (message) => notify('error', message),
      onSuccess: () => setLastSavedAt(new Date()),
    });
  }, [notify, operations]);

  const handleReloadFromConflict = useCallback(async (): Promise<void> => {
    const reloaded = await operations.reload();
    if (!reloaded) {
      notify('error', '重新加载失败，请重试');
      return;
    }
    setShowConflictDialog(false);
  }, [notify, operations]);

  const doPublish = useCallback((): void => {
    operations.publish({
      onConflict: () => setShowConflictDialog(true),
      onError: (message) => notify('error', message),
      onSuccess: () => notify('success', '发布成功'),
    });
  }, [notify, operations]);

  const handlePublish = useCallback((): void => {
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
  }, [doPublish, notify, store]);

  const handlePublishConfirm = useCallback((): void => {
    setShowPublishConfirm(false);
    setPublishDiagnostics([]);
    doPublish();
  }, [doPublish]);

  const handleExport = useCallback((): void => {
    const result = operations.exportProject();
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

  useKeyboardShortcuts({
    onSave: handleSave,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitToScreen: handleFitToScreen,
    onShowHelp: () => setShowHelp(true),
    editorSession,
    suspended: showEventBlueprint || blueprintSheetOpen || showCodeEditor,
  });

  if (operations.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground/70" />
      </div>
    );
  }

  const canvasWidth = canvasConfig?.width ?? 1920;
  const canvasHeight = canvasConfig?.height ?? 1080;
  const blueprintOpen = showEventBlueprint || blueprintSheetOpen;

  return (
    <TooltipProvider>
      <div className="relative flex h-full min-h-0 w-full flex-col bg-background text-foreground">
        {showToolbar && (
          <EditorToolbar
            onSave={handleSave}
            onPublish={handlePublish}
            onPreview={handlePreview}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            isSaving={operations.isSaving}
            isPublishing={operations.isPublishing}
            lastSavedAt={lastSavedAt}
            editorSession={editorSession}
            menubarProps={{
              onShowImport: () => setShowImport(true),
              onExport: handleExport,
              onShowSnapshotManager:
                operations.snapshots === undefined ? undefined : () => setShowSnapshotManager(true),
              onShowCanvasSettings: () => setShowCanvasSettings(true),
              onShowEventBlueprint: () => setShowEventBlueprint(true),
              onShowCodeEditor: () => setShowCodeEditor(true),
              onShowShortcutsHelp: () => setShowHelp(true),
            }}
          />
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {showPanels && <EditorLeftPanel />}
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
          {showPanels && <EditorRightPanel />}
        </div>
        {showPanels && <CanvasStatusBar editorSession={editorSession} />}
      </div>

      <ShortcutsHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <CanvasSettingsDialog open={showCanvasSettings} onOpenChange={setShowCanvasSettings} />
      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        currentProjectId={operations.projectId}
      />
      {operations.snapshots !== undefined && (
        <SnapshotManagerDialog
          open={showSnapshotManager}
          onOpenChange={setShowSnapshotManager}
          projectId={operations.projectId}
          adapter={operations.snapshots}
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
