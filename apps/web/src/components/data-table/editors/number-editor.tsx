import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import type { EditorProps } from './text-editor';

/** 数字编辑器：Enter 确认、Escape 取消、失焦确认 */
export function NumberEditor({ value, onCommit, onCancel }: EditorProps) {
  const [localValue, setLocalValue] = useState(
    value !== undefined && value !== null ? String(value) : '',
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      const num = localValue === '' ? undefined : Number(localValue);
      onCommit(num);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <Input
      type="number"
      autoFocus
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        const num = localValue === '' ? undefined : Number(localValue);
        onCommit(num);
      }}
      className="h-8"
    />
  );
}
