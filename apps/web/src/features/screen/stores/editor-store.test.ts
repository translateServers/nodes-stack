import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasConfig, ScreenComponent, ScreenProject } from '@nebula/shared';

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

/** 创建一个最小可用的 CanvasConfig mock */
function makeMockCanvas(overrides: Partial<CanvasConfig> = {}): CanvasConfig {
  return {
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    scaleMode: 'fit',
    ...overrides,
  };
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

    it('当 project 存在时推入 components 与 canvas 快照到 past 并清空 future', () => {
      const setMock = vi.fn();
      withHistory(setMock as never, 'test', () => ({}));

      const pushHistoryUpdater = setMock.mock.calls[0][0] as (
        state: ScreenEditorState,
      ) => Partial<ScreenEditorState>;

      const mockComponent = makeMockComponent('comp-1');
      const state = makeMockState({
        project: {
          components: [mockComponent],
          canvas: makeMockCanvas(),
        } as unknown as ScreenProject,
        history: {
          past: [],
          future: [{ components: [], canvas: makeMockCanvas() }],
        },
      });

      const result = pushHistoryUpdater(state);
      expect(result).toEqual({
        history: {
          past: [{ components: [mockComponent], canvas: makeMockCanvas() }],
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

      const oldEntry = { components: [makeMockComponent('old')], canvas: makeMockCanvas() };
      const newComponent = makeMockComponent('new');
      const state = makeMockState({
        project: {
          components: [newComponent],
          canvas: makeMockCanvas(),
        } as unknown as ScreenProject,
        history: { past: [oldEntry], future: [] },
      });

      const result = pushHistoryUpdater(state);
      expect(result.history?.past).toEqual([
        oldEntry,
        { components: [newComponent], canvas: makeMockCanvas() },
      ]);
      expect(result.history?.future).toEqual([]);
    });

    it('超过 HISTORY_LIMIT (50) 时丢弃最旧的快照（FIFO）', () => {
      const setMock = vi.fn();
      withHistory(setMock as never, 'test', () => ({}));

      const pushHistoryUpdater = setMock.mock.calls[0][0] as (
        state: ScreenEditorState,
      ) => Partial<ScreenEditorState>;

      // 创建 60 个旧快照
      const oldSnapshots = Array.from({ length: 60 }, (_, i) => ({
        components: [makeMockComponent(`old-${i}`)],
        canvas: makeMockCanvas(),
      }));
      const newComponent = makeMockComponent('new');
      const state = makeMockState({
        project: {
          components: [newComponent],
          canvas: makeMockCanvas(),
        } as unknown as ScreenProject,
        history: { past: oldSnapshots, future: [] },
      });

      const result = pushHistoryUpdater(state);
      // 60 + 1 = 61，slice(-50) 保留最后 50 个，丢弃最旧的 11 个
      expect(result.history?.past.length).toBe(50);
      // 最旧的应该是 oldSnapshots[11]（index 0-10 被丢弃）
      expect(result.history?.past[0]).toEqual({
        components: [makeMockComponent('old-11')],
        canvas: makeMockCanvas(),
      });
      // 最新的是 newComponent 快照
      expect(result.history?.past[49]).toEqual({
        components: [newComponent],
        canvas: makeMockCanvas(),
      });
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
          canvas: makeMockCanvas(),
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

      // 验证：history.past 已推入旧快照（空组件数组 + 旧画布配置）
      expect(currentState.history.past).toEqual([{ components: [], canvas: makeMockCanvas() }]);
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
          canvas: makeMockCanvas(),
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

      // 验证：history.past 累积为 2 个快照（第一次组件为 []，第二次为 [comp1]）
      expect(currentState.history.past).toEqual([
        { components: [], canvas: makeMockCanvas() },
        { components: [comp1], canvas: makeMockCanvas() },
      ]);
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

describe('画布配置进入历史栈（阶段 2 链路 B）', () => {
  /** 创建一个最小可用的 ScreenProject mock */
  function makeProject(id = 'proj-1', canvasOverrides: Partial<CanvasConfig> = {}): ScreenProject {
    return {
      id,
      name: `project-${id}`,
      description: null,
      canvas: makeMockCanvas(canvasOverrides),
      components: [],
      status: 'draft',
      thumbnail: null,
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-01 00:00:00',
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

  describe('任务 8.1 历史条目同时记录组件与画布快照', () => {
    it('undo 同时恢复组件与画布配置，组件编辑与画布编辑共享同一时间线', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
      useScreenEditorStore.getState().updateCanvas({ backgroundColor: '#ffffff' });
      expect(useScreenEditorStore.getState().history.past).toHaveLength(2);

      // 第一次 undo：回退画布修改，组件保留
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.canvas.backgroundColor).toBe('#000000');
      expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);

      // 第二次 undo：回退组件新增
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.components).toHaveLength(0);
      expect(useScreenEditorStore.getState().project?.canvas.backgroundColor).toBe('#000000');
    });

    it('redo 同时恢复组件与画布配置', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
      useScreenEditorStore.getState().updateCanvas({ backgroundColor: '#ffffff' });
      useScreenEditorStore.getState().undo();
      useScreenEditorStore.getState().undo();

      // 第一次 redo：恢复组件
      useScreenEditorStore.getState().redo();
      expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
      expect(useScreenEditorStore.getState().project?.canvas.backgroundColor).toBe('#000000');

      // 第二次 redo：恢复画布
      useScreenEditorStore.getState().redo();
      expect(useScreenEditorStore.getState().project?.canvas.backgroundColor).toBe('#ffffff');
      expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
    });

    it('组件编辑产生的历史条目同样携带画布快照，undo 组件操作不会误回退画布', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      // undo 组件新增：组件回退，画布保持 1280（条目快照语义一致）
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.components).toHaveLength(0);
      expect(useScreenEditorStore.getState().project?.canvas.width).toBe(1280);
    });

    it('loadProject 清空历史（既有语义不变）', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      expect(useScreenEditorStore.getState().history.past).toHaveLength(2);

      useScreenEditorStore.getState().loadProject(makeProject('proj-2'));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().history.future).toHaveLength(0);
    });
  });

  describe('任务 8.2 updateCanvas 接入历史栈', () => {
    it('宽度/高度/背景色/背景图/缩放模式修改均入栈，可逐步撤销与重做', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      const originalCanvas = useScreenEditorStore.getState().project?.canvas;

      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      useScreenEditorStore.getState().updateCanvas({ height: 720 });
      useScreenEditorStore.getState().updateCanvas({ backgroundColor: '#123456' });
      useScreenEditorStore.getState().updateCanvas({
        backgroundImage: 'https://example.com/bg.png',
      });
      useScreenEditorStore.getState().updateCanvas({ scaleMode: 'full' });

      const modified = useScreenEditorStore.getState().project?.canvas;
      expect(useScreenEditorStore.getState().history.past).toHaveLength(5);
      expect(modified).toEqual({
        width: 1280,
        height: 720,
        backgroundColor: '#123456',
        backgroundImage: 'https://example.com/bg.png',
        scaleMode: 'full',
      });

      // 逐步撤销恢复原始画布
      for (let i = 0; i < 5; i++) {
        useScreenEditorStore.getState().undo();
      }
      expect(useScreenEditorStore.getState().project?.canvas).toEqual(originalCanvas);

      // 逐步重做恢复修改后画布
      for (let i = 0; i < 5; i++) {
        useScreenEditorStore.getState().redo();
      }
      expect(useScreenEditorStore.getState().project?.canvas).toEqual(modified);
    });

    it('无实际变化时不入栈也不置脏（不产生空历史记录）', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      expect(useScreenEditorStore.getState().isDirty).toBe(false);

      // 各字段提交与当前值相同
      useScreenEditorStore.getState().updateCanvas({ width: 1920 });
      useScreenEditorStore.getState().updateCanvas({ height: 1080 });
      useScreenEditorStore.getState().updateCanvas({ backgroundColor: '#000000' });
      useScreenEditorStore.getState().updateCanvas({ scaleMode: 'fit' });
      useScreenEditorStore.getState().updateCanvas({ backgroundImage: undefined });
      useScreenEditorStore.getState().updateCanvas({});

      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().history.future).toHaveLength(0);
      expect(useScreenEditorStore.getState().isDirty).toBe(false);
    });

    it('混合提交（部分字段相同、部分不同）时按实际变化入栈一条，且仅应用差异字段', () => {
      useScreenEditorStore.getState().loadProject(makeProject());

      // width 相同、height 不同：应入栈一条且只改 height
      useScreenEditorStore.getState().updateCanvas({ width: 1920, height: 720 });

      const state = useScreenEditorStore.getState();
      expect(state.history.past).toHaveLength(1);
      expect(state.project?.canvas.width).toBe(1920);
      expect(state.project?.canvas.height).toBe(720);
      expect(state.isDirty).toBe(true);
    });

    it('有实际变化时入栈并置脏（脏状态语义与既有约定一致）', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      expect(useScreenEditorStore.getState().isDirty).toBe(true);

      // 撤销/重做路径同样置脏
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().isDirty).toBe(true);
      useScreenEditorStore.getState().redo();
      expect(useScreenEditorStore.getState().isDirty).toBe(true);
    });

    it('project 为 null 时 updateCanvas 不产生历史', () => {
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().isDirty).toBe(false);
    });
  });

  describe('任务 8.3 连续输入的单条历史语义', () => {
    it('一次业务修改（draft 提交语义下单次 updateCanvas）只产生一条历史，快照为修改前状态', () => {
      useScreenEditorStore.getState().loadProject(makeProject());

      // 模拟属性面板 NumberInput / 画布设置对话框的 draft 提交：
      // 连续微调过程不调用 store，仅在 Enter/Blur/确认时提交一次
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });

      const state = useScreenEditorStore.getState();
      expect(state.history.past).toHaveLength(1);
      // 唯一的历史条目是修改前的完整快照（组件 + 画布）
      expect(state.history.past[0]).toEqual({
        components: [],
        canvas: makeMockCanvas(),
      });
    });

    it('重复提交相同值不产生空历史记录', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);

      // 再次提交当前值（如对话框二次确认但未修改）：不入栈
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
      expect(useScreenEditorStore.getState().history.future).toHaveLength(0);
    });
  });
});
