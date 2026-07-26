/**
 * QuickEventEditor 组件测试（任务 4.9）
 *
 * 验证点（对应 tasks.md 4.9 验证要求）：
 * 1. 无 blueprint 时显示空状态
 * 2. 有 blueprint 但无相关规则时显示空状态
 * 3. 显示「触发器（本组件作为源）」列表
 * 4. 显示「动作（本组件作为目标）」列表
 * 5. 点击「+ 添加触发器」选择模板后调用 updateBlueprint
 * 6. 点击删除按钮调用 updateBlueprint 删除节点
 * 7. 点击「打开事件蓝图」按钮调用 openBlueprintSheet
 *
 * 测试策略：
 * - mock editor-store：用 vi.fn() 替换 actions，用受控对象控制 project.blueprint
 * - 不依赖真实 zustand store，避免副作用与跨用例污染
 * - 用 data-testid 定位元素，与生产代码契约一致
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock editor-store：QuickEventEditor 依赖 zustand store，测试用 vi.fn() 替换以便控制返回值
vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: vi.fn(),
}));

import { useScreenEditorStore } from '../stores/editor-store';
import { QuickEventEditor } from './quick-event-editor';
import type { EventBlueprint, ScreenProject } from '@nebula/shared';

/** 测试用 store 状态结构（仅包含 QuickEventEditor 读取的字段） */
interface StoreState {
  project: Pick<ScreenProject, 'blueprint'> | null;
  updateBlueprint: ReturnType<typeof vi.fn>;
  openBlueprintSheet: ReturnType<typeof vi.fn>;
}

/** 创建最小可用蓝图 */
function makeBlueprint(
  nodes: EventBlueprint['nodes'],
  edges: EventBlueprint['edges'] = [],
): EventBlueprint {
  return { version: 1, nodes, edges };
}

/** 将 mock useScreenEditorStore 转为可操控的 Mock 函数 */
const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn>;

/** 当前测试用 store 状态（mock 闭包读取此变量） */
let currentState: StoreState;

/** 设置 store 状态并让 mock 返回对应字段的值 */
function setStoreState(state: StoreState): void {
  currentState = state;
  mockUseStore.mockImplementation((selector: (s: StoreState) => unknown) => selector(currentState));
}

describe('QuickEventEditor', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
  });

  describe('空状态', () => {
    it('无 blueprint 时显示「事件蓝图未初始化」空状态', () => {
      setStoreState({
        project: null,
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      expect(screen.getByTestId('quick-events-empty')).toBeDefined();
      expect(screen.getByText('事件蓝图未初始化')).toBeDefined();
    });

    it('有 blueprint 但无相关规则时显示「当前组件暂无事件规则」空状态', () => {
      const blueprint = makeBlueprint([
        {
          id: 't-other',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'other-comp' },
        },
      ]);

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      expect(screen.getByTestId('quick-events-empty')).toBeDefined();
      expect(screen.getByText('当前组件暂无事件规则')).toBeDefined();
    });

    it('空蓝图（nodes 为空）时显示空状态', () => {
      const blueprint = makeBlueprint([], []);

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      expect(screen.getByTestId('quick-events-empty')).toBeDefined();
    });
  });

  describe('触发器（本组件作为源）列表', () => {
    it('显示本组件作为触发源的规则', () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'comp-a' },
          },
          {
            id: 'a1',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
          },
        ],
        [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
      );

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      // 触发器分区可见
      expect(screen.getByTestId('quick-events-triggers-section')).toBeDefined();
      // 列表中至少有一条触发器项
      const items = screen.getAllByTestId('quick-events-trigger-item');
      expect(items).toHaveLength(1);
      // 显示触发器类型名称
      expect(screen.getByText('点击组件')).toBeDefined();
      // 显示下游动作摘要
      expect(screen.getByText(/跳转/)).toBeDefined();
    });

    it('未配置动作时显示「未配置动作」提示', () => {
      const blueprint = makeBlueprint([
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-a' },
        },
      ]);

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      expect(screen.getByText(/未配置动作/)).toBeDefined();
    });

    it('触发器分区为空时显示「本组件未作为触发源」', () => {
      const blueprint = makeBlueprint([
        {
          id: 'a1',
          kind: 'action',
          position: { x: 0, y: 0 },
          config: { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'show' },
        },
      ]);

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      // 触发器分区显示空态（但整体不显示 quick-events-empty，因为动作分区有内容）
      expect(screen.queryByTestId('quick-events-empty')).toBeNull();
      expect(screen.getByText('本组件未作为触发源')).toBeDefined();
    });
  });

  describe('动作（本组件作为目标）列表', () => {
    it('显示本组件作为动作目标的规则', () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'other-comp' },
          },
          {
            id: 'a1',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'show' },
          },
        ],
        [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
      );

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      // 动作分区可见
      expect(screen.getByTestId('quick-events-actions-section')).toBeDefined();
      const items = screen.getAllByTestId('quick-events-action-item');
      expect(items).toHaveLength(1);
      // 显示动作摘要
      expect(screen.getByText('显示组件')).toBeDefined();
      // 显示上游 trigger 来源
      expect(screen.getByText(/点击组件/)).toBeDefined();
    });

    it('未连接上游 trigger 时显示「未连接触发器」', () => {
      const blueprint = makeBlueprint([
        {
          id: 'a1',
          kind: 'action',
          position: { x: 0, y: 0 },
          config: { type: 'refreshDataSource', targetComponentId: 'comp-a' },
        },
      ]);

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      expect(screen.getByText(/未连接触发器/)).toBeDefined();
    });
  });

  describe('添加触发器模板', () => {
    it('选择「跳转 URL」模板后调用 updateBlueprint 新增 trigger + action + edge', async () => {
      const updateBlueprint = vi.fn();
      setStoreState({
        project: { blueprint: makeBlueprint([]) },
        updateBlueprint,
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      // 点击「+ 添加触发器」按钮展开下拉菜单（Radix DropdownMenu 需 userEvent 触发 pointer 事件）
      const user = userEvent.setup();
      await user.click(screen.getByTestId('quick-events-add-trigger'));

      // 等待下拉菜单渲染
      const navigateItem = await screen.findByTestId('quick-events-template-navigate');
      await user.click(navigateItem);

      expect(updateBlueprint).toHaveBeenCalledTimes(1);
      const arg = updateBlueprint.mock.calls[0]?.[0] as EventBlueprint;
      expect(arg.nodes).toHaveLength(2);
      expect(arg.edges).toHaveLength(1);
      // trigger 节点 config.componentId = 当前 componentId
      const trigger = arg.nodes.find((n) => n.kind === 'trigger');
      expect(trigger).toBeDefined();
      expect(trigger?.config).toEqual({ type: 'componentClick', componentId: 'comp-a' });
      // action 节点为 navigate 类型
      const action = arg.nodes.find((n) => n.kind === 'action');
      expect(action).toBeDefined();
      expect(action?.config.type).toBe('navigate');
      // edge 连接 trigger.out → action.in
      const edge = arg.edges[0];
      expect(edge?.source).toBe(trigger?.id);
      expect(edge?.target).toBe(action?.id);
      expect(edge?.sourceHandle).toBe('out');
      expect(edge?.targetHandle).toBe('in');
    });

    it('选择「显示/隐藏目标组件」模板后新增 setVisibility action', async () => {
      const updateBlueprint = vi.fn();
      setStoreState({
        project: { blueprint: makeBlueprint([]) },
        updateBlueprint,
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      const user = userEvent.setup();
      await user.click(screen.getByTestId('quick-events-add-trigger'));
      const item = await screen.findByTestId('quick-events-template-set-visibility');
      await user.click(item);

      const arg = updateBlueprint.mock.calls[0]?.[0] as EventBlueprint;
      const action = arg.nodes.find((n) => n.kind === 'action');
      expect(action?.config.type).toBe('setVisibility');
    });

    it('选择「刷新目标组件数据」模板后新增 refreshDataSource action', async () => {
      const updateBlueprint = vi.fn();
      setStoreState({
        project: { blueprint: makeBlueprint([]) },
        updateBlueprint,
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      const user = userEvent.setup();
      await user.click(screen.getByTestId('quick-events-add-trigger'));
      const item = await screen.findByTestId('quick-events-template-refresh-data-source');
      await user.click(item);

      const arg = updateBlueprint.mock.calls[0]?.[0] as EventBlueprint;
      const action = arg.nodes.find((n) => n.kind === 'action');
      expect(action?.config.type).toBe('refreshDataSource');
    });

    it('已有 blueprint 时模板追加到现有节点列表（不覆盖）', async () => {
      const updateBlueprint = vi.fn();
      const existingBlueprint = makeBlueprint([
        {
          id: 'existing-trigger',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'pageLoad' },
        },
      ]);

      setStoreState({
        project: { blueprint: existingBlueprint },
        updateBlueprint,
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      const user = userEvent.setup();
      await user.click(screen.getByTestId('quick-events-add-trigger'));
      const item = await screen.findByTestId('quick-events-template-navigate');
      await user.click(item);

      const arg = updateBlueprint.mock.calls[0]?.[0] as EventBlueprint;
      // 原 pageLoad 节点保留 + 新增 2 个节点
      expect(arg.nodes).toHaveLength(3);
      expect(arg.nodes.some((n) => n.id === 'existing-trigger')).toBe(true);
    });
  });

  describe('删除规则', () => {
    it('点击删除按钮后弹出确认弹窗，确认后调用 updateBlueprint 删除 trigger 及下游节点', () => {
      const updateBlueprint = vi.fn();
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'comp-a' },
          },
          {
            id: 'a1',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'navigate', url: 'https://example.com', target: '_blank' },
          },
          // 无关节点：不应被删除
          {
            id: 't-other',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'other-comp' },
          },
        ],
        [{ id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' }],
      );

      setStoreState({
        project: { blueprint },
        updateBlueprint,
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      // 点击删除按钮
      fireEvent.click(screen.getByTestId('quick-events-delete-trigger'));

      // 确认弹窗显示
      expect(screen.getByText('删除事件规则？')).toBeDefined();

      // 点击确认
      fireEvent.click(screen.getByTestId('quick-events-delete-confirm'));

      expect(updateBlueprint).toHaveBeenCalledTimes(1);
      const arg = updateBlueprint.mock.calls[0]?.[0] as EventBlueprint;
      // t1 和 a1 被删除（trigger 及其下游），t-other 保留
      expect(arg.nodes.map((n) => n.id)).toEqual(['t-other']);
      // 关联的边被删除
      expect(arg.edges).toHaveLength(0);
    });

    it('删除动作节点时仅移除该节点（不影响其他节点）', () => {
      const updateBlueprint = vi.fn();
      const blueprint = makeBlueprint(
        [
          {
            id: 't1',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'other-comp' },
          },
          {
            id: 'a1',
            kind: 'action',
            position: { x: 100, y: 0 },
            config: { type: 'setVisibility', targetComponentId: 'comp-a', visible: 'show' },
          },
          {
            id: 'a2',
            kind: 'action',
            position: { x: 200, y: 0 },
            config: { type: 'scrollToComponent', targetComponentId: 'comp-a' },
          },
        ],
        [
          { id: 'e1', source: 't1', sourceHandle: 'out', target: 'a1', targetHandle: 'in' },
          { id: 'e2', source: 't1', sourceHandle: 'out', target: 'a2', targetHandle: 'in' },
        ],
      );

      setStoreState({
        project: { blueprint },
        updateBlueprint,
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      // 动作分区有 2 个删除按钮，点击第一个（a1）
      const deleteButtons = screen.getAllByTestId('quick-events-delete-action');
      expect(deleteButtons).toHaveLength(2);
      fireEvent.click(deleteButtons[0]);

      // 确认
      fireEvent.click(screen.getByTestId('quick-events-delete-action-confirm'));

      expect(updateBlueprint).toHaveBeenCalledTimes(1);
      const arg = updateBlueprint.mock.calls[0]?.[0] as EventBlueprint;
      // a1 被删除，t1 和 a2 保留
      expect(arg.nodes.map((n) => n.id)).toEqual(['t1', 'a2']);
      // e1 被删除（连接 a1），e2 保留
      expect(arg.edges.map((e) => e.id)).toEqual(['e2']);
    });

    it('取消删除时不调用 updateBlueprint', () => {
      const updateBlueprint = vi.fn();
      const blueprint = makeBlueprint([
        {
          id: 't1',
          kind: 'trigger',
          position: { x: 0, y: 0 },
          config: { type: 'componentClick', componentId: 'comp-a' },
        },
      ]);

      setStoreState({
        project: { blueprint },
        updateBlueprint,
        openBlueprintSheet: vi.fn(),
      });

      render(<QuickEventEditor componentId="comp-a" />);

      fireEvent.click(screen.getByTestId('quick-events-delete-trigger'));
      fireEvent.click(screen.getByTestId('quick-events-delete-cancel'));

      expect(updateBlueprint).not.toHaveBeenCalled();
    });
  });

  describe('打开事件蓝图', () => {
    it('点击「打开事件蓝图」按钮调用 openBlueprintSheet 并携带 focusComponentId', () => {
      const openBlueprintSheet = vi.fn();
      setStoreState({
        project: { blueprint: makeBlueprint([]) },
        updateBlueprint: vi.fn(),
        openBlueprintSheet,
      });

      render(<QuickEventEditor componentId="comp-a" />);

      fireEvent.click(screen.getByTestId('quick-events-open-blueprint'));

      expect(openBlueprintSheet).toHaveBeenCalledTimes(1);
      expect(openBlueprintSheet).toHaveBeenCalledWith({ focusComponentId: 'comp-a' });
    });

    it('无 blueprint 时点击「打开事件蓝图」仍然调用 openBlueprintSheet', () => {
      const openBlueprintSheet = vi.fn();
      setStoreState({
        project: null,
        updateBlueprint: vi.fn(),
        openBlueprintSheet,
      });

      render(<QuickEventEditor componentId="comp-a" />);

      fireEvent.click(screen.getByTestId('quick-events-open-blueprint'));

      expect(openBlueprintSheet).toHaveBeenCalledWith({ focusComponentId: 'comp-a' });
    });
  });

  describe('组件切换时重新派生规则', () => {
    it('componentId 变化后重新派生触发器列表', async () => {
      const blueprint = makeBlueprint(
        [
          {
            id: 't-a',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'comp-a' },
          },
          {
            id: 't-b',
            kind: 'trigger',
            position: { x: 0, y: 0 },
            config: { type: 'componentClick', componentId: 'comp-b' },
          },
        ],
        [],
      );

      setStoreState({
        project: { blueprint },
        updateBlueprint: vi.fn(),
        openBlueprintSheet: vi.fn(),
      });

      const { rerender } = render(<QuickEventEditor componentId="comp-a" />);

      // 初始：comp-a 有 1 条触发器
      expect(screen.getAllByTestId('quick-events-trigger-item')).toHaveLength(1);

      // 切换到 comp-b
      rerender(<QuickEventEditor componentId="comp-b" />);

      // 切换后：comp-b 有 1 条触发器（不同的 trigger 节点）
      await waitFor(() => {
        expect(screen.getAllByTestId('quick-events-trigger-item')).toHaveLength(1);
      });
    });
  });
});
