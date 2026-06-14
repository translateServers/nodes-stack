import { useState } from 'react';
import type { z } from 'zod';
import { CreateRoleSchema, UpdateRoleSchema, type RoleResponse } from '@nebula/shared';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '@/api';
import { DataTable, createColumnHelper } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
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
import { InlineAlert } from '@/components/ui/alert';
import { useNebulaForm } from '@/hooks/use-nebula-form';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

const columnHelper = createColumnHelper<RoleResponse>();

interface RoleFormProps {
  role?: RoleResponse;
  onSubmit: (data: unknown) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function RoleForm({ role, onSubmit, onCancel, isSubmitting }: RoleFormProps) {
  const isEdit = !!role;

  const form = useNebulaForm({
    schema: isEdit ? UpdateRoleSchema : CreateRoleSchema,
    defaultValues: role
      ? { name: role.name, description: role.description ?? '' }
      : { name: '', description: '' },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>角色名称</FormLabel>
              <FormControl>
                <Input placeholder="请输入角色名称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>角色描述</FormLabel>
              <FormControl>
                <Input placeholder="请输入角色描述（可选）" {...field} />
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

export default function RolesPage() {
  const { data: roles, isLoading, error } = useRoles();
  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponse | undefined>();

  const handleCreate = () => {
    setEditingRole(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (role: RoleResponse) => {
    setEditingRole(role);
    setDialogOpen(true);
  };

  const handleDelete = async (role: RoleResponse) => {
    if (!confirm(`确定要删除角色 "${role.name}" 吗？`)) return;
    await deleteRoleMutation.mutateAsync(role.id);
  };

  const handleFormSubmit = async (data: unknown) => {
    if (editingRole) {
      await updateRoleMutation.mutateAsync({
        id: editingRole.id,
        params: data as UpdateRoleInput,
      });
    } else {
      await createRoleMutation.mutateAsync(data as CreateRoleInput);
    }
    setDialogOpen(false);
  };

  const columns = [
    columnHelper.accessor('name', { header: '角色名称', size: 200 }),
    columnHelper.accessor('description', {
      header: '描述',
      size: 300,
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
        <h1 className="text-2xl font-semibold tracking-tight">角色管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          新建角色
        </Button>
      </div>

      {error && <InlineAlert variant="destructive">加载角色列表失败</InlineAlert>}

      <DataTable
        columns={columns}
        data={roles ?? []}
        isLoading={isLoading}
        emptyMessage="暂无角色数据"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '新建角色'}</DialogTitle>
          </DialogHeader>
          <RoleForm
            role={editingRole}
            onSubmit={handleFormSubmit}
            onCancel={() => setDialogOpen(false)}
            isSubmitting={createRoleMutation.isPending || updateRoleMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
