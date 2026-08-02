/**
 * 按钮组件
 *
 * 交互型基础元素，主要用于触发事件蓝图中的点击事件。
 *
 * 渲染特性：
 * - 居中显示按钮文字（props.text）
 * - 应用 backgroundColor / color / fontSize / borderRadius / borderWidth 等基础样式
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
import type { ComponentStyle } from '@nebula/shared';
import type { ScreenComponentElementModel } from '@nebula/screen-component-sdk';
import { MousePointerClick } from 'lucide-react';
import { mergeActions, mergeEvents } from '../component-events-actions';
import type { ComponentModule } from '../types';
import { BUTTON_SCHEMA } from '../../property-schema/schemas';

interface ButtonComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function ButtonComponent({ props, style }: ButtonComponentProps) {
  const text = (props.text as string) ?? '按钮';

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        backgroundColor: style.backgroundColor ?? '#3b82f6',
        color: style.color ?? '#ffffff',
        fontSize: style.fontSize ?? 14,
        fontWeight: style.fontWeight ?? '500',
        borderWidth: style.borderWidth ?? 0,
        borderStyle: style.borderStyle ?? 'solid',
        borderColor: style.borderColor ?? 'transparent',
        borderRadius: style.borderRadius ?? 8,
        opacity: style.opacity ?? 1,
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span className="truncate px-2" title={text}>
        {text}
      </span>
    </div>
  );
}

function cssLength(value: unknown, fallback: string): string {
  if (typeof value === 'number') return `${value}px`;
  return typeof value === 'string' ? value : fallback;
}

function cssText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function cssNumber(value: unknown, fallback: string): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : fallback;
}

export class ButtonCustomElement extends HTMLElement {
  #root: HTMLDivElement | null = null;
  #label: HTMLSpanElement | null = null;

  #ensureRoot(): { label: HTMLSpanElement; root: HTMLDivElement } {
    if (this.#root !== null && this.#label !== null) {
      return { root: this.#root, label: this.#label };
    }
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    const root = document.createElement('div');
    root.style.display = 'flex';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.overflow = 'hidden';
    root.style.cursor = 'pointer';
    root.style.userSelect = 'none';
    const label = document.createElement('span');
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    label.style.paddingInline = '0.5rem';
    root.append(label);
    this.append(root);
    this.#root = root;
    this.#label = label;
    return { root, label };
  }

  set model(model: ScreenComponentElementModel) {
    const { root, label: labelElement } = this.#ensureRoot();
    const style = model.style;
    const text = model.props['text'];
    const label = typeof text === 'string' ? text : '按钮';
    labelElement.textContent = label;
    labelElement.title = label;
    root.style.backgroundColor = cssText(style['backgroundColor'], '#3b82f6');
    root.style.color = cssText(style['color'], '#ffffff');
    root.style.fontSize = cssLength(style['fontSize'], '14px');
    root.style.fontWeight = cssNumber(style['fontWeight'], '500');
    root.style.borderWidth = cssLength(style['borderWidth'], '0px');
    root.style.borderStyle = cssText(style['borderStyle'], 'solid');
    root.style.borderColor = cssText(style['borderColor'], 'transparent');
    root.style.borderRadius = cssLength(style['borderRadius'], '8px');
    root.style.opacity = cssNumber(style['opacity'], '1');
  }
}

if (
  typeof customElements !== 'undefined' &&
  customElements.get('nebula-screen-button-v1') === undefined
) {
  customElements.define('nebula-screen-button-v1', ButtonCustomElement);
}

const buttonModule: ComponentModule = {
  definition: {
    type: 'button',
    name: '按钮',
    category: 'text',
    icon: 'MousePointerClick',
    keywords: ['按钮', 'button', 'btn', '点击', '交互', '提交', '确认'],
    description: '按钮组件，支持文字、样式与点击事件',
    defaultProps: { text: '按钮' },
    defaultSize: { width: 120, height: 48 },
    defaultStyle: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      fontSize: 14,
      borderRadius: 8,
      borderWidth: 0,
      borderColor: '#1e40af',
    },
    order: 2,
    events: mergeEvents(),
    actions: mergeActions(),
  },
  renderer: ButtonComponent,
  customElementConstructor: ButtonCustomElement,
  schema: BUTTON_SCHEMA,
  icon: MousePointerClick,
};

export default buttonModule;
