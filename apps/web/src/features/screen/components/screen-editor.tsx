import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Save, Layers, Package } from 'lucide-react';
import { useScreenProject, useUpdateScreenProject, usePublishScreenProject } from '../hooks';
import { useScreenEditorStore } from '../stores/editor-store';
import { ScreenCanvas } from '../components/screen-canvas';
import { ComponentLibrary, useCanvasDrop } from '../components/component-library';
import { PropertyPanel } from '../components/property-panel';
import { LayerPanel } from '../components/layer-panel';
import { CanvasContextMenu } from '../components/canvas-context-menu';
import { CanvasRulers, type RulersHandle } from '../components/canvas-rulers';
import { CanvasGuides } from '../components/canvas-guides';
import { CanvasStatusBar } from './canvas-status-bar';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { useToolStateMachine } from '../hooks/use-tool-state-machine';
import { ShortcutsHelpDialog } from './shortcuts-help-dialog';
import { ProjectMenubar } from './project-menubar';
import { CanvasSettingsDialog } from './canvas-settings-dialog';
import { ImportDialog } from './import-dialog';
import { SnapshotManagerDialog } from './snapshot-manager-dialog';
import { EventBlueprintSheet } from './event-blueprint-sheet';
import { CodeEditorSheet } from './code-editor-sheet';
import { SaveConflictDialog } from './save-conflict-dialog';
import { isSaveConflictError } from '../lib/is-save-conflict-error';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
  const [activeTab, setActiveTab] = useState<'library' | 'layers'>('library');
  const [showHelp, setShowHelp] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSnapshotManager, setShowSnapshotManager] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showEventBlueprint, setShowEventBlueprint] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const toolStateMachine = useToolStateMachine();

  useEffect(() => {
    if (project) {
      loadProject(project);
    }
  }, [project, loadProject]);

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
          expectedUpdatedAt: storeProject.updatedAt,
        },
      },
      {
        onSuccess: (response) => {
          // 保存成功后用服务端响应（含新 updatedAt 与 draft 状态）回写 Store，
          // 作为下次保存/发布基线；保存失败时不调用，保持本地内容
          loadProject(response);
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

  const handlePublish = useCallback(() => {
    if (!storeProject) return;
    // 任务 8.3：存在本地脏状态时阻止直接发布，要求用户显式保存
    if (useScreenEditorStore.getState().isDirty) {
      toast.warning('请先保存修改后再发布');
      return;
    }
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
    toolStateMachine,
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
          <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => void navigate({ to: '/screen' })}>
              <ArrowLeft />
              返回
            </Button>
            <div className="text-sm font-medium text-foreground">
              {storeProject?.name ?? '加载中...'}
            </div>

            <Separator orientation="vertical" className="mx-2 h-5" />

            <ProjectMenubar
              onSave={handleSave}
              onPublish={handlePublish}
              onPreview={handlePreview}
              onShowImport={() => setShowImport(true)}
              onExport={handleExport}
              onShowSnapshotManager={() => setShowSnapshotManager(true)}
              onShowCanvasSettings={() => setShowCanvasSettings(true)}
              onShowEventBlueprint={() => setShowEventBlueprint(true)}
              onShowCodeEditor={() => setShowCodeEditor(true)}
              onShowShortcutsHelp={() => setShowHelp(true)}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitToScreen={handleFitToScreen}
              isSaving={updateMutation.isPending}
              isPublishing={publishMutation.isPending}
            />

            <div className="flex-1" />

            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Spinner className="size-4" /> : <Save />}
              保存
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishMutation.isPending}
              className="bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              发布
            </Button>
          </div>
        )}

        {/* Editor layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar with tabs（仅 standard 模式显示） */}
          {showPanels && (
            <div className="flex h-full w-60 flex-col border-r border-border bg-card">
              <div className="flex border-b border-border">
                <button
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'library'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveTab('library')}
                >
                  <Package className="h-3.5 w-3.5" />
                  组件库
                </button>
                <button
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'layers'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveTab('layers')}
                >
                  <Layers className="h-3.5 w-3.5" />
                  图层
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'library' ? <ComponentLibrary /> : <LayerPanel />}
              </div>
            </div>
          )}

          {/* Canvas area with rulers and context menu（始终显示） */}
          <CanvasContextMenu
            onShowCanvasSettings={() => setShowCanvasSettings(true)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
          >
            <div ref={canvasContainerRef} className="relative flex-1 overflow-hidden">
              <CanvasRulers
                ref={rulersRef}
                scale={canvasScale}
                offset={canvasOffset}
                containerRef={canvasContainerRef}
              />
              <div className="absolute inset-0" style={{ top: 20, left: 20 }}>
                <ScreenCanvas onDrop={handleDrop} onDragOver={handleDragOver} />
              </div>
              <CanvasGuides
                containerRef={canvasContainerRef}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            </div>
          </CanvasContextMenu>

          {/* Property panel（仅 standard 模式显示） */}
          {showPanels && <PropertyPanel />}
        </div>

        {/* Status bar（仅 standard 模式显示） */}
        {showPanels && <CanvasStatusBar toolStateMachine={toolStateMachine} />}
      </div>
      <ShortcutsHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <CanvasSettingsDialog open={showCanvasSettings} onOpenChange={setShowCanvasSettings} />
      <ImportDialog open={showImport} onOpenChange={setShowImport} currentProjectId={id} />
      <SnapshotManagerDialog
        open={showSnapshotManager}
        onOpenChange={setShowSnapshotManager}
        projectId={storeProject?.id}
      />
      <EventBlueprintSheet open={showEventBlueprint} onOpenChange={setShowEventBlueprint} />
      <CodeEditorSheet open={showCodeEditor} onOpenChange={setShowCodeEditor} />
      <SaveConflictDialog
        open={showConflictDialog}
        onReload={() => void handleReloadFromConflict()}
        onCancel={() => setShowConflictDialog(false)}
      />
    </TooltipProvider>
  );
}
