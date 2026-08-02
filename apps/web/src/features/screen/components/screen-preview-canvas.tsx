import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import {
  BlueprintEventProvider,
  BlueprintPreviewProvider,
  PreviewComponentRenderer,
  buildFilterString,
  CanvasInteractionProvider,
  INTERACTIVE_CAPABILITIES,
  RegistryProvider,
  resolveComponentContainerStyle,
  ScreenEditorRuntimeProfileProvider,
  useBlueprintPreviewRuntime,
} from '@nebula/screen-editor-core';
import type { ScreenComponentRegistry } from '@nebula/screen-sdk/components';
import { DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE } from '../runtime/dynamic-runtime-profile';

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
  /**
   * 共享组件注册表（Task 6.4, Spec §14.2）。
   *
   * 编辑器内预览与公开预览复用同一 registry factory，确保渲染层与编辑器
   * 使用同一组件定义来源。registry 必须在 PreviewCanvas 挂载前就绪。
   */
  registry: ScreenComponentRegistry;
}

interface PreviewCanvasContentProps {
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
 * - 完整派发蓝图组件事件并调度 pageLoad / interval
 * - 通过 RegistryProvider 注入共享 registry（Task 6.4）
 *
 * 调用方负责数据获取与加载/不存在态展示，本组件只接收 project 渲染。
 */
export function PreviewCanvas({ project, registry }: PreviewCanvasProps) {
  return (
    <ScreenEditorRuntimeProfileProvider profile={DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE}>
      <RegistryProvider registry={registry}>
        <PreviewCanvasContent project={project} />
      </RegistryProvider>
    </ScreenEditorRuntimeProfileProvider>
  );
}

function PreviewCanvasContent({ project }: PreviewCanvasContentProps) {
  const { canvas, components, blueprint } = project;
  const scale = fitScale(canvas.width, canvas.height, canvas.scaleMode);
  const { contextValue, onComponentClick, onComponentEvent } = useBlueprintPreviewRuntime(
    blueprint,
    components,
    { enabled: true },
  );

  return (
    <BlueprintPreviewProvider value={contextValue}>
      <BlueprintEventProvider value={onComponentEvent}>
        <CanvasInteractionProvider value={INTERACTIVE_CAPABILITIES}>
          <div className="screen-preview-atmosphere flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
            <div
              className="screen-preview-stage"
              style={{
                width: canvas.width,
                height: canvas.height,
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                backgroundColor: canvas.backgroundColor,
                backgroundImage: canvas.backgroundImage
                  ? `url(${canvas.backgroundImage})`
                  : undefined,
                backgroundSize: 'cover',
                position: 'relative',
              }}
            >
              {components
                .filter((c) => isComponentVisible(c, contextValue.visibilityOverrides))
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((component, index) => (
                  <div
                    key={component.id}
                    className="screen-preview-component-enter"
                    style={{
                      ...resolveComponentContainerStyle(component),
                      filter: buildFilterString(component.style.filter) || undefined,
                      animationDelay: `${Math.min(index, 12) * 90 + 120}ms`,
                    }}
                    data-preview-component-id={component.id}
                    onClick={(e) => {
                      // 阻止冒泡到父容器（避免画布空白处点击触发组件事件）
                      e.stopPropagation();
                      onComponentClick(component.id);
                    }}
                    onMouseEnter={() => {
                      // Dispatch hover events for evt:hover blueprint anchors.
                      onComponentEvent(component.id, 'hover');
                    }}
                  >
                    <PreviewComponentRenderer component={component} />
                  </div>
                ))}
            </div>
          </div>
        </CanvasInteractionProvider>
      </BlueprintEventProvider>
    </BlueprintPreviewProvider>
  );
}
