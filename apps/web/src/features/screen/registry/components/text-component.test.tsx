/**
 * TextComponent 测试（Task 7）
 *
 * 验证点：
 * - 基础渲染：content / fontSize / color 等遗留字段不受影响
 * - Task 7：letterSpacing 应用为 `Npx`
 * - Task 7：textStrokeWidth + textStrokeColor 应用为 `-webkit-text-stroke: Npx COLOR`
 * - Task 7：textStrokeWidth 存在但 textStrokeColor 缺失时回退到 #000000
 * - Task 7：letterSpacing / textStrokeWidth 缺失时不应用相关 CSS
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ComponentStyle } from '@nebula/shared';
import { TextComponent } from './text-component';

function renderText(overrides: { props?: Record<string, unknown>; style?: ComponentStyle }) {
  return render(<TextComponent props={overrides.props ?? {}} style={overrides.style ?? {}} />);
}

describe('TextComponent - 基础渲染（回归）', () => {
  it('渲染 props.content 文本内容', () => {
    const { container } = renderText({ props: { content: 'Hello' } });
    expect(container.textContent).toBe('Hello');
  });

  it('props.content 缺失时渲染空字符串', () => {
    const { container } = renderText({});
    expect(container.textContent).toBe('');
  });

  it('应用 fontSize / color / textAlign 样式', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { fontSize: 18, color: '#ff0000', textAlign: 'left' },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.fontSize).toBe('18px');
    expect(target.style.color).toBe('rgb(255, 0, 0)');
    expect(target.style.textAlign).toBe('left');
  });
});

describe('TextComponent - Task 7 字间距（letterSpacing）', () => {
  it('letterSpacing = 2 时应用 letter-spacing: 2px', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { letterSpacing: 2 },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.letterSpacing).toBe('2px');
  });

  it('letterSpacing 支持小数（0.5px）', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { letterSpacing: 0.5 },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.letterSpacing).toBe('0.5px');
  });

  it('letterSpacing = 0 时不应用 letter-spacing CSS（falsy 短路）', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { letterSpacing: 0 },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.letterSpacing).toBe('');
  });

  it('letterSpacing 缺失时不应用 letter-spacing CSS', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: {},
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.letterSpacing).toBe('');
  });
});

describe('TextComponent - Task 7 文字描边（WebkitTextStroke）', () => {
  it('textStrokeWidth = 1 + textStrokeColor = #000000 应用 -webkit-text-stroke: 1px #000000', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { textStrokeWidth: 1, textStrokeColor: '#000000' },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.webkitTextStroke).toBe('1px #000000');
  });

  it('textStrokeWidth 存在但 textStrokeColor 缺失时回退到 #000000', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { textStrokeWidth: 1 },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.webkitTextStroke).toBe('1px #000000');
  });

  it('textStrokeWidth 支持小数（0.5px）', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { textStrokeWidth: 0.5, textStrokeColor: '#ff0000' },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.webkitTextStroke).toBe('0.5px #ff0000');
  });

  it('textStrokeWidth = 0 时不应用 -webkit-text-stroke CSS（falsy 短路）', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { textStrokeWidth: 0, textStrokeColor: '#000000' },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.webkitTextStroke).toBe('');
  });

  it('textStrokeWidth 缺失时即使 textStrokeColor 存在也不应用 -webkit-text-stroke', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { textStrokeColor: '#000000' },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.webkitTextStroke).toBe('');
  });
});

describe('TextComponent - Task 7 字间距 + 描边组合', () => {
  it('同时配置 letterSpacing + textStrokeWidth + textStrokeColor 时全部应用', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: { letterSpacing: 2, textStrokeWidth: 1, textStrokeColor: '#ff0000' },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.letterSpacing).toBe('2px');
    expect(target.style.webkitTextStroke).toBe('1px #ff0000');
  });

  it('组合配置不影响 fontSize / color 等遗留字段渲染', () => {
    const { container } = renderText({
      props: { content: 'X' },
      style: {
        fontSize: 24,
        color: '#00ff00',
        letterSpacing: 1.5,
        textStrokeWidth: 2,
        textStrokeColor: '#000000',
      },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.fontSize).toBe('24px');
    expect(target.style.color).toBe('rgb(0, 255, 0)');
    expect(target.style.letterSpacing).toBe('1.5px');
    expect(target.style.webkitTextStroke).toBe('2px #000000');
  });
});
