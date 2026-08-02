/**
 * 搜索节点面板测试（任务 4.4）
 *
 * 验证点（对应 tasks.md 4.4 验证要求）：
 * - 组件测试覆盖搜索过滤
 * - 键盘交互（ArrowDown/Up 选择、Enter 插入、Esc 关闭）
 * - 自动连线（mode=connect 时通过 onInsert 回调传出）
 * - Esc 关闭
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NODE_OPTIONS, SearchPanel, filterOptions } from './search-panel';
import type { NodeOption, PendingConnection } from './search-panel';

afterEach(() => {
  vi.clearAllMocks();
});

// ===== filterOptions 纯函数 =====

describe('filterOptions', () => {
  it('空 query 返回全部选项', () => {
    expect(filterOptions(NODE_OPTIONS, '')).toHaveLength(NODE_OPTIONS.length);
  });

  it('空白 query 返回全部选项', () => {
    expect(filterOptions(NODE_OPTIONS, '   ')).toHaveLength(NODE_OPTIONS.length);
  });

  it('按 label 过滤（"触发"）', () => {
    const result = filterOptions(NODE_OPTIONS, '触发');
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toContain('trigger.componentClick');
    expect(result.map((o) => o.id)).toContain('trigger.pageLoad');
  });

  it('按 description 过滤（"可见"）', () => {
    const result = filterOptions(NODE_OPTIONS, '可见');
    expect(result.map((o) => o.id)).toContain('action.setVisibility');
  });

  it('多 token 必须全部命中', () => {
    // "触发 点击" - componentClick 命中（label+description 都含）
    const result = filterOptions(NODE_OPTIONS, '触发 点击');
    expect(result.map((o) => o.id)).toContain('trigger.componentClick');
    // pageLoad 命中"触发"但不含"点击"
    expect(result.map((o) => o.id)).not.toContain('trigger.pageLoad');
  });

  it('大小写不敏感', () => {
    const result = filterOptions(NODE_OPTIONS, 'URL');
    expect(result.map((o) => o.id)).toContain('action.navigate');
  });

  it('无匹配返回空数组', () => {
    expect(filterOptions(NODE_OPTIONS, '不存在的节点类型')).toEqual([]);
  });
});

// ===== SearchPanel 渲染 =====

describe('SearchPanel 渲染', () => {
  it('create 模式渲染面板与输入框', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('search-panel')).toBeInTheDocument();
    expect(screen.getByTestId('search-panel-input')).toBeInTheDocument();
    expect(screen.getByTestId('search-panel').getAttribute('data-mode')).toBe('create');
  });

  it('connect 模式带 pendingConnection 时显示从源节点连接提示', () => {
    const pending: PendingConnection = {
      sourceNodeId: 't1',
      sourceHandle: 'out',
    };
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="connect"
        pendingConnection={pending}
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('search-panel').getAttribute('data-mode')).toBe('connect');
    expect(screen.getByText('从源节点连接到新节点')).toBeInTheDocument();
  });

  it('渲染全部节点选项', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('search-panel-item');
    expect(items).toHaveLength(NODE_OPTIONS.length);
  });

  it('mount 时自动聚焦输入框', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByTestId('search-panel-input');
    expect(document.activeElement).toBe(input);
  });
});

// ===== 搜索过滤（组件层）=====

describe('SearchPanel 搜索过滤', () => {
  it('输入过滤后列表更新', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByTestId('search-panel-input');
    fireEvent.change(input, { target: { value: '触发' } });

    const items = screen.getAllByTestId('search-panel-item');
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute('data-option-id')).toBe('trigger.componentClick');
  });

  it('无匹配时显示空态', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByTestId('search-panel-input');
    fireEvent.change(input, { target: { value: '不存在的节点类型' } });

    expect(screen.getByText('无匹配项')).toBeInTheDocument();
    expect(screen.queryAllByTestId('search-panel-item')).toHaveLength(0);
  });
});

// ===== 键盘交互 =====

describe('SearchPanel 键盘交互', () => {
  function fireKey(target: Element, key: string): void {
    fireEvent.keyDown(target, { key });
  }

  it('ArrowDown 移动高亮到下一项', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('search-panel');
    const items = screen.getAllByTestId('search-panel-item');
    expect(items[0]?.getAttribute('data-active')).toBe('true');

    fireKey(panel, 'ArrowDown');

    const updatedItems = screen.getAllByTestId('search-panel-item');
    expect(updatedItems[0]?.getAttribute('data-active')).toBe('false');
    expect(updatedItems[1]?.getAttribute('data-active')).toBe('true');
  });

  it('ArrowUp 在第一项时循环到最后一项', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('search-panel');
    const items = screen.getAllByTestId('search-panel-item');
    expect(items[0]?.getAttribute('data-active')).toBe('true');

    fireKey(panel, 'ArrowUp');

    const updatedItems = screen.getAllByTestId('search-panel-item');
    const lastItem = updatedItems[updatedItems.length - 1];
    expect(lastItem?.getAttribute('data-active')).toBe('true');
  });

  it('ArrowDown 在最后一项时循环到第一项', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('search-panel');
    // 先 ArrowUp 到最后一项
    fireKey(panel, 'ArrowUp');
    // 再 ArrowDown 应回到第一项
    fireKey(panel, 'ArrowDown');

    const updatedItems = screen.getAllByTestId('search-panel-item');
    expect(updatedItems[0]?.getAttribute('data-active')).toBe('true');
    expect(updatedItems[1]?.getAttribute('data-active')).toBe('false');
  });

  it('Enter 调用 onInsert 传入当前高亮项', () => {
    const onInsert = vi.fn<(option: NodeOption) => void>();
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={onInsert}
        onClose={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('search-panel');
    fireKey(panel, 'Enter');

    expect(onInsert).toHaveBeenCalledTimes(1);
    const arg: NodeOption = onInsert.mock.calls[0][0];
    expect(arg.id).toBe('trigger.componentClick');
  });

  it('ArrowDown + Enter 选择第二项并插入', () => {
    const onInsert = vi.fn<(option: NodeOption) => void>();
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={onInsert}
        onClose={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('search-panel');
    fireKey(panel, 'ArrowDown');
    fireKey(panel, 'Enter');

    expect(onInsert).toHaveBeenCalledTimes(1);
    const arg: NodeOption = onInsert.mock.calls[0][0];
    expect(arg.id).toBe('trigger.pageLoad');
  });

  it('过滤后 ArrowDown 不越界（仅 2 项时循环）', () => {
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByTestId('search-panel-input');
    fireEvent.change(input, { target: { value: '触发' } });
    // 此时 filtered 2 项，activeIndex=0

    const panel = screen.getByTestId('search-panel');
    fireKey(panel, 'ArrowDown');
    fireKey(panel, 'ArrowDown');
    // 第二次 ArrowDown 应回到第一项
    const items = screen.getAllByTestId('search-panel-item');
    expect(items[0]?.getAttribute('data-active')).toBe('true');
    expect(items[1]?.getAttribute('data-active')).toBe('false');
  });

  it('过滤后空列表 Enter 不调用 onInsert', () => {
    const onInsert = vi.fn<(option: NodeOption) => void>();
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={onInsert}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByTestId('search-panel-input');
    fireEvent.change(input, { target: { value: '不存在' } });

    const panel = screen.getByTestId('search-panel');
    fireKey(panel, 'Enter');

    expect(onInsert).not.toHaveBeenCalled();
  });

  it('Escape 调用 onClose 关闭面板', () => {
    const onClose = vi.fn();
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={onClose}
      />,
    );

    const panel = screen.getByTestId('search-panel');
    fireKey(panel, 'Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="create"
        onInsert={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId('search-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ===== 自动连线（connect 模式）=====

describe('SearchPanel 自动连线（connect 模式）', () => {
  it('connect 模式选择节点后通过 onInsert 回调传出（由调用方完成连线）', () => {
    const onInsert = vi.fn<(option: NodeOption) => void>();
    const pending: PendingConnection = {
      sourceNodeId: 't1',
      sourceHandle: 'out',
    };
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="connect"
        pendingConnection={pending}
        onInsert={onInsert}
        onClose={vi.fn()}
      />,
    );

    const items = screen.getAllByTestId('search-panel-item');
    fireEvent.click(items[2]); // action.setVisibility

    expect(onInsert).toHaveBeenCalledTimes(1);
    const arg: NodeOption = onInsert.mock.calls[0][0];
    expect(arg.id).toBe('action.setVisibility');
    // pendingConnection 由调用方持有，不通过 onInsert 传出
  });

  it('connect 模式不显示 pendingConnection 详情给用户（仅显示通用提示）', () => {
    const pending: PendingConnection = {
      sourceNodeId: 't1',
      sourceHandle: 'out',
    };
    render(
      <SearchPanel
        position={{ x: 100, y: 100 }}
        mode="connect"
        pendingConnection={pending}
        onInsert={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // 不应显示具体 sourceNodeId（避免暴露内部 ID）
    const panel = screen.getByTestId('search-panel');
    expect(panel.textContent).not.toContain('t1');
  });
});
