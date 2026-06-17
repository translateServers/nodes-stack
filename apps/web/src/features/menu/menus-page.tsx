import { useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Link2,
  MousePointerClick,
  Plus,
  Pencil,
  Trash2,
  Menu,
} from 'lucide-react';
import {
  CreateMenuSchema,
  UpdateMenuSchema,
  type MenuResponse,
  type MenuTreeNode,
} from '@nebula/shared';
import { useMenuTree, useCreateMenu, useUpdateMenu, useDeleteMenu } from './hooks';
import { Button } from '@/components/ui/button';
import { confirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useNebulaForm } from '@/hooks/use-nebula-form';
import { Spinner } from '@/components/ui/spinner';

type MenuTypeValue = 'DIRECTORY' | 'MENU' | 'BUTTON';

const MENU_TYPE_OPTIONS: {
  value: MenuTypeValue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'DIRECTORY', label: '目录', icon: Folder },
  { value: 'MENU', label: '菜单', icon: Link2 },
  { value: 'BUTTON', label: '按钮', icon: MousePointerClick },
];

// ── MenuForm ────────────────────────────────────────────

interface MenuFormProps {
  menu?: MenuResponse;
  parentId?: string | null;
  onSubmit: (data: unknown) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function MenuForm({ menu, parentId, onSubmit, onCancel, isSubmitting }: MenuFormProps) {
  const isEdit = !!menu;
  const { data: treeData } = useMenuTree();

  const form = useNebulaForm({
    schema: isEdit ? UpdateMenuSchema : CreateMenuSchema,
    defaultValues: menu
      ? {
          name: menu.name,
          type: menu.type,
          path: menu.path ?? '',
          icon: menu.icon ?? '',
          component: menu.component ?? '',
          parentId: menu.parentId,
          sort: menu.sort,
          permission: menu.permission ?? '',
          isVisible: menu.isVisible,
        }
      : {
          name: '',
          type: 'MENU' as MenuTypeValue,
          path: '',
          icon: '',
          component: '',
          parentId: parentId ?? null,
          sort: 0,
          permission: '',
          isVisible: true,
        },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <FieldGroup>
        {/* 菜单名称 */}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>菜单名称</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入菜单名称"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* 菜单类型 */}
        <Controller
          name="type"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>菜单类型</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="选择菜单类型" />
                </SelectTrigger>
                <SelectContent>
                  {MENU_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-1.5">
                        <opt.icon className="size-3.5" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* 父级菜单 */}
        <Controller
          name="parentId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>父级菜单</FieldLabel>
              <Select
                value={field.value ?? 'root'}
                onValueChange={(v) => field.onChange(v === 'root' ? null : v)}
              >
                <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="选择父级菜单（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">作为一级菜单</SelectItem>
                  {flattenTreeForSelect(treeData ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.indent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* 路由路径 */}
        <Controller
          name="path"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>路由路径</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="/users（可选）"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* 图标 */}
        <Controller
          name="icon"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>图标</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="Users（lucide 图标名，可选）"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* 组件路径 */}
        <Controller
          name="component"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>组件路径</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="/pages/Users.tsx（可选）"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* 排序 + 显示 */}
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="sort"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>排序</FieldLabel>
                <Input
                  id={field.name}
                  type="number"
                  min={0}
                  value={String(field.value ?? 0)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="isVisible"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                <Checkbox
                  id={field.name}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-invalid={fieldState.invalid}
                />
                <FieldLabel htmlFor={field.name} className="font-normal">
                  显示菜单
                </FieldLabel>
              </Field>
            )}
          />
        </div>

        {/* 权限标识 */}
        <Controller
          name="permission"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>权限标识</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="system:user:read（可选）"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : isEdit ? '更新' : '创建'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

// ── Flatten tree for select options ─────────────────────

function flattenTreeForSelect(
  nodes: MenuTreeNode[],
  result: { id: string; indent: string }[] = [],
  depth = 0,
): { id: string; indent: string }[] {
  for (const node of nodes) {
    result.push({ id: node.id, indent: `${'　'.repeat(depth)}${node.name}` });
    if (node.children?.length) {
      flattenTreeForSelect(node.children, result, depth + 1);
    }
  }
  return result;
}

// ── TypeTag ─────────────────────────────────────────────

function TypeTag({ type }: { type: string }) {
  const opt = MENU_TYPE_OPTIONS.find((o) => o.value === type);
  if (!opt) return null;
  return (
    <span className="flex items-center gap-1">
      <opt.icon className="size-3.5" />
      {opt.label}
    </span>
  );
}

// ── TreeNode ────────────────────────────────────────────

interface TreeNodeProps {
  node: MenuTreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (menu: MenuResponse) => void;
  onDelete: (menu: MenuResponse) => void | Promise<void>;
}

function TreeNode({ node, depth, expandedIds, onToggle, onEdit, onDelete }: TreeNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <>
      <tr className="group border-b hover:bg-muted/30">
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 24 }}>
            {hasChildren ? (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => onToggle(node.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <span>{node.name}</span>
          </div>
        </td>
        <td className="px-3 py-2">
          <TypeTag type={node.type} />
        </td>
        <td className="px-3 py-2 text-muted-foreground text-sm">{node.path ?? '-'}</td>
        <td className="px-3 py-2 text-muted-foreground text-sm">{node.permission ?? '-'}</td>
        <td className="px-3 py-2 text-center">
          <Badge variant={node.isVisible ? 'default' : 'outline'}>
            {node.isVisible ? '显示' : '隐藏'}
          </Badge>
        </td>
        <td className="px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1">
            <Button variant="ghost" size="icon-xs" onClick={() => onEdit(node)} title="编辑">
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void onDelete(node)}
              className="text-destructive hover:text-destructive"
              title="删除"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {hasChildren && isExpanded
        ? node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        : null}
    </>
  );
}

// ── MenusPage ───────────────────────────────────────────

export default function MenusPage() {
  const { data: tree, isLoading, error } = useMenuTree();
  const createMutation = useCreateMenu();
  const updateMutation = useUpdateMenu();
  const deleteMutation = useDeleteMenu();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuResponse | undefined>();
  const [parentId, setParentId] = useState<string | null | undefined>();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleCreate = (pid?: string | null) => {
    setEditingMenu(undefined);
    setParentId(pid);
    setDialogOpen(true);
  };

  const handleEdit = (menu: MenuResponse) => {
    setEditingMenu(menu);
    setParentId(undefined);
    setDialogOpen(true);
  };

  const handleDelete = async (menu: MenuResponse) => {
    const ok = await confirmDialog({
      title: '删除菜单',
      description: (
        <>
          确定要删除菜单 <strong>「{menu.name}」</strong> 吗？子菜单也会一并删除。
        </>
      ),
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(menu.id);
  };

  const handleFormSubmit = async (formData: unknown) => {
    if (editingMenu) {
      await updateMutation.mutateAsync({
        id: editingMenu.id,
        params: formData as Parameters<typeof updateMutation.mutateAsync>[0]['params'],
      });
    } else {
      await createMutation.mutateAsync(
        formData as Parameters<typeof createMutation.mutateAsync>[0],
      );
    }
    setDialogOpen(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">菜单管理</h1>
        <Button onClick={() => handleCreate()}>
          <Plus className="mr-1.5 size-4" />
          新建菜单
        </Button>
      </div>

      {error && <Alert variant="destructive">加载菜单列表失败</Alert>}

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2.5 text-left font-medium">菜单名称</th>
                <th className="px-3 py-2.5 text-left font-medium">类型</th>
                <th className="px-3 py-2.5 text-left font-medium">路由</th>
                <th className="px-3 py-2.5 text-left font-medium">权限</th>
                <th className="px-3 py-2.5 text-center font-medium">状态</th>
                <th className="px-3 py-2.5 text-center font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="h-32 text-center">
                    <Spinner className="mx-auto size-6" />
                  </td>
                </tr>
              ) : !tree?.length ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Menu />
                        </EmptyMedia>
                        <EmptyTitle>暂无菜单数据</EmptyTitle>
                        <EmptyDescription>
                          还没有任何菜单，点击上方按钮创建第一个菜单
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </td>
                </tr>
              ) : (
                tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    expandedIds={expandedIds}
                    onToggle={toggleExpand}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMenu ? '编辑菜单' : '新建菜单'}</DialogTitle>
            <DialogDescription>
              {editingMenu
                ? `正在编辑菜单：${editingMenu.name}`
                : parentId
                  ? '为选中菜单添加子菜单'
                  : '创建一个新的菜单'}
            </DialogDescription>
          </DialogHeader>
          <MenuForm
            menu={editingMenu}
            parentId={parentId}
            onSubmit={handleFormSubmit}
            onCancel={() => setDialogOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
