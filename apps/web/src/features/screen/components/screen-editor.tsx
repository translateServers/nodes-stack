import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  Save,
  Eye,
  Loader2,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Maximize,
  Layers,
  Package,
} from 'lucide-react';
import { useScreenProject, useUpdateScreenProject, usePublishScreenProject } from '../hooks';
import { useScreenEditorStore } from '../stores/editor-store';
import { ScreenCanvas } from '../components/screen-canvas';
import { ComponentLibrary, useCanvasDrop } from '../components/component-library';
import { PropertyPanel } from '../components/property-panel';
import { LayerPanel } from '../components/layer-panel';
import { CanvasContextMenu } from '../components/canvas-context-menu';
import { CanvasRulers, type RulersHandle } from '../components/canvas-rulers';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];

export function ScreenEditor() {
  const { id } = useParams({ from: '/screen/$id' });
  const navigate = useNavigate();

  const { data: project, isLoading } = useScreenProject(id);
  const updateMutation = useUpdateScreenProject();
  const publishMutation = usePublishScreenProject();

  const loadProject = useScreenEditorStore((s) => s.loadProject);
  const storeProject = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const canvasOffset = useScreenEditorStore((s) => s.canvasOffset);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);
  const setCanvasScaleAndOffset = useScreenEditorStore((s) => s.setCanvasScaleAndOffset);
  const canUndo = useScreenEditorStore((s) => s.history.past.length > 0);
  const canRedo = useScreenEditorStore((s) => s.history.future.length > 0);
  const undo = useScreenEditorStore((s) => s.undo);
  const redo = useScreenEditorStore((s) => s.redo);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rulersRef = useRef<RulersHandle>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'layers'>('library');

  useEffect(() => {
    if (project) {
      loadProject(project);
    }
  }, [project, loadProject]);

  const handleSave = useCallback(() => {
    if (!storeProject) return;
    updateMutation.mutate({
      id: storeProject.id,
      params: {
        name: storeProject.name,
        description: storeProject.description ?? undefined,
        canvas: storeProject.canvas,
        components: storeProject.components,
      },
    });
  }, [storeProject, updateMutation]);

  const handlePublish = useCallback(() => {
    if (!storeProject) return;
    publishMutation.mutate(storeProject.id);
  }, [storeProject, publishMutation]);

  const handlePreview = useCallback(() => {
    window.open(`/screen-preview/${id}`, '_blank');
  }, [id]);

  useKeyboardShortcuts(handleSave);

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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  const canvasWidth = storeProject?.canvas.width ?? 1920;
  const canvasHeight = storeProject?.canvas.height ?? 1080;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => navigate({ to: '/screen' })}
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="text-sm font-medium text-foreground">
          {storeProject?.name ?? '加载中...'}
        </div>

        <div className="mx-2 h-5 w-px bg-border" />

        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          title="撤销 (Ctrl+Z)"
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          title="重做 (Ctrl+Shift+Z)"
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="缩小"
            onClick={handleZoomOut}
          >
            <Minus className="h-4 w-4" />
          </button>
          <select
            className="w-16 rounded border border-input bg-card px-1 py-0.5 text-center text-xs text-foreground"
            value={Math.round(canvasScale * 100)}
            onChange={(e) => setCanvasScale(Number(e.target.value) / 100)}
          >
            {ZOOM_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}%
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="放大"
            onClick={handleZoomIn}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="适应屏幕"
            onClick={handleFitToScreen}
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-2 h-5 w-px bg-border" />

        <button
          type="button"
          className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          保存
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          onClick={handlePublish}
          disabled={publishMutation.isPending}
        >
          发布
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={handlePreview}
        >
          <Eye className="h-4 w-4" />
          预览
        </button>
      </div>

      {/* Editor layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar with tabs */}
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

        {/* Canvas area with rulers and context menu */}
        <div ref={canvasContainerRef} className="relative flex-1 overflow-hidden">
          <CanvasRulers
            ref={rulersRef}
            scale={canvasScale}
            offset={canvasOffset}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            containerRef={canvasContainerRef}
          />
          <div className="absolute inset-0" style={{ top: 20, left: 20 }}>
            <ScreenCanvas onDrop={handleDrop} onDragOver={handleDragOver} />
          </div>
          <CanvasContextMenu containerRef={canvasContainerRef} />
        </div>

        <PropertyPanel />
      </div>
    </div>
  );
}
