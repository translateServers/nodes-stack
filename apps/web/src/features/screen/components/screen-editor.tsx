import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { TextEditExitKind } from '../lib/text-editing-contract';
import { useScreenProject, useUpdateScreenProject, usePublishScreenProject } from '../hooks';
import { useScreenEditorStore } from '../stores/editor-store';
import { ScreenCanvas } from '../components/screen-canvas';
import { TextEditorOverlay } from '../components/text-editor-overlay';
import { useCanvasDrop } from '../components/component-library';
import { EditorLeftPanel } from '../components/editor-left-panel';
import { EditorRightPanel } from '../components/editor-right-panel';
import { EditorToolbar } from '../components/editor-toolbar';
import { CanvasContextMenu } from '../components/canvas-context-menu';
import { CanvasRulers, type RulersHandle } from '../components/canvas-rulers';
import { CanvasGuides } from '../components/canvas-guides';
import { CanvasStatusBar } from './canvas-status-bar';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { useToolStateMachine } from '../hooks/use-tool-state-machine';
import { useInteractionStateMachine } from '../hooks/use-interaction-state-machine';
import { useEditorSession } from '../hooks/use-editor-session';
import { ShortcutsHelpDialog } from './shortcuts-help-dialog';
import { CanvasSettingsDialog } from './canvas-settings-dialog';
import { ImportDialog } from './import-dialog';
import { SnapshotManagerDialog } from './snapshot-manager-dialog';
import { BlueprintSheetV2 } from '../blueprint/sheet';
import { compileBlueprint } from '../blueprint/compiler';
import { compileBlueprintV2 } from '../blueprint/compiler/v2-compile';
import type { BaseDiagnostic } from '../blueprint/hooks';
import { EVENT_BLUEPRINT_VERSION_V2 } from '@nebula/shared';
import { useCanvasFlash } from '../hooks/use-canvas-flash';
import { CanvasFlashOverlay } from './canvas-flash-overlay';
import { CodeEditorSheet } from './code-editor-sheet';
import { SaveConflictDialog } from './save-conflict-dialog';
import { PublishConfirmDialog } from './publish-confirm-dialog';
import { isSaveConflictError } from '../lib/is-save-conflict-error';
import { Spinner } from '@/components/ui/spinner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';

export function ScreenEditor() {
  const { id } = useParams({ from: '/_app/screen/$id' });
  const navigate = useNavigate();

  const { data: project, isLoading, refetch } = useScreenProject(id);
  const updateMutation = useUpdateScreenProject();
  const publishMutation = usePublishScreenProject();

  const loadProject = useScreenEditorStore((s) => s.loadProject);
  // 性能优化：细粒度订阅，仅订阅渲染真正需要的字段，避免整个 project 对象变化（如拖拽结束
  // updateComponent）触发 ScreenEditor 外壳重渲染。回调中需要 project 时统一用 getState() 读取。
  const canvasConfig = useScreenEditorStore((s) => s.project?.canvas);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const canvasOffset = useScreenEditorStore((s) => s.canvasOffset);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);
  const setCanvasScaleAndOffset = useScreenEditorStore((s) => s.setCanvasScaleAndOffset);
  // UI 显隐开关（Tab 快捷键）：false 时隐藏工具栏/侧边栏/属性面板/状态栏，仅保留画布
  const uiVisible = useScreenEditorStore((s) => s.uiVisible);
  // 屏幕模式（F 快捷键）：standard / withMenu / fullscreen，与 uiVisible 组合决定显隐
  const screenMode = useScreenEditorStore((s) => s.screenMode);
  // 组合显隐：uiVisible=false 强制隐藏所有 UI；screenMode 进一步控制细节
  const showToolbar = uiVisible && screenMode !== 'fullscreen';
  const showPanels = uiVisible && screenMode === 'standard';

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rulersRef = useRef<RulersHandle>(null);
  // 最近一次保存成功时间（工具栏保存状态徽标展示用）
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
  // 任务 9.1：蓝图→画布闪烁高亮联动
  const { flashingComponentId, flashComponent } = useCanvasFlash();
  // 任务 9.2：画布→蓝图过滤联动（选中单个组件时传给 BlueprintSheet 过滤视图）
  //
  // 性能优化（2026-07-26）：原本 ScreenEditor 订阅 selectedComponentIds 来派生
  // filterComponentId，但这导致每次点击组件 → ScreenEditor 重渲染 → 整个外壳
  // （左/右面板、画布、上下文菜单、状态栏等）一起重渲染，造成 Moveable 控制框
  // 显示/隐藏延迟（用户感知"抽帧"）。
  // 现在 BlueprintSheet 内部自己订阅 selectedComponentIds 派生 filterComponentId，
  // ScreenEditor 完全脱离 selectedComponentIds 订阅链路，仅保留 BlueprintSheet
  // 显式优先值（QuickEventEditor 携带的 focusComponentId）。
  // 任务 4.7：QuickEventEditor「打开事件蓝图」入口通过 store API 打开 Sheet，
  // 可携带 focusComponentId 自动进入过滤模式（优先级高于选中组件派生的 filterComponentId）
  const blueprintSheetOpen = useScreenEditorStore((s) => s.blueprintSheetOpen);
  const blueprintFocusComponentId = useScreenEditorStore((s) => s.blueprintFocusComponentId);
  const closeBlueprintSheet = useScreenEditorStore((s) => s.closeBlueprintSheet);
  const toolStateMachine = useToolStateMachine();
  const interactionStateMachine = useInteractionStateMachine();
  // 任务 2.2：编辑器只创建一套会话控制器，下发给画布、工具入口、状态栏和快捷键
  const editorSession = useEditorSession({
    toolStateMachine,
    interactionStateMachine,
  });
  // 任务 5.4：文本编辑器提交/取消所需的 Store actions
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);
  const removeComponent = useScreenEditorStore((s) => s.removeComponent);
  // 任务 13.7：切换主工具时清除选中
  const clearSelection = useScreenEditorStore((s) => s.clearSelection);

  /**
   * 任务 5.4：文本编辑器退出回调。
   *
   * 根据 5.1 契约处理提交/取消：
   * - cancel + isNewlyCreated：删除组件（取消创建），不写入历史
   * - cancel + !isNewlyCreated：不修改组件（保留初始内容），不写入历史
   * - commit + shouldDeleteComponent：删除组件（空内容新建），不写入历史
   * - commit + shouldCommitHistory：更新组件 content，写入历史一条
   * - commit + !shouldCommitHistory：不修改组件（无变化），不写入历史
   *
   * 派发到交互状态机：commit/escape → text-editing → idle
   * 同步会话控制器：endTextEditing 清空 textEditing 上下文
   */
  const handleTextEditorExit = useCallback(
    (result: {
      exitKind: TextEditExitKind;
      content: string;
      shouldCommitHistory: boolean;
      shouldDeleteComponent: boolean;
    }) => {
      const ctx = editorSession.textEditing;
      if (!ctx) return;
      const { componentId, isNewlyCreated } = ctx;

      if (result.exitKind === 'cancel') {
        // 取消：新建路径删除组件，编辑路径不修改
        if (isNewlyCreated) {
          removeComponent(componentId);
        }
        editorSession.endTextEditing();
        editorSession.dispatchInteraction('escape');
        return;
      }

      // commit 路径
      if (result.shouldDeleteComponent) {
        // 空内容 + 新建 → 删除组件
        removeComponent(componentId);
      } else if (result.shouldCommitHistory) {
        // 有效内容 + 有变化 → 更新组件
        updateComponent(componentId, {
          props: { ...({ content: result.content } as Record<string, unknown>) },
        });
      }
      // shouldCommitHistory=false 时无变化，不修改组件

      editorSession.endTextEditing();
      editorSession.dispatchInteraction('commit');
    },
    [editorSession, removeComponent, updateComponent],
  );

  useEffect(() => {
    if (project) {
      loadProject(project);
    }
  }, [project, loadProject]);

  /**
   * 任务 13.7：切换主工具时清除选中组件。
   *
   * 选中态只对选择工具有意义，切换到其他工具（抓手/文字/形状/图片/缩放）时
   * 应清除选中，避免 Moveable 控制框残留在画布上干扰新工具的交互。
   *
   * 监听 currentTool（主工具）而非 activeTool（含临时栈），原因：
   * - Space 临时抓手通过 pushTemporaryTool 使 activeTool 变为 'hand'，但 currentTool
   *   保持不变。临时抓手期间选中应保留（松开 Space 回到选择工具后继续编辑）
   * - 只有用户主动切换主工具（点击工具栏）时才清除选中
   *
   * 用 ref 追踪前一次 currentTool，避免初始化时触发 clearSelection。
   */
  const prevCurrentToolRef = useRef(editorSession.currentTool);
  useEffect(() => {
    if (prevCurrentToolRef.current === editorSession.currentTool) return;
    prevCurrentToolRef.current = editorSession.currentTool;
    clearSelection();
  }, [editorSession.currentTool, clearSelection]);

  /**
   * 任务 13.6：文本编辑被外部取消时清理 textEditing 上下文。
   *
   * 修复 bug：用户在文本编辑态直接切换工具时，setToolWithCleanup 派发 cancel
   * 让交互状态机回到 idle，但 textEditing 上下文（会话控制器持有）不会自动清理，
   * 导致 TextEditorOverlay 仍渲染、新建的文本组件残留在画布上。
   *
   * 当 interactionState 不再是 text-editing 但 textEditing 仍存在时，按 cancel 语义处理：
   * - isNewlyCreated=true：删除组件（同 Escape 取消新建路径，不写入历史）
   * - isNewlyCreated=false：保留原内容（同 Escape 取消编辑路径，不写入历史）
   * 然后清空 textEditing 上下文。
   *
   * 注意：不调用 dispatchInteraction('escape')，因为状态已由 setToolWithCleanup 的
   * cancel 派发恢复到 idle，对 idle 派发 escape 是 no-op（但会触发诊断 console.warn）。
   */
  useEffect(() => {
    if (editorSession.interactionState === 'text-editing') return;
    const ctx = editorSession.textEditing;
    if (!ctx) return;
    // interactionState 已离开 text-editing，但 textEditing 上下文仍残留 → 外部取消
    if (ctx.isNewlyCreated) {
      removeComponent(ctx.componentId);
    }
    editorSession.endTextEditing();
  }, [
    editorSession.interactionState,
    editorSession.textEditing,
    editorSession.endTextEditing,
    removeComponent,
  ]);

  // 任务 11.1：E2E fallback — 暴露 beginTextEditing 到 window
  // 原因：Moveable 控制框在第一次点击选中文本后拦截第二次点击，
  // 导致 Playwright dblclick() 无法触发 Selecto 的双击检测。
  // 仅在 DEV 环境暴露，供 E2E 测试直接调用以进入文本编辑态。
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (
      window as unknown as { __startTextEditing?: (componentId: string) => void }
    ).__startTextEditing = (componentId: string) => {
      const comp = useScreenEditorStore
        .getState()
        .project?.components.find((c) => c.id === componentId);
      if (!comp || comp.type !== 'text') return;
      const content = (comp.props as { content?: unknown }).content;
      const initialContent = typeof content === 'string' ? content : '请输入文本';
      editorSession.beginTextEditing({
        componentId,
        initialContent,
        isNewlyCreated: false,
      });
      editorSession.dispatchInteraction('double-click');
    };
    return () => {
      delete (window as unknown as { __startTextEditing?: unknown }).__startTextEditing;
    };
  }, [editorSession]);

  const handleSave = useCallback(() => {
    const currentProject = useScreenEditorStore.getState().project;
    if (!currentProject) return;
    updateMutation.mutate(
      {
        id: currentProject.id,
        params: {
          name: currentProject.name,
          description: currentProject.description ?? undefined,
          canvas: currentProject.canvas,
          components: currentProject.components,
          // 任务 5.3：blueprint 随项目保存；undefined 时后端不修改该列（不凭空写入）
          blueprint: currentProject.blueprint,
          expectedUpdatedAt: currentProject.updatedAt,
        },
      },
      {
        onSuccess: (response) => {
          loadProject(response);
          setLastSavedAt(new Date());
        },
        onError: (error) => {
          if (isSaveConflictError(error)) {
            setShowConflictDialog(true);
          }
        },
      },
    );
  }, [updateMutation, loadProject]);

  // 重新加载服务端版本：放弃本地未保存修改，用服务端最新项目整体替换 Store 项目、基线、选中态和本地历史
  // 重新加载失败时（refetch 抛出异常或 result.data 为空）保持本地内容，不关闭对话框，用户可重试或取消
  const handleReloadFromConflict = useCallback(async () => {
    try {
      const result = await refetch();
      if (!result.data) {
        // refetch 返回但数据为空：保持本地内容，不调用 loadProject，不关闭对话框
        toast.error('重新加载失败，请重试');
        return;
      }
      loadProject(result.data);
      setShowConflictDialog(false);
    } catch {
      // refetch 抛出异常：保持本地内容，不调用 loadProject，不关闭对话框
      toast.error('重新加载失败，请重试');
    }
  }, [refetch, loadProject]);

  const doPublish = useCallback(() => {
    const currentProject = useScreenEditorStore.getState().project;
    if (!currentProject) return;
    publishMutation.mutate(
      {
        id: currentProject.id,
        expectedUpdatedAt: currentProject.updatedAt,
      },
      {
        onSuccess: (response) => {
          loadProject(response);
        },
        onError: (error) => {
          if (isSaveConflictError(error)) {
            setShowConflictDialog(true);
          }
        },
      },
    );
  }, [publishMutation, loadProject]);

  const handlePublish = useCallback(() => {
    const currentProject = useScreenEditorStore.getState().project;
    if (!currentProject) return;
    if (useScreenEditorStore.getState().isDirty) {
      toast.warning('请先保存修改后再发布');
      return;
    }
    const blueprint = currentProject.blueprint;
    if (blueprint) {
      const componentIds = new Set(currentProject.components.map((c) => c.id));
      const diagnostics =
        blueprint.version === EVENT_BLUEPRINT_VERSION_V2
          ? compileBlueprintV2(blueprint, { componentIds }).diagnostics
          : compileBlueprint(blueprint, { componentIds }).diagnostics;
      const errors = diagnostics.filter((d) => d.level === 'error');
      if (errors.length > 0) {
        setPublishDiagnostics(errors);
        setShowPublishConfirm(true);
        return;
      }
    }
    doPublish();
  }, [doPublish]);

  const handlePublishConfirm = useCallback(() => {
    setShowPublishConfirm(false);
    setPublishDiagnostics([]);
    doPublish();
  }, [doPublish]);

  const handlePreview = useCallback(() => {
    // 编辑器内预览读取草稿版本（需登录鉴权），与公开预览页（/screen-preview/$id，匿名读取已发布版本）区分
    window.open(`/screen-editor-preview/${id}`, '_blank');
  }, [id]);

  /** 导出当前项目为 JSON 文件，由浏览器直接触发下载 */
  const handleExport = useCallback(() => {
    const currentProject = useScreenEditorStore.getState().project;
    if (!currentProject) return;
    try {
      const json = JSON.stringify(currentProject, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentProject.name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${currentProject.name}.json`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    }
  }, []);

  const { handleDrop, handleDragOver } = useCanvasDrop();

  /**
   * 文本编辑组件查找：textEditing 为低频状态（仅双击文本进入/退出编辑时变化），
   * 直接从 store 读取，不订阅 components 数组引用以避免拖拽结束触发外壳重渲染。
   */
  const textEditing = editorSession.textEditing;
  const editingComponent = useMemo(() => {
    if (!textEditing) return undefined;
    return useScreenEditorStore
      .getState()
      .project?.components.find((c) => c.id === textEditing.componentId);
  }, [textEditing]);

  /**
   * CanvasFlashOverlay 所需 components：flashingComponentId 为低频事件（蓝图跳转），
   * 直接从 store 读取最新值，不订阅 components 引用。
   */
  const flashComponents = useMemo(
    () => (flashingComponentId ? useScreenEditorStore.getState().project?.components : undefined),
    [flashingComponentId],
  );

  // P0 优化：用 getState() 读取 canvasScale，避免 callback 依赖 canvasScale 导致每次缩放重建
  const handleZoomIn = useCallback(() => {
    setCanvasScale(Math.min(5, useScreenEditorStore.getState().canvasScale + 0.1));
  }, [setCanvasScale]);

  const handleZoomOut = useCallback(() => {
    setCanvasScale(Math.max(0.1, useScreenEditorStore.getState().canvasScale - 0.1));
  }, [setCanvasScale]);

  const handleFitToScreen = useCallback(() => {
    const currentProject = useScreenEditorStore.getState().project;
    if (!canvasContainerRef.current || !currentProject) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const canvas = currentProject.canvas;
    const scaleX = (rect.width - 60) / canvas.width;
    const scaleY = (rect.height - 60) / canvas.height;
    const fitScale = Math.min(scaleX, scaleY, 1);
    const offsetX = (rect.width - canvas.width * fitScale) / 2;
    const offsetY = (rect.height - canvas.height * fitScale) / 2;
    setCanvasScaleAndOffset(fitScale, { x: offsetX, y: offsetY });
  }, [setCanvasScaleAndOffset]);

  useKeyboardShortcuts({
    onSave: handleSave,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitToScreen: handleFitToScreen,
    onShowHelp: () => setShowHelp(true),
    editorSession,
    suspended: showEventBlueprint || blueprintSheetOpen || showCodeEditor,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground/70" />
      </div>
    );
  }

  const canvasWidth = canvasConfig?.width ?? 1920;
  const canvasHeight = canvasConfig?.height ?? 1080;
  const currentProjectId = useScreenEditorStore.getState().project?.id;

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background text-foreground">
        {/* Toolbar（standard + withMenu 显示，fullscreen 隐藏，Tab 切换时强制隐藏） */}
        {showToolbar && (
          <EditorToolbar
            onBack={() => void navigate({ to: '/screen' })}
            onSave={handleSave}
            onPublish={handlePublish}
            onPreview={handlePreview}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            isSaving={updateMutation.isPending}
            isPublishing={publishMutation.isPending}
            lastSavedAt={lastSavedAt}
            editorSession={editorSession}
            menubarProps={{
              onShowImport: () => setShowImport(true),
              onExport: handleExport,
              onShowSnapshotManager: () => setShowSnapshotManager(true),
              onShowCanvasSettings: () => setShowCanvasSettings(true),
              onShowEventBlueprint: () => setShowEventBlueprint(true),
              onShowCodeEditor: () => setShowCodeEditor(true),
              onShowShortcutsHelp: () => setShowHelp(true),
            }}
          />
        )}

        {/* Editor layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar（组件库/图层，仅 standard 模式显示，宽度可调、可折叠） */}
          {showPanels && <EditorLeftPanel />}

          {/* Canvas area with rulers and context menu（始终显示） */}
          <CanvasContextMenu
            onShowCanvasSettings={() => setShowCanvasSettings(true)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            dispatchInteraction={editorSession.dispatchInteraction}
            interactionState={editorSession.interactionState}
          >
            {/* 画布工作区：点阵底纹衬托画布边界（语义 token，light/dark 自适应） */}
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
              {/* 任务 5.4：文本编辑器浮层，仅在 textEditing 非空时渲染 */}
              {editingComponent && editorSession.textEditing && (
                <TextEditorOverlay
                  component={editingComponent}
                  isNewlyCreated={editorSession.textEditing.isNewlyCreated}
                  canvasScale={canvasScale}
                  canvasOffset={canvasOffset}
                  onExit={handleTextEditorExit}
                />
              )}
              {/* 任务 9.1：蓝图→画布闪烁高亮覆盖层 */}
              {flashComponents && (
                <CanvasFlashOverlay
                  flashingComponentId={flashingComponentId}
                  components={flashComponents}
                />
              )}
            </div>
          </CanvasContextMenu>

          {/* Property panel（仅 standard 模式显示，宽度可调、可折叠） */}
          {showPanels && <EditorRightPanel />}
        </div>

        {/* Status bar（仅 standard 模式显示） */}
        {showPanels && <CanvasStatusBar editorSession={editorSession} />}
      </div>
      <ShortcutsHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <CanvasSettingsDialog open={showCanvasSettings} onOpenChange={setShowCanvasSettings} />
      <ImportDialog open={showImport} onOpenChange={setShowImport} currentProjectId={id} />
      <SnapshotManagerDialog
        open={showSnapshotManager}
        onOpenChange={setShowSnapshotManager}
        projectId={currentProjectId}
      />
      <BlueprintSheetV2
        open={showEventBlueprint || blueprintSheetOpen}
        onOpenChange={(next) => {
          // 任一来源关闭都同步：React state 关闭工具栏入口，store API 关闭 QuickEventEditor 入口
          setShowEventBlueprint(next);
          if (!next) closeBlueprintSheet();
        }}
        onLocateComponent={flashComponent}
        // 仅传 QuickEventEditor 的显式 focusComponentId；普通选中态由 BlueprintSheetV2
        // 内部订阅 selectedComponentIds 自动派生，避免 ScreenEditor 重新渲染
        filterComponentId={blueprintFocusComponentId}
        onSave={handleSave}
        onShowHelp={() => setShowHelp(true)}
      />
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
