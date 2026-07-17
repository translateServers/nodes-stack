import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { NumberInput } from './number-input';

/** 工具：模拟"在 input 上按组合键" */
function keyDown(input: HTMLElement, key: string, shiftKey = false) {
  fireEvent.keyDown(input, { key, shiftKey });
}

describe('NumberInput', () => {
  describe('ArrowUp / ArrowDown 微调', () => {
    it('ArrowUp 默认步进 1', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      keyDown(input, 'ArrowUp');
      expect(onChange).toHaveBeenCalledWith(11);
    });

    it('ArrowDown 默认步进 -1', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      keyDown(input, 'ArrowDown');
      expect(onChange).toHaveBeenCalledWith(9);
    });

    it('Shift+ArrowUp 步进 10', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      keyDown(input, 'ArrowUp', true);
      expect(onChange).toHaveBeenCalledWith(20);
    });

    it('Shift+ArrowDown 步进 -10', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      keyDown(input, 'ArrowDown', true);
      expect(onChange).toHaveBeenCalledWith(0);
    });

    it('自定义 step 与 shiftStep', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} step={2} shiftStep={50} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      keyDown(input, 'ArrowUp');
      expect(onChange).toHaveBeenCalledWith(2);
      keyDown(input, 'ArrowUp', true);
      expect(onChange).toHaveBeenLastCalledWith(50);
    });
  });

  describe('min / max 钳制', () => {
    it('ArrowUp 不超过 max', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} max={10} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      keyDown(input, 'ArrowUp');
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('ArrowDown 不低于 min', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} min={0} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      keyDown(input, 'ArrowDown');
      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe('直接输入数值', () => {
    it('Enter 提交 draft 值', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      // 进入编辑态
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '42' } });
      keyDown(input, 'Enter');
      expect(onChange).toHaveBeenCalledWith(42);
    });

    it('Blur 提交 draft 值', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(99);
    });

    it('Esc 放弃编辑，不触发 onChange', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '999' } });
      keyDown(input, 'Escape');
      // Esc 不应提交，但 blur 会触发 commit —— 由于 draft 已被 setDraft(null) 清空，commit 不会调用 onChange
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('无效输入（非数字）不提交', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('空字符串不提交', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('浮点数正常解析', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '12.5' } });
      keyDown(input, 'Enter');
      expect(onChange).toHaveBeenCalledWith(12.5);
    });

    it('负数正常解析', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '-3' } });
      keyDown(input, 'Enter');
      expect(onChange).toHaveBeenCalledWith(-3);
    });

    it('值未变化时不重复触发 onChange', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);
      // draft 解析为 10，与原 value 相同 → 不应触发
      expect(onChange).not.toHaveBeenCalled();
    });

    it('直接输入时受 min/max 钳制', () => {
      const onChange = vi.fn();
      render(<NumberInput value={5} onChange={onChange} min={0} max={10} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(10);
    });
  });

  describe('显示与渲染', () => {
    it('未编辑时显示 value', () => {
      render(<NumberInput value={42} onChange={vi.fn()} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('42');
    });

    it('有 label 时渲染 label', () => {
      render(<NumberInput value={0} onChange={vi.fn()} label="X" />);
      expect(screen.getByText('X')).toBeDefined();
    });

    it('有 unit 时渲染 unit', () => {
      render(<NumberInput value={0} onChange={vi.fn()} unit="px" />);
      expect(screen.getByText('px')).toBeDefined();
    });

    it('disabled 时 input 不可编辑', () => {
      render(<NumberInput value={0} onChange={vi.fn()} disabled />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  describe('编辑中的 ArrowUp/Down', () => {
    it('编辑态下 ArrowUp 基于 draft 解析值步进', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '100' } });
      keyDown(input, 'ArrowUp');
      // 100 + 1 = 101
      expect(onChange).toHaveBeenCalledWith(101);
    });

    it('编辑态下 draft 无效时 ArrowUp 回退到 value', () => {
      const onChange = vi.fn();
      render(<NumberInput value={50} onChange={onChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'abc' } });
      keyDown(input, 'ArrowUp');
      // 解析失败 → 用 value 50 → +1 = 51
      expect(onChange).toHaveBeenCalledWith(51);
    });
  });
});
