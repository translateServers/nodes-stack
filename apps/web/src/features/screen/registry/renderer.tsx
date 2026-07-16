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

export function ComponentRenderer({ component }: ComponentRendererProps) {
  const Renderer = RENDERERS[component.type];
  if (!Renderer) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        未知组件: {component.type}
      </div>
    );
  }
  return <Renderer props={component.props} style={component.style as Record<string, unknown>} />;
}
