import { useCallback } from 'react';
import { Type, BarChart3, Image, Frame, Table, Box } from 'lucide-react';
import { useScreenEditorStore } from '../stores/editor-store';
import { COMPONENT_DEFINITIONS, CATEGORY_LABELS, createComponentInstance } from '../registry';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Type,
  BarChart3,
  Image,
  Frame,
  Table,
  Box,
};

export function ComponentLibrary() {
  const categories = [...new Set(COMPONENT_DEFINITIONS.map((d) => d.category))];

  const handleDragStart = useCallback((e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('component-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div className="flex h-full w-60 flex-col border-r bg-white">
      <div className="border-b px-4 py-3 font-medium">组件库</div>
      <div className="flex-1 overflow-y-auto p-3">
        {categories.map((category) => (
          <div key={category} className="mb-4">
            <div className="mb-2 text-xs font-medium text-gray-500">
              {CATEGORY_LABELS[category] ?? category}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {COMPONENT_DEFINITIONS.filter((d) => d.category === category).map((def) => {
                const Icon = ICON_MAP[def.icon ?? 'Box'] ?? Box;
                return (
                  <div
                    key={def.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, def.type)}
                    className="flex cursor-grab flex-col items-center gap-1 rounded border bg-gray-50 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50 active:cursor-grabbing"
                  >
                    <Icon className="h-5 w-5 text-gray-600" />
                    <span className="text-xs text-gray-700">{def.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useCanvasDrop() {
  const project = useScreenEditorStore((s) => s.project);
  const addComponent = useScreenEditorStore((s) => s.addComponent);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('component-type');
      if (!type || !project) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / canvasScale);
      const y = Math.round((e.clientY - rect.top) / canvasScale);
      const maxZ = project.components.reduce((max, c) => Math.max(max, c.zIndex), 0);

      const instance = createComponentInstance(type, x, y, maxZ + 1, project.components);
      if (instance) {
        addComponent(instance);
      }
    },
    [project, addComponent, canvasScale],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return { handleDrop, handleDragOver };
}
