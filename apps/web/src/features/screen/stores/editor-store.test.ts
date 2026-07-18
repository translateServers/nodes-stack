import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScreenComponent, ScreenProject } from '@nebula/shared';

import { useScreenEditorStore, withHistory } from './editor-store';
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
  it('调用顺序：先调用 set(fn) 推入历史，再调用 set(wrapper, false, actionName) 应用更新并标记脏状态', () => {
    const setMock = vi.fn();
    const updater = vi.fn((): Partial<ScreenEditorState> => ({}));

    withHistory(setMock as never, 'addComponent', updater);

    expect(setMock).toHaveBeenCalledTimes(2);

    // 第一次：pushHistory 内部调用 set(fn) — 仅传函数，无 replace / actionName
    const firstCall = setMock.mock.calls[0];
    expect(typeof firstCall[0]).toBe('function');
    expect(firstCall[1]).toBeUndefined();
    expect(firstCall[2]).toBeUndefined();

    // 第二次：set(wrapper, false, actionName) — wrapper 内部调用 updater 并合并 isDirty: true
    const secondCall = setMock.mock.calls[1];
    expect(typeof secondCall[0]).toBe('function');
    expect(secondCall[1]).toBe(false);
    expect(secondCall[2]).toBe('addComponent');

    // 验证 wrapper 调用 updater 并合并 isDirty: true（任务 8.1）
    const wrapper = secondCall[0] as (s: ScreenEditorState) => Partial<ScreenEditorState>;
    const mockState = makeMockState({ project: null });
    const result = wrapper(mockState);
    expect(updater).toHaveBeenCalledWith(mockState);
    expect(result).toEqual({ isDirty: true });
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

describe('isDirty 脏状态跟踪（任务 8.1）', () => {
  /** 创建一个最小可用的 ScreenProject mock */
  function makeProject(id = 'proj-1', updatedAt = '2024-01-01 00:00:00'): ScreenProject {
    return {
      id,
      name: `project-${id}`,
      description: null,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [],
      status: 'draft',
      thumbnail: null,
      createdAt: '2024-01-01 00:00:00',
      updatedAt,
    } as unknown as ScreenProject;
  }

  /** 创建一个最小可用的 ScreenComponent mock */
  function makeComponent(id = 'comp-1'): ScreenComponent {
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

  beforeEach(() => {
    // 重置 store 数据字段，保留 actions；隔离每个用例的状态
    useScreenEditorStore.setState({
      project: null,
      selectedComponentIds: [],
      history: { past: [], future: [] },
      isDirty: false,
    });
  });

  it('a) 加载后为干净（isDirty=false）', () => {
    useScreenEditorStore.getState().loadProject(makeProject());
    expect(useScreenEditorStore.getState().isDirty).toBe(false);
  });

  it('b) 修改后为脏（isDirty=true）—— 覆盖 withHistory / updateCanvas / undo / redo 多路径', () => {
    // withHistory 路径：addComponent（首次修改）
    useScreenEditorStore.getState().loadProject(makeProject());
    useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    // 再次 loadProject 恢复干净后，验证 updateComponent 路径
    useScreenEditorStore.getState().loadProject({
      ...makeProject('proj-2', '2024-01-01 00:00:00'),
      components: [makeComponent('comp-2')],
    });
    expect(useScreenEditorStore.getState().isDirty).toBe(false);
    useScreenEditorStore.getState().updateComponent('comp-2', {
      position: { x: 10, y: 20, width: 100, height: 100 },
    });
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    // 再次 loadProject 恢复干净后，验证 updateCanvas（非 withHistory）路径
    useScreenEditorStore.getState().loadProject({
      ...makeProject('proj-3', '2024-01-01 00:00:00'),
      components: [makeComponent('comp-3')],
    });
    expect(useScreenEditorStore.getState().isDirty).toBe(false);
    useScreenEditorStore.getState().updateCanvas({ backgroundColor: '#ffffff' });
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    // 再次 loadProject + addComponent 制造历史，验证 undo 路径
    useScreenEditorStore.getState().loadProject({
      ...makeProject('proj-4', '2024-01-01 00:00:00'),
      components: [makeComponent('comp-4')],
    });
    useScreenEditorStore.getState().addComponent(makeComponent('comp-5'));
    expect(useScreenEditorStore.getState().isDirty).toBe(true);
    useScreenEditorStore.getState().loadProject(useScreenEditorStore.getState().project!);
    expect(useScreenEditorStore.getState().isDirty).toBe(false);
    useScreenEditorStore.getState().addComponent(makeComponent('comp-6'));
    useScreenEditorStore.getState().undo();
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    // 验证 redo 路径
    useScreenEditorStore.getState().loadProject(useScreenEditorStore.getState().project!);
    expect(useScreenEditorStore.getState().isDirty).toBe(false);
    useScreenEditorStore.getState().addComponent(makeComponent('comp-7'));
    useScreenEditorStore.getState().undo();
    useScreenEditorStore.getState().redo();
    expect(useScreenEditorStore.getState().isDirty).toBe(true);
  });

  it('c) 保存成功后恢复干净（通过 loadProject 回写）', () => {
    // 模拟任务 7.3 的保存成功流程：loadProject → 修改 → 保存成功后 loadProject 回写新基线
    useScreenEditorStore.getState().loadProject(makeProject('proj-1', '2024-01-01 00:00:00'));
    useScreenEditorStore.getState().addComponent(makeComponent());
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    // 模拟服务端返回保存后的完整项目（新 updatedAt），编辑器调用 loadProject 回写
    const savedProject: ScreenProject = {
      ...makeProject('proj-1', '2024-01-02 00:00:00'),
      components: [makeComponent()],
    };
    useScreenEditorStore.getState().loadProject(savedProject);

    expect(useScreenEditorStore.getState().isDirty).toBe(false);
    // 验证回写后 Store 中的 updatedAt 是新基线
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe('2024-01-02 00:00:00');
  });

  it('d) 保存失败后保持脏', () => {
    // 模拟任务 7.3 的保存失败流程：loadProject → 修改 → 保存失败（不调用 loadProject）
    useScreenEditorStore.getState().loadProject(makeProject('proj-1', '2024-01-01 00:00:00'));
    useScreenEditorStore.getState().addComponent(makeComponent());
    expect(useScreenEditorStore.getState().isDirty).toBe(true);
    const baselineUpdatedAt = useScreenEditorStore.getState().project?.updatedAt;

    // 模拟保存失败：mutation 抛错，不会调用 loadProject
    // —— 此处无需实际触发网络请求，只需断言"未调用 loadProject"时 isDirty 保持 true
    expect(useScreenEditorStore.getState().isDirty).toBe(true);
    // 验证基线 updatedAt 未被覆盖（保持旧值，下次保存仍用旧基线）
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe(baselineUpdatedAt);
  });
});
