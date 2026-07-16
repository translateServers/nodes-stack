interface BarChartComponentProps {
  props: Record<string, unknown>;
  style: Record<string, unknown>;
}

interface DataItem {
  name: string;
  value: number;
}

export function BarChartComponent({ props, style }: BarChartComponentProps) {
  const data = (props.data as DataItem[]) ?? [];
  const title = (props.title as string) ?? '';

  if (data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
        暂无数据
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barColor = (style.backgroundColor as string) || '#3b82f6';
  const padding = { top: title ? 30 : 10, right: 10, bottom: 30, left: 40 };

  return (
    <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
      {title && (
        <text
          x={200}
          y={20}
          textAnchor="middle"
          fontSize={14}
          fill={(style.color as string) ?? '#fff'}
        >
          {title}
        </text>
      )}
      {data.map((item, i) => {
        const chartWidth = 400 - padding.left - padding.right;
        const chartHeight = 300 - padding.top - padding.bottom;
        const barWidth = (chartWidth / data.length) * 0.7;
        const gap = (chartWidth / data.length) * 0.3;
        const barHeight = (item.value / maxValue) * chartHeight;
        const x = padding.left + i * (barWidth + gap) + gap / 2;
        const y = padding.top + chartHeight - barHeight;

        return (
          <g key={item.name}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={barColor} rx={2} />
            <text
              x={x + barWidth / 2}
              y={300 - 10}
              textAnchor="middle"
              fontSize={11}
              fill={(style.color as string) ?? '#aaa'}
            >
              {item.name}
            </text>
            <text
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill={(style.color as string) ?? '#aaa'}
            >
              {item.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
