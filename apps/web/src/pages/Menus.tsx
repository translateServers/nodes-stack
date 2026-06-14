import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Link2,
  MousePointerClick,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  CreateMenuSchema,
  UpdateMenuSchema,
  type MenuResponse,
  type MenuTreeNode,
} from '@nebula/shared';
import { useMenuTree, useCreateMenu, useUpdateMenu, useDeleteMenu } from '@/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineAlert } from '@/components/ui/alert';
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
    <Form {...form}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>菜单名称</FormLabel>
              <FormControl>
                <Input placeholder="请输入菜单名称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>菜单类型</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
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
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>父级菜单</FormLabel>
              <FormControl>
                <Select
                  value={field.value ?? 'root'}
                  onValueChange={(v) => field.onChange(v === 'root' ? null : v)}
                >
                  <SelectTrigger>
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
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="path"
          render={({ field }) => (
            <FormItem>
              <FormLabel>路由路径</FormLabel>
              <FormControl>
                <Input placeholder="/users（可选）" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>图标</FormLabel>
              <FormControl>
                <Input placeholder="Users（lucide 图标名，可选）" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="component"
          render={({ field }) => (
            <FormItem>
              <FormLabel>组件路径</FormLabel>
              <FormControl>
                <Input placeholder="/pages/Users.tsx（可选）" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sort"
            render={({ field }) => (
              <FormItem>
                <FormLabel>排序</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    value={String(field.value ?? 0)}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isVisible"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-normal">显示菜单</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="permission"
          render={({ field }) => (
            <FormItem>
              <FormLabel>权限标识</FormLabel>
              <FormControl>
                <Input placeholder="system:user:read（可选）" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
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
      </form>
    </Form>
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
  onDelete: (menu: MenuResponse) => void;
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

  const handleDelete = (menu: MenuResponse) => {
    if (!confirm(`确定要删除菜单「${menu.name}」吗？子菜单也会一并删除。`)) return;
    void deleteMutation.mutateAsync(menu.id);
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

      {error && <InlineAlert variant="destructive">加载菜单列表失败</InlineAlert>}

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
                  <td colSpan={6} className="h-32 text-center text-muted-foreground">
                    暂无菜单数据
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
