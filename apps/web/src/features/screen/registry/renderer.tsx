import { memo } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import { TextComponent } from './components/text-component';
import { BarChartComponent } from './components/bar-chart-component';

interface ComponentRendererProps {
  component: ScreenComponent;
}

const RENDERERS: Record<
  string,
  React.ComponentType<{ props: Record<string, unknown>; style: Record<string, unknown> }>
> = {
  text: TextComponent,
  'bar-chart': BarChartComponent,
};

/**
 * Memo 化的组件渲染器。
 * 父级 CanvasComponentWrapper 已 memo，但若任意兄弟组件更新触发父级重渲染，
 * 未 memo 的 ComponentRenderer 仍会重新执行。memo 屏障可阻断这类无效渲染。
 */
export const ComponentRenderer = memo(function ComponentRenderer({
  component,
}: ComponentRendererProps) {
  const Renderer = RENDERERS[component.type];
  if (!Renderer) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        未知组件: {component.type}
      </div>
    );
  }
  return <Renderer props={component.props} style={component.style} />;
});
