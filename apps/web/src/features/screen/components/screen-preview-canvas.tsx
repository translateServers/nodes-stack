import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { resolveComponentContainerStyle } from '../registry/component-container-style';
import { BlueprintPreviewProvider, useBlueprintPreviewRuntime } from '../blueprint/runtime';
import { PreviewComponentRenderer } from './preview-component-renderer';

/**
 * 按 scaleMode 计算画布缩放比以适配视口。
 *
 * 纯函数：仅依赖入参与 window 尺寸，不读取任何 store。
 * 公开预览（已发布版本）与编辑器内预览（草稿）共享此函数。
 */
export function fitScale(canvasW: number, canvasH: number, scaleMode: string): number {
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
 *
 * 公开预览与编辑器内预览共享此函数。
 */
export function isComponentVisible(
  component: ScreenComponent,
  visibilityOverrides: Map<string, boolean> | undefined,
): boolean {
  if (visibilityOverrides?.has(component.id)) {
    return visibilityOverrides.get(component.id) === true;
  }
  return !component.status.hidden;
}

interface PreviewCanvasProps {
  project: ScreenProject;
}

/**
 * 预览画布渲染层。
 *
 * 公开预览（读取已发布版本，匿名可访问）与编辑器内预览（读取草稿，需鉴权）
 * 共享此组件。两者差异仅在数据来源（不同 API 端点），渲染逻辑完全一致：
 * - 启用蓝图运行时（BlueprintPreviewProvider）
 * - 自动 fitScale 按 scaleMode 适配视口
 * - 组件可见性判定（isComponentVisible）
 * - 组件点击派发蓝图 componentClick 事件
 *
 * 调用方负责数据获取与加载/不存在态展示，本组件只接收 project 渲染。
 */
export function PreviewCanvas({ project }: PreviewCanvasProps) {
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
