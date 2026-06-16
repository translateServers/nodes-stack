import { useHealth, useProfile } from '@/api';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Database,
  Clock,
  Server,
  TrendingUp,
  TrendingDown,
  Users,
  Shield,
  FileText,
  ArrowRight,
  Zap,
  CheckCircle2,
  CircleDot,
  AlertCircle,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp = true,
  color = 'primary',
}: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary text-secondary-foreground',
    accent: 'bg-accent text-accent-foreground',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
  };

  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </div>
        <div
          className={`${colorClasses[color]} rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
          {trend && (
            <Badge
              variant="secondary"
              className={
                trendUp
                  ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
              }
            >
              {trendUp ? (
                <TrendingUp className="size-3 mr-1" />
              ) : (
                <TrendingDown className="size-3 mr-1" />
              )}
              {trend}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

function QuickAction({ title, description, icon: Icon }: QuickActionProps) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-all duration-300 hover:border-primary/40 hover:bg-card hover:shadow-md hover:shadow-primary/5 cursor-pointer"
    >
      <div className="bg-primary/10 flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:bg-primary/15 group-hover:scale-110">
        <Icon className="text-primary size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold transition-colors group-hover:text-primary">
          {title}
        </div>
        <div className="text-muted-foreground text-xs truncate">{description}</div>
      </div>
      <ArrowRight className="text-muted-foreground/50 size-4 shrink-0 transition-all duration-300 group-hover:text-primary group-hover:translate-x-1" />
    </button>
  );
}

interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'loading';
  label: string;
  description: string;
}

function StatusIndicator({ status, label, description }: StatusIndicatorProps) {
  const config = {
    success: {
      icon: CheckCircle2,
      bgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      textColor: 'text-emerald-600',
      dotColor: 'bg-emerald-500',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      textColor: 'text-amber-600',
      dotColor: 'bg-amber-500 animate-pulse',
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-500/10',
      iconColor: 'text-red-500',
      textColor: 'text-red-600',
      dotColor: 'bg-red-500',
    },
    loading: {
      icon: CircleDot,
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-600',
      dotColor: 'bg-blue-500 animate-pulse',
    },
  };

  const { icon: Icon, bgColor, iconColor, textColor, dotColor } = config[status];

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
      <span className={`text-xs font-semibold ${textColor}`}>
        {status === 'success'
          ? '正常'
          : status === 'warning'
            ? '警告'
            : status === 'error'
              ? '异常'
              : '加载中'}
      </span>
    </div>
  );
}

interface MiniChartProps {
  data: number[];
}

function MiniChart({ data }: MiniChartProps) {
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
            className="flex-1 rounded-t-md bg-gradient-to-t from-primary/60 to-primary/30 transition-all duration-500 hover:from-primary/80 hover:to-primary/50"
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

interface RecentActivityItem {
  title: string;
  time: string;
  type: string;
}

interface RecentActivityProps {
  items: RecentActivityItem[];
}

function RecentActivity({ items }: RecentActivityProps) {
  const typeColors: Record<string, string> = {
    login: 'bg-blue-500/10 text-blue-600',
    create: 'bg-emerald-500/10 text-emerald-600',
    update: 'bg-amber-500/10 text-amber-600',
    delete: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <div
              className={`${typeColors[item.type] ?? 'bg-gray-500/10 text-gray-600'} flex size-6 items-center justify-center rounded-full`}
            >
              <Activity className="size-3" />
            </div>
            <span className="text-sm">{item.title}</span>
          </div>
          <span className="text-muted-foreground text-xs">{item.time}</span>
        </div>
      ))}
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}小时 ${minutes}分钟`;
}

export default function DashboardPage() {
  const profileQuery = useProfile();
  const healthQuery = useHealth();

  const mockChartData = [12, 19, 15, 25, 22, 30, 24];
  const recentActivityItems: RecentActivityItem[] = [
    { title: '用户 admin 登录系统', time: '2分钟前', type: 'login' },
    { title: '创建新用户 John', time: '15分钟前', type: 'create' },
    { title: '更新角色管理员权限', time: '1小时前', type: 'update' },
    { title: '删除过期字典数据', time: '2小时前', type: 'delete' },
    { title: '用户 guest 登录系统', time: '3小时前', type: 'login' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            欢迎回来，{profileQuery.data?.name ?? '管理员'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            这是你的管理面板概览，查看系统状态和快速操作。
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2 px-4 py-2">
          <Zap className="text-amber-500 size-4" />
          <span className="text-sm">系统运行正常</span>
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="在线用户"
          value="1,284"
          description="较昨日 +12.5%"
          icon={Users}
          trend="+12.5%"
          trendUp={true}
          color="primary"
        />
        <StatCard
          title="API 请求"
          value="45.2K"
          description="今日累计"
          icon={Activity}
          trend="+8.2%"
          trendUp={true}
          color="success"
        />
        <StatCard
          title="系统负载"
          value="32%"
          description="CPU 使用率"
          icon={Server}
          color="warning"
        />
        <StatCard
          title="数据库"
          value="12/50"
          description="连接池使用"
          icon={Database}
          color="secondary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="text-primary size-5" />
                服务状态
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                实时监控
              </Badge>
            </div>
            <CardDescription>系统健康检查和服务状态</CardDescription>
          </CardHeader>
          <CardContent>
            {healthQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner className="size-8 mb-4" />
                <p className="text-muted-foreground text-sm">正在检查服务状态...</p>
              </div>
            ) : healthQuery.error ? (
              <Alert variant="destructive" className="mb-4">
                健康检查失败，请检查服务状态
              </Alert>
            ) : (
              <div className="space-y-4">
                <StatusIndicator status="success" label="服务状态" description="所有服务运行正常" />
                <StatusIndicator status="success" label="数据库" description="连接状态正常" />
                <StatusIndicator
                  status="success"
                  label="运行时长"
                  description={`自上次重启 ${formatUptime(healthQuery.data?.uptime ?? 0)}`}
                />
                <div className="pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">最后更新</span>
                    <span className="font-medium">{healthQuery.data?.timestamp}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold mb-3">快速操作</h2>
            <div className="space-y-3">
              <QuickAction title="用户管理" description="查看和管理系统用户" icon={Users} />
              <QuickAction title="角色管理" description="配置权限和角色" icon={Shield} />
              <QuickAction title="字典管理" description="管理系统数据字典" icon={FileText} />
            </div>
          </div>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="text-primary size-4" />
                活动趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniChart data={mockChartData} />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>周一</span>
                <span>周二</span>
                <span>周三</span>
                <span>周四</span>
                <span>周五</span>
                <span>周六</span>
                <span>周日</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="text-primary size-5" />
            最近活动
          </CardTitle>
          <CardDescription>系统最近操作记录</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentActivity items={recentActivityItems} />
        </CardContent>
      </Card>
    </div>
  );
}
