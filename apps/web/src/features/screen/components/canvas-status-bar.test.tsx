import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { CanvasStatusBar } from './canvas-status-bar';
import { useScreenEditorStore } from '../stores/editor-store';
import type { EditorSessionApi } from '../hooks/use-editor-session';
import type { EditorTool } from '../hooks/tool-registry';
import { TOOL_REGISTRY, getToolById } from '../hooks/tool-registry';

/**
 * 任务 1.2 验证：状态栏接入统一工具注册表
 *
 * 测试策略：
 * - 不 mock tool-registry，验证状态栏真实消费 TOOL_REGISTRY 元数据
 * - mock useScreenEditorStore 提供受控状态
 * - 通过 ToolStateMachineApi.activeTool 切换工具，验证名称/图标来自注册表
 */

vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: vi.fn(),
}));

const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn>;

function makeProject(overrides: Partial<ScreenProject> = {}): ScreenProject {
  return {
    id: 'p1',
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
    updatedAt: '2025-06-01 10:00:00',
    ...overrides,
  };
}

function makeComponent(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'c1',
    type: 'shape',
    name: '矩形 1',
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 0,
    ...overrides,
  };
}

function makeEditorSession(
  activeTool: EditorTool,
  overrides: Partial<Pick<EditorSessionApi, 'interactionState'>> = {},
): Pick<EditorSessionApi, 'activeTool' | 'interactionState'> {
  return {
    activeTool,
    interactionState: overrides.interactionState ?? 'idle',
  };
}

/** 配置 store mock：每次 useScreenEditorStore(selector) 调用都按 selector 返回受控数据 */
function setupStore(
  overrides: {
    project?: ScreenProject | null;
    canvasScale?: number;
    selectedComponentIds?: string[];
    snapEnabled?: boolean;
    guidesVisible?: boolean;
  } = {},
): {
  toggleSnap: ReturnType<typeof vi.fn>;
  toggleGuidesVisibility: ReturnType<typeof vi.fn>;
  setCanvasScale: ReturnType<typeof vi.fn>;
} {
  const project = overrides.project === undefined ? makeProject() : overrides.project;
  const canvasScale = overrides.canvasScale ?? 1;
  const selectedComponentIds = overrides.selectedComponentIds ?? [];
  const snapEnabled = overrides.snapEnabled ?? true;
  const guidesVisible = overrides.guidesVisible ?? true;

  const toggleSnap = vi.fn();
  const toggleGuidesVisibility = vi.fn();
  const setCanvasScale = vi.fn();

  const store: Record<string, unknown> = {
    project,
    canvasScale,
    selectedComponentIds,
    snapEnabled,
    guides: { visible: guidesVisible },
    toggleSnap,
    toggleGuidesVisibility,
    setCanvasScale,
  };

  mockUseStore.mockImplementation(<T,>(selector: (s: typeof store) => T): T => selector(store));

  return { toggleSnap, toggleGuidesVisibility, setCanvasScale };
}

describe('CanvasStatusBar 任务 1.2：接入统一工具注册表', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
  });

  it('活动工具的名称来自 TOOL_REGISTRY（不维护独立映射）', () => {
    setupStore();
    // 验证状态栏消费的是注册表里的 name
    const expected = getToolById('select')!.name;
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('切换 activeTool 时显示对应工具名称', () => {
    setupStore();
    const { rerender } = render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    expect(screen.getByText(getToolById('select')!.name)).toBeInTheDocument();

    rerender(<CanvasStatusBar editorSession={makeEditorSession('hand')} />);
    expect(screen.getByText(getToolById('hand')!.name)).toBeInTheDocument();

    rerender(<CanvasStatusBar editorSession={makeEditorSession('zoom')} />);
    expect(screen.getByText(getToolById('zoom')!.name)).toBeInTheDocument();
  });

  it('每个 TOOL_REGISTRY 工具切换都能正确显示名称', () => {
    setupStore();
    for (const tool of TOOL_REGISTRY) {
      const { unmount } = render(<CanvasStatusBar editorSession={makeEditorSession(tool.id)} />);
      expect(screen.getByText(tool.name)).toBeInTheDocument();
      unmount();
    }
  });

  it('选中单个组件时显示组件名', () => {
    const comp = makeComponent({ name: '柱状图 A' });
    setupStore({
      project: makeProject({ components: [comp] }),
      selectedComponentIds: [comp.id],
    });
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    expect(screen.getByText('柱状图 A')).toBeInTheDocument();
  });

  it('选中多个组件时显示数量', () => {
    const c1 = makeComponent({ id: 'c1', name: 'A' });
    const c2 = makeComponent({ id: 'c2', name: 'B' });
    setupStore({
      project: makeProject({ components: [c1, c2] }),
      selectedComponentIds: [c1.id, c2.id],
    });
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    expect(screen.getByText(/已选中 2 个组件/)).toBeInTheDocument();
  });

  it('未选中时显示未选中', () => {
    setupStore({ selectedComponentIds: [] });
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    expect(screen.getByText('未选中')).toBeInTheDocument();
  });

  it('显示画布尺寸', () => {
    setupStore({
      project: makeProject({
        canvas: { width: 3840, height: 2160, backgroundColor: '#000', scaleMode: 'fit' },
      }),
    });
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    expect(screen.getByText('3840 × 2160')).toBeInTheDocument();
  });

  it('显示当前缩放百分比', () => {
    setupStore({ canvasScale: 0.5 });
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('点击 Snap 开关调用 toggleSnap', () => {
    const { toggleSnap } = setupStore();
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    const snapBtn = screen.getByRole('switch', { name: /Snap/ });
    fireEvent.click(snapBtn);
    expect(toggleSnap).toHaveBeenCalledOnce();
  });

  it('点击 Guide 开关调用 toggleGuidesVisibility', () => {
    const { toggleGuidesVisibility } = setupStore();
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    const guideBtn = screen.getByRole('switch', { name: /Guide/ });
    fireEvent.click(guideBtn);
    expect(toggleGuidesVisibility).toHaveBeenCalledOnce();
  });

  it('缩放百分比按钮具有可访问名称（缩放）', () => {
    setupStore({ canvasScale: 1 });
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    const zoomBtn = screen.getByRole('button', { name: '缩放' });
    expect(zoomBtn).toBeInTheDocument();
    expect(zoomBtn).toHaveTextContent('100');
  });

  it('project 为 null 时不崩溃，使用默认画布尺寸', () => {
    setupStore({ project: null });
    render(<CanvasStatusBar editorSession={makeEditorSession('select')} />);
    // 默认 1920 × 1080
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
  });
});
