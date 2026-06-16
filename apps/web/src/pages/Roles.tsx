import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { type ColumnDef } from '@tanstack/react-table';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useNebulaForm } from '@/hooks/use-nebula-form';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';

type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

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
    <form onSubmit={(e) => void handleSubmit(e)}>
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>角色名称</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入角色名称"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>角色描述</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入角色描述（可选）"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
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
      </FieldGroup>
    </form>
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

  const handleBatchDelete = async (selectedRoles: RoleResponse[]) => {
    for (const role of selectedRoles) {
      await deleteRoleMutation.mutateAsync(role.id);
    }
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

  const columnHelper = createColumnHelper<RoleResponse>();

  const columns: ColumnDef<RoleResponse, unknown>[] = [
    columnHelper.accessor('name', {
      header: '角色名称',
      size: 200,
      enableResizing: true,
    }),
    columnHelper.accessor('description', {
      header: '描述',
      size: 300,
      enableResizing: true,
      cell: (value) => (value as string) || '-',
    }),
    columnHelper.accessor('isActive', {
      header: '状态',
      size: 100,
      cell: (value) =>
        value ? <Badge variant="default">启用</Badge> : <Badge variant="destructive">禁用</Badge>,
    }),
    {
      id: 'actions',
      header: '操作',
      size: 120,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(row.original)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void handleDelete(row.original)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">角色管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          新建角色
        </Button>
      </div>

      {error && <Alert variant="destructive">加载角色列表失败</Alert>}

      <DataTable
        data={roles ?? []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="搜索角色名称..."
        searchColumnId="name"
        enableRowSelection
        enableColumnResize
        onBatchDelete={(selectedRoles) => void handleBatchDelete(selectedRoles)}
        batchDeleteConfirmMessage="确定要删除选中的角色吗？"
        emptyIcon={<Shield className="size-12" />}
        emptyTitle="暂无角色数据"
        emptyDescription="还没有任何角色，点击上方按钮创建第一个角色"
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
