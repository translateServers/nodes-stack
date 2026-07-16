import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Save, Eye, Loader2 } from 'lucide-react';
import { useScreenProject, useUpdateScreenProject, usePublishScreenProject } from '../hooks';
import { useScreenEditorStore } from '../stores/editor-store';
import { ScreenCanvas } from '../components/screen-canvas';
import { ComponentLibrary, useCanvasDrop } from '../components/component-library';
import { PropertyPanel } from '../components/property-panel';

export function ScreenEditor() {
  const { id } = useParams({ from: '/screen/$id' });
  const navigate = useNavigate();

  const { data: project, isLoading } = useScreenProject(id);
  const updateMutation = useUpdateScreenProject();
  const publishMutation = usePublishScreenProject();

  const loadProject = useScreenEditorStore((s) => s.loadProject);
  const storeProject = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const setCanvasScale = useScreenEditorStore((s) => s.setCanvasScale);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        description: storeProject.description,
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const { handleDrop, handleDragOver } = useCanvasDrop();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          onClick={() => navigate({ to: '/screen' })}
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="text-sm font-medium text-gray-800">{storeProject?.name ?? '加载中...'}</div>
        <div className="flex-1" />

        <div className="flex items-center gap-1 text-xs text-gray-500">
          缩放
          <select
            className="rounded border border-gray-300 px-1 py-0.5 text-xs"
            value={Math.round(canvasScale * 100)}
            onChange={(e) => setCanvasScale(Number(e.target.value) / 100)}
          >
            {[25, 50, 75, 100, 125, 150].map((s) => (
              <option key={s} value={s}>
                {s}%
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="flex items-center gap-1 rounded bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
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
          className="flex items-center gap-1 rounded bg-green-500 px-3 py-1.5 text-sm text-white hover:bg-green-600 disabled:opacity-50"
          onClick={handlePublish}
          disabled={publishMutation.isPending}
        >
          发布
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          onClick={handlePreview}
        >
          <Eye className="h-4 w-4" />
          预览
        </button>
      </div>

      {/* Editor layout */}
      <div className="flex flex-1 overflow-hidden">
        <ComponentLibrary />
        <div className="flex-1 overflow-auto">
          <ScreenCanvas onDrop={handleDrop} onDragOver={handleDragOver} />
        </div>
        <PropertyPanel />
      </div>
    </div>
  );
}
