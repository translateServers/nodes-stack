import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import type { EditorProps } from './text-editor';

/** 日期编辑器：原生 date input，Enter 确认、Escape 取消、失焦确认 */
export function DateEditor({ value, onCommit, onCancel }: EditorProps) {
  const [localValue, setLocalValue] = useState(
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '',
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      onCommit(localValue || undefined);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <Input
      type="date"
      autoFocus
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onCommit(localValue || undefined)}
      className="h-8"
    />
  );
}
