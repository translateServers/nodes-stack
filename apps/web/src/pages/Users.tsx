import { useUsers } from '@/api';
import { InlineAlert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export default function UsersPage() {
  const { data, isLoading, error } = useUsers();

  if (isLoading) {
    return <Spinner className="size-8" />;
  }

  if (error) {
    return <InlineAlert variant="destructive">加载用户列表失败</InlineAlert>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">用户管理</h1>
      {data?.map((user) => (
        <Card key={user.id}>
          <CardHeader className="pb-3">
            <CardTitle>{user.username}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-sm">
            <div className="text-muted-foreground">{user.email}</div>
            <div>状态：{user.isActive ? '启用' : '禁用'}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
