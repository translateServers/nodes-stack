import { useHealth, useProfile } from '@/api';
import { InlineAlert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Activity,
  Database,
  Clock,
  Server,
  TrendingUp,
  Users,
  Shield,
  FileText,
} from 'lucide-react';

// ── Stat Card ───────────────────────────────────────────
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="bg-primary/10 rounded-lg p-2">
          <Icon className="text-primary size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          {trend && (
            <span className="text-emerald-600 inline-flex items-center gap-0.5 font-medium">
              <TrendingUp className="size-3" />
              {trend}
            </span>
          )}
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Quick Action Card ───────────────────────────────────
function QuickAction({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm cursor-pointer"
    >
      <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon className="text-primary size-5" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
    </button>
  );
}

// ── Dashboard Page ──────────────────────────────────────
export default function DashboardPage() {
  const profileQuery = useProfile();
  const healthQuery = useHealth();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          欢迎回来，{profileQuery.data?.name ?? '管理员'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          这是你的管理面板概览，查看系统状态和快速操作。
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="在线用户" value="1,284" description="较昨日" icon={Users} trend="+12.5%" />
        <StatCard
          title="API 请求"
          value="45.2K"
          description="今日累计"
          icon={Activity}
          trend="+8.2%"
        />
        <StatCard title="系统负载" value="32%" description="CPU 使用率" icon={Server} />
        <StatCard title="数据库" value="正常" description="连接池 12/50" icon={Database} />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Service Status */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              服务状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : healthQuery.error ? (
              <InlineAlert variant="destructive">健康检查失败</InlineAlert>
            ) : (
              <div className="space-y-4">
                {/* Status Row */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 flex size-8 items-center justify-center rounded-full">
                      <div className="size-2 rounded-full bg-emerald-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">服务状态</div>
                      <div className="text-muted-foreground text-xs">所有服务运行正常</div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">
                    {healthQuery.data?.status}
                  </span>
                </div>
                {/* Database Row */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 flex size-8 items-center justify-center rounded-full">
                      <Database className="text-blue-500 size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">数据库</div>
                      <div className="text-muted-foreground text-xs">连接状态正常</div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-600">
                    {healthQuery.data?.database}
                  </span>
                </div>
                {/* Time Row */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500/10 flex size-8 items-center justify-center rounded-full">
                      <Clock className="text-amber-500 size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">运行时长</div>
                      <div className="text-muted-foreground text-xs">自上次重启</div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-amber-600">
                    {formatUptime(healthQuery.data?.uptime ?? 0)}
                  </span>
                </div>
                {/* Timestamp */}
                <div className="text-muted-foreground pt-2 text-xs">
                  最后更新：{healthQuery.data?.timestamp}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">快速操作</h2>
          <div className="space-y-3">
            <QuickAction title="用户管理" description="查看和管理系统用户" icon={Users} />
            <QuickAction title="角色管理" description="配置权限和角色" icon={Shield} />
            <QuickAction title="字典管理" description="管理系统数据字典" icon={FileText} />
          </div>
        </div>
      </div>
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
