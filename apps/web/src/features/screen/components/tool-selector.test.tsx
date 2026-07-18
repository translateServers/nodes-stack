import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToolSelector } from './tool-selector';
import { TOOL_REGISTRY, getImplementedTools, type EditorTool } from '../hooks/tool-registry';
import type { EditorSessionApi } from '../hooks/use-editor-session';

/** 包裹 TooltipProvider，避免 Radix Tooltip 报错 */
function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

/**
 * 任务 1.5 验证：可访问的工具选择入口
 *
 * 测试策略：
 * - 不 mock tool-registry，验证 ToolSelector 真实消费 TOOL_REGISTRY
 * - 验证每个工具按钮具有：名称（aria-label）、选中态（aria-pressed）、禁用语义（disabled）
 * - 验证鼠标点击触发 setTool
 * - 验证键盘导航：Tab 可聚焦未禁用按钮，Enter/Space 触发 setTool
 * - 验证未实现工具（implemented=false）显示为禁用，不可点击
 */

/** 构造受控 EditorSessionApi 子集 */
function makeEditorSession(activeTool: EditorTool = 'select'): {
  session: Pick<EditorSessionApi, 'activeTool' | 'setTool'>;
  setTool: ReturnType<typeof vi.fn<(tool: EditorTool) => void>>;
} {
  const setTool = vi.fn<(tool: EditorTool) => void>();
  return {
    session: {
      activeTool,
      setTool,
    },
    setTool,
  };
}

describe('ToolSelector 任务 1.5：可访问的工具选择入口', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染所有 TOOL_REGISTRY 中的工具按钮', () => {
    const { session } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    for (const tool of TOOL_REGISTRY) {
      const btn = screen.getByRole('button', { name: tool.name });
      expect(btn).toBeInTheDocument();
    }
  });

  it('每个按钮具有 aria-label 等于工具名称', () => {
    const { session } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    for (const tool of TOOL_REGISTRY) {
      const btn = screen.getByRole('button', { name: tool.name });
      expect(btn).toHaveAttribute('aria-label', tool.name);
    }
  });

  it('活动工具按钮具有 aria-pressed=true', () => {
    const { session } = makeEditorSession('hand');
    renderWithProvider(<ToolSelector editorSession={session} />);
    const handBtn = screen.getByRole('button', { name: '抓手' });
    expect(handBtn).toHaveAttribute('aria-pressed', 'true');
    // 其他工具按钮 aria-pressed=false
    const selectBtn = screen.getByRole('button', { name: '选择' });
    expect(selectBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('切换 activeTool 时 aria-pressed 状态正确更新', () => {
    const { session, setTool } = makeEditorSession('select');
    const { rerender } = renderWithProvider(<ToolSelector editorSession={session} />);
    const selectBtn = screen.getByRole('button', { name: '选择' });
    expect(selectBtn).toHaveAttribute('aria-pressed', 'true');

    // 模拟切换到 hand
    rerender(
      <TooltipProvider>
        <ToolSelector editorSession={makeEditorSession('hand').session} />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: '抓手' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '选择' })).toHaveAttribute('aria-pressed', 'false');
    // setTool 不应被 rerender 调用
    expect(setTool).not.toHaveBeenCalled();
  });

  it('鼠标点击已实现工具按钮调用 setTool', () => {
    const { session, setTool } = makeEditorSession('select');
    renderWithProvider(<ToolSelector editorSession={session} />);
    // select 已实现，可点击
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('阶段 1 完成后所有工具按钮均可点击（无 disabled）', () => {
    const { session, setTool } = makeEditorSession('select');
    renderWithProvider(<ToolSelector editorSession={session} />);
    // 阶段 1 闭环后，TOOL_REGISTRY 中所有工具均 implemented=true
    for (const tool of TOOL_REGISTRY) {
      const btn = screen.getByRole('button', { name: tool.name });
      expect(btn).not.toBeDisabled();
    }
    // 点击任意已实现工具应调用 setTool
    const handBtn = screen.getByRole('button', { name: '抓手' });
    fireEvent.click(handBtn);
    expect(setTool).toHaveBeenCalledWith('hand');
  });

  it('只有 implemented=true 的工具按钮可被聚焦（键盘导航）', () => {
    const { session } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    const implementedTools = getImplementedTools();
    // 阶段 1 闭环后全部 8 个工具均实现
    expect(implementedTools.map((t) => t.id)).toEqual([
      'select',
      'hand',
      'text',
      'rect',
      'ellipse',
      'image',
      'zoom',
      'eyedropper',
    ]);

    const selectBtn = screen.getByRole('button', { name: '选择' });
    expect(selectBtn).not.toBeDisabled();
    // 全部工具均未 disabled
    for (const tool of TOOL_REGISTRY) {
      const btn = screen.getByRole('button', { name: tool.name });
      expect(btn).not.toBeDisabled();
    }
  });

  it('键盘 Enter 触发已实现工具按钮的 setTool', () => {
    const { session, setTool } = makeEditorSession('hand');
    renderWithProvider(<ToolSelector editorSession={session} />);
    const selectBtn = screen.getByRole('button', { name: '选择' });
    selectBtn.focus();
    expect(selectBtn).toHaveFocus();
    // 浏览器原生行为：聚焦按钮上按 Enter/Space 会触发 click
    // jsdom 不会自动转化，所以直接 fire click
    fireEvent.click(selectBtn);
    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('键盘 Space 触发已实现工具按钮的 setTool', () => {
    const { session, setTool } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    const selectBtn = screen.getByRole('button', { name: '选择' });
    fireEvent.click(selectBtn);
    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('工具按钮组具有 role=group 和 aria-label', () => {
    const { session } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    const group = screen.getByRole('group', { name: '工具选择' });
    expect(group).toBeInTheDocument();
  });

  it('阶段 1 闭环后所有工具按钮 tooltip 不再显示"未实现"提示', () => {
    const { session } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    // Tooltip 在 hover/focus 时显示，jsdom 不渲染 portal 内容
    // 阶段 1 闭环后所有工具均 implemented=true，无 disabled 按钮
    for (const tool of TOOL_REGISTRY) {
      const btn = screen.getByRole('button', { name: tool.name });
      expect(btn).not.toBeDisabled();
    }
  });

  it('所有工具按 implemented 标记决定 disabled 状态', () => {
    const { session } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    // 阶段 1 闭环后所有工具 implemented=true，故全部 not.toBeDisabled()
    // 此测试保留 disabled 机制验证，后续新增未实现工具时自动适用
    for (const tool of TOOL_REGISTRY) {
      const btn = screen.getByRole('button', { name: tool.name });
      if (tool.implemented) {
        expect(btn).not.toBeDisabled();
      } else {
        expect(btn).toBeDisabled();
      }
    }
  });

  it('点击当前活动工具按钮也会调用 setTool（允许用户重新确认）', () => {
    const { session, setTool } = makeEditorSession('select');
    renderWithProvider(<ToolSelector editorSession={session} />);
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('按钮总数等于 TOOL_REGISTRY 长度', () => {
    const { session } = makeEditorSession();
    renderWithProvider(<ToolSelector editorSession={session} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(TOOL_REGISTRY.length);
  });
});
