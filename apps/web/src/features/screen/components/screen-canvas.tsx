import { useCallback, useRef } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { ComponentRenderer } from '../registry/renderer';

function ComponentWrapper({ component }: { component: ScreenComponent }) {
  const selectedComponentId = useScreenEditorStore((s) => s.selectedComponentId);
  const selectComponent = useScreenEditorStore((s) => s.selectComponent);
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);

  const isSelected = selectedComponentId === component.id;
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (component.status.locked) return;
      e.stopPropagation();
      selectComponent(component.id);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: component.position.x,
        origY: component.position.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const canvasScale = useScreenEditorStore.getState().canvasScale;
        const dx = (ev.clientX - dragRef.current.startX) / canvasScale;
        const dy = (ev.clientY - dragRef.current.startY) / canvasScale;
        updateComponent(component.id, {
          position: {
            ...component.position,
            x: Math.round(dragRef.current.origX + dx),
            y: Math.round(dragRef.current.origY + dy),
          },
        });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [component, selectComponent, updateComponent],
  );

  if (component.status.hidden) return null;

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`absolute ${component.status.locked ? 'cursor-not-allowed' : 'cursor-move'} ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
      }`}
      style={{
        left: component.position.x,
        top: component.position.y,
        width: component.position.width,
        height: component.position.height,
        zIndex: component.zIndex,
        opacity: component.style.opacity ?? 1,
        borderRadius: component.style.borderRadius,
        borderWidth: component.style.borderWidth,
        borderColor: component.style.borderColor,
        borderStyle: component.style.borderStyle,
        backgroundColor: component.style.backgroundColor,
        overflow: component.style.overflow ?? 'hidden',
      }}
    >
      <ComponentRenderer component={component} />
    </div>
  );
}

export function ScreenCanvas({
  onDrop,
  onDragOver,
}: {
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const project = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const selectComponent = useScreenEditorStore((s) => s.selectComponent);

  if (!project) return null;

  const { canvas, components } = project;

  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-auto bg-gray-100"
      onMouseDown={() => selectComponent(null)}
    >
      <div
        className="relative origin-top-left shrink-0"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${canvasScale})`,
          backgroundColor: canvas.backgroundColor,
          backgroundImage: canvas.backgroundImage ? `url(${canvas.backgroundImage})` : undefined,
          backgroundSize: 'cover',
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {components
          .filter((c) => !c.parentId)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((component) => (
            <ComponentWrapper key={component.id} component={component} />
          ))}
      </div>
    </div>
  );
}
