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

  return {
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: position.width,
    height: position.height,
    zIndex,
    opacity: style.opacity ?? 1,
    borderRadius: style.borderRadius,
    borderWidth: style.borderWidth,
    borderColor: style.borderColor,
    borderStyle: style.borderStyle,
    backgroundColor: style.backgroundColor,
    overflow: style.overflow ?? 'hidden',
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
  };
}
