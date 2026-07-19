import type { ScreenComponent } from '@nebula/shared';
import { Input } from '@/components/ui/input';
// 数值字段统一使用 PS 风格 NumberInput（↑↓ 微调 + draft 提交，避免每次按键入历史栈）
import { NumberInput } from './number-input';

/** 属性面板内数值字段的统一样式（与新 NumberInput 默认 h-8 视觉对齐到原 h-7 紧凑外观） */
export const numberInputClass = 'h-7 px-2 py-1 text-sm';

/** 与 Input 同款样式的 textarea，项目暂无 Textarea shadcn 组件，本地复用样式 */
export const textareaClass =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';

export function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-12 shrink-0 text-xs text-muted-foreground">{label}</label>
      <Input
        type="text"
        className="h-7 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-12 shrink-0 text-xs text-muted-foreground">{label}</label>
      <input
        type="color"
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input bg-card"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input
        type="text"
        className="h-7 px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function StyleFields({
  component,
  onUpdate,
}: {
  component: ScreenComponent;
  onUpdate: (updates: Partial<ScreenComponent>) => void;
}) {
  const { style } = component;
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">样式</div>
      <ColorInput
        label="背景"
        value={style.backgroundColor ?? '#ffffff'}
        onChange={(v) => onUpdate({ style: { ...style, backgroundColor: v } })}
      />
      <NumberInput
        label="透明度"
        value={style.opacity ?? 1}
        step={0.1}
        shiftStep={0.5}
        min={0}
        max={1}
        onChange={(v) => onUpdate({ style: { ...style, opacity: v } })}
        className={numberInputClass}
        syncKey={`${component.id}:style.opacity`}
      />
      <NumberInput
        label="边框"
        value={style.borderWidth ?? 0}
        min={0}
        onChange={(v) => onUpdate({ style: { ...style, borderWidth: v } })}
        className={numberInputClass}
        syncKey={`${component.id}:style.borderWidth`}
      />
      <ColorInput
        label="边框色"
        value={style.borderColor ?? '#000000'}
        onChange={(v) => onUpdate({ style: { ...style, borderColor: v } })}
      />
      <NumberInput
        label="圆角"
        value={style.borderRadius ?? 0}
        min={0}
        onChange={(v) => onUpdate({ style: { ...style, borderRadius: v } })}
        className={numberInputClass}
        syncKey={`${component.id}:style.borderRadius`}
      />
    </div>
  );
}
