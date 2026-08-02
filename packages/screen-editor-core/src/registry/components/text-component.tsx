import type { ComponentStyle } from '@nebula/shared';
import type { ScreenComponentElementModelV1 } from '@nebula/screen-component-sdk';
import { Type } from 'lucide-react';
import { mergeActions, mergeEvents } from '../component-events-actions';
import type { ComponentModule } from '../types';
import { TEXT_SCHEMA } from '../../property-schema/schemas';

interface TextComponentProps {
  props: Record<string, unknown>;
  style: ComponentStyle;
}

export function TextComponent({ props, style }: TextComponentProps) {
  const content = (props.content as string) ?? '';

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        fontSize: style.fontSize,
        color: style.color,
        textAlign: style.textAlign ?? 'center',
        // Phase 2 Slice D：文本增强字段（字重 / 行高），由 Schema 声明式字段写入 style
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        // Task 7：文本细化配置（Light Chaser 特色：字间距 + 文字描边）
        letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
        WebkitTextStroke: style.textStrokeWidth
          ? `${style.textStrokeWidth}px ${style.textStrokeColor ?? '#000000'}`
          : undefined,
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </div>
  );
}

function cssLength(value: unknown): string {
  if (typeof value === 'number') return `${value}px`;
  return typeof value === 'string' ? value : '';
}

function cssText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function cssNumber(value: unknown): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

export class TextCustomElement extends HTMLElement {
  #root: HTMLDivElement | null = null;

  #ensureRoot(): HTMLDivElement {
    if (this.#root !== null) return this.#root;
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
    root.style.wordBreak = 'break-word';
    this.append(root);
    this.#root = root;
    return root;
  }

  set model(model: ScreenComponentElementModelV1) {
    const root = this.#ensureRoot();
    const style = model.style;
    const content = model.props['content'];
    root.textContent = typeof content === 'string' ? content : '';
    root.style.fontSize = cssLength(style['fontSize']);
    root.style.color = cssText(style['color']);
    root.style.textAlign = cssText(style['textAlign'], 'center');
    root.style.fontWeight = cssNumber(style['fontWeight']);
    root.style.lineHeight = cssNumber(style['lineHeight']);
    root.style.letterSpacing = cssLength(style['letterSpacing']);
    const strokeWidth = style['textStrokeWidth'];
    root.style.webkitTextStroke =
      typeof strokeWidth === 'number' && strokeWidth > 0
        ? `${strokeWidth}px ${cssText(style['textStrokeColor'], '#000000')}`
        : '';
  }
}

if (
  typeof customElements !== 'undefined' &&
  customElements.get('nebula-screen-text-v1') === undefined
) {
  customElements.define('nebula-screen-text-v1', TextCustomElement);
}

const textModule: ComponentModule = {
  definition: {
    type: 'text',
    name: '文本',
    category: 'text',
    icon: 'Type',
    keywords: ['文本', '文字', 'text', 'title', '标题', '段落'],
    description: '可编辑的文本段落，支持字号、字色、对齐等样式',
    defaultProps: { content: '请输入文本' },
    defaultSize: { width: 200, height: 60 },
    defaultStyle: { color: '#ffffff', fontSize: 14 },
    order: 1,
    events: mergeEvents(),
    actions: mergeActions(),
  },
  renderer: TextComponent,
  customElementConstructor: TextCustomElement,
  schema: TEXT_SCHEMA,
  icon: Type,
};

export default textModule;
