import { useState } from 'react';
import { CreateUserSchema, UpdateUserSchema, type UserResponse } from '@nebula/shared';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/api';
import { DataTable, createColumnHelper } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useNebulaForm } from '@/hooks/use-nebula-form';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const columnHelper = createColumnHelper<UserResponse>();

interface UserFormProps {
  user?: UserResponse;
  onSubmit: (data: unknown) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function UserForm({ user, onSubmit, onCancel, isSubmitting }: UserFormProps) {
  const isEdit = !!user;

  const form = useNebulaForm({
    schema: isEdit ? UpdateUserSchema : CreateUserSchema,
    defaultValues: user
      ? { username: user.username, email: user.email, name: user.name ?? '' }
      : { username: '', email: '', password: '', name: '' },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
              <FormControl>
                <Input placeholder="请输入用户名" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>邮箱</FormLabel>
              <FormControl>
                <Input type="email" placeholder="请输入邮箱" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isEdit && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="请输入密码" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>显示名称</FormLabel>
              <FormControl>
                <Input placeholder="请输入显示名称（可选）" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : isEdit ? '更新' : '创建'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function UsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | undefined>();

  const handleCreate = () => {
    setEditingUser(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (user: UserResponse) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleDelete = async (user: UserResponse) => {
    if (!confirm(`确定要删除用户 "${user.username}" 吗？`)) return;
    await deleteUserMutation.mutateAsync(user.id);
  };

  const handleFormSubmit = async (data: unknown) => {
    if (editingUser) {
      await updateUserMutation.mutateAsync({
        id: editingUser.id,
        params: data as Parameters<typeof updateUserMutation.mutateAsync>[0]['params'],
      });
    } else {
      await createUserMutation.mutateAsync(
        data as Parameters<typeof createUserMutation.mutateAsync>[0],
      );
    }
    setDialogOpen(false);
  };

  const columns = [
    columnHelper.accessor('username', { header: '用户名', size: 150 }),
    columnHelper.accessor('email', { header: '邮箱', size: 200 }),
    columnHelper.accessor('name', {
      header: '显示名称',
      size: 150,
      cell: (value) => value ?? '-',
    }),
    columnHelper.accessor('isActive', {
      header: '状态',
      size: 100,
      cell: (value) =>
        value ? <Badge variant="default">启用</Badge> : <Badge variant="destructive">禁用</Badge>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '操作',
      size: 120,
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(row)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void handleDelete(row)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          新建用户
        </Button>
      </div>

      {error && <Alert variant="destructive">加载用户列表失败</Alert>}

      <DataTable
        columns={columns}
        data={users ?? []}
        isLoading={isLoading}
        emptyMessage="暂无用户数据"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑用户' : '新建用户'}</DialogTitle>
            <DialogDescription>
              {editingUser ? `正在编辑用户：${editingUser.username}` : '创建一个新的用户账号'}
            </DialogDescription>
          </DialogHeader>
          <UserForm
            user={editingUser}
            onSubmit={handleFormSubmit}
            onCancel={() => setDialogOpen(false)}
            isSubmitting={createUserMutation.isPending || updateUserMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
