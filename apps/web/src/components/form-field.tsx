import type { Control, FieldValues, Path } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ── FormField ──────────────────────────────────────────

interface FormFieldBaseProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

interface FormFieldInputProps<T extends FieldValues> extends FormFieldBaseProps<T> {
  type?: 'text' | 'email' | 'password' | 'number';
}

interface FormFieldTextareaProps<T extends FieldValues> extends FormFieldBaseProps<T> {
  type: 'textarea';
  rows?: number;
}

interface FormFieldSelectOption {
  label: string;
  value: string;
}

interface FormFieldSelectProps<T extends FieldValues> extends FormFieldBaseProps<T> {
  type: 'select';
  options: FormFieldSelectOption[];
}

type FormFieldProps<T extends FieldValues> =
  | FormFieldInputProps<T>
  | FormFieldTextareaProps<T>
  | FormFieldSelectProps<T>;

/**
 * 表单字段组件，集成 react-hook-form Controller + label + 错误提示。
 * 支持 text/email/password/number/textarea/select 类型。
 */
export function FormField<T extends FieldValues>(props: FormFieldProps<T>) {
  const { control, name, label, required, className } = props;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('space-y-1.5', className)}>
          {label && (
            <Label htmlFor={name}>
              {label}
              {required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
          )}
          {renderInput(props, field)}
          {fieldState.error && (
            <p className="text-destructive text-xs">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}

function renderInput<T extends FieldValues>(
  props: FormFieldProps<T>,
  field: {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    name: string;
    ref: (el: HTMLElement | null) => void;
  },
) {
  const { name, placeholder } = props;

  if (props.type === 'textarea') {
    return (
      <textarea
        id={name}
        rows={props.rows ?? 3}
        placeholder={placeholder}
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        {...field}
        value={(field.value as string) ?? ''}
        onChange={(e) => field.onChange(e.target.value)}
        ref={(el) => field.ref(el)}
      />
    );
  }

  if (props.type === 'select') {
    return (
      <select
        id={name}
        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        {...field}
        value={(field.value as string) ?? ''}
        onChange={(e) => field.onChange(e.target.value)}
        ref={(el) => field.ref(el)}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      id={name}
      type={props.type ?? 'text'}
      placeholder={placeholder}
      {...field}
      value={(field.value as string) ?? ''}
      onChange={(e) => field.onChange(e.target.value)}
      ref={(el) => field.ref(el)}
    />
  );
}

// ── FormActions ────────────────────────────────────────

export function FormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('flex items-center gap-2 pt-2', className)}>{children}</div>;
}
