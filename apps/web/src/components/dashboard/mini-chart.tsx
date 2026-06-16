interface MiniChartProps {
  data: number[];
  color?: string;
}

export function MiniChart({ data, color = 'from-primary/60 to-primary/30' }: MiniChartProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((value, index) => {
        const height = ((value - min) / range) * 100 + 10;
        return (
          <div
            key={index}
            className={`flex-1 rounded-t-md bg-gradient-to-t ${color} transition-all duration-500 hover:opacity-80`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
