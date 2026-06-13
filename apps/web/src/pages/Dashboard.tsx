import { useHealth, useProfile } from '@/api';
import { InlineAlert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export default function DashboardPage() {
  const profileQuery = useProfile();
  const healthQuery = useHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">仪表盘</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          欢迎回来，{profileQuery.data?.username ?? '管理员'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>服务状态</CardTitle>
        </CardHeader>
        <CardContent>
          {healthQuery.isLoading ? (
            <Spinner />
          ) : healthQuery.error ? (
            <InlineAlert variant="destructive">健康检查失败</InlineAlert>
          ) : (
            <div className="space-y-2 text-sm">
              <div>状态：{healthQuery.data?.status}</div>
              <div>数据库：{healthQuery.data?.database}</div>
              <div>时间：{healthQuery.data?.timestamp}</div>
              <div>运行时长：{Math.round(healthQuery.data?.uptime ?? 0)}s</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
