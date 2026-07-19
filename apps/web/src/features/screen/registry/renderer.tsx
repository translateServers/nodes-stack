import { memo } from 'react';
import type {
  DataSourceConfig,
  InteractionConfig,
  LogicConfig,
  ScreenComponent,
} from '@nebula/shared';
import { TextComponent } from './components/text-component';
import { BarChartComponent } from './components/bar-chart-component';
import { RectComponent } from './components/rect-component';
import { EllipseComponent } from './components/ellipse-component';
import { ImageComponent } from './components/image-component';

interface ComponentRendererProps {
  component: ScreenComponent;
}

/**
 * 组件 renderer 统一入参（阶段 2 任务 3.2）。
 *
 * 除 props/style 外，透传四层配置中渲染链路需要的
 * dataSource / logic / interaction；非图表组件忽略即可。
 */
export interface RendererComponentProps {
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  dataSource?: DataSourceConfig;
  logic?: LogicConfig;
  interaction?: InteractionConfig;
}

const RENDERERS: Record<string, React.ComponentType<RendererComponentProps>> = {
  text: TextComponent,
  'bar-chart': BarChartComponent,
  // 任务 6.2：矩形与椭圆组件 renderer
  rect: RectComponent,
  ellipse: EllipseComponent,
  // 任务 7.2：图片组件 renderer
  image: ImageComponent,
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
  return (
    <Renderer
      props={component.props}
      style={component.style}
      dataSource={component.dataSource}
      logic={component.logic}
      interaction={component.interaction}
    />
  );
});
