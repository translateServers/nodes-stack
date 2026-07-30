import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CanvasConfig,
  EventBlueprint,
  GlobalVariable,
  ScreenComponent,
  ScreenProject,
} from '@nebula/shared';

import { createScreenEditorStore, withHistory } from './editor-store';
import type { ScreenEditorState } from './editor-store';

const useScreenEditorStore = createScreenEditorStore();

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

describe('历史快照扩展为三要素（任务 5.1）', () => {
  /** 创建一个最小可用的 ScreenProject mock */
  function makeProject(id = 'proj-1', blueprint?: EventBlueprint): ScreenProject {
    return {
      id,
      name: `project-${id}`,
      description: null,
      canvas: makeMockCanvas(),
      components: [],
      blueprint,
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

  /** 创建最小可用的 EventBlueprint mock（V2 格式，避免 loadProject 触发迁移） */
  function makeBlueprint(nodes: unknown[] = [], edges: unknown[] = []): EventBlueprint {
    return {
      version: 2,
      nodes,
      edges,
    } as unknown as EventBlueprint;
  }

  /** 创建一个 V2 comment 节点 mock（含位置，便于模拟拖拽位移） */
  function makeNode(id: string, x = 0, y = 0): unknown {
    return { id, kind: 'comment', position: { x, y }, config: { text: '' } };
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

  describe('历史快照携带 blueprint 三要素', () => {
    it('pushHistory 推入的快照包含 components/canvas/blueprint 三要素', () => {
      const blueprint = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));

      // withHistory 路径：触发 pushHistory 推入当前快照
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      const past = useScreenEditorStore.getState().history.past;
      expect(past).toHaveLength(1);
      // 三要素都存在：components（修改前的空数组）、canvas、blueprint
      expect(past[0]).toEqual({
        components: [],
        canvas: makeMockCanvas(),
        blueprint: { version: 2, nodes: [makeNode('n1')], edges: [] },
      });
    });

    it('project.blueprint=undefined 时快照不带 blueprint 字段（保持向后兼容）', () => {
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', undefined));

      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      const past = useScreenEditorStore.getState().history.past;
      expect(past).toHaveLength(1);
      // blueprint 字段不存在（undefined 在展开条件中不写入）
      expect(past[0].blueprint).toBeUndefined();
    });
  });

  describe('undo/redo 同步恢复三要素', () => {
    it('undo 同时恢复 components、canvas 与 blueprint', () => {
      // 初始无 blueprint
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', undefined));

      // 添加组件 → pushHistory 推入 (空组件 + 无 blueprint)
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      // 修改蓝图（模拟添加节点）→ withHistory 推入 (1 组件 + 无 blueprint)
      const blueprint2 = makeBlueprint([makeNode('n1'), makeNode('n2')]);
      withHistory(
        (partial: unknown) => {
          useScreenEditorStore.setState(partial as Partial<ScreenEditorState>);
        },
        'updateBlueprint',
        () => ({
          project: {
            ...useScreenEditorStore.getState().project!,
            blueprint: blueprint2,
          },
        }),
      );

      // 此时状态：1 组件 + blueprint2
      expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(blueprint2);
      expect(useScreenEditorStore.getState().history.past).toHaveLength(2);

      // undo 蓝图修改：blueprint 回退到 undefined（pushHistory 时的状态）
      useScreenEditorStore.getState().undo();
      const state1 = useScreenEditorStore.getState();
      expect(state1.project?.blueprint).toBeUndefined();
      // components 应该恢复到 pushHistory 时的状态（1 组件，未变化的）
      expect(state1.project?.components).toHaveLength(1);

      // 再次 undo：恢复到空组件状态
      useScreenEditorStore.getState().undo();
      const state2 = useScreenEditorStore.getState();
      expect(state2.project?.components).toHaveLength(0);
      expect(state2.project?.blueprint).toBeUndefined();
    });

    it('redo 同时恢复 components、canvas 与 blueprint', () => {
      const blueprint = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));

      // 添加组件 → pushHistory 推入 (空组件 + blueprint)
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
      // 修改画布 → pushHistory 推入 (1 组件 + blueprint)
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });

      // 两次 undo：回到初始状态
      useScreenEditorStore.getState().undo();
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.components).toHaveLength(0);
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(blueprint);
      expect(useScreenEditorStore.getState().project?.canvas.width).toBe(1920);

      // 第一次 redo：恢复 1 组件 + 初始画布 + blueprint
      useScreenEditorStore.getState().redo();
      const state1 = useScreenEditorStore.getState();
      expect(state1.project?.components).toHaveLength(1);
      expect(state1.project?.blueprint).toEqual(blueprint);
      expect(state1.project?.canvas.width).toBe(1920);

      // 第二次 redo：恢复 1 组件 + 1280 画布 + blueprint
      useScreenEditorStore.getState().redo();
      const state2 = useScreenEditorStore.getState();
      expect(state2.project?.components).toHaveLength(1);
      expect(state2.project?.blueprint).toEqual(blueprint);
      expect(state2.project?.canvas.width).toBe(1280);
    });

    it('undo 组件操作不会误回退 blueprint（蓝图与组件共享同一时间线）', () => {
      const blueprint = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));

      // 添加组件 → pushHistory 推入 (空组件 + blueprint)
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
      // 再次修改画布 → pushHistory 推入 (1 组件 + 画布 + blueprint)
      useScreenEditorStore.getState().updateCanvas({ backgroundColor: '#ffffff' });

      // undo 画布修改：components 保持 1 个，blueprint 保持 1 节点
      useScreenEditorStore.getState().undo();
      const state1 = useScreenEditorStore.getState();
      expect(state1.project?.components).toHaveLength(1);
      expect(state1.project?.canvas.backgroundColor).toBe('#000000');
      expect(state1.project?.blueprint).toEqual(blueprint);
    });

    it('undo 蓝图修改不会误回退 components 或 canvas', () => {
      const blueprint1 = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint1));

      // 1. 添加组件 → pushHistory 推入 (空组件 + 初始画布 + blueprint1)
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
      // 2. 修改画布 → pushHistory 推入 (1 组件 + 初始画布 + blueprint1)
      useScreenEditorStore.getState().updateCanvas({ width: 1280 });
      // 3. 修改蓝图（模拟） → pushHistory 推入 (1 组件 + 1280 画布 + blueprint1)
      //    然后应用新蓝图 blueprint2
      const blueprint2 = makeBlueprint([makeNode('n1'), makeNode('n2')]);
      // 通过 withHistory 制造一个含蓝图修改的历史条目
      withHistory(
        (partial: unknown) => {
          useScreenEditorStore.setState(partial as Partial<ScreenEditorState>);
        },
        'updateBlueprint',
        () => ({
          project: {
            ...useScreenEditorStore.getState().project!,
            blueprint: blueprint2,
          },
        }),
      );

      // undo 蓝图修改：blueprint 回退到 blueprint1，但 components 与 canvas 保持
      useScreenEditorStore.getState().undo();
      const state = useScreenEditorStore.getState();
      expect(state.project?.blueprint).toEqual(blueprint1);
      expect(state.project?.components).toHaveLength(1);
      expect(state.project?.canvas.width).toBe(1280);
    });
  });

  describe('旧快照兼容（无 blueprint 字段）', () => {
    it('旧快照（无 blueprint 字段）undo 后 project.blueprint 为 undefined', () => {
      // 模拟旧版本的历史栈：HistoryEntry 没有 blueprint 字段
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', undefined));
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      // 手动构造一个旧格式快照（无 blueprint 字段）注入到 past
      const oldSnapshot = {
        components: [],
        canvas: makeMockCanvas(),
        // 没有 blueprint 字段
      };
      useScreenEditorStore.setState({
        history: {
          past: [oldSnapshot],
          future: [],
        },
      });

      // undo 后应该恢复到旧快照状态：blueprint 为 undefined
      useScreenEditorStore.getState().undo();
      const state = useScreenEditorStore.getState();
      expect(state.project?.blueprint).toBeUndefined();
      expect(state.project?.components).toHaveLength(0);
    });

    it('旧快照（无 blueprint 字段）注入 future 后 redo 也能正确恢复', () => {
      const blueprint = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      // 替换 future 为旧格式快照（无 blueprint）
      const oldSnapshot = {
        components: [makeComponent('comp-old')],
        canvas: makeMockCanvas({ width: 800 }),
        // 没有 blueprint 字段
      };
      useScreenEditorStore.setState({
        history: {
          past: [],
          future: [oldSnapshot],
        },
      });

      // redo 后应该恢复到旧快照状态：blueprint 为 undefined
      useScreenEditorStore.getState().redo();
      const state = useScreenEditorStore.getState();
      expect(state.project?.blueprint).toBeUndefined();
      expect(state.project?.components).toHaveLength(1);
      expect(state.project?.components[0]?.id).toBe('comp-old');
      expect(state.project?.canvas.width).toBe(800);
    });
  });

  describe('容量限制与 loadProject 清空语义不变', () => {
    it('HISTORY_LIMIT 对 blueprint 同样生效（旧快照被丢弃）', () => {
      const blueprint = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));

      // 制造 51 次修改，使最早的快照被丢弃
      for (let i = 0; i < 51; i++) {
        useScreenEditorStore.getState().addComponent(makeComponent(`comp-${i}`));
      }

      const state = useScreenEditorStore.getState();
      // 历史栈长度限制为 50
      expect(state.history.past).toHaveLength(50);
      // 每个快照都应包含 blueprint 三要素
      for (const entry of state.history.past) {
        expect(entry.blueprint).toEqual(blueprint);
      }
    });

    it('loadProject 清空历史（含 blueprint 的历史也被清空）', () => {
      const blueprint = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);

      // loadProject 清空历史
      useScreenEditorStore.getState().loadProject(makeProject('proj-2', blueprint));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().history.future).toHaveLength(0);
    });
  });

  describe('blueprint 在 future 快照中的同步语义', () => {
    it('undo 后 future 中保存的快照包含 blueprint', () => {
      const blueprint = makeBlueprint([makeNode('n1')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      useScreenEditorStore.getState().undo();

      const future = useScreenEditorStore.getState().history.future;
      expect(future).toHaveLength(1);
      // future 中保存的快照应包含 blueprint
      expect(future[0].blueprint).toEqual(blueprint);
      expect(future[0].components).toHaveLength(1);
    });

    it('redo 时 future 快照的 blueprint 正确恢复', () => {
      const blueprint = makeBlueprint([makeNode('n1'), makeNode('n2')]);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', blueprint));
      useScreenEditorStore.getState().addComponent(makeComponent('comp-1'));

      // undo → future 含 blueprint
      useScreenEditorStore.getState().undo();
      // redo → 从 future 恢复 blueprint
      useScreenEditorStore.getState().redo();

      const state = useScreenEditorStore.getState();
      expect(state.project?.blueprint).toEqual(blueprint);
      expect(state.project?.components).toHaveLength(1);
    });
  });
});

describe('蓝图编辑手势接入历史栈（任务 5.2）', () => {
  /** 创建一个最小可用的 ScreenProject mock */
  function makeProject(id = 'proj-1', blueprint?: EventBlueprint): ScreenProject {
    return {
      id,
      name: `project-${id}`,
      description: null,
      canvas: makeMockCanvas(),
      components: [],
      blueprint,
      status: 'draft',
      thumbnail: null,
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-01 00:00:00',
    } as unknown as ScreenProject;
  }

  /** 创建最小可用的 EventBlueprint mock（V2 格式，避免 loadProject 触发迁移） */
  function makeBlueprint(nodes: unknown[] = [], edges: unknown[] = []): EventBlueprint {
    return { version: 2, nodes, edges } as unknown as EventBlueprint;
  }

  /** 创建一个 comment 节点 mock（含位置，便于模拟拖拽位移） */
  function makeNode(id: string, x = 0, y = 0): unknown {
    return { id, kind: 'comment', position: { x, y }, config: { text: '' } };
  }

  beforeEach(() => {
    // 重置 store 数据字段（含蓝图手势态），隔离每个用例
    useScreenEditorStore.setState({
      project: null,
      selectedComponentIds: [],
      history: { past: [], future: [] },
      isDirty: false,
      blueprintGesture: { active: false, baseline: undefined },
    });
  });

  describe('各编辑路径单条历史', () => {
    it('节点增删、连线增删、参数修改均各产生一条历史', () => {
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', makeBlueprint([], [])));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);

      // 新增节点 → +1
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1')], []));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);

      // 参数修改（config 变化）→ +1
      useScreenEditorStore
        .getState()
        .updateBlueprint(
          makeBlueprint([{ ...(makeNode('n1') as object), config: { text: 'hi' } }], []),
        );
      expect(useScreenEditorStore.getState().history.past).toHaveLength(2);

      // 新增连线 → +1
      useScreenEditorStore
        .getState()
        .updateBlueprint(
          makeBlueprint(
            [makeNode('n1'), makeNode('n2')],
            [{ id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in' }],
          ),
        );
      expect(useScreenEditorStore.getState().history.past).toHaveLength(3);

      // 删除节点 → +1
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n2')], []));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(4);
    });

    it('每次编辑只产生一条历史，快照为修改前状态', () => {
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', makeBlueprint([], [])));
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1')], []));

      const past = useScreenEditorStore.getState().history.past;
      expect(past).toHaveLength(1);
      // 快照为修改前（空蓝图）
      expect(past[0].blueprint).toEqual(makeBlueprint([], []));
      // 当前为修改后
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(
        makeBlueprint([makeNode('n1')], []),
      );
    });
  });

  describe('连续拖拽合并单条历史', () => {
    it('手势期间多次 updateBlueprint 只更新数据不入栈，结束手势补一条历史', () => {
      useScreenEditorStore
        .getState()
        .loadProject(makeProject('proj-1', makeBlueprint([makeNode('n1', 0, 0)], [])));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);

      useScreenEditorStore.getState().beginBlueprintGesture();
      // 拖拽过程：连续位置更新（模拟每帧）
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1', 10, 10)], []));
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1', 20, 20)], []));
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1', 30, 30)], []));

      // 手势期间：数据已更新到最新位置，但不产生历史；脏标记置位
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(
        makeBlueprint([makeNode('n1', 30, 30)], []),
      );
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().isDirty).toBe(true);

      // 结束手势：补一条历史
      useScreenEditorStore.getState().endBlueprintGesture();
      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
    });

    it('拖拽结束补入的历史快照为拖拽前状态，undo/redo 正确恢复', () => {
      const before = makeBlueprint([makeNode('n1', 0, 0)], []);
      const after = makeBlueprint([makeNode('n1', 50, 50)], []);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', before));

      useScreenEditorStore.getState().beginBlueprintGesture();
      useScreenEditorStore.getState().updateBlueprint(after);
      useScreenEditorStore.getState().endBlueprintGesture();

      // 当前为拖拽后
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(after);
      // undo 回到拖拽前
      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(before);
      // redo 恢复拖拽后
      useScreenEditorStore.getState().redo();
      expect(useScreenEditorStore.getState().project?.blueprint).toEqual(after);
    });

    it('手势期间无净变化时不补历史（拖拽后回到原位）', () => {
      const bp = makeBlueprint([makeNode('n1', 0, 0)], []);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', bp));

      useScreenEditorStore.getState().beginBlueprintGesture();
      // 拖出去又拖回来（净变化为 0）
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1', 20, 20)], []));
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1', 0, 0)], []));
      useScreenEditorStore.getState().endBlueprintGesture();

      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
    });
  });

  describe('空提交跳过', () => {
    it('updateBlueprint 内容相同不入栈也不置脏', () => {
      const bp = makeBlueprint([makeNode('n1')], []);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', bp));
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1')], []));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().isDirty).toBe(false);
    });

    it('未 begin 直接 end 为空操作；begin 后立即 end（无更新）不产生历史', () => {
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', makeBlueprint([], [])));
      // 未 begin 直接 end → 空操作
      useScreenEditorStore.getState().endBlueprintGesture();
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      // begin 后立即 end（无更新）→ 无历史
      useScreenEditorStore.getState().beginBlueprintGesture();
      useScreenEditorStore.getState().endBlueprintGesture();
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
    });
  });

  describe('手势状态管理', () => {
    it('begin 幂等：重复 begin 不重置 baseline', () => {
      const bp = makeBlueprint([makeNode('n1', 0, 0)], []);
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', bp));
      useScreenEditorStore.getState().beginBlueprintGesture();
      const baseline1 = useScreenEditorStore.getState().blueprintGesture.baseline;
      // 手势期间更新一次
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1', 5, 5)], []));
      // 重复 begin 不应重置 baseline
      useScreenEditorStore.getState().beginBlueprintGesture();
      expect(useScreenEditorStore.getState().blueprintGesture.baseline).toEqual(baseline1);
      useScreenEditorStore.getState().endBlueprintGesture();
    });

    it('手势结束后 updateBlueprint 恢复正常入栈', () => {
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', makeBlueprint([], [])));
      useScreenEditorStore.getState().beginBlueprintGesture();
      useScreenEditorStore.getState().updateBlueprint(makeBlueprint([makeNode('n1')], []));
      useScreenEditorStore.getState().endBlueprintGesture();
      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);

      // 手势结束后再编辑 → 正常入栈
      useScreenEditorStore
        .getState()
        .updateBlueprint(makeBlueprint([makeNode('n1'), makeNode('n2')], []));
      expect(useScreenEditorStore.getState().history.past).toHaveLength(2);
    });

    it('loadProject 重置手势状态', () => {
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', makeBlueprint([], [])));
      useScreenEditorStore.getState().beginBlueprintGesture();
      expect(useScreenEditorStore.getState().blueprintGesture.active).toBe(true);
      useScreenEditorStore.getState().loadProject(makeProject('proj-2', makeBlueprint([], [])));
      expect(useScreenEditorStore.getState().blueprintGesture.active).toBe(false);
      expect(useScreenEditorStore.getState().blueprintGesture.baseline).toBeUndefined();
    });
  });
});

describe('全局变量 API 接入历史栈（Task 8）', () => {
  /** 创建一个最小可用的 ScreenProject mock */
  function makeProject(id = 'proj-1', globalVariables: GlobalVariable[] = []): ScreenProject {
    return {
      id,
      name: `project-${id}`,
      description: null,
      canvas: makeMockCanvas(),
      components: [],
      globalVariables,
      status: 'draft',
      thumbnail: null,
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-01 00:00:00',
    } as unknown as ScreenProject;
  }

  /** 创建一个 static 类型全局变量 mock */
  function makeStaticVariable(id: string, name: string, value: unknown = ''): GlobalVariable {
    return {
      id,
      name,
      type: 'static',
      value,
    } as unknown as GlobalVariable;
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

  describe('addGlobalVariable', () => {
    it('追加新变量到 project.globalVariables 并生成唯一 id', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      useScreenEditorStore.getState().addGlobalVariable({
        name: 'apiBaseUrl',
        type: 'static',
        value: 'https://api.example.com',
      });

      const vars = useScreenEditorStore.getState().project?.globalVariables ?? [];
      expect(vars).toHaveLength(1);
      expect(vars[0].name).toBe('apiBaseUrl');
      expect(vars[0].type).toBe('static');
      expect(vars[0].value).toBe('https://api.example.com');
      // id 由 crypto.randomUUID() 生成，应为非空字符串
      expect(typeof vars[0].id).toBe('string');
      expect(vars[0].id.length).toBeGreaterThan(0);
    });

    it('进入历史栈并置脏', () => {
      useScreenEditorStore.getState().loadProject(makeProject());
      expect(useScreenEditorStore.getState().isDirty).toBe(false);
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);

      useScreenEditorStore.getState().addGlobalVariable({
        name: 'token',
        type: 'static',
        value: 'abc',
      });

      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
      expect(useScreenEditorStore.getState().isDirty).toBe(true);
    });

    it('连续添加多个变量：每次都推入历史，id 互不相同', () => {
      useScreenEditorStore.getState().loadProject(makeProject());

      useScreenEditorStore.getState().addGlobalVariable({ name: 'v1', type: 'static' });
      useScreenEditorStore.getState().addGlobalVariable({ name: 'v2', type: 'static' });
      useScreenEditorStore.getState().addGlobalVariable({ name: 'v3', type: 'static' });

      const vars = useScreenEditorStore.getState().project?.globalVariables ?? [];
      expect(vars).toHaveLength(3);
      const ids = new Set(vars.map((v) => v.id));
      expect(ids.size).toBe(3);
      expect(useScreenEditorStore.getState().history.past).toHaveLength(3);
    });

    it('历史快照包含 globalVariables 字段（修改前的快照）', () => {
      const existing = makeStaticVariable('v1', 'apiBaseUrl', 'https://a.com');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [existing]));

      useScreenEditorStore.getState().addGlobalVariable({ name: 'token', type: 'static' });

      const past = useScreenEditorStore.getState().history.past;
      expect(past).toHaveLength(1);
      // 快照为修改前状态：仅含 existing 变量
      expect(past[0].globalVariables).toEqual([existing]);
    });

    it('project 为 null 时不入栈、不报错（与 addComponent 一致的空操作语义）', () => {
      expect(() => {
        useScreenEditorStore.getState().addGlobalVariable({ name: 'v1', type: 'static' });
      }).not.toThrow();
      // project 为 null 时 pushHistory 内部 updater 返回 {}，不写入 history
      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      // project 不变（仍为 null）
      expect(useScreenEditorStore.getState().project).toBeNull();
    });
  });

  describe('updateGlobalVariable', () => {
    it('按 id 合并 updates 到目标变量', () => {
      const v1 = makeStaticVariable('v1', 'apiBaseUrl', 'https://old.com');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      useScreenEditorStore.getState().updateGlobalVariable('v1', { value: 'https://new.com' });

      const vars = useScreenEditorStore.getState().project?.globalVariables ?? [];
      expect(vars[0].value).toBe('https://new.com');
      // 未修改的字段保留
      expect(vars[0].name).toBe('apiBaseUrl');
      expect(vars[0].type).toBe('static');
    });

    it('进入历史栈并置脏', () => {
      const v1 = makeStaticVariable('v1', 'apiBaseUrl', 'https://old.com');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));
      // loadProject 后再 loadProject 重置脏状态
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));
      expect(useScreenEditorStore.getState().isDirty).toBe(false);

      useScreenEditorStore.getState().updateGlobalVariable('v1', { value: 'https://new.com' });

      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
      expect(useScreenEditorStore.getState().isDirty).toBe(true);
    });

    it('找不到 id 时为空操作（不入栈、不置脏）', () => {
      const v1 = makeStaticVariable('v1', 'apiBaseUrl', 'https://a.com');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      useScreenEditorStore.getState().updateGlobalVariable('nonexistent', { value: 'x' });

      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().isDirty).toBe(false);
      // 原变量未被修改
      expect(useScreenEditorStore.getState().project?.globalVariables?.[0].value).toBe(
        'https://a.com',
      );
    });

    it('type 切换：static → api 时合并 apiConfig', () => {
      const v1 = makeStaticVariable('v1', 'token', '');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      useScreenEditorStore.getState().updateGlobalVariable('v1', {
        type: 'api',
        apiConfig: {
          url: 'https://auth.example.com/token',
          method: 'POST',
          refreshInterval: 60000,
        },
      });

      const updated = useScreenEditorStore.getState().project?.globalVariables?.[0];
      expect(updated?.type).toBe('api');
      expect(updated?.apiConfig?.url).toBe('https://auth.example.com/token');
      expect(updated?.apiConfig?.method).toBe('POST');
    });
  });

  describe('removeGlobalVariable', () => {
    it('按 id 从 globalVariables 移除目标变量', () => {
      const v1 = makeStaticVariable('v1', 'a', '1');
      const v2 = makeStaticVariable('v2', 'b', '2');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1, v2]));

      useScreenEditorStore.getState().removeGlobalVariable('v1');

      const vars = useScreenEditorStore.getState().project?.globalVariables ?? [];
      expect(vars).toHaveLength(1);
      expect(vars[0].id).toBe('v2');
    });

    it('进入历史栈并置脏', () => {
      const v1 = makeStaticVariable('v1', 'a', '1');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));
      expect(useScreenEditorStore.getState().isDirty).toBe(false);

      useScreenEditorStore.getState().removeGlobalVariable('v1');

      expect(useScreenEditorStore.getState().history.past).toHaveLength(1);
      expect(useScreenEditorStore.getState().isDirty).toBe(true);
    });

    it('找不到 id 时为空操作（不入栈、不置脏）', () => {
      const v1 = makeStaticVariable('v1', 'a', '1');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      useScreenEditorStore.getState().removeGlobalVariable('nonexistent');

      expect(useScreenEditorStore.getState().history.past).toHaveLength(0);
      expect(useScreenEditorStore.getState().isDirty).toBe(false);
      expect(useScreenEditorStore.getState().project?.globalVariables).toHaveLength(1);
    });
  });

  describe('undo/redo 同步恢复 globalVariables', () => {
    it('undo 恢复被删除的变量', () => {
      const v1 = makeStaticVariable('v1', 'a', '1');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      useScreenEditorStore.getState().removeGlobalVariable('v1');
      expect(useScreenEditorStore.getState().project?.globalVariables).toHaveLength(0);

      useScreenEditorStore.getState().undo();
      expect(useScreenEditorStore.getState().project?.globalVariables).toEqual([v1]);
    });

    it('redo 重新应用删除', () => {
      const v1 = makeStaticVariable('v1', 'a', '1');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      useScreenEditorStore.getState().removeGlobalVariable('v1');
      useScreenEditorStore.getState().undo();
      useScreenEditorStore.getState().redo();

      expect(useScreenEditorStore.getState().project?.globalVariables).toHaveLength(0);
    });

    it('undo 恢复被修改的变量值', () => {
      const v1 = makeStaticVariable('v1', 'apiBaseUrl', 'https://old.com');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      useScreenEditorStore.getState().updateGlobalVariable('v1', {
        value: 'https://new.com',
      });
      useScreenEditorStore.getState().undo();

      expect(useScreenEditorStore.getState().project?.globalVariables?.[0].value).toBe(
        'https://old.com',
      );
    });
  });

  describe('旧快照兼容（无 globalVariables 字段）', () => {
    it('旧快照（无 globalVariables 字段）undo 后 project.globalVariables 恢复为 []', () => {
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', []));
      useScreenEditorStore.getState().addGlobalVariable({ name: 'v1', type: 'static' });

      // 手动注入旧格式快照（无 globalVariables 字段）
      const oldSnapshot = {
        components: [],
        canvas: makeMockCanvas(),
        // 没有 globalVariables 字段
      };
      useScreenEditorStore.setState({
        history: { past: [oldSnapshot], future: [] },
      });

      useScreenEditorStore.getState().undo();
      // 旧快照无 globalVariables → 按 [] 恢复（与 schema default 一致）
      expect(useScreenEditorStore.getState().project?.globalVariables).toEqual([]);
    });
  });

  describe('与组件/画布编辑共享同一时间线', () => {
    it('undo 组件操作不会误回退 globalVariables', () => {
      const v1 = makeStaticVariable('v1', 'a', '1');
      useScreenEditorStore.getState().loadProject(makeProject('proj-1', [v1]));

      // 添加组件 → pushHistory 推入 (空组件 + [v1])
      useScreenEditorStore.getState().addComponent(makeMockComponent('comp-1'));

      // 修改 globalVariables → pushHistory 推入 (1 组件 + [v1])
      useScreenEditorStore.getState().updateGlobalVariable('v1', { value: '2' });

      // undo 变量修改：globalVariables 回退到 [v1]，组件保持 1 个
      useScreenEditorStore.getState().undo();
      const state1 = useScreenEditorStore.getState();
      expect(state1.project?.globalVariables?.[0].value).toBe('1');
      expect(state1.project?.components).toHaveLength(1);
    });
  });
});

// Spec: introduce-canvas-interaction-modes
describe('画布交互模式（interactionMode）', () => {
  function makeProject(id: string): ScreenProject {
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
      updatedAt: '2024-01-01 00:00:00',
    } as unknown as ScreenProject;
  }

  beforeEach(() => {
    localStorage.clear();
    useScreenEditorStore.getState().loadProject(makeProject('mode-test'));
  });

  it('默认模式为 design', () => {
    expect(useScreenEditorStore.getState().interactionMode).toBe('design');
  });

  it('setInteractionMode 切换到 interactive', () => {
    useScreenEditorStore.getState().setInteractionMode('interactive');
    expect(useScreenEditorStore.getState().interactionMode).toBe('interactive');
  });

  it('setInteractionMode 切换回 design', () => {
    useScreenEditorStore.getState().setInteractionMode('interactive');
    useScreenEditorStore.getState().setInteractionMode('design');
    expect(useScreenEditorStore.getState().interactionMode).toBe('design');
  });

  it('setInteractionMode 持久化到 localStorage', () => {
    useScreenEditorStore.getState().setInteractionMode('interactive');
    const raw = localStorage.getItem('nebula:screen-sdk:v1:preferences');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    expect(parsed.interactionMode).toBe('interactive');
  });

  it('loadProject 重置 interactionMode 到 design', () => {
    useScreenEditorStore.getState().setInteractionMode('interactive');
    expect(useScreenEditorStore.getState().interactionMode).toBe('interactive');

    useScreenEditorStore.getState().loadProject(makeProject('new-project'));
    expect(useScreenEditorStore.getState().interactionMode).toBe('design');
  });

  it('相同模式重复调用 setInteractionMode 为 no-op（不写入 localStorage）', () => {
    useScreenEditorStore.getState().setInteractionMode('design');
    const rawBefore = localStorage.getItem('nebula:screen-sdk:v1:preferences');
    useScreenEditorStore.getState().setInteractionMode('design');
    const rawAfter = localStorage.getItem('nebula:screen-sdk:v1:preferences');
    expect(rawAfter).toBe(rawBefore);
  });

  it('Store 不再公开 eventsEnabled / toggleEvents', () => {
    const state = useScreenEditorStore.getState();
    expect(state).not.toHaveProperty('eventsEnabled');
    expect(state).not.toHaveProperty('toggleEvents');
  });
});
