import type { CSSProperties } from 'react';
import type { ScreenComponent } from '@nebula/shared';

/**
 * 构造组件变换字符串（translate -> rotate -> scaleX -> scaleY）。
 *
 * CSS transform 从右到左应用：视觉上先翻转再旋转，最后平移到目标位置。
 * translate 作为最外层变换，仅改变组件在画布坐标系下的绝对位置，
 * 不影响旋转/翻转的视觉锚点（始终为组件中心，transform-origin 默认 50% 50%）。
 *
 * 供渲染层（resolveComponentContainerStyle）与事件层（Moveable onDrag/onResize/onRotate）
 * 共享，确保 transform 链顺序一致，避免渲染产物与拖拽过程 DOM 写入互相覆盖。
 *
 * Phase 2 Slice D：扩展支持水平/垂直翻转（scaleX(-1) / scaleY(-1)）。
 * Canvas Drag Optimization：扩展支持 translate 定位（替代 left/top，GPU 合成层）。
 */
export function composeComponentTransform(
  x: number,
  y: number,
  rotation: number,
  flipX: boolean,
  flipY: boolean,
): string {
  const parts: string[] = [`translate(${x}px, ${y}px)`];
  if (rotation) parts.push(`rotate(${rotation}deg)`);
  if (flipX) parts.push('scaleX(-1)');
  if (flipY) parts.push('scaleY(-1)');
  return parts.join(' ');
}

/**
 * 解析组件公共容器样式为 React CSSProperties。
 *
 * 纯函数：仅依赖入参 component，不读取编辑器 Store、DOM、window 或 Moveable 状态。
 * 编辑器与预览共享此解析结果，避免重复映射导致的字段漂移（如预览漏掉旋转）。
 *
 * Phase 2 Slice D：transform 扩展支持水平/垂直翻转（CSS transform 链：
 * `translate(...) rotate(...) scaleX(-1) scaleY(-1)`）。翻转锚点固定为中心（transform-origin 默认）。
 *
 * Canvas Drag Optimization：组件定位从 `left/top` 迁移到 `transform: translate()`，
 * 利用 GPU 合成层避免布局重排，提升拖拽流畅度。`left: 0, top: 0` 作为绝对定位锚点，
 * 实际位置由 transform 的 translate 部分控制。store 层 `position.x/y` 语义不变
 * （画布坐标系下的绝对位置），与 DOM 定位方式解耦。
 */
export function resolveComponentContainerStyle(component: ScreenComponent): CSSProperties {
  const { position, style, zIndex } = component;
  const rotation = position.rotation ?? 0;
  const flipX = style.flipX === true;
  const flipY = style.flipY === true;

  // 椭圆组件的填充/边框/圆角完全由 EllipseComponent 内部渲染（固定 borderRadius: 50%）。
  // 容器若再应用 backgroundColor/border，会形成一个同色的实心矩形衬底，
  // 遮住内部椭圆的透明四角，视觉上椭圆退化为矩形。
  const isEllipse = component.type === 'ellipse';

  const transform = composeComponentTransform(position.x, position.y, rotation, flipX, flipY);

  return {
    position: 'absolute',
    // left/top 固定为 0：作为绝对定位锚点，实际位置由 transform 的 translate 控制
    left: 0,
    top: 0,
    width: position.width,
    height: position.height,
    zIndex,
    opacity: style.opacity ?? 1,
    borderRadius: isEllipse ? undefined : style.borderRadius,
    borderWidth: isEllipse ? undefined : style.borderWidth,
    borderColor: isEllipse ? undefined : style.borderColor,
    borderStyle: isEllipse ? undefined : style.borderStyle,
    backgroundColor: isEllipse ? undefined : style.backgroundColor,
    overflow: style.overflow ?? 'hidden',
    transform,
  };
}
