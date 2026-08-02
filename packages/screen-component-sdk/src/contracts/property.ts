/**
 * 声明式属性面板（Spec §7.4）
 *
 * 公共属性面板只开放可序列化字段。
 * pointer 使用相对 props 根的 RFC 6901 JSON Pointer。
 * 不允许 render、customRender、ReactNode、HTML 字符串或回调函数。
 */

export interface ScreenComponentPropertySection {
  id: string;
  title: string;
  defaultOpen?: boolean;
  fields: readonly ScreenComponentPropertyField[];
}

interface ScreenComponentPropertyFieldBase {
  id: string;
  label: string;
  pointer: string;
  description?: string;
}

export type ScreenComponentPropertyField =
  | (ScreenComponentPropertyFieldBase & {
      control: 'text' | 'textarea' | 'color' | 'switch';
    })
  | (ScreenComponentPropertyFieldBase & {
      control: 'number';
      min?: number;
      max?: number;
      step?: number;
    })
  | (ScreenComponentPropertyFieldBase & {
      control: 'select';
      options: readonly { label: string; value: string | number }[];
    });

/** 属性控件类型枚举 */
export const PROPERTY_CONTROL_TYPES = [
  'text',
  'textarea',
  'color',
  'switch',
  'number',
  'select',
] as const;

export type PropertyControlType = (typeof PROPERTY_CONTROL_TYPES)[number];
