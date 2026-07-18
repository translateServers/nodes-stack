/**
 * 矩形组件（任务 6.2）
 *
 * 渲染一个可配置背景色、边框、圆角的矩形装饰组件。
 * 与 ellipse 共用同一套样式属性，差异仅在形状（rect 不强制 borderRadius:50%）。
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
interface RectComponentProps {
  props: Record<string, unknown>;
  style: Record<string, unknown>;
}

export function RectComponent({ style }: RectComponentProps) {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: (style.backgroundColor as string) ?? 'transparent',
        borderWidth: (style.borderWidth as number | undefined) ?? 0,
        borderStyle: (style.borderStyle as 'solid' | 'dashed' | 'dotted' | undefined) ?? 'solid',
        borderColor: (style.borderColor as string | undefined) ?? '#000000',
        borderRadius: (style.borderRadius as number | undefined) ?? 0,
        opacity: (style.opacity as number | undefined) ?? 1,
      }}
    />
  );
}
