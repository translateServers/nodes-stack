/**
 * 数值输入组件（适配表 #19）
 *
 * 包装 shadcn `Input`，提供 Photoshop 风格的数值微调：
 * - ↑ / ↓：步进 1px
 * - Shift + ↑ / ↓：步进 10px
 * - 直接输入数值：回车确认 / Blur 提交（draft 模式，避免每次按键都入历史栈）
 * - Esc：放弃当前编辑，恢复到 value
 *
 * 与 property-panel 内联 NumberInput 的差异：
 * - 内部维护 draft 字符串状态，避免 onChange 直接写入 store 触发历史栈污染
 * - 提交时机仅限 Enter / Blur，符合 PS 输入习惯
 */

import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

export interface NumberInputProps {
  /** 当前值（受控） */
  value: number;
  /** 值变更回调（仅在 Enter / Blur / 方向键时触发） */
  onChange: (value: number) => void;
  /** 普通步长（ArrowUp/Down），默认 1 */
  step?: number;
  /** Shift 修饰时的步长（Shift+ArrowUp/Down），默认 10 */
  shiftStep?: number;
  /** 最小值（可选） */
  min?: number;
  /** 最大值（可选） */
  max?: number;
  /** 标签文本（可选） */
  label?: string;
  /** 单位后缀（可选，如 'px'） */
  unit?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 透传给 Input 的 className */
  className?: string;
}

/** 将数值钳制到 [min, max] 区间 */
function clamp(value: number, min?: number, max?: number): number {
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

/**
 * 解析 draft 字符串为有限数。
 * 接受 "123"、"12.5"、"-3" 等；拒绝空串、NaN、Infinity。
 */
function parseDraft(draft: string): number | null {
  const trimmed = draft.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  shiftStep = 10,
  min,
  max,
  label,
  unit,
  disabled,
  className,
}: NumberInputProps) {
  // draft !== null 时表示用户正在编辑（input 显示 draft）；null 时显示 value
  const [draft, setDraft] = useState<string | null>(null);

  const displayValue = draft ?? String(value);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseDraft(draft);
    if (parsed !== null) {
      const clamped = clamp(parsed, min, max);
      // 仅当值变化时回调，避免重复入历史栈
      if (clamped !== value) {
        onChange(clamped);
      }
    }
    setDraft(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(null); // 放弃编辑
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // 微调时基于 draft 解析值（若可解析）或当前 value
      const base = draft !== null ? (parseDraft(draft) ?? value) : value;
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? shiftStep : step);
      const next = clamp(base + delta, min, max);
      onChange(next);
      setDraft(null); // 让显示回到 value 受控状态，下次渲染会显示新 value
    }
  };

  const inputEl = (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={displayValue}
      disabled={disabled}
      onFocus={(e) => {
        // 进入编辑态：把 draft 设为当前 value 的字符串形式，便于用户全选替换
        setDraft(String(value));
        // 自动全选，符合 PS 数值输入习惯
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
    />
  );

  if (!label && !unit) return inputEl;

  return (
    <div className="flex items-center gap-2">
      {label && <label className="w-12 shrink-0 text-xs text-muted-foreground">{label}</label>}
      {inputEl}
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </div>
  );
}
