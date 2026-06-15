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
import type { z } from 'zod';
import { CreateRoleSchema, UpdateRoleSchema, type RoleResponse } from '@nebula/shared';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '@/api';
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
  DialogHeader,
  DialogFooter,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

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

  const columns: ColumnDef<RoleResponse, unknown>[] = [
    {
      accessorKey: 'name',
      size: 200,
      header: ({ column }) => <DataTableColumnHeader column={column} title="角色名称" />,
    },
    {
      accessorKey: 'description',
      size: 300,
      header: ({ column }) => <DataTableColumnHeader column={column} title="描述" />,
      cell: ({ row }) => {
        const description = row.getValue('description');
        return description || '-';
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
    data: roles ?? [],
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
        <h1 className="text-2xl font-semibold tracking-tight">角色管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1.5 size-4" />
          新建角色
        </Button>
      </div>

      {error && <Alert variant="destructive">加载角色列表失败</Alert>}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索角色名称..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
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
                <TableCell colSpan={columns.length} className="p-0">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Shield />
                      </EmptyMedia>
                      <EmptyTitle>暂无角色数据</EmptyTitle>
                      <EmptyDescription>
                        还没有任何角色，点击上方按钮创建第一个角色
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
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
