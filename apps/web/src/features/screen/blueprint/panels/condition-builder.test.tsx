/**
 * ConditionBuilder 组件测试（任务 10.2）
 *
 * 验证点：
 * - 初始渲染显示当前表达式字段
 * - 切换字段来源类型重置 key/path
 * - 选择组件 ID 触发 onChange
 * - 输入属性键/数据路径触发 onChange
 * - 切换运算符触发 onChange；切到 empty/notEmpty 隐藏 value 输入
 * - 输入比较值自动推断类型（string/number/boolean）
 * - empty/notEmpty 不显示 value 输入
 * - needsValue 纯函数返回正确
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ConditionNodeConfig, ScreenComponent } from '@nebula/shared';
import { ConditionBuilder, needsValue } from './condition-builder';

function makeConfig(overrides: Partial<ConditionNodeConfig> = {}): ConditionNodeConfig {
  return {
    type: 'condition',
    expression: {
      source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
      operator: 'eq',
      value: '1',
    },
    ...overrides,
  };
}

function makeComponents(): ScreenComponent[] {
  return [
    { id: 'c1', name: '组件1' } as ScreenComponent,
    { id: 'c2', name: '组件2' } as ScreenComponent,
  ];
}

describe('ConditionBuilder', () => {
  describe('needsValue 纯函数', () => {
    it('empty / notEmpty 返回 false', () => {
      expect(needsValue('empty')).toBe(false);
      expect(needsValue('notEmpty')).toBe(false);
    });

    it('eq/ne/gt/gte/lt/lte/contains 返回 true', () => {
      for (const op of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'] as const) {
        expect(needsValue(op)).toBe(true);
      }
    });
  });

  describe('初始渲染', () => {
    it('显示当前字段来源类型（componentProp）', () => {
      render(
        <ConditionBuilder config={makeConfig()} onChange={vi.fn()} components={makeComponents()} />,
      );
      const builder = screen.getByTestId('condition-builder');
      expect(builder.getAttribute('data-condition-source-kind')).toBe('componentProp');
      expect(builder.getAttribute('data-condition-operator')).toBe('eq');
    });

    it('componentProp 来源显示属性键输入框', () => {
      render(
        <ConditionBuilder config={makeConfig()} onChange={vi.fn()} components={makeComponents()} />,
      );
      expect(screen.getByTestId('condition-source-key')).toBeInTheDocument();
      expect(screen.queryByTestId('condition-source-path')).not.toBeInTheDocument();
    });

    it('componentData 来源显示数据路径输入框', () => {
      const config = makeConfig({
        expression: {
          source: { kind: 'componentData', componentId: 'c1', path: 'list.0.value' },
          operator: 'gt',
          value: 100,
        },
      });
      render(<ConditionBuilder config={config} onChange={vi.fn()} components={makeComponents()} />);
      expect(screen.getByTestId('condition-source-path')).toBeInTheDocument();
      expect(screen.queryByTestId('condition-source-key')).not.toBeInTheDocument();
    });

    it('渲染组件选项列表', () => {
      render(
        <ConditionBuilder config={makeConfig()} onChange={vi.fn()} components={makeComponents()} />,
      );
      const select = screen.getByTestId('condition-component-id') as HTMLSelectElement;
      expect(select.options.length).toBe(3); // 1 占位 + 2 组件
      expect(select.options[1]!.value).toBe('c1');
      expect(select.options[2]!.value).toBe('c2');
    });

    it('渲染所有 9 个运算符选项', () => {
      render(
        <ConditionBuilder config={makeConfig()} onChange={vi.fn()} components={makeComponents()} />,
      );
      const select = screen.getByTestId('condition-operator') as HTMLSelectElement;
      expect(select.options.length).toBe(9);
    });

    it('eq 运算符显示 value 输入框', () => {
      render(
        <ConditionBuilder config={makeConfig()} onChange={vi.fn()} components={makeComponents()} />,
      );
      expect(screen.getByTestId('condition-value')).toBeInTheDocument();
    });

    it('empty 运算符不显示 value 输入框', () => {
      const config = makeConfig({
        expression: {
          source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
          operator: 'empty',
        },
      });
      render(<ConditionBuilder config={config} onChange={vi.fn()} components={makeComponents()} />);
      expect(screen.queryByTestId('condition-value')).not.toBeInTheDocument();
    });

    it('notEmpty 运算符不显示 value 输入框', () => {
      const config = makeConfig({
        expression: {
          source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
          operator: 'notEmpty',
        },
      });
      render(<ConditionBuilder config={config} onChange={vi.fn()} components={makeComponents()} />);
      expect(screen.queryByTestId('condition-value')).not.toBeInTheDocument();
    });

    it('boolean value 显示为 true/false 字符串', () => {
      const config = makeConfig({
        expression: {
          source: { kind: 'componentProp', componentId: 'c1', key: 'visible' },
          operator: 'eq',
          value: true,
        },
      });
      render(<ConditionBuilder config={config} onChange={vi.fn()} components={makeComponents()} />);
      const input = screen.getByTestId('condition-value') as HTMLInputElement;
      expect(input.value).toBe('true');
    });

    it('number value 显示为数字字符串', () => {
      const config = makeConfig({
        expression: {
          source: { kind: 'componentProp', componentId: 'c1', key: 'count' },
          operator: 'gt',
          value: 100,
        },
      });
      render(<ConditionBuilder config={config} onChange={vi.fn()} components={makeComponents()} />);
      const input = screen.getByTestId('condition-value') as HTMLInputElement;
      expect(input.value).toBe('100');
    });
  });

  describe('交互触发 onChange', () => {
    it('切换字段来源类型触发 onChange 重置 key/path', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-source-kind'), {
        target: { value: 'componentData' },
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.source.kind).toBe('componentData');
      expect(next.expression.source.componentId).toBe('');
      expect(next.expression.source.path).toBe('');
    });

    it('选择组件 ID 触发 onChange', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-component-id'), { target: { value: 'c2' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.source.componentId).toBe('c2');
    });

    it('输入属性键触发 onChange', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-source-key'), {
        target: { value: 'props.label' },
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.source.key).toBe('props.label');
    });

    it('输入数据路径触发 onChange', () => {
      const onChange = vi.fn();
      const config = makeConfig({
        expression: {
          source: { kind: 'componentData', componentId: 'c1', path: '' },
          operator: 'gt',
          value: 0,
        },
      });
      render(
        <ConditionBuilder config={config} onChange={onChange} components={makeComponents()} />,
      );
      fireEvent.change(screen.getByTestId('condition-source-path'), {
        target: { value: 'list.0.value' },
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.source.path).toBe('list.0.value');
    });

    it('切换运算符触发 onChange', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-operator'), { target: { value: 'ne' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.operator).toBe('ne');
    });

    it('切换到 empty 移除 value', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-operator'), { target: { value: 'empty' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.operator).toBe('empty');
      expect(next.expression.value).toBeUndefined();
    });

    it('从 empty 切回 eq 时补充默认 value', () => {
      const onChange = vi.fn();
      const config = makeConfig({
        expression: {
          source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
          operator: 'empty',
        },
      });
      render(
        <ConditionBuilder config={config} onChange={onChange} components={makeComponents()} />,
      );
      fireEvent.change(screen.getByTestId('condition-operator'), { target: { value: 'eq' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.operator).toBe('eq');
      expect(next.expression.value).toBe('');
    });

    it('输入纯数字比较值 → value 推断为 number', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-value'), { target: { value: '42' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.value).toBe(42);
      expect(typeof next.expression.value).toBe('number');
    });

    it('输入小数比较值 → value 推断为 number', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-value'), { target: { value: '3.14' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.value).toBe(3.14);
    });

    it('输入 true 比较 → value 推断为 boolean', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-value'), { target: { value: 'true' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.value).toBe(true);
      expect(typeof next.expression.value).toBe('boolean');
    });

    it('输入 false 比较 → value 推断为 boolean', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-value'), { target: { value: 'false' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.value).toBe(false);
    });

    it('输入普通字符串 → value 保持 string', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-value'), { target: { value: 'hello' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.value).toBe('hello');
      expect(typeof next.expression.value).toBe('string');
    });

    it('空字符串 value 推断为 string', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-value'), { target: { value: '' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.value).toBe('');
    });

    it('负数 value 推断为 number', () => {
      const onChange = vi.fn();
      render(
        <ConditionBuilder
          config={makeConfig()}
          onChange={onChange}
          components={makeComponents()}
        />,
      );
      fireEvent.change(screen.getByTestId('condition-value'), { target: { value: '-10' } });
      const next = onChange.mock.calls[0]![0];
      expect(next.expression.value).toBe(-10);
    });
  });
});
