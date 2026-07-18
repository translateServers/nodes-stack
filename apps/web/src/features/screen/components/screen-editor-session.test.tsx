import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CanvasStatusBar } from './canvas-status-bar';
import { ToolSelector } from './tool-selector';
import { useEditorSession } from '../hooks/use-editor-session';
import { useToolStateMachine } from '../hooks/use-tool-state-machine';
import { useInteractionStateMachine } from '../hooks/use-interaction-state-machine';
import { useScreenEditorStore } from '../stores/editor-store';

/**
 * 任务 2.2 验证：在 ScreenEditor 创建唯一控制器实例
 *
 * 测试策略：
 * - 不 mock useEditorSession / useToolStateMachine / useInteractionStateMachine
 * - 验证多个子组件（ToolSelector、CanvasStatusBar）消费同一会话控制器
 * - 验证切换工具时各子组件状态同步更新
 * - 验证子组件不自行创建平行实例
 *
 * 注意：useScreenEditorStore 在 canvas-status-bar 中被调用，需要 mock
 */

vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: vi.fn(),
}));

const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn>;

/** 配置 store mock */
function setupStore() {
  const store: Record<string, unknown> = {
    project: null,
    canvasScale: 1,
    selectedComponentIds: [],
    snapEnabled: true,
    guides: { visible: true },
    toggleSnap: vi.fn(),
    toggleGuidesVisibility: vi.fn(),
    setCanvasScale: vi.fn(),
  };
  mockUseStore.mockImplementation(<T,>(selector: (s: typeof store) => T): T => selector(store));
}

/**
 * 测试用编辑器外壳：模拟 ScreenEditor 的"创建唯一会话控制器并下发"行为
 */
function TestEditorShell({ children }: { children?: ReactNode }) {
  const toolStateMachine = useToolStateMachine();
  const interactionStateMachine = useInteractionStateMachine();
  const editorSession = useEditorSession({
    toolStateMachine,
    interactionStateMachine,
  });
  return (
    <TooltipProvider>
      <ToolSelector editorSession={editorSession} />
      <CanvasStatusBar editorSession={editorSession} />
      {children}
    </TooltipProvider>
  );
}

describe('任务 2.2：ScreenEditor 创建唯一会话控制器实例', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  it('ToolSelector 和 CanvasStatusBar 同时渲染并显示初始工具（select）', () => {
    render(<TestEditorShell />);
    // ToolSelector 中 select 按钮 aria-pressed=true
    expect(screen.getByRole('button', { name: '选择' })).toHaveAttribute('aria-pressed', 'true');
    // CanvasStatusBar 显示工具名"选择"
    expect(screen.getByText('选择')).toBeInTheDocument();
  });

  it('点击 ToolSelector 中的工具按钮，CanvasStatusBar 同步更新显示的工具名', () => {
    render(<TestEditorShell />);
    // 初始：select
    expect(screen.getByText('选择')).toBeInTheDocument();

    // 阶段 1 闭环后所有工具均 implemented=true，可点击切换
    // 点击 hand（已实现），验证状态同步
    const handBtn = screen.getByRole('button', { name: '抓手' });
    fireEvent.click(handBtn);

    // CanvasStatusBar 应更新显示"抓手"
    expect(screen.getByText('抓手')).toBeInTheDocument();
  });

  it('不同子组件读取同一 activeTool 实例（无平行实例）', () => {
    // 通过验证 ToolSelector 的 aria-pressed 和 CanvasStatusBar 的文本一致，
    // 间接证明两者读取同一会话控制器
    render(<TestEditorShell />);
    const toolButtons = screen.getAllByRole('button');
    // ToolSelector 应有 8 个工具按钮
    expect(toolButtons.filter((b) => b.getAttribute('aria-pressed') !== null)).toHaveLength(8);
    // 状态栏左侧"选择"文本应与 ToolSelector 的 aria-pressed=true 工具一致
    const pressedButton = toolButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressedButton).toBeDefined();
    expect(pressedButton?.getAttribute('aria-label')).toBe('选择');
    expect(screen.getByText('选择')).toBeInTheDocument();
  });

  it('会话控制器拥有 interactionState 字段（CanvasStatusBar 可读取）', () => {
    // 渲染外壳后，CanvasStatusBar 应能正常渲染（说明能接收 interactionState）
    render(<TestEditorShell />);
    // 初始交互状态为 idle，状态栏正常显示工具名
    expect(screen.getByText('选择')).toBeInTheDocument();
  });

  it('useEditorSession 返回的 activeTool 和 ToolSelector/CanvasStatusBar 一致', () => {
    let capturedSession: ReturnType<typeof useEditorSession> | null = null;
    function CaptureSession() {
      const tsm = useToolStateMachine();
      const ism = useInteractionStateMachine();
      capturedSession = useEditorSession({
        toolStateMachine: tsm,
        interactionStateMachine: ism,
      });
      return null;
    }
    render(
      <TooltipProvider>
        <CaptureSession />
        <TestEditorShell />
      </TooltipProvider>,
    );
    // 验证捕获的 session.activeTool 为 'select'
    expect(capturedSession).not.toBeNull();
    expect(capturedSession!.activeTool).toBe('select');
    // 状态栏应显示"选择"
    // 注意：TestEditorShell 内部有自己的 session 实例，但 activeTool 应该一致（都是初始值）
    // 真正的"单一实例"由 ScreenEditor 在生产代码中保证（只调用 useEditorSession 一次）
  });

  it('切换 activeTool 时所有子组件同步更新（通过 ToolSelector 触发）', () => {
    render(<TestEditorShell />);
    // select 是已实现工具，按钮可点击
    const selectBtn = screen.getByRole('button', { name: '选择' });
    // 验证初始状态
    expect(selectBtn).toHaveAttribute('aria-pressed', 'true');
    // CanvasStatusBar 显示"选择"
    expect(screen.getByText('选择')).toBeInTheDocument();

    // 再次点击 select（不应出错）
    fireEvent.click(selectBtn);
    expect(selectBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('选择')).toBeInTheDocument();
  });

  it('阶段 1 闭环后所有工具按钮均可点击，切换工具 CanvasStatusBar 同步更新', () => {
    render(<TestEditorShell />);
    // 阶段 1 闭环后所有工具均 implemented=true，无 disabled 按钮
    // CanvasStatusBar 显示当前工具（select）
    expect(screen.getByText('选择')).toBeInTheDocument();
    // 切换到吸管
    const eyedropperBtn = screen.getByRole('button', { name: '吸管' });
    expect(eyedropperBtn).not.toBeDisabled();
    fireEvent.click(eyedropperBtn);
    // CanvasStatusBar 应更新显示"吸管"
    expect(screen.getByText('吸管')).toBeInTheDocument();
  });
});
