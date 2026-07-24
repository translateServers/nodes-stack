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

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
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
  /**
   * 同步键（可选）：变化时丢弃当前 draft。
   * 用于属性面板切换选中对象/字段时重置编辑上下文，避免把上一对象的草稿带入下一对象。
   */
  syncKey?: string;
  /**
   * 显示精度（可选）：仅影响非编辑态的显示字符串，不修改实际 value。
   * 例如 precision=2 时：
   * - 100 → "100"（去掉无意义尾零）
   * - 100.5 → "100.5"
   * - 100.567 → "100.57"（四舍五入到 2 位）
   * 编辑态始终显示用户原始输入，不进行格式化。
   */
  precision?: number;
}

/** 将数值钳制到 [min, max] 区间 */
function clamp(value: number, min?: number, max?: number): number {
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

/**
 * 按精度格式化数值为显示字符串，自动去掉无意义尾零。
 *
 * - 不传 precision 或 precision<=0：直接 String(value)
 * - precision=2：100 → "100"，100.5 → "100.5"，100.567 → "100.57"
 *
 * 加 Number.EPSILON 缓解 1.005 类四舍五入问题；
 * 非 finite 值（NaN/Infinity）回退到 String(value)。
 */
function formatValue(value: number, precision?: number): string {
  if (precision === undefined || precision <= 0 || !Number.isFinite(value)) {
    return String(value);
  }
  const factor = 10 ** precision;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return String(rounded);
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
  syncKey,
  precision,
}: NumberInputProps) {
  // draft !== null 时表示用户正在编辑（input 显示 draft）；null 时显示 value
  const [draft, setDraft] = useState<string | null>(null);

  // 记录上一次的外部 value 与 syncKey，用于检测外部变化
  const prevValueRef = useRef(value);
  const prevSyncKeyRef = useRef(syncKey);

  // 外部值优先策略：
  // - 未聚焦时：始终显示外部 value（draft === null）
  // - 聚焦编辑中：保留用户 draft
  // - 外部 value 或 syncKey 变化时：放弃 draft，显示新值
  //   适用于拖拽/缩放期间 Store 更新会覆盖用户草稿、属性面板切换选中对象的场景
  useEffect(() => {
    if (prevValueRef.current !== value || prevSyncKeyRef.current !== syncKey) {
      prevValueRef.current = value;
      prevSyncKeyRef.current = syncKey;
      setDraft(null);
    }
  }, [value, syncKey]);

  const displayValue = draft ?? formatValue(value, precision);

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

  // 标记"刚刚通过 Enter/Escape 主动 blur"，用于跳过随后 blur 触发的重复 commit。
  // 真实浏览器中 element.blur() 会同步派发 blur 事件，此时 commit 闭包仍持有旧 draft，
  // 会再次触发 onChange。此 ref 确保一次显式提交最多触发一次 onChange。
  const skipNextBlurCommitRef = useRef(false);

  const handleBlur = () => {
    if (skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false;
      return;
    }
    commit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      skipNextBlurCommitRef.current = true; // 跳过随后 .blur() 触发的 commit
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(null); // 放弃编辑
      skipNextBlurCommitRef.current = true; // 跳过随后 .blur() 触发的 commit
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
        // 进入编辑态前重置跳过标记，防止上一次未消费的标记误伤本次 blur
        skipNextBlurCommitRef.current = false;
        // 进入编辑态：把 draft 设为格式化后的字符串，便于用户全选替换
        // 避免聚焦瞬间从 "100.57" 跳到 "100.567" 的视觉抖动
        setDraft(formatValue(value, precision));
        // 自动全选，符合 PS 数值输入习惯
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
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
