/**
 * ButtonComponent 测试
 *
 * 验证点：
 * - 渲染 props.text 文字内容
 * - 应用 backgroundColor / color / fontSize / borderRadius / borderWidth 等样式
 * - props.text 缺失时回退到默认"按钮"
 * - style 字段缺失时使用渲染层默认值
 * - 字重应用 fontWeight（默认 500）
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ComponentStyle } from '@nebula/shared';
import { ButtonComponent } from './button-component';

function renderButton(overrides: { props?: Record<string, unknown>; style?: ComponentStyle }) {
  return render(<ButtonComponent props={overrides.props ?? {}} style={overrides.style ?? {}} />);
}

describe('ButtonComponent - 基础渲染', () => {
  it('渲染 props.text 文字内容', () => {
    const { container, getByTitle } = renderButton({ props: { text: '提交' } });
    expect(container.textContent).toBe('提交');
    expect(getByTitle('提交')).toBeInTheDocument();
  });

  it('props.text 缺失时回退到默认"按钮"', () => {
    const { container } = renderButton({});
    expect(container.textContent).toBe('按钮');
  });

  it('props.text 为空字符串时渲染空内容（不回退）', () => {
    const { container } = renderButton({ props: { text: '' } });
    expect(container.textContent).toBe('');
  });
});

describe('ButtonComponent - 样式应用', () => {
  it('应用 backgroundColor / color / fontSize 样式', () => {
    const { container } = renderButton({
      props: { text: 'X' },
      style: {
        backgroundColor: '#ff0000',
        color: '#00ff00',
        fontSize: 18,
      },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(target.style.color).toBe('rgb(0, 255, 0)');
    expect(target.style.fontSize).toBe('18px');
  });

  it('应用 borderRadius / borderWidth / borderColor 样式', () => {
    const { container } = renderButton({
      props: { text: 'X' },
      style: {
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#000000',
      },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.borderRadius).toBe('12px');
    expect(target.style.borderWidth).toBe('2px');
    expect(target.style.borderColor).toBe('rgb(0, 0, 0)');
  });

  it('应用 opacity 样式', () => {
    const { container } = renderButton({
      props: { text: 'X' },
      style: { opacity: 0.5 },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.opacity).toBe('0.5');
  });

  it('应用 fontWeight 字重（字符串值）', () => {
    const { container } = renderButton({
      props: { text: 'X' },
      style: { fontWeight: 'bold' },
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.fontWeight).toBe('bold');
  });
});

describe('ButtonComponent - 默认值回退', () => {
  it('style 字段全缺失时使用渲染层默认值（蓝底白字 8px 圆角）', () => {
    const { container } = renderButton({ props: { text: 'X' } });
    const target = container.firstChild as HTMLElement;
    expect(target.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3b82f6
    expect(target.style.color).toBe('rgb(255, 255, 255)');
    expect(target.style.fontSize).toBe('14px');
    expect(target.style.fontWeight).toBe('500');
    expect(target.style.borderRadius).toBe('8px');
    expect(target.style.borderWidth).toBe('0px');
  });

  it('borderColor 缺失且 borderWidth 存在时回退到 transparent', () => {
    const { container } = renderButton({
      props: { text: 'X' },
      style: { borderWidth: 1 }, // 未指定 borderColor
    });
    const target = container.firstChild as HTMLElement;
    expect(target.style.borderColor).toBe('transparent');
  });
});

describe('ButtonComponent - 交互语义', () => {
  it('渲染 cursor: pointer 暗示可点击', () => {
    const { container } = renderButton({ props: { text: 'X' } });
    const target = container.firstChild as HTMLElement;
    expect(target.style.cursor).toBe('pointer');
  });

  it('渲染 userSelect: none 避免文字被选中', () => {
    const { container } = renderButton({ props: { text: 'X' } });
    const target = container.firstChild as HTMLElement;
    expect(target.style.userSelect).toBe('none');
  });

  it('文字超出容器时 truncate（不换行）', () => {
    const longText = '这是一个非常长的按钮文字内容应该被截断显示';
    const { container } = renderButton({ props: { text: longText } });
    const span = container.querySelector('span');
    expect(span?.className).toContain('truncate');
    expect(span?.getAttribute('title')).toBe(longText);
  });
});
