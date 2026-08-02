import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { DataSourceConfig, RefreshIntervalUnit } from '@nebula/shared';
import { BarChart, type BarSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  type GridComponentOption,
  TitleComponent,
  type TitleComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
} from 'echarts/components';
import {
  color as echartsColor,
  init as initECharts,
  use as useECharts,
  type ComposeOption,
  type EChartsType,
} from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart3 } from 'lucide-react';
import type { RendererComponentProps } from '../renderer';
import {
  DATASOURCE_ACTIONS,
  DATASOURCE_EVENTS,
  mergeActions,
  mergeEvents,
} from '../component-events-actions';
import type { ComponentModule } from '../types';
import { BAR_CHART_SCHEMA } from '../../property-schema/schemas';
import { useChartData } from '../../hooks/use-chart-data';
import {
  DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK,
  useOptionalScreenEditorRuntimeProfile,
} from '../../runtime-profile.js';
import { useComponentEvent } from '../../blueprint/runtime/component-event-context';
import { useCanvasInteraction } from '../../lib/canvas-interaction-context';
import type { ChartDataItem } from '../../lib/chart-data-parser';

useECharts([BarChart, GridComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

type EChartsBarOption = ComposeOption<
  BarSeriesOption | GridComponentOption | TitleComponentOption | TooltipComponentOption
>;

interface EChartsBarRendererProps {
  data: readonly ChartDataItem[];
  title: string;
  barColor: string;
  labelColor: string;
  titleColor: string;
  tooltipEnabled: boolean;
  interactive: boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function EChartsBarRenderer({
  data,
  title,
  barColor,
  labelColor,
  titleColor,
  tooltipEnabled,
  interactive,
}: EChartsBarRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const reduceMotion = prefersReducedMotion();
  const option = useMemo<EChartsBarOption>(
    () => ({
      animation: !reduceMotion,
      animationDuration: 860,
      animationEasing: 'cubicOut',
      title: title
        ? {
            text: title,
            left: 'center',
            top: 2,
            textStyle: {
              color: titleColor,
              fontSize: 14,
              fontWeight: 500,
            },
          }
        : undefined,
      tooltip: {
        show: tooltipEnabled,
        trigger: 'item',
        formatter: '{b}: {c}',
        confine: true,
      },
      grid: {
        top: title ? 44 : 24,
        right: 16,
        bottom: 16,
        left: 16,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.name),
        axisTick: { show: false },
        axisLine: {
          lineStyle: { color: 'rgba(148, 163, 184, 0.28)' },
        },
        axisLabel: {
          color: labelColor,
          fontSize: 11,
          hideOverlap: true,
          margin: 12,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitNumber: 4,
        splitLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.14)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          type: 'bar',
          name: title || '数值',
          data: data.map((item) => item.value),
          silent: !interactive,
          barWidth: '70%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: barColor },
                { offset: 0.58, color: echartsColor.modifyAlpha(barColor, 0.82) },
                { offset: 1, color: echartsColor.modifyAlpha(barColor, 0.42) },
              ],
            },
            borderRadius: [3, 3, 0, 0],
            shadowBlur: 8,
            shadowColor: 'rgba(15, 23, 42, 0.28)',
            shadowOffsetY: 7,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(15, 23, 42, 0.38)',
              shadowOffsetY: 9,
            },
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            color: labelColor,
            fontSize: 10,
          },
          animationDelay: (dataIndex: number) => dataIndex * 80 + 100,
        },
      ],
    }),
    [barColor, data, interactive, labelColor, reduceMotion, title, titleColor, tooltipEnabled],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const chart = initECharts(container, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const resizeChart = () => chart.resize();
    let resizeObserver: ResizeObserver | undefined;

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resizeChart);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', resizeChart);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeChart);
      chart.dispose();
      if (chartRef.current === chart) chartRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  const accessibleTitle = title.trim() || '柱状图';

  return (
    <div
      ref={containerRef}
      className="nebula-bar-chart"
      role="img"
      aria-label={`${accessibleTitle}，共 ${data.length} 项数据`}
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
    />
  );
}

/** 将刷新策略的 interval + unit 转换为秒数 */
function toSeconds(interval: number, unit: RefreshIntervalUnit): number {
  switch (unit) {
    case 'second':
      return interval;
    case 'minute':
      return interval * 60;
    case 'hour':
      return interval * 3600;
    default:
      return interval;
  }
}

/**
 * bar-chart renderer（阶段 2 任务 3.2/3.3/5.5 改造 + 事件蓝图 3.4 接入 + 数据集集成）
 *
 * 数据来自数据层解析结果（useChartData）：
 * - 有数据层配置时，数据层为唯一生效数据源，遗留 props.data 不再生效
 * - 无数据层配置时，回退读取遗留 props.data（任务 3.3 兼容语义；
 *   首次通过数据层 UI 提交后 props.data 被一次性迁移清除）
 * - API 数据源：经 useApiDataSource 发起 GET 请求，响应数据传入 useChartData 解析（5.5）
 * - 数据集数据源：经 useDatasetSource 调用后端 /dataset/:id/execute，
 *   后端返回 parsed（已应用 shape.dataPath + fieldMapping + filter）传入 useChartData
 * - apiRawDataOverride（任务 3.4）：蓝图 refreshDataSource 动作完成后写入的覆盖数据，
 *   优先于 hook state；独立预览始终可写入，编辑器画布仅在 Event 总闸门开启时写入
 * 标题与颜色仍取视觉层 props/style，渲染行为不回退。
 * 交互层 interaction.tooltipOnHover 开启时，悬停柱条经 ECharts tooltip 展示名称与数值
 * （任务 4.5，默认关闭）。
 */
export function BarChartComponent({
  componentId,
  props,
  style,
  dataSource,
  logic,
  interaction,
  apiRawDataOverride,
}: RendererComponentProps) {
  // 读取宿主事件回调；编辑器总闸门关闭时回调稳定存在但运行时会丢弃事件。
  const emitEvent = useComponentEvent();
  // Spec: introduce-canvas-interaction-modes
  // 设计模式下关闭组件原生交互（tooltip 等），仅交互调试/预览中开启
  const { canDispatchNativeEvents } = useCanvasInteraction();
  // 任务 3.3：无数据层配置时回退遗留 props.data；有数据层时数据层唯一生效
  const effectiveDataSource = useMemo<DataSourceConfig | undefined>(() => {
    if (dataSource !== undefined) return dataSource;
    if (!('data' in props)) return undefined;
    return { type: 'static', staticData: props.data };
  }, [dataSource, props]);
  const dataRuntime =
    useOptionalScreenEditorRuntimeProfile()?.dataRuntime ??
    DYNAMIC_SCREEN_EDITOR_RUNTIME_FALLBACK.dataRuntime;

  // 任务 5.5：API 数据源请求（仅 type='api' 时传入 apiConfig，否则 undefined 保持 idle）
  const apiConfig = effectiveDataSource?.type === 'api' ? effectiveDataSource.apiConfig : undefined;
  const apiState = dataRuntime.useApiDataSource(apiConfig);

  // 数据集数据源请求（仅 type='dataset' 时启用，编辑态默认 useMock=true）
  const isDatasetType = effectiveDataSource?.type === 'dataset';
  const datasetId = isDatasetType ? effectiveDataSource.datasetId : undefined;
  const datasetParamBindings = isDatasetType ? effectiveDataSource.paramBindings : undefined;
  const datasetRefreshSeconds = useMemo(() => {
    if (!isDatasetType) return undefined;
    const override = effectiveDataSource.overrideRefresh;
    if (override !== undefined && override.interval > 0) {
      return toSeconds(override.interval, override.intervalUnit);
    }
    return undefined;
  }, [effectiveDataSource, isDatasetType]);
  // bindingContext 必须 memoize：内联对象每次渲染都是新引用，会导致
  // useDatasetSource 的 effect 反复触发 setState({status:'idle'}) 形成无限渲染循环
  const datasetBindingContext = useMemo(() => ({ componentProps: props }), [props]);
  const datasetState = dataRuntime.useDatasetSource({
    datasetId,
    paramBindings: datasetParamBindings,
    bindingContext: datasetBindingContext,
    useMock: true,
    refreshIntervalSeconds: datasetRefreshSeconds,
  });

  // 事件蓝图修复：API 数据源状态变化时派发 dataLoaded / dataError
  // - 仅在 apiRawDataOverride === undefined 时派发（避免 override 与 hook state 双重触发）
  // - 仅在 emitEvent 非 null 时派发（无运行时宿主时短路）
  // - 每次 status 变为 success/error 都派发（含定时刷新的重复 success）
  useEffect(() => {
    if (apiRawDataOverride !== undefined) return;
    if (emitEvent === null) return;
    if (apiState.status === 'success') {
      emitEvent(componentId, 'dataLoaded');
    } else if (apiState.status === 'error') {
      emitEvent(componentId, 'dataError');
    }
  }, [componentId, apiState.status, apiRawDataOverride, emitEvent]);

  // 事件蓝图修复：数据集数据源状态变化时派发 dataLoaded / dataError
  useEffect(() => {
    if (apiRawDataOverride !== undefined) return;
    if (emitEvent === null) return;
    if (datasetState.status === 'success') {
      emitEvent(componentId, 'dataLoaded');
    } else if (datasetState.status === 'error') {
      emitEvent(componentId, 'dataError');
    }
  }, [componentId, datasetState.status, apiRawDataOverride, emitEvent]);

  // 任务 3.4：优先使用 override（refreshDataSource 完成后写入），否则回退 hook state
  const hookRawData = isDatasetType
    ? datasetState.status === 'success'
      ? datasetState.data
      : undefined
    : apiState.status === 'success'
      ? apiState.data
      : undefined;
  const apiRawData = apiRawDataOverride !== undefined ? apiRawDataOverride : hookRawData;
  const parseResult = useChartData(effectiveDataSource, logic, apiRawData);
  const title = typeof props.title === 'string' ? props.title : '';

  // 请求进行中：加载态（6.x 统一三态契约前的简化展示）
  // 注意：override 存在时不显示加载态（数据已就绪）
  const activeState = isDatasetType ? datasetState : apiState;
  if (apiRawDataOverride === undefined && activeState.status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
        加载中…
      </div>
    );
  }

  // 请求失败：错误态（override 存在时不显示错误态）
  if (apiRawDataOverride === undefined && activeState.status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-red-400">
        {activeState.error.message}
      </div>
    );
  }

  if (parseResult.status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-red-400">
        数据解析失败：{parseResult.message}
      </div>
    );
  }

  if (parseResult.status === 'empty') {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
        暂无数据
      </div>
    );
  }

  const data = parseResult.data;
  const barColor = style.backgroundColor || '#3b82f6';
  const tooltipOnHover = canDispatchNativeEvents && (interaction?.tooltipOnHover ?? false);
  const labelColor = style.color ?? '#aaa';
  const titleColor = style.color ?? '#fff';

  return (
    <EChartsBarRenderer
      data={data}
      title={title}
      barColor={barColor}
      labelColor={labelColor}
      titleColor={titleColor}
      tooltipEnabled={tooltipOnHover}
      interactive={canDispatchNativeEvents}
    />
  );
}

const barChartModule: ComponentModule = {
  definition: {
    type: 'bar-chart',
    name: '柱状图',
    category: 'chart',
    icon: 'BarChart3',
    keywords: ['柱状图', '图表', 'chart', 'bar', '数据图', '可视化', '统计图'],
    description: '柱状图，支持静态数据 / API 数据源、字段映射与排序',
    defaultProps: {
      title: '柱状图',
      data: [
        { name: 'A', value: 120 },
        { name: 'B', value: 200 },
        { name: 'C', value: 150 },
        { name: 'D', value: 80 },
        { name: 'E', value: 170 },
      ],
    },
    defaultSize: { width: 400, height: 300 },
    order: 1,
    events: mergeEvents(DATASOURCE_EVENTS),
    actions: mergeActions(DATASOURCE_ACTIONS),
  },
  renderer: BarChartComponent,
  schema: BAR_CHART_SCHEMA,
  icon: BarChart3,
};

export default barChartModule;
