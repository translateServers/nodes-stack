import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * 任务 3.7 验证：右键菜单状态镜像到交互状态机
 *
 * 测试策略：
 * - 用 vi.hoisted 声明捕获容器，避免 vi.mock 提升后的 TDZ 问题
 * - mock @/components/ui/context-menu 捕获传入的 onOpenChange
 * - mock editor-store 提供最小 store 数据
 * - mock canvas-event-router 避免真实 DOM 事件绑定
 * - 验证菜单打开/关闭时 dispatchInteraction 被正确调用
 * - 验证未传入 dispatchInteraction 时菜单行为不回退
 */

const { capturedRef } = vi.hoisted(() => ({
  capturedRef: {
    current: null as ((open: boolean) => void) | null,
  },
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({
    children,
    onOpenChange,
  }: {
    children: unknown;
    onOpenChange: (open: boolean) => void;
  }) => {
    capturedRef.current = onOpenChange;
    return children as React.ReactNode;
  },
  ContextMenuTrigger: ({ children }: { children: unknown }) => children as React.ReactNode,
  ContextMenuContent: ({ children }: { children: unknown }) => (
    <div>{children as React.ReactNode}</div>
  ),
  ContextMenuGroup: ({ children }: { children: unknown }) => children as React.ReactNode,
  ContextMenuItem: ({ children }: { children: unknown }) => (
    <div>{children as React.ReactNode}</div>
  ),
  ContextMenuSeparator: () => <div />,
  ContextMenuSub: ({ children }: { children: unknown }) => children as React.ReactNode,
  ContextMenuSubTrigger: ({ children }: { children: unknown }) => (
    <div>{children as React.ReactNode}</div>
  ),
  ContextMenuSubContent: ({ children }: { children: unknown }) => (
    <div>{children as React.ReactNode}</div>
  ),
}));

vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: (selector: (s: unknown) => unknown) => {
    const state = {
      selectedComponentIds: [],
      project: { components: [] },
      clipboard: null,
      selectComponent: vi.fn(),
      clearSelection: vi.fn(),
      selectComponents: vi.fn(),
      pasteFromClipboard: vi.fn(),
      copySelectedToClipboard: vi.fn(),
      duplicateSelected: vi.fn(),
      removeSelectedComponents: vi.fn(),
      setLocked: vi.fn(),
      setHidden: vi.fn(),
      reorderToTop: vi.fn(),
      reorderToBottom: vi.fn(),
      alignSelectedHorizontal: vi.fn(),
      alignSelectedVertical: vi.fn(),
      distributeSelectedHorizontal: vi.fn(),
      distributeSelectedVertical: vi.fn(),
      groupSelected: vi.fn(),
      ungroupSelected: vi.fn(),
    };
    return selector(state);
  },
}));

vi.mock('../lib/canvas-event-router', () => ({
  attachContextMenuRedistributor: () => () => {},
  findComponentIdAtPoint: () => null,
  getComponentIdFromElement: () => null,
}));

vi.mock('./shortcut-badge', () => ({
  ShortcutBadge: () => null,
}));

vi.mock('../hooks/shortcuts-registry', () => ({
  getShortcutKeys: () => 'mod+x',
}));

import { render, cleanup } from '@testing-library/react';
import { CanvasContextMenu } from './canvas-context-menu';
import type { InteractionState } from '../hooks/use-interaction-state-machine';

describe('任务 3.7：右键菜单状态镜像到交互状态机', () => {
  beforeEach(() => {
    capturedRef.current = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('菜单打开时 dispatch "open-context-menu"', () => {
    const dispatchInteraction = vi.fn();
    render(
      <CanvasContextMenu
        onShowCanvasSettings={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToScreen={vi.fn()}
        dispatchInteraction={dispatchInteraction}
      >
        <div />
      </CanvasContextMenu>,
    );

    expect(capturedRef.current).not.toBeNull();
    capturedRef.current!(true);
    expect(dispatchInteraction).toHaveBeenCalledWith('open-context-menu');
  });

  it('菜单关闭时 dispatch "close-context-menu"', () => {
    const dispatchInteraction = vi.fn();
    render(
      <CanvasContextMenu
        onShowCanvasSettings={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToScreen={vi.fn()}
        dispatchInteraction={dispatchInteraction}
      >
        <div />
      </CanvasContextMenu>,
    );

    capturedRef.current!(false);
    expect(dispatchInteraction).toHaveBeenCalledWith('close-context-menu');
  });

  it('未传入 dispatchInteraction 时菜单打开不抛错（向后兼容）', () => {
    render(
      <CanvasContextMenu
        onShowCanvasSettings={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToScreen={vi.fn()}
      >
        <div />
      </CanvasContextMenu>,
    );

    expect(() => capturedRef.current!(true)).not.toThrow();
    expect(() => capturedRef.current!(false)).not.toThrow();
  });

  it('菜单从打开切换到关闭 dispatch 两个事件', () => {
    const dispatchInteraction = vi.fn();
    render(
      <CanvasContextMenu
        onShowCanvasSettings={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToScreen={vi.fn()}
        dispatchInteraction={dispatchInteraction}
      >
        <div />
      </CanvasContextMenu>,
    );

    capturedRef.current!(true);
    capturedRef.current!(false);
    expect(dispatchInteraction).toHaveBeenCalledTimes(2);
    expect(dispatchInteraction).toHaveBeenNthCalledWith(1, 'open-context-menu');
    expect(dispatchInteraction).toHaveBeenNthCalledWith(2, 'close-context-menu');
  });
});

/**
 * 任务 12.3：文本编辑和右键菜单由状态机仲裁
 *
 * 测试策略：
 * - 渲染 CanvasContextMenu 时传入 interactionState，模拟不同交互状态
 * - 调用捕获的 onOpenChange(true) 验证菜单是否允许打开
 * - 合法源状态（idle/hovering/marquee-selecting/context-menu-open）：允许打开，派发 open-context-menu
 * - 非法源状态（dragging/resizing/rotating/panning/zooming/text-editing/creating）：
 *   拒绝打开，不派发 open-context-menu
 * - 关闭菜单（onOpenChange(false)）不做状态检查，确保菜单总能关闭
 */
describe('任务 12.3：右键菜单由状态机仲裁', () => {
  beforeEach(() => {
    capturedRef.current = null;
  });

  afterEach(() => {
    cleanup();
  });

  function renderWithState(interactionState: InteractionState): {
    dispatchInteraction: ReturnType<typeof vi.fn>;
  } {
    const dispatchInteraction = vi.fn();
    render(
      <CanvasContextMenu
        onShowCanvasSettings={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToScreen={vi.fn()}
        dispatchInteraction={dispatchInteraction}
        interactionState={interactionState}
      >
        <div />
      </CanvasContextMenu>,
    );
    expect(capturedRef.current).not.toBeNull();
    return { dispatchInteraction };
  }

  // ===== 合法源状态：允许打开菜单 =====
  it('idle 状态下允许打开菜单，派发 open-context-menu', () => {
    const { dispatchInteraction } = renderWithState('idle');
    capturedRef.current!(true);
    expect(dispatchInteraction).toHaveBeenCalledWith('open-context-menu');
  });

  it('hovering 状态下允许打开菜单', () => {
    const { dispatchInteraction } = renderWithState('hovering');
    capturedRef.current!(true);
    expect(dispatchInteraction).toHaveBeenCalledWith('open-context-menu');
  });

  it('marquee-selecting 状态下允许打开菜单', () => {
    const { dispatchInteraction } = renderWithState('marquee-selecting');
    capturedRef.current!(true);
    expect(dispatchInteraction).toHaveBeenCalledWith('open-context-menu');
  });

  it('context-menu-open 状态下允许重新打开（重定位场景）', () => {
    const { dispatchInteraction } = renderWithState('context-menu-open');
    capturedRef.current!(true);
    expect(dispatchInteraction).toHaveBeenCalledWith('open-context-menu');
  });

  // ===== 非法源状态：拒绝打开菜单 =====
  it('dragging 状态下拒绝打开菜单，不派发 open-context-menu', () => {
    const { dispatchInteraction } = renderWithState('dragging');
    capturedRef.current!(true);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('open-context-menu');
  });

  it('resizing 状态下拒绝打开菜单', () => {
    const { dispatchInteraction } = renderWithState('resizing');
    capturedRef.current!(true);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('open-context-menu');
  });

  it('rotating 状态下拒绝打开菜单', () => {
    const { dispatchInteraction } = renderWithState('rotating');
    capturedRef.current!(true);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('open-context-menu');
  });

  it('panning 状态下拒绝打开菜单', () => {
    const { dispatchInteraction } = renderWithState('panning');
    capturedRef.current!(true);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('open-context-menu');
  });

  it('zooming 状态下拒绝打开菜单', () => {
    const { dispatchInteraction } = renderWithState('zooming');
    capturedRef.current!(true);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('open-context-menu');
  });

  it('text-editing 状态下拒绝打开菜单（文本编辑优先）', () => {
    const { dispatchInteraction } = renderWithState('text-editing');
    capturedRef.current!(true);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('open-context-menu');
  });

  it('creating 状态下拒绝打开菜单', () => {
    const { dispatchInteraction } = renderWithState('creating');
    capturedRef.current!(true);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('open-context-menu');
  });

  // ===== 关闭菜单不受状态机仲裁限制 =====
  it('关闭菜单（onOpenChange(false)）不受状态机仲裁限制', () => {
    // 即使在 dragging 状态下，关闭菜单也应该生效（确保菜单总能关闭）
    const { dispatchInteraction } = renderWithState('dragging');
    capturedRef.current!(false);
    expect(dispatchInteraction).toHaveBeenCalledWith('close-context-menu');
  });

  // ===== 未传入 interactionState 时不进行仲裁（向后兼容） =====
  it('未传入 interactionState 时不进行状态机仲裁（向后兼容）', () => {
    const dispatchInteraction = vi.fn();
    render(
      <CanvasContextMenu
        onShowCanvasSettings={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToScreen={vi.fn()}
        dispatchInteraction={dispatchInteraction}
      >
        <div />
      </CanvasContextMenu>,
    );
    // 不传 interactionState 时，即使在"非法"状态下也应该允许打开（兼容旧测试）
    capturedRef.current!(true);
    expect(dispatchInteraction).toHaveBeenCalledWith('open-context-menu');
  });

  // ===== 恢复语义：拒绝后从 idle 可继续打开菜单 =====
  it('恢复语义：dragging 状态下拒绝后，恢复 idle 可继续打开菜单', () => {
    // dragging 状态下被拒绝
    const { dispatchInteraction: dispatch1 } = renderWithState('dragging');
    capturedRef.current!(true);
    expect(dispatch1).not.toHaveBeenCalledWith('open-context-menu');

    // 恢复到 idle 后可继续打开
    cleanup();
    const { dispatchInteraction: dispatch2 } = renderWithState('idle');
    capturedRef.current!(true);
    expect(dispatch2).toHaveBeenCalledWith('open-context-menu');
  });
});
