import { useParams } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import type { ScreenProject } from '@nebula/shared';
import { useScreenPreview } from '../hooks';
import { ComponentRenderer } from '../registry/renderer';

function fitScale(canvasW: number, canvasH: number, scaleMode: string): number {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  switch (scaleMode) {
    case 'fit':
      return Math.min(vw / canvasW, vh / canvasH);
    case 'full':
      return Math.max(vw / canvasW, vh / canvasH);
    case 'width':
      return vw / canvasW;
    case 'height':
      return vh / canvasH;
    case 'none':
      return 1;
    default:
      return Math.min(vw / canvasW, vh / canvasH);
  }
}

function PreviewCanvas({ project }: { project: ScreenProject }) {
  const { canvas, components } = project;
  const scale = fitScale(canvas.width, canvas.height, canvas.scaleMode);

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          backgroundColor: canvas.backgroundColor,
          backgroundImage: canvas.backgroundImage ? `url(${canvas.backgroundImage})` : undefined,
          backgroundSize: 'cover',
          position: 'relative',
        }}
      >
        {components
          .filter((c) => !c.status.hidden && !c.parentId)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((component) => (
            <div
              key={component.id}
              style={{
                position: 'absolute',
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
          ))}
      </div>
    </div>
  );
}

export function ScreenPreview() {
  const { id } = useParams({ from: '/screen-preview/$id' });
  const { data: project, isLoading } = useScreenPreview(id);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        大屏项目不存在或未发布
      </div>
    );
  }

  return <PreviewCanvas project={project} />;
}
