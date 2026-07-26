/**
 * V2NodeConfigPanel 组件测试（任务 5.6）
 *
 * 验证点（对应 spec.md 任务 5.6 配置面板适配 Requirement）：
 * - component（普通组件节点）：组件选择下拉 + dangling 态保留原值
 * - global + pageLoad：无字段，显示提示
 * - global + navigate：URL 输入 + target
 * - global + requestApi：method + URL（高级字段提示）
 * - global + scrollTo：目标组件选择
 * - delay：delayMs 数字输入
 * - comment：纯文本域
 * - condition：复用 ConditionBuilder（仅验证渲染）
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import type {
  CommentNodeConfig,
  ConditionNodeConfig,
  GlobalNavigateConfig,
  GlobalRequestApiConfig,
  GlobalScrollToConfig,
  ScreenComponent,
} from '@nebula/shared';
import { V2NodeConfigPanel } from './node-config-panel-v2';

function makeComponents(): ScreenComponent[] {
  return [
    { id: 'c1', name: '柱状图' } as ScreenComponent,
    { id: 'c2', name: '按钮' } as ScreenComponent,
  ];
}

function makeNode(overrides: Partial<Node> & { data?: Record<string, unknown> } = {}): Node {
  return {
    id: 'n1',
    type: 'component',
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  };
}

describe('V2NodeConfigPanel（任务 5.6）', () => {
  describe('component（普通组件节点）', () => {
    it('渲染组件下拉框（含项目组件选项）', () => {
      const node = makeNode({ data: { componentId: '' } });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      expect(screen.getByTestId('v2-config-component-id')).toBeInTheDocument();
      expect(screen.getByText('柱状图')).toBeInTheDocument();
      expect(screen.getByText('按钮')).toBeInTheDocument();
    });

    it('选择组件后触发 onChange 并带新 componentId', () => {
      const node = makeNode({ data: { componentId: '' } });
      const onChange = vi.fn();
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('v2-config-component-id'), { target: { value: 'c1' } });
      expect(onChange).toHaveBeenCalledWith({ kind: 'component-id', componentId: 'c1' });
    });

    it('dangling 引用保留原值并显示悬空标记', () => {
      const node = makeNode({ data: { componentId: 'deleted-comp' } });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      expect(screen.getByText('目标组件（悬空引用）')).toBeInTheDocument();
      const select = screen.getByTestId<HTMLSelectElement>('v2-config-component-id');
      expect(select.value).toBe('deleted-comp');
    });
  });

  describe('global + pageLoad', () => {
    it('无字段，显示提示文案', () => {
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'pageLoad' },
      });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      expect(screen.queryByTestId('v2-config-component-id')).not.toBeInTheDocument();
      expect(screen.getByText('页面加载触发器无需配置。')).toBeInTheDocument();
    });
  });

  describe('global + navigate', () => {
    it('渲染 URL 输入与 target 选择', () => {
      const config: GlobalNavigateConfig = { globalType: 'navigate', url: '', target: '_blank' };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'navigate', config },
      });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      expect(screen.getByTestId('v2-config-navigate-url')).toBeInTheDocument();
      expect(screen.getByTestId('v2-config-navigate-target')).toBeInTheDocument();
    });

    it('修改 URL 触发 onChange 带 global-config', () => {
      const config: GlobalNavigateConfig = { globalType: 'navigate', url: '', target: '_blank' };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'navigate', config },
      });
      const onChange = vi.fn();
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('v2-config-navigate-url'), {
        target: { value: 'https://example.com' },
      });
      expect(onChange).toHaveBeenCalledWith({
        kind: 'global-config',
        config: { globalType: 'navigate', url: 'https://example.com', target: '_blank' },
      });
    });

    it('修改 target 触发 onChange 带 global-config', () => {
      const config: GlobalNavigateConfig = { globalType: 'navigate', url: '', target: '_blank' };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'navigate', config },
      });
      const onChange = vi.fn();
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('v2-config-navigate-target'), {
        target: { value: '_self' },
      });
      expect(onChange).toHaveBeenCalledWith({
        kind: 'global-config',
        config: { globalType: 'navigate', url: '', target: '_self' },
      });
    });
  });

  describe('global + requestApi', () => {
    it('渲染 method 与 URL 输入', () => {
      const config: GlobalRequestApiConfig = {
        globalType: 'requestApi',
        method: 'GET',
        url: '',
        headers: {},
        body: '',
        secretHeaderKeys: [],
        timeoutMs: 10_000,
      };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'requestApi', config },
      });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      expect(screen.getByTestId('v2-config-request-api-method')).toBeInTheDocument();
      expect(screen.getByTestId('v2-config-request-api-url')).toBeInTheDocument();
      // 高级字段提示文案
      expect(screen.getByText(/高级字段/)).toBeInTheDocument();
    });

    it('修改 method 触发 onChange 带 global-config', () => {
      const config: GlobalRequestApiConfig = {
        globalType: 'requestApi',
        method: 'GET',
        url: '',
        headers: {},
        body: '',
        secretHeaderKeys: [],
        timeoutMs: 10_000,
      };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'requestApi', config },
      });
      const onChange = vi.fn();
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('v2-config-request-api-method'), {
        target: { value: 'POST' },
      });
      expect(onChange).toHaveBeenCalledWith({
        kind: 'global-config',
        config: { ...config, method: 'POST' },
      });
    });
  });

  describe('global + scrollTo', () => {
    it('渲染目标组件下拉', () => {
      const config: GlobalScrollToConfig = {
        globalType: 'scrollTo',
        targetComponentId: '',
      };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'scrollTo', config },
      });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      expect(screen.getByTestId('v2-config-scroll-to-target')).toBeInTheDocument();
      expect(screen.getByText('柱状图')).toBeInTheDocument();
    });

    it('选择目标组件触发 onChange 带 global-config', () => {
      const config: GlobalScrollToConfig = {
        globalType: 'scrollTo',
        targetComponentId: '',
      };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'scrollTo', config },
      });
      const onChange = vi.fn();
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('v2-config-scroll-to-target'), {
        target: { value: 'c2' },
      });
      expect(onChange).toHaveBeenCalledWith({
        kind: 'global-config',
        config: { globalType: 'scrollTo', targetComponentId: 'c2' },
      });
    });
  });

  describe('delay 节点', () => {
    it('渲染 delayMs 数字输入', () => {
      const node = makeNode({
        type: 'delay',
        data: { config: { delayMs: 500 } },
      });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      const input = screen.getByTestId('v2-config-delay-ms');
      expect(input).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('500');
    });

    it('修改 delayMs 触发 onChange 带 delay-config', () => {
      const node = makeNode({
        type: 'delay',
        data: { config: { delayMs: 500 } },
      });
      const onChange = vi.fn();
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('v2-config-delay-ms'), {
        target: { value: '1000' },
      });
      expect(onChange).toHaveBeenCalledWith({
        kind: 'delay-config',
        config: { delayMs: 1000 },
      });
    });

    it('config 为 undefined 时回退默认 500ms', () => {
      const node = makeNode({ type: 'delay', data: {} });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      const input = screen.getByTestId('v2-config-delay-ms');
      expect((input as HTMLInputElement).value).toBe('500');
    });
  });

  describe('comment 节点', () => {
    it('渲染注释文本域', () => {
      const config: CommentNodeConfig = { text: 'hello' };
      const node = makeNode({ type: 'comment', data: { config } });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      const textarea = screen.getByTestId('v2-config-comment-text');
      expect(textarea).toBeInTheDocument();
      expect((textarea as HTMLTextAreaElement).value).toBe('hello');
    });

    it('修改文本触发 onChange 带 comment-config', () => {
      const config: CommentNodeConfig = { text: '' };
      const node = makeNode({ type: 'comment', data: { config } });
      const onChange = vi.fn();
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('v2-config-comment-text'), {
        target: { value: 'new comment' },
      });
      expect(onChange).toHaveBeenCalledWith({
        kind: 'comment-config',
        config: { text: 'new comment' },
      });
    });
  });

  describe('condition 节点', () => {
    it('渲染 ConditionBuilder（包含运算符选择）', () => {
      const config: ConditionNodeConfig = {
        type: 'condition',
        expression: {
          source: { kind: 'componentProp', componentId: '', key: '' },
          operator: 'eq',
          value: '',
        },
      };
      const node = makeNode({ type: 'condition', data: { config } });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      // ConditionBuilder 内部运算符 select（具体 testid 由 condition-builder 自身约定）
      // 这里仅验证面板能渲染 condition 类型节点而不抛错
      expect(screen.getByTestId('v2-node-config-panel')).toBeInTheDocument();
      expect(screen.getByTestId('v2-node-config-panel')).toHaveAttribute(
        'data-node-kind',
        'condition',
      );
    });
  });

  describe('容器与无配置节点', () => {
    it('容器带 data-testid 与 data-node-kind 属性', () => {
      const node = makeNode({ type: 'component', data: { componentId: '' } });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      const panel = screen.getByTestId('v2-node-config-panel');
      expect(panel).toHaveAttribute('data-node-kind', 'component');
    });

    it('全局节点带 data-node-global-type 属性', () => {
      const config: GlobalNavigateConfig = { globalType: 'navigate', url: '', target: '_blank' };
      const node = makeNode({
        type: 'global',
        data: { componentId: 'global', globalType: 'navigate', config },
      });
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      const panel = screen.getByTestId('v2-node-config-panel');
      expect(panel).toHaveAttribute('data-node-global-type', 'navigate');
    });

    it('node.type 缺省时回退为 component', () => {
      const node: Node = {
        id: 'n1',
        position: { x: 0, y: 0 },
        data: { componentId: '' },
        // type 字段缺省
      };
      render(<V2NodeConfigPanel node={node} components={makeComponents()} onChange={vi.fn()} />);

      const panel = screen.getByTestId('v2-node-config-panel');
      expect(panel).toHaveAttribute('data-node-kind', 'component');
    });
  });
});
