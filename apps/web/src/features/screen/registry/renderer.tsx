import { memo } from 'react';
import type {
  ComponentStyle,
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
  /**
   * 外部传入的 API 数据源响应覆盖（任务 3.4 接入蓝图运行时）：
   * - undefined：编辑器场景，组件使用 useApiDataSource 自身 state
   * - 已定义值：预览场景，组件优先使用此值作为 apiRawData（refreshDataSource 动作完成后写入）
   * 仅图表类组件消费此 prop，其他组件忽略。
   */
  apiRawDataOverride?: unknown;
}

/**
 * 组件 renderer 统一入参（阶段 2 任务 3.2）。
 *
 * 除 props/style 外，透传四层配置中渲染链路需要的
 * dataSource / logic / interaction；非图表组件忽略即可。
 */
export interface RendererComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
  dataSource?: DataSourceConfig;
  logic?: LogicConfig;
  interaction?: InteractionConfig;
  /**
   * 外部传入的 API 数据源响应覆盖（任务 3.4）：
   * 仅 BarChartComponent 等图表类组件消费，作为 useApiDataSource state.data 的替代。
   */
  apiRawDataOverride?: unknown;
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
  apiRawDataOverride,
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
      apiRawDataOverride={apiRawDataOverride}
    />
  );
});
