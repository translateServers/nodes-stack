/**
 * 画布闪烁高亮覆盖层（任务 9.1）
 *
 * 在主画布容器上叠加一层绝对定位的闪烁框，定位到目标组件位置。
 * - 当 flashingComponentId 为 null 或对应组件不存在时不渲染
 * - 组件存在时在组件位置渲染一个蓝色 ring 边框 + pulse 动画
 * - pointer-events: none（不拦截交互）
 *
 * 使用场景：蓝图 Sheet 点击节点 → onLocateComponent(componentId)
 * → 主画布渲染本组件，对目标组件闪烁定位。
 */

import type { JSX } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import { resolveComponentContainerStyle } from '../registry/component-container-style';

interface CanvasFlashOverlayProps {
  /** 待闪烁的 componentId；为 null 时不渲染 */
  flashingComponentId: string | null;
  /** 项目组件列表，用于查找目标组件位置 */
  components: ScreenComponent[];
}

/**
 * 闪烁高亮覆盖层。
 *
 * 定位策略：从 components 列表中找到 flashingComponentId 对应组件，
 * 复用 resolveComponentContainerStyle 计算其画布位置与尺寸，
 * 渲染一个绝对定位的蓝色 ring + pulse 动画框。
 *
 * Canvas Drag Optimization：resolveComponentContainerStyle 现返回 left:0/top:0 + transform: translate()，
 * 闪烁框需使用 transform 定位以匹配组件实际位置。
 */
export function CanvasFlashOverlay({
  flashingComponentId,
  components,
}: CanvasFlashOverlayProps): JSX.Element | null {
  if (!flashingComponentId) return null;

  const target = components.find((c) => c.id === flashingComponentId);
  if (!target) return null;

  const style = resolveComponentContainerStyle(target);

  return (
    <div
      className="pointer-events-none absolute z-[9999] animate-pulse rounded-sm ring-4 ring-blue-500 ring-offset-2"
      style={{
        left: 0,
        top: 0,
        width: style.width,
        height: style.height,
        transform: style.transform,
      }}
      data-testid="canvas-flash-overlay"
      data-flashing-component-id={flashingComponentId}
    />
  );
}
