/**
 * 矩形组件（任务 6.2）
 *
 * 渲染一个可配置背景色、边框、圆角的矩形装饰组件。
 * 与 ellipse 共用同一套样式属性，差异仅在形状（rect 不强制 borderRadius:50%）。
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
import type { ComponentStyle } from '@nebula/shared';

interface RectComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function RectComponent({ style }: RectComponentProps) {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: style.backgroundColor ?? 'transparent',
        borderWidth: style.borderWidth ?? 0,
        borderStyle: style.borderStyle ?? 'solid',
        borderColor: style.borderColor ?? '#000000',
        borderRadius: style.borderRadius ?? 0,
        opacity: style.opacity ?? 1,
      }}
    />
  );
}
