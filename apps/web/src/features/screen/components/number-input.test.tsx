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
      const input = screen.getByRole('textbox');
      keyDown(input, 'ArrowUp');
      expect(onChange).toHaveBeenCalledWith(11);
    });

    it('ArrowDown 默认步进 -1', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      keyDown(input, 'ArrowDown');
      expect(onChange).toHaveBeenCalledWith(9);
    });

    it('Shift+ArrowUp 步进 10', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      keyDown(input, 'ArrowUp', true);
      expect(onChange).toHaveBeenCalledWith(20);
    });

    it('Shift+ArrowDown 步进 -10', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      keyDown(input, 'ArrowDown', true);
      expect(onChange).toHaveBeenCalledWith(0);
    });

    it('自定义 step 与 shiftStep', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} step={2} shiftStep={50} />);
      const input = screen.getByRole('textbox');
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
      const input = screen.getByRole('textbox');
      keyDown(input, 'ArrowUp');
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('ArrowDown 不低于 min', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} min={0} />);
      const input = screen.getByRole('textbox');
      keyDown(input, 'ArrowDown');
      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe('直接输入数值', () => {
    it('Enter 提交 draft 值', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      // 进入编辑态
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '42' } });
      keyDown(input, 'Enter');
      expect(onChange).toHaveBeenCalledWith(42);
    });

    it('Enter 提交后 blur 不重复触发 onChange（精确断言次数与参数）', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '42' } });
      keyDown(input, 'Enter');
      // Enter 内部已 commit，并主动 blur；blur 不应再次提交
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(42);
    });

    it('Enter 后显式 blur 也不再触发 onChange', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '42' } });
      keyDown(input, 'Enter');
      expect(onChange).toHaveBeenCalledTimes(1);
      // 显式触发 blur（模拟真实浏览器中 .blur() 同步派发的 blur 事件）
      fireEvent.blur(input);
      // 仍只有 1 次，blur 没有重复提交
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(42);
    });

    it('Enter 提交无效 draft 时 blur 也不触发 onChange', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'abc' } });
      keyDown(input, 'Enter');
      // Enter commit 解析失败不调用 onChange；blur 也不应再次尝试
      expect(onChange).not.toHaveBeenCalled();
    });

    it('Escape 后显式 blur 不触发 onChange（精确断言 0 次）', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '999' } });
      keyDown(input, 'Escape');
      // Escape 已放弃编辑，blur 不应提交
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledTimes(0);
    });

    it('连续两次 Enter 编辑各自只触发一次 onChange', () => {
      const onChange = vi.fn();
      const { rerender } = render(<NumberInput value={10} onChange={onChange} />);
      let input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '42' } });
      keyDown(input, 'Enter');
      // 第一次提交：1 次
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(42);

      // 模拟 store 回写新值
      rerender(<NumberInput value={42} onChange={onChange} />);
      input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '100' } });
      keyDown(input, 'Enter');
      // 第二次提交：累计 2 次
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(100);
    });

    it('Blur 提交 draft 值', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(99);
    });

    it('Esc 放弃编辑，不触发 onChange', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
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
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('空字符串不提交', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('浮点数正常解析', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '12.5' } });
      keyDown(input, 'Enter');
      expect(onChange).toHaveBeenCalledWith(12.5);
    });

    it('负数正常解析', () => {
      const onChange = vi.fn();
      render(<NumberInput value={0} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '-3' } });
      keyDown(input, 'Enter');
      expect(onChange).toHaveBeenCalledWith(-3);
    });

    it('值未变化时不重复触发 onChange', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);
      // draft 解析为 10，与原 value 相同 → 不应触发
      expect(onChange).not.toHaveBeenCalled();
    });

    it('直接输入时受 min/max 钳制', () => {
      const onChange = vi.fn();
      render(<NumberInput value={5} onChange={onChange} min={0} max={10} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(10);
    });
  });

  describe('显示与渲染', () => {
    it('未编辑时显示 value', () => {
      render(<NumberInput value={42} onChange={vi.fn()} />);
      const input = screen.getByRole<HTMLInputElement>('textbox');
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
      const input = screen.getByRole<HTMLInputElement>('textbox');
      expect(input.disabled).toBe(true);
    });
  });

  describe('编辑中的 ArrowUp/Down', () => {
    it('编辑态下 ArrowUp 基于 draft 解析值步进', () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '100' } });
      keyDown(input, 'ArrowUp');
      // 100 + 1 = 101
      expect(onChange).toHaveBeenCalledWith(101);
    });

    it('编辑态下 draft 无效时 ArrowUp 回退到 value', () => {
      const onChange = vi.fn();
      render(<NumberInput value={50} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'abc' } });
      keyDown(input, 'ArrowUp');
      // 解析失败 → 用 value 50 → +1 = 51
      expect(onChange).toHaveBeenCalledWith(51);
    });
  });

  describe('外部 value 变更同步', () => {
    it('未聚焦时外部 value 变化，显示新值', () => {
      const { rerender } = render(<NumberInput value={10} onChange={vi.fn()} />);
      const input = screen.getByRole<HTMLInputElement>('textbox');
      expect(input.value).toBe('10');
      // 外部 store 更新（如拖拽提交、协同推送）
      rerender(<NumberInput value={30} onChange={vi.fn()} />);
      expect(input.value).toBe('30');
    });

    it('编辑 draft 时外部 value 变化，按"外部值优先"显示新值', () => {
      const onChange = vi.fn();
      const { rerender } = render(<NumberInput value={10} onChange={onChange} />);
      const input = screen.getByRole<HTMLInputElement>('textbox');
      // 进入编辑态：focus 触发 setDraft(String(value))
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '15' } });
      expect(input.value).toBe('15');
      // 编辑过程中外部 store 被更新（如拖拽联动、协同推送）
      rerender(<NumberInput value={30} onChange={onChange} />);
      // 外部值优先：旧 draft 失效，显示新值
      expect(input.value).toBe('30');
    });

    it('切换 syncKey（选中对象/字段）后旧 draft 被清除', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <NumberInput value={10} onChange={onChange} syncKey="componentA.x" />,
      );
      const input = screen.getByRole<HTMLInputElement>('textbox');
      // 进入编辑态并输入 '15'
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '15' } });
      expect(input.value).toBe('15');
      // 切换到另一个对象（syncKey 变化），value 也随之变为新对象的 20
      rerender(<NumberInput value={20} onChange={onChange} syncKey="componentB.x" />);
      // 旧 draft 被清除，显示新值
      expect(input.value).toBe('20');
      // blur 时不应把旧 draft '15' 提交到 componentB
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('syncKey 不变时仅 value 变化也会丢弃 draft', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <NumberInput value={10} onChange={onChange} syncKey="componentA.x" />,
      );
      const input = screen.getByRole<HTMLInputElement>('textbox');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '15' } });
      expect(input.value).toBe('15');
      // 仅 value 变化（如拖拽联动），syncKey 不变
      rerender(<NumberInput value={30} onChange={onChange} syncKey="componentA.x" />);
      // 外部值优先：显示新值
      expect(input.value).toBe('30');
    });
  });
});
