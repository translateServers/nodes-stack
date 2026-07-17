import { describe, expect, it, vi } from 'vitest';

import type { ScreenComponent, ScreenProject } from '@nebula/shared';

import { withHistory } from './editor-store';
import type { ScreenEditorState } from './editor-store';

/**
 * 创建一个最小的 ScreenEditorState 用于测试（actions 字段用 noop 占位，测试中不会被调用）。
 */
function makeMockState(overrides: Partial<ScreenEditorState> = {}): ScreenEditorState {
  return {
    project: null,
    selectedComponentIds: [],
    canvasScale: 1,
    canvasOffset: { x: 0, y: 0 },
    showBorderGuides: false,
    guides: { vertical: [], horizontal: [], visible: true, locked: false },
    history: { past: [], future: [] },
    clipboard: null,
    pasteCount: 0,
    snapEnabled: true,
    nativeEventEnabled: false,
    activeGroupId: null,
    ...overrides,
  } as unknown as ScreenEditorState;
}

/** 创建一个最小可用的 ScreenComponent mock */
function makeMockComponent(id: string): ScreenComponent {
  return {
    id,
    type: 'rect',
    name: `comp-${id}`,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
  } as unknown as ScreenComponent;
}

describe('withHistory', () => {
  it('调用顺序：先调用 set(fn) 推入历史，再调用 set(updater, false, actionName) 应用更新', () => {
    const setMock = vi.fn();
    const updater = (): Partial<ScreenEditorState> => ({});

    withHistory(setMock as never, 'addComponent', updater);

    expect(setMock).toHaveBeenCalledTimes(2);

    // 第一次：pushHistory 内部调用 set(fn) — 仅传函数，无 replace / actionName
    const firstCall = setMock.mock.calls[0];
    expect(typeof firstCall[0]).toBe('function');
    expect(firstCall[1]).toBeUndefined();
    expect(firstCall[2]).toBeUndefined();

    // 第二次：set(updater, false, actionName)
    const secondCall = setMock.mock.calls[1];
    expect(secondCall[0]).toBe(updater);
    expect(secondCall[1]).toBe(false);
    expect(secondCall[2]).toBe('addComponent');
  });

  it('actionName 透传：传入的 actionName 出现在第二次 set 调用中', () => {
    const setMock = vi.fn();
    const updater = (): Partial<ScreenEditorState> => ({});

    withHistory(setMock as never, 'updateComponent', updater);

    expect(setMock.mock.calls[1][2]).toBe('updateComponent');
  });

  describe('pushHistory 内部 updater 行为', () => {
    it('当 project 为 null 时返回空对象（不写入 history）', () => {
      const setMock = vi.fn();
      withHistory(setMock as never, 'test', () => ({}));

      const pushHistoryUpdater = setMock.mock.calls[0][0] as (
        state: ScreenEditorState,
      ) => Partial<ScreenEditorState>;

      const emptyState = makeMockState({ project: null });
      expect(pushHistoryUpdater(emptyState)).toEqual({});
    });

    it('当 project 存在时推入 components 快照到 past 并清空 future', () => {
      const setMock = vi.fn();
      withHistory(setMock as never, 'test', () => ({}));

      const pushHistoryUpdater = setMock.mock.calls[0][0] as (
        state: ScreenEditorState,
      ) => Partial<ScreenEditorState>;

      const mockComponent = makeMockComponent('comp-1');
      const state = makeMockState({
        project: { components: [mockComponent] } as unknown as ScreenProject,
        history: { past: [], future: [{ id: 'stale' } as unknown as ScreenComponent[]] },
      });

      const result = pushHistoryUpdater(state);
      expect(result).toEqual({
        history: {
          past: [[mockComponent]],
          future: [],
        },
      });
    });

    it('保留历史栈中已存在的快照（追加而非覆盖）', () => {
      const setMock = vi.fn();
      withHistory(setMock as never, 'test', () => ({}));

      const pushHistoryUpdater = setMock.mock.calls[0][0] as (
        state: ScreenEditorState,
      ) => Partial<ScreenEditorState>;

      const oldSnapshot: ScreenComponent[] = [makeMockComponent('old')];
      const newComponent = makeMockComponent('new');
      const state = makeMockState({
        project: { components: [newComponent] } as unknown as ScreenProject,
        history: { past: [oldSnapshot], future: [] },
      });

      const result = pushHistoryUpdater(state);
      expect(result.history?.past).toEqual([oldSnapshot, [newComponent]]);
      expect(result.history?.future).toEqual([]);
    });

    it('超过 HISTORY_LIMIT (50) 时丢弃最旧的快照（FIFO）', () => {
      const setMock = vi.fn();
      withHistory(setMock as never, 'test', () => ({}));

      const pushHistoryUpdater = setMock.mock.calls[0][0] as (
        state: ScreenEditorState,
      ) => Partial<ScreenEditorState>;

      // 创建 60 个旧快照
      const oldSnapshots: ScreenComponent[][] = Array.from({ length: 60 }, (_, i) => [
        makeMockComponent(`old-${i}`),
      ]);
      const newComponent = makeMockComponent('new');
      const state = makeMockState({
        project: { components: [newComponent] } as unknown as ScreenProject,
        history: { past: oldSnapshots, future: [] },
      });

      const result = pushHistoryUpdater(state);
      // 60 + 1 = 61，slice(-50) 保留最后 50 个，丢弃最旧的 11 个
      expect(result.history?.past.length).toBe(50);
      // 最旧的应该是 oldSnapshots[11]（index 0-10 被丢弃）
      expect(result.history?.past[0]).toEqual([makeMockComponent('old-11')]);
      // 最新的是 [newComponent]
      expect(result.history?.past[49]).toEqual([newComponent]);
    });
  });

  describe('集成：模拟 store 行为，验证最终 state 正确', () => {
    it('通过模拟 set 实现 state 合并，验证 history.past 推入旧快照且 state 已更新', () => {
      // 模拟一个最小 store：set(partial) 合并到 currentState
      const initialComponents: ScreenComponent[] = [];
      let currentState: ScreenEditorState = makeMockState({
        project: {
          id: 'proj-1',
          name: 'test',
          components: initialComponents,
        } as unknown as ScreenProject,
        history: { past: [], future: [] },
      });

      const setMock = vi.fn((partial: unknown) => {
        if (typeof partial === 'function') {
          const result = (partial as (s: ScreenEditorState) => Partial<ScreenEditorState>)(
            currentState,
          );
          currentState = { ...currentState, ...result };
        } else {
          currentState = { ...currentState, ...(partial as Partial<ScreenEditorState>) };
        }
      });

      const newComponent = makeMockComponent('comp-1');
      withHistory(setMock, 'addComponent', (state) => ({
        project: {
          ...state.project!,
          components: [...state.project!.components, newComponent],
        },
      }));

      // 验证：history.past 已推入旧快照（空数组）
      expect(currentState.history.past).toEqual([[]]);
      // 验证：state 已更新，project.components 包含新组件
      expect(currentState.project?.components).toEqual([newComponent]);
      // 验证：future 已清空（即使原本就为空）
      expect(currentState.history.future).toEqual([]);
    });

    it('连续调用两次：每次都把当前快照推入 past，且 state 累积更新', () => {
      let currentState: ScreenEditorState = makeMockState({
        project: {
          id: 'proj-1',
          name: 'test',
          components: [],
        } as unknown as ScreenProject,
        history: { past: [], future: [] },
      });

      const setMock = vi.fn((partial: unknown) => {
        if (typeof partial === 'function') {
          const result = (partial as (s: ScreenEditorState) => Partial<ScreenEditorState>)(
            currentState,
          );
          currentState = { ...currentState, ...result };
        } else {
          currentState = { ...currentState, ...(partial as Partial<ScreenEditorState>) };
        }
      });

      // 第一次：添加 comp-1
      const comp1 = makeMockComponent('comp-1');
      withHistory(setMock, 'addComponent', (state) => ({
        project: {
          ...state.project!,
          components: [...state.project!.components, comp1],
        },
      }));

      // 第二次：添加 comp-2
      const comp2 = makeMockComponent('comp-2');
      withHistory(setMock, 'addComponent', (state) => ({
        project: {
          ...state.project!,
          components: [...state.project!.components, comp2],
        },
      }));

      // 验证：history.past 累积为 2 个快照（第一次为 []，第二次为 [comp1]）
      expect(currentState.history.past).toEqual([[], [comp1]]);
      // 验证：state 已累积更新，project.components 包含两个组件
      expect(currentState.project?.components).toEqual([comp1, comp2]);
    });

    it('当 project 为 null 时调用：set 仍被调用 2 次，但 pushHistory 不修改 history', () => {
      let currentState: ScreenEditorState = makeMockState({
        project: null,
        history: { past: [], future: [] },
      });

      const setMock = vi.fn((partial: unknown) => {
        if (typeof partial === 'function') {
          const result = (partial as (s: ScreenEditorState) => Partial<ScreenEditorState>)(
            currentState,
          );
          currentState = { ...currentState, ...result };
        } else {
          currentState = { ...currentState, ...(partial as Partial<ScreenEditorState>) };
        }
      });

      withHistory(setMock, 'addComponent', () => ({
        // 业务 updater 通常也会在 project 为 null 时返回 {}，这里模拟 addComponent 的实际行为
        // 但因为 project 为 null，updater 通常也什么也不做
      }));

      // 验证：set 仍被调用 2 次
      expect(setMock).toHaveBeenCalledTimes(2);
      // 验证：history 未被修改（past 仍为空）
      expect(currentState.history.past).toEqual([]);
    });
  });
});
