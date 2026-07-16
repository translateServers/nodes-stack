import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  Save,
  Eye,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Maximize,
  Layers,
  Package,
  Moon,
  Sun,
  Ruler,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';
import { useScreenProject, useUpdateScreenProject, usePublishScreenProject } from '../hooks';
import { useScreenEditorStore } from '../stores/editor-store';
import { useUiStore } from '@/store';
import { ScreenCanvas } from '../components/screen-canvas';
import { ComponentLibrary, useCanvasDrop } from '../components/component-library';
import { PropertyPanel } from '../components/property-panel';
import { LayerPanel } from '../components/layer-panel';
import { CanvasContextMenu } from '../components/canvas-context-menu';
import { CanvasRulers, type RulersHandle } from '../components/canvas-rulers';
import { CanvasGuides } from '../components/canvas-guides';
import { useKeyboardShortcuts } from '../hooks/use-keyboard-shortcuts';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const guides = useScreenEditorStore((s) => s.guides);
  const toggleGuidesVisibility = useScreenEditorStore((s) => s.toggleGuidesVisibility);
  const clearGuides = useScreenEditorStore((s) => s.clearGuides);
  const toggleGuidesLock = useScreenEditorStore((s) => s.toggleGuidesLock);

  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

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
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/screen' })}>
            <ArrowLeft />
            返回
          </Button>
          <div className="text-sm font-medium text-foreground">
            {storeProject?.name ?? '加载中...'}
          </div>

          <Separator orientation="vertical" className="mx-2 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo}>
                <Undo2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>撤销 (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo}>
                <Redo2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重做 (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={handleZoomOut}>
                  <Minus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>缩小</TooltipContent>
            </Tooltip>
            <Select
              value={String(Math.round(canvasScale * 100))}
              onValueChange={(v) => setCanvasScale(Number(v) / 100)}
            >
              <SelectTrigger size="sm" className="w-16 justify-center text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOOM_PRESETS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={handleZoomIn}>
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>放大</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={handleFitToScreen}>
                  <Maximize />
                </Button>
              </TooltipTrigger>
              <TooltipContent>适应屏幕</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="mx-2 h-5" />

          {/* 参考线控制 */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={guides.visible ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  aria-label="切换参考线显示"
                  onClick={toggleGuidesVisibility}
                >
                  <Ruler />
                </Button>
              </TooltipTrigger>
              <TooltipContent>参考线 (Ctrl+;)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="锁定参考线"
                  onClick={toggleGuidesLock}
                  disabled={!guides.visible}
                >
                  {guides.locked ? <Lock /> : <Unlock />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{guides.locked ? '解锁参考线' : '锁定参考线'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="清除所有参考线"
                  onClick={clearGuides}
                  disabled={
                    !guides.visible ||
                    (guides.vertical.length === 0 && guides.horizontal.length === 0)
                  }
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>清除所有参考线</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="mx-2 h-5" />

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
          <Button variant="outline" onClick={handlePreview}>
            <Eye />
            预览
          </Button>

          <Separator orientation="vertical" className="mx-2 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="切换主题"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            </TooltipContent>
          </Tooltip>
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
            <CanvasGuides
              containerRef={canvasContainerRef}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
            />
            <CanvasContextMenu containerRef={canvasContainerRef} />
          </div>

          <PropertyPanel />
        </div>
      </div>
    </TooltipProvider>
  );
}
