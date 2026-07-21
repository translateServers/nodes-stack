import { useParams } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { useScreenPreview } from '../hooks';
import { resolveComponentContainerStyle } from '../registry/component-container-style';
import { BlueprintPreviewProvider, useBlueprintPreviewRuntime } from '../blueprint/runtime';
import { PreviewComponentRenderer } from './preview-component-renderer';

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

/**
 * 判定组件在预览中是否可见。
 *
 * 优先级：蓝图 visibilityOverrides > component.status.hidden
 * - 蓝图 setVisibility 动作写入覆盖表后，覆盖 status.hidden
 * - 无覆盖时回退到组件自身的 status.hidden（阶段 2 既有行为）
 */
function isComponentVisible(
  component: ScreenComponent,
  visibilityOverrides: Map<string, boolean> | undefined,
): boolean {
  if (visibilityOverrides?.has(component.id)) {
    return visibilityOverrides.get(component.id) === true;
  }
  return !component.status.hidden;
}

function PreviewCanvas({ project }: { project: ScreenProject }) {
  const { canvas, components, blueprint } = project;
  const scale = fitScale(canvas.width, canvas.height, canvas.scaleMode);
  const { contextValue, onComponentClick } = useBlueprintPreviewRuntime(blueprint, components);

  return (
    <BlueprintPreviewProvider value={contextValue}>
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
            .filter((c) => isComponentVisible(c, contextValue.visibilityOverrides))
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((component) => (
              <div
                key={component.id}
                style={resolveComponentContainerStyle(component)}
                data-preview-component-id={component.id}
                onClick={(e) => {
                  // 阻止冒泡到父容器（避免画布空白处点击触发组件事件）
                  e.stopPropagation();
                  onComponentClick(component.id);
                }}
              >
                <PreviewComponentRenderer component={component} />
              </div>
            ))}
        </div>
      </div>
    </BlueprintPreviewProvider>
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
