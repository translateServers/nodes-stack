import type { CSSProperties } from 'react';
import type { ScreenComponent } from '@nebula/shared';

/**
 * 解析组件公共容器样式为 React CSSProperties。
 *
 * 纯函数：仅依赖入参 component，不读取编辑器 Store、DOM、window 或 Moveable 状态。
 * 编辑器与预览共享此解析结果，避免重复映射导致的字段漂移（如预览漏掉旋转）。
 */
export function resolveComponentContainerStyle(component: ScreenComponent): CSSProperties {
  const { position, style, zIndex } = component;
  const rotation = position.rotation;

  // 椭圆组件的填充/边框/圆角完全由 EllipseComponent 内部渲染（固定 borderRadius: 50%）。
  // 容器若再应用 backgroundColor/border，会形成一个同色的实心矩形衬底，
  // 遮住内部椭圆的透明四角，视觉上椭圆退化为矩形。
  const isEllipse = component.type === 'ellipse';

  return {
    position: 'absolute',
    left: position.x,
    top: position.y,
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
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
  };
}
