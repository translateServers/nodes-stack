import { useMemo } from 'react';
import type { DataSourceConfig } from '@nebula/shared';
import type { RendererComponentProps } from '../renderer';
import { useChartData } from '../../hooks/use-chart-data';
import { useApiDataSource } from '../../hooks/use-api-data-source';

/**
 * bar-chart renderer（阶段 2 任务 3.2/3.3/5.5 改造 + 事件蓝图 3.4 接入）
 *
 * 数据来自数据层解析结果（useChartData）：
 * - 有数据层配置时，数据层为唯一生效数据源，遗留 props.data 不再生效
 * - 无数据层配置时，回退读取遗留 props.data（任务 3.3 兼容语义；
 *   首次通过数据层 UI 提交后 props.data 被一次性迁移清除）
 * - API 数据源：经 useApiDataSource 发起 GET 请求，响应数据传入 useChartData 解析（5.5）
 * - apiRawDataOverride（任务 3.4）：预览页蓝图 refreshDataSource 动作完成后写入的覆盖数据，
 *   优先于 useApiDataSource state；编辑器场景下为 undefined，行为不变
 * 标题与颜色仍取视觉层 props/style，渲染行为不回退。
 * 交互层 interaction.tooltipOnHover 开启时，悬停柱条经 SVG <title> 展示名称与数值
 * （任务 4.5，默认关闭，关闭时视觉与既有行为一致）。
 */
export function BarChartComponent({
  props,
  style,
  dataSource,
  logic,
  interaction,
  apiRawDataOverride,
}: RendererComponentProps) {
  // 任务 3.3：无数据层配置时回退遗留 props.data；有数据层时数据层唯一生效
  const effectiveDataSource = useMemo<DataSourceConfig | undefined>(() => {
    if (dataSource !== undefined) return dataSource;
    if (!('data' in props)) return undefined;
    return { type: 'static', staticData: props.data };
  }, [dataSource, props]);

  // 任务 5.5：API 数据源请求（仅 type='api' 时传入 apiConfig，否则 undefined 保持 idle）
  const apiConfig = effectiveDataSource?.type === 'api' ? effectiveDataSource.apiConfig : undefined;
  const apiState = useApiDataSource(apiConfig);

  // 任务 3.4：优先使用 override（refreshDataSource 完成后写入），否则回退 useApiDataSource state
  const apiRawData =
    apiRawDataOverride !== undefined
      ? apiRawDataOverride
      : apiState.status === 'success'
        ? apiState.data
        : undefined;
  const parseResult = useChartData(effectiveDataSource, logic, apiRawData);
  const title = (props.title as string) ?? '';

  // API 请求进行中：加载态（6.x 统一三态契约前的简化展示）
  // 注意：override 存在时不显示加载态（数据已就绪）
  if (apiRawDataOverride === undefined && apiState.status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
        加载中…
      </div>
    );
  }

  // API 请求失败：错误态（override 存在时不显示错误态）
  if (apiRawDataOverride === undefined && apiState.status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-red-400">
        {apiState.error.message}
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
