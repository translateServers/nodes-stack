import { useCallback, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { z } from 'zod';
import {
  CreateDictTypeSchema,
  UpdateDictTypeSchema,
  CreateDictValueSchema,
  UpdateDictValueSchema,
  type DictTypeResponse,
  type DictValueResponse,
} from '@nebula/shared';
import {
  useDictTypes,
  useCreateDictType,
  useUpdateDictType,
  useDeleteDictType,
  useDictValues,
  useCreateDictValue,
  useUpdateDictValue,
  useDeleteDictValue,
} from './hooks';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table';
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
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useNebulaForm } from '@/hooks/use-nebula-form';
import { Plus, Pencil, Trash2, BookOpen, FileText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type CreateDictTypeInput = z.infer<typeof CreateDictTypeSchema>;
type UpdateDictTypeInput = z.infer<typeof UpdateDictTypeSchema>;
type CreateDictValueInput = z.infer<typeof CreateDictValueSchema>;
type UpdateDictValueInput = z.infer<typeof UpdateDictValueSchema>;

// ──────────────────────── 字典类型表单 ────────────────────────

interface DictTypeFormProps {
  dictType?: DictTypeResponse;
  onSubmit: (data: unknown) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function DictTypeForm({ dictType, onSubmit, onCancel, isSubmitting }: DictTypeFormProps) {
  const isEdit = !!dictType;

  const form = useNebulaForm({
    schema: isEdit ? UpdateDictTypeSchema : CreateDictTypeSchema,
    defaultValues: dictType
      ? {
          code: dictType.code,
          name: dictType.name,
          remark: dictType.remark ?? '',
          isActive: dictType.isActive,
          sort: dictType.sort,
        }
      : { code: '', name: '', remark: '', isActive: true, sort: 0 },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <FieldGroup>
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>编码</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入字典类型编码（如：user_status）"
                aria-invalid={fieldState.invalid}
                disabled={isEdit}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>名称</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入字典类型名称"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="isActive"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>状态</FieldLabel>
              <Select
                value={field.value ? 'true' : 'false'}
                onValueChange={(val) => field.onChange(val === 'true')}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">启用</SelectItem>
                  <SelectItem value="false">禁用</SelectItem>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="remark"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>备注</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入备注（可选）"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="sort"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>排序</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="number"
                placeholder="0"
                aria-invalid={fieldState.invalid}
                onChange={(e) => field.onChange(Number(e.target.value))}
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

// ──────────────────────── 字典值表单 ────────────────────────

interface DictValueFormProps {
  dictValue?: DictValueResponse;
  dictTypeId: string;
  onSubmit: (data: unknown) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function DictValueForm({
  dictValue,
  dictTypeId,
  onSubmit,
  onCancel,
  isSubmitting,
}: DictValueFormProps) {
  const isEdit = !!dictValue;

  const form = useNebulaForm({
    schema: isEdit ? UpdateDictValueSchema : CreateDictValueSchema,
    defaultValues: dictValue
      ? {
          code: dictValue.code,
          label: dictValue.label,
          value: dictValue.value,
          color: dictValue.color ?? '',
          remark: dictValue.remark ?? '',
          sort: dictValue.sort,
        }
      : { code: '', label: '', value: '', color: '', remark: '', sort: 0, dictTypeId },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="code"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>编码</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="如：active"
                  aria-invalid={fieldState.invalid}
                  disabled={isEdit}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="label"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>标签</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="如：启用"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="value"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>值</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="如：1"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="color"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>颜色</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="如：#10b981（可选）"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="sort"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>排序</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="number"
                  placeholder="0"
                  aria-invalid={fieldState.invalid}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <Controller
          name="remark"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>备注</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="请输入备注（可选）"
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

// ──────────────────────── 主页面 ────────────────────────

export default function DictsPage() {
  // 字典类型
  const { data: dictTypes, isLoading: typesLoading, error: typesError } = useDictTypes();
  const createTypeMutation = useCreateDictType();
  const updateTypeMutation = useUpdateDictType();
  const deleteTypeMutation = useDeleteDictType();

  // 字典值
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const { data: dictValues, isLoading: valuesLoading } = useDictValues(selectedTypeId);
  const createValueMutation = useCreateDictValue();
  const updateValueMutation = useUpdateDictValue();
  const deleteValueMutation = useDeleteDictValue();

  // 搜索状态
  const [typeSearch, setTypeSearch] = useState('');

  // 对话框状态
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<DictTypeResponse | undefined>();
  const [valueDialogOpen, setValueDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<DictValueResponse | undefined>();

  // 过滤后的字典类型
  const filteredTypes = useMemo(() => {
    if (!dictTypes) return [];
    if (!typeSearch.trim()) return dictTypes;
    const keyword = typeSearch.toLowerCase();
    return dictTypes.filter(
      (type) =>
        type.name.toLowerCase().includes(keyword) ||
        type.code.toLowerCase().includes(keyword) ||
        (type.remark && type.remark.toLowerCase().includes(keyword)),
    );
  }, [dictTypes, typeSearch]);

  const handleSelectType = useCallback((typeId: string) => {
    setSelectedTypeId(typeId);
  }, []);

  // 字典类型操作
  const handleCreateType = useCallback(() => {
    setEditingType(undefined);
    setTypeDialogOpen(true);
  }, []);

  const handleEditType = useCallback((dictType: DictTypeResponse) => {
    setEditingType(dictType);
    setTypeDialogOpen(true);
  }, []);

  const handleDeleteType = useCallback(async (dictType: DictTypeResponse) => {
    if (!confirm(`确定要删除字典类型 "${dictType.name}" 及其所有字典值吗？`)) return;
    await deleteTypeMutation.mutateAsync(dictType.id);
    if (selectedTypeId === dictType.id) {
      setSelectedTypeId('');
    }
  }, [deleteTypeMutation, selectedTypeId]);

  const handleTypeFormSubmit = useCallback(async (data: unknown) => {
    if (editingType) {
      await updateTypeMutation.mutateAsync({
        id: editingType.id,
        params: data as UpdateDictTypeInput,
      });
    } else {
      await createTypeMutation.mutateAsync(data as CreateDictTypeInput);
    }
    setTypeDialogOpen(false);
  }, [editingType, createTypeMutation, updateTypeMutation]);

  // 字典值操作
  const handleCreateValue = useCallback(() => {
    setEditingValue(undefined);
    setValueDialogOpen(true);
  }, []);

  const handleEditValue = useCallback((dictValue: DictValueResponse) => {
    setEditingValue(dictValue);
    setValueDialogOpen(true);
  }, []);

  const handleDeleteValue = useCallback(async (dictValue: DictValueResponse) => {
    if (!confirm(`确定要删除字典值 "${dictValue.label}" 吗？`)) return;
    await deleteValueMutation.mutateAsync(dictValue.id);
  }, [deleteValueMutation]);

  const handleValueFormSubmit = useCallback(async (data: unknown) => {
    if (editingValue) {
      await updateValueMutation.mutateAsync({
        id: editingValue.id,
        params: data as UpdateDictValueInput,
      });
    } else {
      await createValueMutation.mutateAsync({
        ...(data as CreateDictValueInput),
        dictTypeId: selectedTypeId,
      });
    }
    setValueDialogOpen(false);
  }, [editingValue, selectedTypeId, createValueMutation, updateValueMutation]);

  const valueColumnHelper = createColumnHelper<DictValueResponse>();

  const valueColumns = useMemo(() => [
    valueColumnHelper.accessor('code', {
      header: '编码',
      cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    valueColumnHelper.accessor('label', {
      header: '标签',
    }),
    valueColumnHelper.accessor('value', {
      header: '值',
      cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    valueColumnHelper.accessor('color', {
      header: '颜色',
      cell: (info) => {
        const color = info.getValue();
        if (!color) return '-';
        return (
          <div className="flex items-center gap-2">
            <div
              className="size-4 rounded border"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs">{color}</span>
          </div>
        );
      },
    }),
    valueColumnHelper.accessor('sort', {
      header: '排序',
    }),
    valueColumnHelper.accessor('isActive', {
      header: '状态',
      cell: (info) =>
        info.getValue() ? (
          <Badge variant="default">启用</Badge>
        ) : (
          <Badge variant="secondary">禁用</Badge>
        ),
    }),
    valueColumnHelper.display({
      id: 'actions',
      header: '操作',
      size: 100,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => handleEditValue(row.original)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void handleDeleteValue(row.original)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    }),
  ], [handleEditValue, handleDeleteValue]);

  const selectedType = dictTypes?.find((t) => t.id === selectedTypeId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">字典管理</h1>
      </div>

      {typesError && <Alert variant="destructive">加载字典类型列表失败</Alert>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 左侧：字典类型列表 */}
        <div className="lg:col-span-4">
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">字典类型</h2>
              <Button size="sm" onClick={handleCreateType}>
                <Plus className="mr-1 size-3.5" />
                新建
              </Button>
            </div>
            {/* 搜索框 */}
            <div className="border-b px-3 py-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  placeholder="搜索类型名称/编码..."
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {typesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="size-6" />
                </div>
              ) : filteredTypes.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BookOpen />
                    </EmptyMedia>
                    <EmptyTitle>{typeSearch ? '未找到匹配的类型' : '暂无字典类型'}</EmptyTitle>
                    <EmptyDescription>
                      {typeSearch ? '尝试其他关键词' : '点击上方按钮创建第一个字典类型'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredTypes.map((type) => (
                    <div
                      key={type.id}
                      className={cn(
                        'group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
                        selectedTypeId === type.id && 'bg-primary/10 hover:bg-primary/15',
                      )}
                      onClick={() => handleSelectType(type.id)}
                    >
                      <div className="flex-1 overflow-hidden">
                        <div className="font-medium">{type.name}</div>
                        <div className="text-muted-foreground text-xs">{type.code}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditType(type);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteType(type);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：字典值列表 */}
        <div className="lg:col-span-8">
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                {selectedType ? `${selectedType.name} - 字典值` : '字典值'}
              </h2>
              <Button size="sm" onClick={handleCreateValue} disabled={!selectedTypeId}>
                <Plus className="mr-1 size-3.5" />
                新建
              </Button>
            </div>
            {!selectedTypeId ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle>请选择字典类型</EmptyTitle>
                  <EmptyDescription>从左侧选择一个字典类型以查看其字典值</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="p-4">
                <DataTable
                  data={dictValues ?? []}
                  columns={valueColumns}
                  getRowId={(row) => row.id}
                  isLoading={valuesLoading}
                  searchPlaceholder="搜索标签/编码/值..."
                  searchColumnIds={['label', 'code', 'value']}
                  emptyIcon={<FileText className="size-12" />}
                  emptyTitle="暂无字典值"
                  emptyDescription="点击上方按钮创建第一个字典值"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 字典类型对话框 */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? '编辑字典类型' : '新建字典类型'}</DialogTitle>
          </DialogHeader>
          <DictTypeForm
            dictType={editingType}
            onSubmit={handleTypeFormSubmit}
            onCancel={() => setTypeDialogOpen(false)}
            isSubmitting={createTypeMutation.isPending || updateTypeMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* 字典值对话框 */}
      <Dialog open={valueDialogOpen} onOpenChange={setValueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingValue ? '编辑字典值' : '新建字典值'}</DialogTitle>
          </DialogHeader>
          {selectedTypeId && (
            <DictValueForm
              dictValue={editingValue}
              dictTypeId={selectedTypeId}
              onSubmit={handleValueFormSubmit}
              onCancel={() => setValueDialogOpen(false)}
              isSubmitting={createValueMutation.isPending || updateValueMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
