/**
 * 椭圆组件（任务 6.2）
 *
 * 渲染一个可配置背景色、边框的椭圆装饰组件。
 * 通过 borderRadius: 50% 将容器变为圆形/椭圆，宽高不等时呈椭圆。
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
interface EllipseComponentProps {
  props: Record<string, unknown>;
  style: Record<string, unknown>;
}

export function EllipseComponent({ style }: EllipseComponentProps) {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: (style.backgroundColor as string) ?? 'transparent',
        borderWidth: (style.borderWidth as number | undefined) ?? 0,
        borderStyle: (style.borderStyle as 'solid' | 'dashed' | 'dotted' | undefined) ?? 'solid',
        borderColor: (style.borderColor as string | undefined) ?? '#000000',
        // 椭圆：始终 50% 圆角，忽略用户配置的 borderRadius
        borderRadius: '50%',
        opacity: (style.opacity as number | undefined) ?? 1,
      }}
    />
  );
}
