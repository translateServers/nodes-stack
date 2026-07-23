import { useEffect, useRef, useCallback, useState } from 'react';
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
import { BlueprintSheet } from '../blueprint/sheet';
import { compileBlueprint, type Diagnostic } from '../blueprint/compiler';
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
  const storeProject = useScreenEditorStore((s) => s.project);
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
  const [publishDiagnostics, setPublishDiagnostics] = useState<Diagnostic[]>([]);
  // 任务 9.1：蓝图→画布闪烁高亮联动
  const { flashingComponentId, flashComponent } = useCanvasFlash();
  // 任务 9.2：画布→蓝图过滤联动（选中单个组件时传给 BlueprintSheet 过滤视图）
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  const filterComponentId = selectedComponentIds.length === 1 ? selectedComponentIds[0] : null;
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
    if (!storeProject) return;
    updateMutation.mutate(
      {
        id: storeProject.id,
        params: {
          name: storeProject.name,
          description: storeProject.description ?? undefined,
          canvas: storeProject.canvas,
          components: storeProject.components,
          // 任务 5.3：blueprint 随项目保存；undefined 时后端不修改该列（不凭空写入）
          blueprint: storeProject.blueprint,
          expectedUpdatedAt: storeProject.updatedAt,
        },
      },
      {
        onSuccess: (response) => {
          // 保存成功后用服务端响应（含新 updatedAt 与 draft 状态）回写 Store，
          // 作为下次保存/发布基线；保存失败时不调用，保持本地内容
          loadProject(response);
          setLastSavedAt(new Date());
        },
        onError: (error) => {
          // 保存冲突：打开冲突对话框，不调用 loadProject，保持本地 Store/历史/基线不变
          // 非冲突错误由全局错误拦截器处理 Toast
          if (isSaveConflictError(error)) {
            setShowConflictDialog(true);
          }
        },
      },
    );
  }, [storeProject, updateMutation, loadProject]);

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
    if (!storeProject) return;
    publishMutation.mutate(
      {
        id: storeProject.id,
        expectedUpdatedAt: storeProject.updatedAt,
      },
      {
        onSuccess: (response) => {
          // 发布成功后用服务端响应（含新 updatedAt 与 published 状态）回写 Store，
          // 作为下次保存/发布基线；发布失败时不调用，保持本地内容
          loadProject(response);
        },
        onError: (error) => {
          // 发布冲突：复用保存冲突对话框，不调用 loadProject，保持本地 Store/历史/基线不变，
          // 也不更新详情缓存与公开预览缓存（mutation 的 onSuccess 未触发）
          // 非冲突错误由全局错误拦截器处理 Toast
          if (isSaveConflictError(error)) {
            setShowConflictDialog(true);
          }
        },
      },
    );
  }, [storeProject, publishMutation, loadProject]);

  const handlePublish = useCallback(() => {
    if (!storeProject) return;
    // 任务 8.3：存在本地脏状态时阻止直接发布，要求用户显式保存
    if (useScreenEditorStore.getState().isDirty) {
      toast.warning('请先保存修改后再发布');
      return;
    }
    // 任务 5.3：发布前编译蓝图，存在 error 级诊断时弹出确认对话框
    const blueprint = storeProject.blueprint;
    if (blueprint) {
      const componentIds = new Set(storeProject.components.map((c) => c.id));
      const { diagnostics } = compileBlueprint(blueprint, { componentIds });
      const errors = diagnostics.filter((d) => d.level === 'error');
      if (errors.length > 0) {
        setPublishDiagnostics(errors);
        setShowPublishConfirm(true);
        return;
      }
    }
    doPublish();
  }, [storeProject, doPublish]);

  const handlePublishConfirm = useCallback(() => {
    setShowPublishConfirm(false);
    setPublishDiagnostics([]);
    doPublish();
  }, [doPublish]);

  const handlePreview = useCallback(() => {
    window.open(`/screen-preview/${id}`, '_blank');
  }, [id]);

  /** 导出当前项目为 JSON 文件，由浏览器直接触发下载 */
  const handleExport = useCallback(() => {
    if (!storeProject) return;
    try {
      const json = JSON.stringify(storeProject, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${storeProject.name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${storeProject.name}.json`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    }
  }, [storeProject]);

  const { handleDrop, handleDragOver } = useCanvasDrop();

  const handleZoomIn = useCallback(() => {
    setCanvasScale(Math.min(5, canvasScale + 0.1));
  }, [canvasScale, setCanvasScale]);

  const handleZoomOut = useCallback(() => {
    setCanvasScale(Math.max(0.1, canvasScale - 0.1));
  }, [canvasScale, setCanvasScale]);

  const handleFitToScreen = useCallback(() => {
    if (!canvasContainerRef.current || !storeProject) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const canvas = storeProject.canvas;
    const scaleX = (rect.width - 60) / canvas.width;
    const scaleY = (rect.height - 60) / canvas.height;
    const fitScale = Math.min(scaleX, scaleY, 1);
    const offsetX = (rect.width - canvas.width * fitScale) / 2;
    const offsetY = (rect.height - canvas.height * fitScale) / 2;
    setCanvasScaleAndOffset(fitScale, { x: offsetX, y: offsetY });
  }, [storeProject, setCanvasScaleAndOffset]);

  useKeyboardShortcuts({
    onSave: handleSave,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFitToScreen: handleFitToScreen,
    onShowHelp: () => setShowHelp(true),
    editorSession,
    suspended: showEventBlueprint || showCodeEditor,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground/70" />
      </div>
    );
  }

  const canvasWidth = storeProject?.canvas.width ?? 1920;
  const canvasHeight = storeProject?.canvas.height ?? 1080;

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
                />
              </div>
              <CanvasGuides
                containerRef={canvasContainerRef}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
              {/* 任务 5.4：文本编辑器浮层，仅在 textEditing 非空时渲染 */}
              {editorSession.textEditing &&
                storeProject?.components.find(
                  (c) => c.id === editorSession.textEditing?.componentId,
                ) && (
                  <TextEditorOverlay
                    component={
                      storeProject.components.find(
                        (c) => c.id === editorSession.textEditing?.componentId,
                      )!
                    }
                    isNewlyCreated={editorSession.textEditing.isNewlyCreated}
                    canvasScale={canvasScale}
                    canvasOffset={canvasOffset}
                    onExit={handleTextEditorExit}
                  />
                )}
              {/* 任务 9.1：蓝图→画布闪烁高亮覆盖层 */}
              {storeProject && (
                <CanvasFlashOverlay
                  flashingComponentId={flashingComponentId}
                  components={storeProject.components}
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
        projectId={storeProject?.id}
      />
      <BlueprintSheet
        open={showEventBlueprint}
        onOpenChange={setShowEventBlueprint}
        onLocateComponent={flashComponent}
        filterComponentId={filterComponentId}
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
