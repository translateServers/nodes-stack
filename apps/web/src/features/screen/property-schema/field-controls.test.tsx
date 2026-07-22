import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { FIELD_CONTROLS } from './field-controls';
import type { FieldControlProps } from './types';

/**
 * 字段控件注册表测试（Phase 2 Slice B）
 *
 * 验证 FIELD_CONTROLS 中每个控件：
 * - 渲染 label 文本
 * - 接收 value 并显示
 * - onChange 在用户交互时触发
 */
describe('property-schema · field-controls 注册表', () => {
  describe('注册表完整性', () => {
    it('包含 number/color/text/textarea/select/switch 六个控件', () => {
      expect(FIELD_CONTROLS.number).toBeDefined();
      expect(FIELD_CONTROLS.color).toBeDefined();
      expect(FIELD_CONTROLS.text).toBeDefined();
      expect(FIELD_CONTROLS.textarea).toBeDefined();
      expect(FIELD_CONTROLS.select).toBeDefined();
      expect(FIELD_CONTROLS.switch).toBeDefined();
    });
  });

  describe('NumberField', () => {
    it('渲染 label 并显示 value', () => {
      const onChange = vi.fn();
      const NumberField = FIELD_CONTROLS.number!;
      render(
        <NumberField
          value={42}
          onChange={onChange as (v: unknown) => void}
          label="X"
          syncKey="comp-a:position.x"
        />,
      );
      expect(screen.getByText('X')).toBeDefined();
      const input = screen.getByDisplayValue('42');
      expect(input).toBeDefined();
    });

    it('blur 提交 draft 值', () => {
      const onChange = vi.fn();
      const NumberField = FIELD_CONTROLS.number!;
      render(
        <NumberField
          value={10}
          onChange={onChange as (v: unknown) => void}
          label="宽"
          syncKey="comp-a:position.width"
        />,
      );
      const input = screen.getByDisplayValue('10') as HTMLInputElement;
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(99);
    });
  });

  describe('ColorField', () => {
    it('渲染 label 和取色器', () => {
      const onChange = vi.fn();
      const ColorField = FIELD_CONTROLS.color!;
      const { container } = render(
        <ColorField value="#ff0000" onChange={onChange as (v: unknown) => void} label="背景" />,
      );
      expect(screen.getByText('背景')).toBeDefined();
      const colorInput = container.querySelector('input[type="color"]');
      expect(colorInput).toBeDefined();
      expect((colorInput as HTMLInputElement).value).toBe('#ff0000');
    });

    it('改变颜色触发 onChange', () => {
      const onChange = vi.fn();
      const ColorField = FIELD_CONTROLS.color!;
      const { container } = render(
        <ColorField value="#000000" onChange={onChange as (v: unknown) => void} label="背景" />,
      );
      const colorInput = container.querySelector('input[type="color"]')!;
      fireEvent.change(colorInput, { target: { value: '#ffffff' } });
      expect(onChange).toHaveBeenCalledWith('#ffffff');
    });
  });

  describe('TextField', () => {
    it('渲染 label 和文本输入', () => {
      const onChange = vi.fn();
      const TextField = FIELD_CONTROLS.text!;
      render(<TextField value="标题" onChange={onChange as (v: unknown) => void} label="名称" />);
      expect(screen.getByText('名称')).toBeDefined();
      expect(screen.getByDisplayValue('标题')).toBeDefined();
    });

    it('输入触发 onChange', () => {
      const onChange = vi.fn();
      const TextField = FIELD_CONTROLS.text!;
      render(<TextField value="" onChange={onChange as (v: unknown) => void} label="名称" />);
      const input = screen.getByDisplayValue('') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '新标题' } });
      expect(onChange).toHaveBeenCalledWith('新标题');
    });
  });

  describe('TextAreaField', () => {
    it('渲染 label 和 textarea', () => {
      const onChange = vi.fn();
      const TextAreaField = FIELD_CONTROLS.textarea!;
      render(
        <TextAreaField value="正文内容" onChange={onChange as (v: unknown) => void} label="内容" />,
      );
      expect(screen.getByText('内容')).toBeDefined();
      expect(screen.getByDisplayValue('正文内容')).toBeDefined();
    });

    it('textarea 标签为多行', () => {
      const onChange = vi.fn();
      const TextAreaField = FIELD_CONTROLS.textarea!;
      const { container } = render(
        <TextAreaField value="" onChange={onChange as (v: unknown) => void} label="内容" />,
      );
      const textarea = container.querySelector('textarea');
      expect(textarea).toBeDefined();
      expect(textarea?.getAttribute('rows')).toBe('3');
    });
  });

  describe('SelectField', () => {
    it('渲染 label 和下拉选项', () => {
      const onChange = vi.fn();
      const SelectField = FIELD_CONTROLS.select!;
      render(
        <SelectField
          value="fit"
          onChange={onChange as (v: unknown) => void}
          label="缩放"
          controlProps={{
            options: [
              { value: 'fit', label: '等比缩放' },
              { value: 'full', label: '拉伸铺满' },
            ],
          }}
        />,
      );
      expect(screen.getByText('缩放')).toBeDefined();
    });
  });

  describe('SwitchField', () => {
    it('渲染 label 和开关', () => {
      const onChange = vi.fn();
      const SwitchField = FIELD_CONTROLS.switch!;
      render(
        <SwitchField value={false} onChange={onChange as (v: unknown) => void} label="悬停提示" />,
      );
      expect(screen.getByText('悬停提示')).toBeDefined();
    });

    it('点击触发 onChange（false → true）', () => {
      const onChange = vi.fn();
      const SwitchField = FIELD_CONTROLS.switch!;
      const { container } = render(
        <SwitchField value={false} onChange={onChange as (v: unknown) => void} label="开关" />,
      );
      const button = container.querySelector('button');
      expect(button).toBeDefined();
      fireEvent.click(button!);
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('通用契约', () => {
    it('所有控件接受 FieldControlProps 并渲染', () => {
      const props: FieldControlProps = {
        value: undefined,
        onChange: vi.fn(),
        label: '测试',
      };
      for (const [name, Control] of Object.entries(FIELD_CONTROLS)) {
        const { unmount } = render(<Control {...props} value={name === 'switch' ? false : ''} />);
        unmount();
      }
    });
  });
});
