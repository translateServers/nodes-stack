import { useState, type ReactNode } from 'react';
import { flexRender, type CellContext, type ColumnDef } from '@tanstack/react-table';
import { getEditor, type EditorType } from '../editors';
import type { DataTableColumnMeta, DataTableFeature } from '../types';

/** EditableCell 组件 props */
interface EditableCellProps<TData> {
  /** 单元格上下文 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: CellContext<TData, any>;
  /** 原始 cell 渲染函数（来自 ColumnDef.cell，类型为 ColumnDefTemplate） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalCell?: ColumnDef<TData, any>['cell'];
  /** 编辑器类型 */
  editorType: EditorType;
  /** 校验函数 */
  validate?: (value: unknown, row: TData) => string | undefined;
  /** 编辑提交回调 */
  onCellEdit?: (row: TData, columnId: string, newValue: unknown) => void | Promise<void>;
}

/** 将 unknown 值安全转为字符串，避免对象触发 [object Object] */
function toDisplayString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** 可编辑单元格组件：双击进入编辑态，Enter 确认、Escape 取消 */
export function EditableCell<TData>({
  ctx,
  originalCell,
  editorType,
  validate,
  onCellEdit,
}: EditableCellProps<TData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (!isEditing) {
    return (
      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="cursor-text"
      >
        {originalCell ? flexRender(originalCell, ctx) : toDisplayString(ctx.getValue())}
      </div>
    );
  }

  const Editor = getEditor(editorType);

  const handleCommit = (newValue: unknown): void => {
    void (async () => {
      // 校验
      const validationError = validate?.(newValue, ctx.row.original);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(undefined);
      setIsEditing(false);

      // 回调
      if (onCellEdit && newValue !== ctx.getValue()) {
        await onCellEdit(ctx.row.original, ctx.column.id, newValue);
      }
    })();
  };

  const handleCancel = () => {
    setError(undefined);
    setIsEditing(false);
  };

  // 将 any 类型的 getValue() 显式收窄为 unknown，避免 no-unsafe-assignment
  const currentValue: unknown = ctx.getValue();

  return (
    <div className="relative">
      <Editor value={currentValue} onCommit={handleCommit} onCancel={handleCancel} />
      {error && (
        <div className="absolute left-0 top-full z-30 mt-0.5 rounded bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground shadow-md">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * 将普通列定义转换为可编辑列定义。
 * 仅对 column.meta.editable === true 的列启用编辑。
 */
export function createEditableColumns<TData>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[],
  onCellEdit?: (row: TData, columnId: string, newValue: unknown) => void | Promise<void>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ColumnDef<TData, any>[] {
  if (!onCellEdit) return columns;

  return columns.map((col) => {
    const meta: DataTableColumnMeta<TData> | undefined = col.meta;
    if (!meta?.editable) return col;

    const originalCell = col.cell;
    const editorType: EditorType = meta.editorType ?? 'text';

    return {
      ...col,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell: (ctx: CellContext<TData, any>): ReactNode => (
        <EditableCell
          ctx={ctx}
          originalCell={originalCell}
          editorType={editorType}
          validate={meta.validate}
          onCellEdit={onCellEdit}
        />
      ),
    };
  });
}

/**
 * 单元格编辑 Feature 插件工厂。
 * 通过 columnEnhancers 将可编辑列注入到表格中。
 */
export function createCellEditingFeature<TData>(
  onCellEdit?: (row: TData, columnId: string, newValue: unknown) => void | Promise<void>,
): DataTableFeature<TData> {
  // 参数由 createEditableColumns 在主组件中直接使用，此处保留 API 一致性
  void onCellEdit;
  return {
    id: 'cell-editing',
    columnEnhancers: () => [],
    // 实际的列增强在主组件中通过 createEditableColumns 实现
    tableOptions: () => ({}),
  };
}
