/**
 * 椭圆组件（任务 6.2）
 *
 * 渲染一个可配置背景色、边框的椭圆装饰组件。
 * 通过 borderRadius: 50% 将容器变为圆形/椭圆，宽高不等时呈椭圆。
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
import type { ComponentStyle } from '@nebula/shared';

interface EllipseComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function EllipseComponent({ style }: EllipseComponentProps) {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: style.backgroundColor ?? 'transparent',
        borderWidth: style.borderWidth ?? 0,
        borderStyle: style.borderStyle ?? 'solid',
        borderColor: style.borderColor ?? '#000000',
        // 椭圆：始终 50% 圆角，忽略用户配置的 borderRadius
        borderRadius: '50%',
        opacity: style.opacity ?? 1,
      }}
    />
  );
}
