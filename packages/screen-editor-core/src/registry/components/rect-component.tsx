/**
 * 矩形组件（任务 6.2）
 *
 * 渲染一个可配置背景色、边框、圆角的矩形装饰组件。
 * 与 ellipse 共用同一套样式属性，差异仅在形状（rect 不强制 borderRadius:50%）。
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
import type { ComponentStyle } from '@nebula/shared';
import type { ScreenComponentElementModelV1 } from '@nebula/screen-component-sdk';
import { Square } from 'lucide-react';
import { mergeActions, mergeEvents } from '../component-events-actions';
import type { ComponentModule } from '../types';

interface RectComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function RectComponent({ style }: RectComponentProps) {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: style.backgroundColor ?? 'transparent',
        borderWidth: style.borderWidth ?? 0,
        borderStyle: style.borderStyle ?? 'solid',
        borderColor: style.borderColor ?? '#000000',
        borderRadius: style.borderRadius ?? 0,
        opacity: style.opacity ?? 1,
      }}
    />
  );
}

function cssLength(value: unknown, fallback = '0px'): string {
  if (typeof value === 'number') return `${value}px`;
  return typeof value === 'string' ? value : fallback;
}

function cssText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function cssOpacity(value: unknown): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '1';
}

export class RectCustomElement extends HTMLElement {
  #root: HTMLDivElement | null = null;

  #ensureRoot(): HTMLDivElement {
    if (this.#root !== null) return this.#root;
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    const root = document.createElement('div');
    root.style.width = '100%';
    root.style.height = '100%';
    this.append(root);
    this.#root = root;
    return root;
  }

  set model(model: ScreenComponentElementModelV1) {
    const root = this.#ensureRoot();
    const style = model.style;
    root.style.backgroundColor = cssText(style['backgroundColor'], 'transparent');
    root.style.borderWidth = cssLength(style['borderWidth']);
    root.style.borderStyle = cssText(style['borderStyle'], 'solid');
    root.style.borderColor = cssText(style['borderColor'], '#000000');
    root.style.borderRadius = cssLength(style['borderRadius']);
    root.style.opacity = cssOpacity(style['opacity']);
  }
}

if (
  typeof customElements !== 'undefined' &&
  customElements.get('nebula-screen-rect-v1') === undefined
) {
  customElements.define('nebula-screen-rect-v1', RectCustomElement);
}

const rectModule: ComponentModule = {
  definition: {
    type: 'rect',
    name: '矩形',
    category: 'decoration',
    icon: 'Square',
    keywords: ['矩形', '方形', 'rect', 'rectangle', '框', '色块'],
    description: '矩形装饰元素，支持背景色 / 边框 / 圆角',
    defaultProps: {},
    defaultSize: { width: 200, height: 120 },
    defaultStyle: {
      backgroundColor: '#3b82f6',
      borderWidth: 0,
      borderColor: '#1e40af',
      borderRadius: 0,
    },
    order: 1,
    events: mergeEvents(),
    actions: mergeActions(),
  },
  renderer: RectComponent,
  customElementConstructor: RectCustomElement,
  icon: Square,
};

export default rectModule;
