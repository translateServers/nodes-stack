/**
 * NodeConfigPanel 组件测试（任务 4.8 - M1 补遗）
 *
 * 验证点（对应 spec.md「节点参数配置」Requirement）：
 * - trigger.componentClick：渲染组件单选，选择后 config 更新
 * - trigger.pageLoad：无组件字段，显示提示
 * - action.setVisibility：组件单选 + show/hide/toggle
 * - action.navigate：URL 输入 + target，非法协议 URL 由 Schema 校验（此处测 UI 写回）
 * - action.scrollToComponent / refreshDataSource：组件单选
 * - comment：纯文本域
 * - condition：复用 ConditionBuilder
 * - dangling 引用保留原值不静默清空
 * - 各 config.type 表单渲染正确
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  BlueprintActionConfig,
  BlueprintTriggerConfig,
  CommentNodeConfig,
  ConditionNodeConfig,
  ScreenComponent,
} from '@nebula/shared';
import { NodeConfigPanel } from './node-config-panel';

function makeComponents(): ScreenComponent[] {
  return [
    { id: 'c1', name: '柱状图' } as ScreenComponent,
    { id: 'c2', name: '按钮' } as ScreenComponent,
  ];
}

describe('NodeConfigPanel', () => {
  describe('trigger.componentClick', () => {
    it('渲染组件下拉框', () => {
      const config: BlueprintTriggerConfig = { type: 'componentClick', componentId: '' };
      render(
        <NodeConfigPanel
          kind="trigger"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('config-component-id')).toBeInTheDocument();
      expect(screen.getByText('柱状图')).toBeInTheDocument();
      expect(screen.getByText('按钮')).toBeInTheDocument();
    });

    it('选择组件后触发 onChange 并带新 componentId', () => {
      const config: BlueprintTriggerConfig = { type: 'componentClick', componentId: '' };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="trigger"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-component-id'), { target: { value: 'c1' } });
      expect(onChange).toHaveBeenCalledWith({ type: 'componentClick', componentId: 'c1' });
    });

    it('dangling 引用保留原值并显示悬空标记', () => {
      const config: BlueprintTriggerConfig = {
        type: 'componentClick',
        componentId: 'deleted-comp',
      };
      render(
        <NodeConfigPanel
          kind="trigger"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      // 悬空标记显示
      expect(screen.getByText('目标组件（悬空引用）')).toBeInTheDocument();
      // select 值保留为原 id
      const select = screen.getByTestId<HTMLSelectElement>('config-component-id');
      expect(select.value).toBe('deleted-comp');
    });
  });

  describe('trigger.pageLoad', () => {
    it('无组件字段，显示提示文案', () => {
      const config: BlueprintTriggerConfig = { type: 'pageLoad' };
      render(
        <NodeConfigPanel
          kind="trigger"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('config-component-id')).not.toBeInTheDocument();
      expect(screen.getByText('该触发器类型无需配置组件。')).toBeInTheDocument();
    });
  });

  describe('action.setVisibility', () => {
    it('渲染组件下拉与显隐模式选择', () => {
      const config: BlueprintActionConfig = {
        type: 'setVisibility',
        targetComponentId: '',
        visible: 'show',
      };
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('config-target-component-id')).toBeInTheDocument();
      expect(screen.getByTestId('config-visible')).toBeInTheDocument();
    });

    it('选择组件后触发 onChange', () => {
      const config: BlueprintActionConfig = {
        type: 'setVisibility',
        targetComponentId: '',
        visible: 'show',
      };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-target-component-id'), {
        target: { value: 'c2' },
      });
      expect(onChange).toHaveBeenCalledWith({
        type: 'setVisibility',
        targetComponentId: 'c2',
        visible: 'show',
      });
    });

    it('切换显隐模式触发 onChange', () => {
      const config: BlueprintActionConfig = {
        type: 'setVisibility',
        targetComponentId: 'c1',
        visible: 'show',
      };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-visible'), { target: { value: 'hide' } });
      expect(onChange).toHaveBeenCalledWith({
        type: 'setVisibility',
        targetComponentId: 'c1',
        visible: 'hide',
      });
    });

    it('dangling 引用保留原值', () => {
      const config: BlueprintActionConfig = {
        type: 'setVisibility',
        targetComponentId: 'gone-comp',
        visible: 'show',
      };
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText('目标组件（悬空引用）')).toBeInTheDocument();
      const select = screen.getByTestId<HTMLSelectElement>('config-target-component-id');
      expect(select.value).toBe('gone-comp');
    });
  });

  describe('action.navigate', () => {
    it('渲染 URL 输入与 target 选择', () => {
      const config: BlueprintActionConfig = {
        type: 'navigate',
        url: 'https://example.com',
        target: '_blank',
      };
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('config-url')).toBeInTheDocument();
      expect(screen.getByTestId('config-target')).toBeInTheDocument();
      const urlInput = screen.getByTestId<HTMLInputElement>('config-url');
      expect(urlInput.value).toBe('https://example.com');
    });

    it('输入 URL 后触发 onChange', () => {
      const config: BlueprintActionConfig = {
        type: 'navigate',
        url: '',
        target: '_blank',
      };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-url'), {
        target: { value: 'https://test.com' },
      });
      expect(onChange).toHaveBeenCalledWith({
        type: 'navigate',
        url: 'https://test.com',
        target: '_blank',
      });
    });

    it('切换 target 触发 onChange', () => {
      const config: BlueprintActionConfig = {
        type: 'navigate',
        url: 'https://example.com',
        target: '_blank',
      };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-target'), { target: { value: '_self' } });
      expect(onChange).toHaveBeenCalledWith({
        type: 'navigate',
        url: 'https://example.com',
        target: '_self',
      });
    });
  });

  describe('action.scrollToComponent', () => {
    it('渲染组件下拉', () => {
      const config: BlueprintActionConfig = {
        type: 'scrollToComponent',
        targetComponentId: '',
      };
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('config-target-component-id')).toBeInTheDocument();
    });

    it('选择组件后触发 onChange', () => {
      const config: BlueprintActionConfig = {
        type: 'scrollToComponent',
        targetComponentId: '',
      };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-target-component-id'), {
        target: { value: 'c1' },
      });
      expect(onChange).toHaveBeenCalledWith({
        type: 'scrollToComponent',
        targetComponentId: 'c1',
      });
    });
  });

  describe('action.refreshDataSource', () => {
    it('渲染组件下拉', () => {
      const config: BlueprintActionConfig = {
        type: 'refreshDataSource',
        targetComponentId: '',
      };
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('config-target-component-id')).toBeInTheDocument();
    });

    it('选择组件后触发 onChange', () => {
      const config: BlueprintActionConfig = {
        type: 'refreshDataSource',
        targetComponentId: '',
      };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="action"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-target-component-id'), {
        target: { value: 'c2' },
      });
      expect(onChange).toHaveBeenCalledWith({
        type: 'refreshDataSource',
        targetComponentId: 'c2',
      });
    });
  });

  describe('comment', () => {
    it('渲染文本域', () => {
      const config: CommentNodeConfig = { text: '这是一条注释' };
      render(
        <NodeConfigPanel
          kind="comment"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      const textarea = screen.getByTestId<HTMLTextAreaElement>('config-comment-text');
      expect(textarea.value).toBe('这是一条注释');
    });

    it('输入文本后触发 onChange', () => {
      const config: CommentNodeConfig = { text: '' };
      const onChange = vi.fn();
      render(
        <NodeConfigPanel
          kind="comment"
          config={config}
          components={makeComponents()}
          onChange={onChange}
        />,
      );
      fireEvent.change(screen.getByTestId('config-comment-text'), {
        target: { value: '新注释内容' },
      });
      expect(onChange).toHaveBeenCalledWith({ text: '新注释内容' });
    });
  });

  describe('condition', () => {
    it('渲染 ConditionBuilder', () => {
      const config: ConditionNodeConfig = {
        type: 'condition',
        expression: {
          source: { kind: 'componentProp', componentId: 'c1', key: 'value' },
          operator: 'eq',
          value: '1',
        },
      };
      render(
        <NodeConfigPanel
          kind="condition"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId('condition-builder')).toBeInTheDocument();
    });
  });

  describe('面板属性', () => {
    it('根节点携带 data-testid 和 data-node-kind', () => {
      const config: CommentNodeConfig = { text: '' };
      render(
        <NodeConfigPanel
          kind="comment"
          config={config}
          components={makeComponents()}
          onChange={vi.fn()}
        />,
      );
      const panel = screen.getByTestId('node-config-panel');
      expect(panel.getAttribute('data-node-kind')).toBe('comment');
    });
  });
});
