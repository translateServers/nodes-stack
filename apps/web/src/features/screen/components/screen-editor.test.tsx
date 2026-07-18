import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BizCode, BusinessError, type ScreenComponent, type ScreenProject } from '@nebula/shared';

/**
 * ScreenEditor 集成测试：保存冲突对话框接入（任务 9.3）
 *
 * 测试策略：
 * - 通过 vi.mock 替换 router hooks、screen data hooks、重型子组件和工具 hooks，
 *   使 ScreenEditor 渲染受控数据。
 * - 保留真实的 useScreenEditorStore 与 SaveConflictDialog，验证冲突时对话框打开
 *   且本地 Store 数据未被覆盖。
 * - useUpdateScreenProject 的 mutate 被 mock 为捕获 callbacks 的 vi.fn，
 *   测试通过手动调用 onError 模拟冲突/普通错误。
 */

vi.mock('@tanstack/react-router', () => ({
  useParams: vi.fn(() => ({ id: 'screen-1' })),
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../hooks', () => ({
  useScreenProject: vi.fn(),
  useUpdateScreenProject: vi.fn(),
  usePublishScreenProject: vi.fn(),
}));

vi.mock('./screen-canvas', () => ({
  ScreenCanvas: () => <div data-testid="screen-canvas" />,
}));

vi.mock('../components/component-library', () => ({
  ComponentLibrary: () => <div data-testid="component-library" />,
  useCanvasDrop: () => ({ handleDrop: vi.fn(), handleDragOver: vi.fn() }),
}));

vi.mock('../components/property-panel', () => ({
  PropertyPanel: () => <div data-testid="property-panel" />,
}));

vi.mock('../components/layer-panel', () => ({
  LayerPanel: () => <div data-testid="layer-panel" />,
}));

vi.mock('../components/canvas-context-menu', () => ({
  CanvasContextMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/canvas-rulers', () => ({
  CanvasRulers: () => null,
}));

vi.mock('./canvas-guides', () => ({
  CanvasGuides: () => null,
}));

vi.mock('./canvas-status-bar', () => ({
  CanvasStatusBar: () => null,
}));

vi.mock('../hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../hooks/use-tool-state-machine', () => ({
  useToolStateMachine: vi.fn(() => ({
    activeTool: 'select' as const,
    currentTool: 'select' as const,
    hasTemporaryTool: false,
    setTool: vi.fn(),
    pushTemporaryTool: vi.fn(),
    popTemporaryTool: vi.fn(),
    isEditingText: false,
    setEditingText: vi.fn(),
  })),
}));

vi.mock('./shortcuts-help-dialog', () => ({
  ShortcutsHelpDialog: () => null,
}));

vi.mock('./project-menubar', () => ({
  ProjectMenubar: () => null,
}));

vi.mock('./canvas-settings-dialog', () => ({
  CanvasSettingsDialog: () => null,
}));

vi.mock('./import-dialog', () => ({
  ImportDialog: () => null,
}));

vi.mock('./snapshot-manager-dialog', () => ({
  SnapshotManagerDialog: () => null,
}));

vi.mock('./event-blueprint-sheet', () => ({
  EventBlueprintSheet: () => null,
}));

vi.mock('./code-editor-sheet', () => ({
  CodeEditorSheet: () => null,
}));

import { useParams } from '@tanstack/react-router';
import { useScreenProject, useUpdateScreenProject, usePublishScreenProject } from '../hooks';
import { ScreenEditor } from './screen-editor';
import { useScreenEditorStore } from '../stores/editor-store';
import { toast } from 'sonner';

const mockUseParams = useParams as unknown as ReturnType<typeof vi.fn>;
const mockUseScreenProject = useScreenProject as unknown as ReturnType<typeof vi.fn>;
const mockUseUpdateScreenProject = useUpdateScreenProject as unknown as ReturnType<typeof vi.fn>;
const mockUsePublishScreenProject = usePublishScreenProject as unknown as ReturnType<typeof vi.fn>;

const BASELINE_UPDATED_AT = '2025-06-01 10:30:45';

/** 构造最小可用 ScreenProject */
function makeProject(overrides: Partial<ScreenProject> = {}): ScreenProject {
  return {
    id: 'screen-1',
    name: '测试大屏',
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
    createdAt: '2025-06-01 10:00:00',
    updatedAt: BASELINE_UPDATED_AT,
    ...overrides,
  };
}

/** 构造最小可用 ScreenComponent */
function makeComponent(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'comp-local',
    type: 'shape',
    name: '本地组件',
    position: { x: 10, y: 20, width: 100, height: 50 },
    style: {},
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 0,
    ...overrides,
  };
}

/** 捕获 updateMutation.mutate 的回调，测试通过手动调用模拟成功/冲突/普通错误 */
type MutateCallbacks = {
  onSuccess?: (data: ScreenProject) => void;
  onError?: (error: unknown) => void;
};
let capturedCallbacks: MutateCallbacks = {};

describe('ScreenEditor 保存冲突对话框接入（任务 9.3）', () => {
  beforeEach(() => {
    mockUseParams.mockReset();
    mockUseScreenProject.mockReset();
    mockUseUpdateScreenProject.mockReset();
    mockUsePublishScreenProject.mockReset();
    capturedCallbacks = {};

    const project = makeProject();
    mockUseParams.mockReturnValue({ id: 'screen-1' });
    mockUseScreenProject.mockReturnValue({ data: project, isLoading: false });

    const mockMutate = vi.fn((_params: unknown, callbacks?: MutateCallbacks) => {
      capturedCallbacks = callbacks ?? {};
    });
    mockUseUpdateScreenProject.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUsePublishScreenProject.mockReturnValue({ mutate: vi.fn(), isPending: false });

    // 重置 Store 到初始基线
    useScreenEditorStore.getState().loadProject(project);
  });

  it('保存冲突时打开对话框', () => {
    render(<ScreenEditor />);

    // 初始状态：对话框未显示
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // 点击保存按钮触发 handleSave → updateMutation.mutate
    fireEvent.click(screen.getByText('保存'));

    // mutate 已被调用，callbacks 已捕获
    expect(capturedCallbacks.onError).toBeDefined();

    // 模拟服务端返回保存冲突
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });

    // 冲突对话框已打开
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('保存冲突')).toBeInTheDocument();
    expect(
      screen.getByText('项目已在其他窗口或会话中被修改。重新加载将放弃当前未保存内容。'),
    ).toBeInTheDocument();
  });

  it('冲突时本地组件数据未被响应错误覆盖', () => {
    render(<ScreenEditor />);

    // 加载后 Store 有 0 个组件
    expect(useScreenEditorStore.getState().project?.components).toHaveLength(0);

    // 模拟用户在本地添加一个组件（产生未保存修改）
    const localComponent = makeComponent({ id: 'comp-local', name: '本地未保存组件' });
    act(() => {
      useScreenEditorStore.getState().addComponent(localComponent);
    });

    // Store 现在有 1 个组件，且 isDirty=true
    expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
    expect(useScreenEditorStore.getState().project?.components[0]?.name).toBe('本地未保存组件');
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    // 记录基线 updatedAt（应在冲突后保持不变）
    const baselineUpdatedAt = useScreenEditorStore.getState().project?.updatedAt;

    // 点击保存触发 mutate
    fireEvent.click(screen.getByText('保存'));
    expect(capturedCallbacks.onError).toBeDefined();

    // 模拟保存冲突
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });

    // 关键断言：本地组件数据未被覆盖
    // 1. 组件数量仍为 1（未被清空或重置为加载时的 0）
    expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
    // 2. 组件名称仍为本地修改后的值
    expect(useScreenEditorStore.getState().project?.components[0]?.name).toBe('本地未保存组件');
    // 3. 基线 updatedAt 未被覆盖（loadProject 未被调用）
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe(baselineUpdatedAt);
    // 4. isDirty 仍为 true（本地修改未丢失）
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    // 冲突对话框已打开
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('普通保存错误不显示冲突对话框', () => {
    render(<ScreenEditor />);

    // 初始状态：对话框未显示
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // 点击保存按钮触发 handleSave → updateMutation.mutate
    fireEvent.click(screen.getByText('保存'));
    expect(capturedCallbacks.onError).toBeDefined();

    // 模拟服务端返回普通错误（非 SCREEN_SAVE_CONFLICT）
    act(() => {
      capturedCallbacks.onError?.(new BusinessError(BizCode.INTERNAL_ERROR, '服务器内部错误'));
    });

    // 关键断言：冲突对话框未打开
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('保存冲突')).not.toBeInTheDocument();
  });
});

describe('ScreenEditor 取消冲突处理（任务 9.5）', () => {
  let mockMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseParams.mockReset();
    mockUseScreenProject.mockReset();
    mockUseUpdateScreenProject.mockReset();
    mockUsePublishScreenProject.mockReset();
    capturedCallbacks = {};

    const project = makeProject();
    mockUseParams.mockReturnValue({ id: 'screen-1' });
    mockUseScreenProject.mockReturnValue({ data: project, isLoading: false });

    mockMutate = vi.fn((_params: unknown, callbacks?: MutateCallbacks) => {
      capturedCallbacks = callbacks ?? {};
    });
    mockUseUpdateScreenProject.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUsePublishScreenProject.mockReturnValue({ mutate: vi.fn(), isPending: false });

    // 重置 Store 到初始基线
    useScreenEditorStore.getState().loadProject(project);
  });

  it('取消冲突后对话框关闭', () => {
    render(<ScreenEditor />);

    // 触发保存并模拟冲突
    fireEvent.click(screen.getByText('保存'));
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });

    // 对话框已打开
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // 点击"继续编辑"按钮（onCancel）：仅关闭对话框，不触发任何数据操作
    fireEvent.click(screen.getByText('继续编辑'));

    // 关键断言：对话框已关闭
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('取消后本地内容保持不变', () => {
    render(<ScreenEditor />);

    // 模拟用户在本地添加一个组件（产生未保存修改）
    const localComponent = makeComponent({ id: 'comp-local', name: '本地未保存组件' });
    act(() => {
      useScreenEditorStore.getState().addComponent(localComponent);
    });

    // 记录基线 updatedAt（应在取消后保持不变）
    const baselineUpdatedAt = useScreenEditorStore.getState().project?.updatedAt;

    // 触发保存并模拟冲突
    fireEvent.click(screen.getByText('保存'));
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });

    // 点击"继续编辑"取消冲突
    fireEvent.click(screen.getByText('继续编辑'));

    // 关键断言：本地 Store/历史/基线均未被修改
    // 1. 组件数量仍为 1
    expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
    // 2. 组件名称仍为本地修改后的值
    expect(useScreenEditorStore.getState().project?.components[0]?.name).toBe('本地未保存组件');
    // 3. 基线 updatedAt 未被覆盖
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe(baselineUpdatedAt);
    // 4. isDirty 仍为 true（本地修改未丢失）
    expect(useScreenEditorStore.getState().isDirty).toBe(true);
  });

  it('取消后再次保存仍使用旧基线并可再次触发冲突', () => {
    render(<ScreenEditor />);

    // 模拟用户在本地添加一个组件（产生未保存修改）
    const localComponent = makeComponent({ id: 'comp-local', name: '本地未保存组件' });
    act(() => {
      useScreenEditorStore.getState().addComponent(localComponent);
    });

    const baselineUpdatedAt = useScreenEditorStore.getState().project?.updatedAt;
    expect(baselineUpdatedAt).toBe(BASELINE_UPDATED_AT);

    // 第一次保存触发冲突
    fireEvent.click(screen.getByText('保存'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    const firstCallParams = mockMutate.mock.calls[0]?.[0] as {
      params: { expectedUpdatedAt: string };
    };
    expect(firstCallParams.params.expectedUpdatedAt).toBe(baselineUpdatedAt);

    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });

    // 点击"继续编辑"取消冲突
    fireEvent.click(screen.getByText('继续编辑'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // 第二次保存：基线仍应为旧值（取消不更新基线）
    fireEvent.click(screen.getByText('保存'));
    expect(mockMutate).toHaveBeenCalledTimes(2);
    const secondCallParams = mockMutate.mock.calls[1]?.[0] as {
      params: { expectedUpdatedAt: string };
    };
    expect(secondCallParams.params.expectedUpdatedAt).toBe(baselineUpdatedAt);

    // 再次模拟冲突，对话框应再次打开（旧基线仍可触发冲突）
    expect(capturedCallbacks.onError).toBeDefined();
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('ScreenEditor 发布冲突复用对话框（任务 9.4）', () => {
  let mockPublishMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseParams.mockReset();
    mockUseScreenProject.mockReset();
    mockUseUpdateScreenProject.mockReset();
    mockUsePublishScreenProject.mockReset();
    capturedCallbacks = {};

    const project = makeProject();
    mockUseParams.mockReturnValue({ id: 'screen-1' });
    mockUseScreenProject.mockReturnValue({ data: project, isLoading: false });

    mockUseUpdateScreenProject.mockReturnValue({ mutate: vi.fn(), isPending: false });
    // publish mutate 捕获 callbacks，测试通过手动调用 onError 模拟冲突/普通错误
    mockPublishMutate = vi.fn((_params: unknown, callbacks?: MutateCallbacks) => {
      capturedCallbacks = callbacks ?? {};
    });
    mockUsePublishScreenProject.mockReturnValue({ mutate: mockPublishMutate, isPending: false });

    // 重置 Store 到初始基线（status: 'draft'）
    useScreenEditorStore.getState().loadProject(project);
  });

  it('发布冲突时打开对话框', () => {
    render(<ScreenEditor />);

    // 初始状态：对话框未显示
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // 点击发布按钮触发 handlePublish → publishMutation.mutate
    fireEvent.click(screen.getByText('发布'));

    // mutate 已被调用，callbacks 已捕获
    expect(capturedCallbacks.onError).toBeDefined();

    // 模拟服务端返回发布冲突（与保存冲突同业务码）
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再发布'),
      );
    });

    // 冲突对话框已打开（复用保存冲突对话框）
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('保存冲突')).toBeInTheDocument();
    expect(
      screen.getByText('项目已在其他窗口或会话中被修改。重新加载将放弃当前未保存内容。'),
    ).toBeInTheDocument();
  });

  it('发布冲突时不显示成功状态', () => {
    render(<ScreenEditor />);

    // 加载后 Store 状态为 draft，基线 updatedAt 为 BASELINE_UPDATED_AT
    expect(useScreenEditorStore.getState().project?.status).toBe('draft');
    const baselineUpdatedAt = useScreenEditorStore.getState().project?.updatedAt;
    expect(baselineUpdatedAt).toBe(BASELINE_UPDATED_AT);

    // 点击发布触发 mutate
    fireEvent.click(screen.getByText('发布'));
    expect(capturedCallbacks.onError).toBeDefined();

    // 模拟发布冲突
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再发布'),
      );
    });

    // 关键断言：未显示成功状态
    // 1. Store 状态未变为 published（仍为 draft）
    expect(useScreenEditorStore.getState().project?.status).toBe('draft');
    // 2. 基线 updatedAt 未被覆盖（loadProject 未被调用）
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe(baselineUpdatedAt);
    // 3. 冲突对话框已打开（不是成功状态，而是冲突状态）
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('发布冲突后公开预览缓存不被当作发布成功处理', () => {
    render(<ScreenEditor />);

    // 加载后 Store 状态为 draft，基线 updatedAt 为 BASELINE_UPDATED_AT
    expect(useScreenEditorStore.getState().project?.status).toBe('draft');
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe(BASELINE_UPDATED_AT);

    // 点击发布触发 mutate
    fireEvent.click(screen.getByText('发布'));
    expect(mockPublishMutate).toHaveBeenCalledTimes(1);
    // 发布请求参数包含 expectedUpdatedAt（基线）
    const callParams = mockPublishMutate.mock.calls[0]?.[0] as {
      id: string;
      expectedUpdatedAt: string;
    };
    expect(callParams.id).toBe('screen-1');
    expect(callParams.expectedUpdatedAt).toBe(BASELINE_UPDATED_AT);

    // 模拟发布冲突
    expect(capturedCallbacks.onError).toBeDefined();
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再发布'),
      );
    });

    // 关键断言：公开预览缓存不被当作发布成功处理
    // 1. Store 的 status 未变为 published（仍是 draft），意味着公开预览查询条件
    //    `id + published` 不会命中当前 Store 内容
    expect(useScreenEditorStore.getState().project?.status).toBe('draft');
    // 2. 基线 updatedAt 未被覆盖（loadProject 未被调用），下次发布仍使用旧基线
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe(BASELINE_UPDATED_AT);
    // 3. 冲突对话框已打开，未进入发布成功流程
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('普通发布错误不显示冲突对话框', () => {
    render(<ScreenEditor />);

    // 初始状态：对话框未显示
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // 点击发布按钮触发 handlePublish → publishMutation.mutate
    fireEvent.click(screen.getByText('发布'));
    expect(capturedCallbacks.onError).toBeDefined();

    // 模拟服务端返回普通错误（非 SCREEN_SAVE_CONFLICT）
    act(() => {
      capturedCallbacks.onError?.(new BusinessError(BizCode.INTERNAL_ERROR, '服务器内部错误'));
    });

    // 关键断言：冲突对话框未打开（由全局错误拦截器处理 Toast）
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('保存冲突')).not.toBeInTheDocument();
  });
});

describe('ScreenEditor 重新加载服务端版本（任务 9.6）', () => {
  let mockRefetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseParams.mockReset();
    mockUseScreenProject.mockReset();
    mockUseUpdateScreenProject.mockReset();
    mockUsePublishScreenProject.mockReset();
    capturedCallbacks = {};

    const project = makeProject();
    mockUseParams.mockReturnValue({ id: 'screen-1' });
    mockRefetch = vi.fn();
    mockUseScreenProject.mockReturnValue({
      data: project,
      isLoading: false,
      refetch: mockRefetch,
    });

    const mockMutate = vi.fn((_params: unknown, callbacks?: MutateCallbacks) => {
      capturedCallbacks = callbacks ?? {};
    });
    mockUseUpdateScreenProject.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUsePublishScreenProject.mockReturnValue({ mutate: vi.fn(), isPending: false });

    // 重置 Store 到初始基线
    useScreenEditorStore.getState().loadProject(project);
  });

  /** 触发保存冲突并打开对话框 */
  function triggerConflict() {
    fireEvent.click(screen.getByText('保存'));
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });
  }

  it('点击"重新加载"后获取服务端项目', async () => {
    const serverProject = makeProject({
      updatedAt: '2025-06-02 12:00:00',
      components: [makeComponent({ id: 'comp-server', name: '服务端组件' })],
    });
    mockRefetch.mockResolvedValue({ data: serverProject });

    render(<ScreenEditor />);

    triggerConflict();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // 点击"重新加载"
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：refetch 被调用一次以获取服务端最新项目
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('重新加载后 Store 被替换为服务端版本', async () => {
    const serverProject = makeProject({
      name: '服务端最新名称',
      updatedAt: '2025-06-02 12:00:00',
      components: [makeComponent({ id: 'comp-server', name: '服务端组件' })],
    });
    mockRefetch.mockResolvedValue({ data: serverProject });

    render(<ScreenEditor />);

    // 模拟本地未保存修改：添加本地组件（与服务端组件不同）
    const localComponent = makeComponent({ id: 'comp-local', name: '本地未保存组件' });
    act(() => {
      useScreenEditorStore.getState().addComponent(localComponent);
    });
    expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
    expect(useScreenEditorStore.getState().project?.components[0]?.id).toBe('comp-local');

    triggerConflict();

    // 点击"重新加载"，放弃本地未保存修改
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：Store 整体替换为服务端版本（项目、基线、选中态、本地历史）
    const storeState = useScreenEditorStore.getState();
    expect(storeState.project?.updatedAt).toBe('2025-06-02 12:00:00');
    expect(storeState.project?.name).toBe('服务端最新名称');
    // 本地未保存组件被明确放弃，仅保留服务端组件
    expect(storeState.project?.components).toHaveLength(1);
    expect(storeState.project?.components[0]?.id).toBe('comp-server');
    expect(storeState.project?.components[0]?.name).toBe('服务端组件');
    // 选中态与本地历史被重置
    expect(storeState.selectedComponentIds).toHaveLength(0);
    expect(storeState.history.past).toHaveLength(0);
    expect(storeState.history.future).toHaveLength(0);
  });

  it('重新加载后对话框关闭', async () => {
    const serverProject = makeProject({
      updatedAt: '2025-06-02 12:00:00',
    });
    mockRefetch.mockResolvedValue({ data: serverProject });

    render(<ScreenEditor />);

    triggerConflict();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // 点击"重新加载"
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：对话框已关闭
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('重新加载后 isDirty=false', async () => {
    const serverProject = makeProject({
      updatedAt: '2025-06-02 12:00:00',
    });
    mockRefetch.mockResolvedValue({ data: serverProject });

    render(<ScreenEditor />);

    // 模拟本地修改使 isDirty=true
    act(() => {
      useScreenEditorStore.getState().addComponent(makeComponent({ id: 'comp-local' }));
    });
    expect(useScreenEditorStore.getState().isDirty).toBe(true);

    triggerConflict();

    // 点击"重新加载"
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：服务端版本成为新权威状态，isDirty 恢复为 false
    expect(useScreenEditorStore.getState().isDirty).toBe(false);
  });
});

describe('ScreenEditor 重新加载失败处理（任务 9.7）', () => {
  let mockRefetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseParams.mockReset();
    mockUseScreenProject.mockReset();
    mockUseUpdateScreenProject.mockReset();
    mockUsePublishScreenProject.mockReset();
    capturedCallbacks = {};

    const project = makeProject();
    mockUseParams.mockReturnValue({ id: 'screen-1' });
    mockRefetch = vi.fn();
    mockUseScreenProject.mockReturnValue({
      data: project,
      isLoading: false,
      refetch: mockRefetch,
    });

    const mockMutate = vi.fn((_params: unknown, callbacks?: MutateCallbacks) => {
      capturedCallbacks = callbacks ?? {};
    });
    mockUseUpdateScreenProject.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUsePublishScreenProject.mockReturnValue({ mutate: vi.fn(), isPending: false });

    // 重置 Store 到初始基线
    useScreenEditorStore.getState().loadProject(project);

    // 重置 toast.error 调用记录，避免用例间互相干扰
    vi.mocked(toast.error).mockClear();
  });

  /** 触发保存冲突并打开对话框 */
  function triggerConflict() {
    fireEvent.click(screen.getByText('保存'));
    act(() => {
      capturedCallbacks.onError?.(
        new BusinessError(BizCode.SCREEN_SAVE_CONFLICT, '项目已被其他会话修改，请重新加载后再保存'),
      );
    });
  }

  it('重新加载网络失败时仍保留本地内容', async () => {
    // refetch 抛出异常，模拟网络错误
    mockRefetch.mockRejectedValue(new Error('网络错误'));

    render(<ScreenEditor />);

    // 模拟用户在本地添加一个组件（产生未保存修改）
    const localComponent = makeComponent({ id: 'comp-local', name: '本地未保存组件' });
    act(() => {
      useScreenEditorStore.getState().addComponent(localComponent);
    });

    const baselineUpdatedAt = useScreenEditorStore.getState().project?.updatedAt;

    triggerConflict();

    // 点击"重新加载"，refetch 抛出异常
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：本地内容仍保留（失败时不调用 loadProject）
    // 1. 组件数量仍为 1（本地未保存组件未被清空）
    expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
    // 2. 组件名称仍为本地修改后的值
    expect(useScreenEditorStore.getState().project?.components[0]?.name).toBe('本地未保存组件');
    // 3. 基线 updatedAt 未被覆盖（loadProject 未被调用）
    expect(useScreenEditorStore.getState().project?.updatedAt).toBe(baselineUpdatedAt);
    // 4. isDirty 仍为 true（本地修改未丢失）
    expect(useScreenEditorStore.getState().isDirty).toBe(true);
    // 5. 显示错误提示
    expect(toast.error).toHaveBeenCalledWith('重新加载失败，请重试');
  });

  it('重新加载失败后 Store 未被清空或部分替换', async () => {
    // refetch 返回但 data 为空（undefined），模拟业务失败
    mockRefetch.mockResolvedValue({ data: undefined });

    render(<ScreenEditor />);

    // 模拟用户在本地添加一个组件（产生未保存修改）
    const localComponent = makeComponent({ id: 'comp-local', name: '本地未保存组件' });
    act(() => {
      useScreenEditorStore.getState().addComponent(localComponent);
    });

    // 记录 Store 关键状态，验证失败后未被任何方式清空或部分替换
    const baselineUpdatedAt = useScreenEditorStore.getState().project?.updatedAt;
    const baselineName = useScreenEditorStore.getState().project?.name;
    const baselineComponentsLength = useScreenEditorStore.getState().project?.components.length;
    const baselineSelectedIds = [...useScreenEditorStore.getState().selectedComponentIds];
    const baselineHistoryPastLength = useScreenEditorStore.getState().history.past.length;
    const baselineHistoryFutureLength = useScreenEditorStore.getState().history.future.length;

    triggerConflict();

    // 点击"重新加载"，refetch 返回空数据
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：Store 未被清空或部分替换
    const state = useScreenEditorStore.getState();
    expect(state.project?.updatedAt).toBe(baselineUpdatedAt);
    expect(state.project?.name).toBe(baselineName);
    expect(state.project?.components).toHaveLength(baselineComponentsLength ?? 0);
    expect(state.project?.components[0]?.id).toBe('comp-local');
    expect(state.project?.components[0]?.name).toBe('本地未保存组件');
    expect(state.selectedComponentIds).toEqual(baselineSelectedIds);
    expect(state.history.past).toHaveLength(baselineHistoryPastLength);
    expect(state.history.future).toHaveLength(baselineHistoryFutureLength);
    expect(state.isDirty).toBe(true);
    // 显示错误提示
    expect(toast.error).toHaveBeenCalledWith('重新加载失败，请重试');
  });

  it('重新加载失败后对话框保持打开', async () => {
    mockRefetch.mockRejectedValue(new Error('网络错误'));

    render(<ScreenEditor />);

    triggerConflict();
    // 对话框已打开
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // 点击"重新加载"，refetch 抛出异常
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：对话框保持打开（保持冲突恢复入口，用户可重试或取消）
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('保存冲突')).toBeInTheDocument();
    expect(
      screen.getByText('项目已在其他窗口或会话中被修改。重新加载将放弃当前未保存内容。'),
    ).toBeInTheDocument();
    // 两个操作按钮仍可访问（可重试或取消）
    expect(screen.getByText('重新加载')).toBeInTheDocument();
    expect(screen.getByText('继续编辑')).toBeInTheDocument();
  });

  it('重新加载失败后可重试', async () => {
    // 第一次失败（网络错误），第二次成功（返回服务端最新版本）
    const serverProject = makeProject({
      updatedAt: '2025-06-02 12:00:00',
      name: '服务端最新名称',
      components: [makeComponent({ id: 'comp-server', name: '服务端组件' })],
    });
    mockRefetch
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce({ data: serverProject });

    render(<ScreenEditor />);

    // 模拟用户在本地添加一个组件（产生未保存修改）
    const localComponent = makeComponent({ id: 'comp-local', name: '本地未保存组件' });
    act(() => {
      useScreenEditorStore.getState().addComponent(localComponent);
    });

    triggerConflict();

    // 第一次点击"重新加载" - 失败
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 失败后：对话框保持打开，本地内容仍在，可重试
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(useScreenEditorStore.getState().project?.components).toHaveLength(1);
    expect(useScreenEditorStore.getState().project?.components[0]?.id).toBe('comp-local');
    expect(useScreenEditorStore.getState().isDirty).toBe(true);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('重新加载失败，请重试');

    // 第二次点击"重新加载" - 成功
    await act(async () => {
      fireEvent.click(screen.getByText('重新加载'));
      await Promise.resolve();
    });

    // 关键断言：重试成功后 Store 被替换为服务端版本，对话框关闭
    expect(mockRefetch).toHaveBeenCalledTimes(2);
    const state = useScreenEditorStore.getState();
    expect(state.project?.updatedAt).toBe('2025-06-02 12:00:00');
    expect(state.project?.name).toBe('服务端最新名称');
    expect(state.project?.components).toHaveLength(1);
    expect(state.project?.components[0]?.id).toBe('comp-server');
    expect(state.project?.components[0]?.name).toBe('服务端组件');
    // 本地未保存组件被明确放弃
    expect(state.project?.components.find((c) => c.id === 'comp-local')).toBeUndefined();
    // isDirty 恢复为 false
    expect(state.isDirty).toBe(false);
    // 对话框已关闭
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
