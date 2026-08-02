/**
 * 椭圆组件（任务 6.2）
 *
 * 渲染一个可配置背景色、边框的椭圆装饰组件。
 * 通过 borderRadius: 50% 将容器变为圆形/椭圆，宽高不等时呈椭圆。
 *
 * 该组件为 canvas 渲染组件（非编辑器 shell），不使用 shadcn/ui，
 * 避免与用户可配置样式冲突。
 */
import type { ComponentStyle } from '@nebula/shared';
import type { ScreenComponentElementModelV1 } from '@nebula/screen-component-sdk';
import { Circle } from 'lucide-react';
import { mergeActions, mergeEvents } from '../component-events-actions';
import type { ComponentModule } from '../types';

interface EllipseComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function EllipseComponent({ style }: EllipseComponentProps) {
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: style.backgroundColor ?? 'transparent',
        borderWidth: style.borderWidth ?? 0,
        borderStyle: style.borderStyle ?? 'solid',
        borderColor: style.borderColor ?? '#000000',
        // 椭圆：始终 50% 圆角，忽略用户配置的 borderRadius
        borderRadius: '50%',
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

export class EllipseCustomElement extends HTMLElement {
  #root: HTMLDivElement | null = null;

  #ensureRoot(): HTMLDivElement {
    if (this.#root !== null) return this.#root;
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    const root = document.createElement('div');
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.borderRadius = '50%';
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
    root.style.borderRadius = '50%';
    root.style.opacity = cssOpacity(style['opacity']);
  }
}

if (
  typeof customElements !== 'undefined' &&
  customElements.get('nebula-screen-ellipse-v1') === undefined
) {
  customElements.define('nebula-screen-ellipse-v1', EllipseCustomElement);
}

const ellipseModule: ComponentModule = {
  definition: {
    type: 'ellipse',
    name: '椭圆',
    category: 'decoration',
    icon: 'Circle',
    keywords: ['椭圆', '圆形', '圆', 'ellipse', 'circle', '球'],
    description: '椭圆装饰元素，常用于头像/标记位',
    defaultProps: {},
    defaultSize: { width: 200, height: 200 },
    defaultStyle: {
      backgroundColor: '#10b981',
      borderWidth: 0,
      borderColor: '#047857',
    },
    order: 2,
    events: mergeEvents(),
    actions: mergeActions(),
  },
  renderer: EllipseComponent,
  customElementConstructor: EllipseCustomElement,
  icon: Circle,
};

export default ellipseModule;
