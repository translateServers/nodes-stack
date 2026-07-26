import { useEffect, useMemo } from 'react';
import type { DataSourceConfig, RefreshIntervalUnit } from '@nebula/shared';
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
import { useApiDataSource } from '../../hooks/use-api-data-source';
import { useDatasetSource } from '../../hooks/use-dataset-source';
import { useComponentEvent } from '../../blueprint/runtime/component-event-context';

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
 * - apiRawDataOverride（任务 3.4）：预览页蓝图 refreshDataSource 动作完成后写入的覆盖数据，
 *   优先于 hook state；编辑器场景下为 undefined，行为不变
 * 标题与颜色仍取视觉层 props/style，渲染行为不回退。
 * 交互层 interaction.tooltipOnHover 开启时，悬停柱条经 SVG <title> 展示名称与数值
 * （任务 4.5，默认关闭，关闭时视觉与既有行为一致）。
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
  // 事件蓝图修复：读取组件事件回调（编辑态返回 null，自动短路）
  const emitEvent = useComponentEvent();

  // 任务 3.3：无数据层配置时回退遗留 props.data；有数据层时数据层唯一生效
  const effectiveDataSource = useMemo<DataSourceConfig | undefined>(() => {
    if (dataSource !== undefined) return dataSource;
    if (!('data' in props)) return undefined;
    return { type: 'static', staticData: props.data };
  }, [dataSource, props]);

  // 任务 5.5：API 数据源请求（仅 type='api' 时传入 apiConfig，否则 undefined 保持 idle）
  const apiConfig = effectiveDataSource?.type === 'api' ? effectiveDataSource.apiConfig : undefined;
  const apiState = useApiDataSource(apiConfig);

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
  const datasetState = useDatasetSource({
    datasetId,
    paramBindings: datasetParamBindings,
    bindingContext: datasetBindingContext,
    useMock: true,
    refreshIntervalSeconds: datasetRefreshSeconds,
  });

  // 事件蓝图修复：API 数据源状态变化时派发 dataLoaded / dataError
  // - 仅在 apiRawDataOverride === undefined 时派发（避免 override 与 hook state 双重触发）
  // - 仅在 emitEvent 非 null 时派发（编辑态短路）
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
  const title = (props.title as string) ?? '';

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
  const padding = { top: title ? 30 : 10, right: 10, bottom: 30, left: 40 };
  const tooltipOnHover = interaction?.tooltipOnHover ?? false;

  // L1+L2 性能优化：将原本在 data.map 内每次迭代都重复计算的不变量提到循环外。
  // 原实现每项都重算 chartWidth/chartHeight/barWidth/gap，这些只依赖 data.length
  // 与 padding，与 item 无关；循环内仅需 barHeight / x / y 这类依赖 item.value 与 i 的值。
  // 同时缓存 style.color 回退值，避免每次渲染都重算。
  // 注意：maxValue 不用 useMemo（react-best-practices 规则 rerender-simple-expression-in-memo：
  // 简单 primitive 表达式不需要 memo 包裹；且 useMemo 不能放在 early return 之后违反 Hooks 规则）
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartWidth = 400 - padding.left - padding.right;
  const chartHeight = 300 - padding.top - padding.bottom;
  const barWidth = (chartWidth / data.length) * 0.7;
  const gap = (chartWidth / data.length) * 0.3;
  const barWidthPlusGap = barWidth + gap;
  const halfBarWidth = barWidth / 2;
  const labelColor = style.color ?? '#aaa';
  const titleColor = style.color ?? '#fff';
  const bottomLabelY = 300 - 10;

  return (
    <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
      {title && (
        <text x={200} y={20} textAnchor="middle" fontSize={14} fill={titleColor}>
          {title}
        </text>
      )}
      {data.map((item, i) => {
        const barHeight = (item.value / maxValue) * chartHeight;
        const x = padding.left + i * barWidthPlusGap + gap / 2;
        const y = padding.top + chartHeight - barHeight;

        return (
          <g key={item.name}>
            {tooltipOnHover && <title>{`${item.name}: ${item.value}`}</title>}
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={barColor} rx={2} />
            <text
              x={x + halfBarWidth}
              y={bottomLabelY}
              textAnchor="middle"
              fontSize={11}
              fill={labelColor}
            >
              {item.name}
            </text>
            <text
              x={x + halfBarWidth}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill={labelColor}
            >
              {item.value}
            </text>
          </g>
        );
      })}
    </svg>
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
