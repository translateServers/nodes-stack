import { useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import { CreateUserSchema, UpdateUserSchema, type UserResponse } from '@nebula/shared';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@/api';
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableViewOptions,
} from '@/components/data-table';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { useNebulaForm } from '@/hooks/use-nebula-form';
import { Plus, Pencil, Trash2 } from 'lucide-react';

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
    <form onSubmit={(e) => void handleSubmit(e)}>
      <FieldGroup>
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>用户名</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入用户名"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>邮箱</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder="请输入邮箱"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {!isEdit && (
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>密码</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  placeholder="请输入密码"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        )}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>显示名称</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入显示名称（可选）"
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

export default function UsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | undefined>();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

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

  const columns: ColumnDef<UserResponse, unknown>[] = [
    {
      accessorKey: 'username',
      size: 150,
      header: ({ column }) => <DataTableColumnHeader column={column} title="用户名" />,
    },
    {
      accessorKey: 'email',
      size: 200,
      header: ({ column }) => <DataTableColumnHeader column={column} title="邮箱" />,
    },
    {
      accessorKey: 'name',
      size: 150,
      header: ({ column }) => <DataTableColumnHeader column={column} title="显示名称" />,
      cell: ({ row }) => {
        const name = row.getValue('name');
        return name || '-';
      },
    },
    {
      accessorKey: 'isActive',
      size: 100,
      header: ({ column }) => <DataTableColumnHeader column={column} title="状态" />,
      cell: ({ row }) =>
        row.getValue('isActive') ? (
          <Badge variant="default">启用</Badge>
        ) : (
          <Badge variant="destructive">禁用</Badge>
        ),
    },
    {
      id: 'actions',
      header: '操作',
      size: 120,
      enableSorting: false,
      enableHiding: false,
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

  const table = useReactTable({
    data: users ?? [],
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          新建用户
        </Button>
      </div>

      {error && <Alert variant="destructive">加载用户列表失败</Alert>}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索用户名或邮箱..."
          value={(table.getColumn('username')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('username')?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
        <DataTableViewOptions table={table} />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <Spinner className="mx-auto size-6" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  暂无用户数据
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <DataTablePagination table={table} />
      </div>

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
