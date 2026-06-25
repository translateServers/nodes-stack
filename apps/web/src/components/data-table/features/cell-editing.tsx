import { useState, type ReactNode } from 'react';
import { flexRender, type CellContext, type ColumnDef } from '@tanstack/react-table';
import { getEditor, type EditorType } from '../editors';
import type { DataTableColumnMeta, DataTableFeature } from '../types';

/** EditableCell 组件 props */
interface EditableCellProps<TData> {
  /** 单元格上下文 */
  ctx: CellContext<TData, unknown>;
  /** 原始 cell 渲染函数 */
  originalCell?: unknown;
  /** 编辑器类型 */
  editorType: EditorType;
  /** 校验函数 */
  validate?: (value: unknown, row: TData) => string | undefined;
  /** 编辑提交回调 */
  onCellEdit?: (row: TData, columnId: string, newValue: unknown) => void | Promise<void>;
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
        {originalCell
          ? flexRender(originalCell as ColumnDef<TData>['cell'], ctx)
          : String(ctx.getValue() ?? '')}
      </div>
    );
  }

  const Editor = getEditor(editorType);

  const handleCommit = async (newValue: unknown) => {
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
  };

  const handleCancel = () => {
    setError(undefined);
    setIsEditing(false);
  };

  return (
    <div className="relative">
      <Editor value={ctx.getValue()} onCommit={handleCommit} onCancel={handleCancel} />
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
  columns: ColumnDef<TData, unknown>[],
  onCellEdit?: (row: TData, columnId: string, newValue: unknown) => void | Promise<void>,
): ColumnDef<TData, unknown>[] {
  if (!onCellEdit) return columns;

  return columns.map((col) => {
    const meta = col.meta as DataTableColumnMeta<TData> | undefined;
    if (!meta?.editable) return col;

    const originalCell = col.cell;
    const editorType = (meta.editorType ?? 'text') as EditorType;

    return {
      ...col,
      cell: (ctx: CellContext<TData, unknown>): ReactNode => (
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
  return {
    id: 'cell-editing',
    columnEnhancers: () => [],
    // 实际的列增强在主组件中通过 createEditableColumns 实现
    tableOptions: () => ({}),
  };
}
