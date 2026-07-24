/**
 * 字段控件注册表（Phase 2 Slice B）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §4.3
 *
 * 所有声明式字段（DeclarativeField）通过 `control` 名查找对应控件组件。
 * 控件统一实现 FieldControlProps 契约，外观一致（两栏栅格 label + 控件）。
 *
 * 吸纳现有 NumberInput / ColorInput / TextInput 并新增 SelectField / SwitchField。
 * 声明式优先，复杂编辑器走 CustomField 逃生舱。
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ColorInput, numberInputClass, textareaClass, TextInput } from '../components/panel-fields';
import { NumberInput } from '../components/number-input';
import type { FieldControlComponent, FieldControlProps } from './types';

/** NumberField：数值输入（PS 风格微调 + draft 提交） */
const NumberField: FieldControlComponent = (props: FieldControlProps<unknown>) => {
  const { value, onChange, label, syncKey, disabled } = props;
  const { min, max, step, shiftStep, precision } = props as FieldControlProps<unknown> & {
    min?: number;
    max?: number;
    step?: number;
    shiftStep?: number;
    precision?: number;
  };
  return (
    <NumberInput
      label={label}
      value={value as number}
      onChange={onChange}
      className={numberInputClass}
      syncKey={syncKey}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      shiftStep={shiftStep}
      precision={precision}
    />
  );
};

/** ColorField：取色器 + 文本输入 */
const ColorField: FieldControlComponent = (props: FieldControlProps<unknown>) => {
  const { value, onChange, label } = props;
  return <ColorInput label={label ?? ''} value={(value as string) ?? ''} onChange={onChange} />;
};

/** TextField：单行文本输入 */
const TextField: FieldControlComponent = (props: FieldControlProps<unknown>) => {
  const { value, onChange, label } = props;
  return <TextInput label={label ?? ''} value={(value as string) ?? ''} onChange={onChange} />;
};

/** TextAreaField：多行文本输入（内容编辑） */
const TextAreaField: FieldControlComponent = (props: FieldControlProps<unknown>) => {
  const { value, onChange, label } = props;
  return (
    <div className="flex items-start gap-2">
      {label && (
        <label className="mt-1.5 w-12 shrink-0 text-xs text-muted-foreground">{label}</label>
      )}
      <textarea
        className={textareaClass}
        rows={3}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

/** SelectOption：select 控件的选项定义 */
interface SelectOption {
  value: string;
  label: string;
}

/** SelectField：下拉选择 */
const SelectField: FieldControlComponent = (props: FieldControlProps<unknown>) => {
  const { value, onChange, label } = props;
  const { options } = props as FieldControlProps<unknown> & {
    options?: readonly SelectOption[];
  };
  return (
    <div className="flex items-center gap-2">
      {label && <label className="w-14 shrink-0 text-xs text-muted-foreground">{label}</label>}
      <Select value={(value as string) ?? ''} onValueChange={(v) => onChange(v)}>
        <SelectTrigger size="sm" className="h-7 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(options ?? []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/** SwitchField：开关 */
const SwitchField: FieldControlComponent = (props: FieldControlProps<unknown>) => {
  const { value, onChange, label, disabled } = props;
  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>}
      <Switch
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked)}
        disabled={disabled}
      />
    </div>
  );
};

/**
 * 字段控件注册表。
 * 声明式字段通过 `control: 'number' | 'color' | 'text' | 'textarea' | 'select' | 'switch'` 查找。
 */
export const FIELD_CONTROLS: Record<string, FieldControlComponent> = {
  number: NumberField,
  color: ColorField,
  text: TextField,
  textarea: TextAreaField,
  select: SelectField,
  switch: SwitchField,
};
