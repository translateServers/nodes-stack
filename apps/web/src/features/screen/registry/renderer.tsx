import { memo } from 'react';
import type {
  ComponentStyle,
  DataSourceConfig,
  InteractionConfig,
  LogicConfig,
  ScreenComponent,
} from '@nebula/shared';
import './registered-components';
import { getAllModules } from './registry';

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
 *
 * componentId（事件蓝图修复）：组件运行时身份标识，供组件通过
 * useComponentEvent() 派发 dataLoaded / dataError / click 等事件。
 * 由 ComponentRenderer 从 component.id 取值并透传，所有 renderer 接收
 * 但不强制消费。
 */
export interface RendererComponentProps {
  componentId: string;
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

/**
 * 从注册中心派生 RENDERERS：遍历所有已注册 module，type → renderer。
 *
 * 改造前为手写 map（新增组件需手动同步），改造后由 registry 自动派生。
 * 顶部 `import './registered-components'` 确保遍历前 registry 已填充。
 *
 * 类型断言说明：ComponentModule.renderer 声明为最小子集 `ComponentType<{props, style}>`，
 * 实际多数组件接收更多 optional 字段（dataSource / logic / interaction / apiRawDataOverride），
 * 由于这些字段在 RendererComponentProps 中均为 optional，运行时调用安全。
 */
const RENDERERS: Record<string, React.ComponentType<RendererComponentProps>> = (() => {
  const map: Record<string, React.ComponentType<RendererComponentProps>> = {};
  for (const mod of getAllModules()) {
    map[mod.definition.type] = mod.renderer as React.ComponentType<RendererComponentProps>;
  }
  return map;
})();

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
      componentId={component.id}
      props={component.props}
      style={component.style}
      dataSource={component.dataSource}
      logic={component.logic}
      interaction={component.interaction}
      apiRawDataOverride={apiRawDataOverride}
    />
  );
});
