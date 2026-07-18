import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EditorProps } from './text-editor';
import type { DataTableColumnMeta } from '../types';

interface SelectEditorProps extends EditorProps {
  options?: { label: string; value: string | number }[];
}

/** 下拉编辑器：选择即确认 */
export function SelectEditor({ value, onCommit, onCancel, options = [] }: SelectEditorProps) {
  const initialValue =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '';
  const [localValue, setLocalValue] = useState(initialValue);

  return (
    <Select
      value={localValue}
      onValueChange={(v) => {
        setLocalValue(v);
        onCommit(v);
      }}
      onOpenChange={(open) => {
        if (!open && localValue === initialValue) onCancel();
      }}
    >
      <SelectTrigger className="h-8" autoFocus>
        <SelectValue placeholder="选择..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** 根据列 meta 配置创建带选项的下拉编辑器 */
export function createSelectEditor(meta: DataTableColumnMeta<unknown> | undefined) {
  return function BoundSelectEditor(props: EditorProps) {
    return <SelectEditor {...props} options={meta?.editorOptions} />;
  };
}
