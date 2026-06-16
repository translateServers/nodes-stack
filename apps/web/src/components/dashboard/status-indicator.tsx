import { CheckCircle2, AlertCircle, CircleDot } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'loading';
  label: string;
  description: string;
}

const config = {
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-600',
    dotColor: 'bg-emerald-500',
    text: '正常',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-600',
    dotColor: 'bg-amber-500 animate-pulse',
    text: '警告',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-500/10',
    iconColor: 'text-red-500',
    textColor: 'text-red-600',
    dotColor: 'bg-red-500',
    text: '异常',
  },
  loading: {
    icon: CircleDot,
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-600',
    dotColor: 'bg-blue-500 animate-pulse',
    text: '加载中',
  },
};

export function StatusIndicator({ status, label, description }: StatusIndicatorProps) {
  const { icon: Icon, bgColor, iconColor, textColor, dotColor, text } = config[status];

  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 p-4 transition-all duration-300 hover:border-border hover:bg-card">
      <div className="flex items-center gap-3">
        <div className={`${bgColor} flex size-10 items-center justify-center rounded-full`}>
          <div className={`size-2.5 rounded-full ${dotColor}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Icon className={`${iconColor} size-3.5`} />
          </div>
          <div className="text-muted-foreground text-xs">{description}</div>
        </div>
      </div>
      <span className={`text-xs font-semibold ${textColor}`}>{text}</span>
    </div>
  );
}
