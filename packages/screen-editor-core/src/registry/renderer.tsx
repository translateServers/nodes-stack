import { memo } from 'react';
import type {
  ComponentStyle,
  DataSourceConfig,
  InteractionConfig,
  LogicConfig,
  ScreenComponent,
} from '@nebula/shared';
import { getRendererFromRegistry } from './registry-derive';
import { useOptionalRegistry } from './registry-context';

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
 *
 * Phase 2 Task 2.2 扩展（Spec §9.1）：为 host 组件桥接新增可选字段
 * mode / interactive / size；内置 legacy renderer 不消费这些字段。
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
  /**
   * 运行模式（Spec §9.1）。
   * - 'design'：编辑器画布（默认）
   * - 'preview'：真实预览
   * 仅 host 组件桥接消费；legacy renderer 忽略。
   * Phase 2 默认 'design'，Phase 5 接入预览路径时由上层透传。
   */
  mode?: 'design' | 'preview';
  /**
   * 是否允许派发业务事件（Spec §9.1）。
   * design 模式下为 false，SDK 忽略组件派发的 nebula-component-event。
   * 仅 host 组件桥接消费；legacy renderer 忽略。
   */
  interactive?: boolean;
  /**
   * 组件尺寸（Spec §9.1 model.size）。
   * 由 ComponentRenderer 从 component.position 派生，写入 host 组件 model。
   * legacy renderer 忽略（其尺寸由外层 Canvas wrapper CSS 控制）。
   */
  size?: { readonly width: number; readonly height: number };
}

/**
 * Memo 化的组件渲染器。
 *
 * Spec §13.2 Phase 1, Task 1.5 改造：
 * - 通过 `useOptionalRegistry()` 读取当前实例注册表（生产路径）
 * - registry 为 null（测试或无 Provider 场景）时，`getRendererFromRegistry`
 *   内部回退到模块级 `getRenderer`，与改造前 `RENDERERS` 派生 map 行为一致
 * - registry 为 null（测试或无 Provider 场景）时，`getRendererFromRegistry`
 *   内部回退到固定内置模块清单。
 *
 * 父级 CanvasComponentWrapper 已 memo，但若任意兄弟组件更新触发父级重渲染，
 * 未 memo 的 ComponentRenderer 仍会重新执行。memo 屏障可阻断这类无效渲染。
 *
 * 类型断言说明：`getRendererFromRegistry` 返回 `ComponentType<LegacyRendererProps>`
 * （最小子集 {componentId, props, style}），实际多数组件接收更多 optional 字段
 * （dataSource / logic / interaction / apiRawDataOverride），由于这些字段在
 * RendererComponentProps 中均为 optional，运行时调用安全。
 */
export const ComponentRenderer = memo(function ComponentRenderer({
  component,
  apiRawDataOverride,
}: ComponentRendererProps) {
  const registry = useOptionalRegistry();
  const Renderer = getRendererFromRegistry(registry, component.type) as
    | React.ComponentType<RendererComponentProps>
    | undefined;
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
      // Phase 2 Task 2.2（Spec §9.1）：host 组件桥接需要 mode/interactive/size
      // - mode='design'：编辑器画布当前为设计模式，Phase 5 接入预览时由上层透传
      // - interactive=false：设计模式忽略业务事件，Phase 4 接入事件桥接时由上层控制
      // - size 来自 component.position.width/height，写入 host 组件 model.size
      mode="design"
      interactive={false}
      size={{ width: component.position.width, height: component.position.height }}
    />
  );
});
