import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

/** 编辑器统一 props 接口 */
export interface EditorProps {
  /** 当前值 */
  value: unknown;
  /** 提交新值 */
  onCommit: (value: unknown) => void;
  /** 取消编辑 */
  onCancel: () => void;
}

/** 文本编辑器：Enter 确认、Escape 取消、失焦确认 */
export function TextEditor({ value, onCommit, onCancel }: EditorProps) {
  const [localValue, setLocalValue] = useState(
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : '',
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      onCommit(localValue);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <Input
      autoFocus
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onCommit(localValue)}
      className="h-8"
    />
  );
}
