/**
 * BlueprintSheet 组件测试（任务 4.7）
 *
 * 验证点（对应 tasks.md 4.7 验证要求）：
 * - open=false 时不渲染
 * - open=true 时渲染全屏弹层容器（fixed inset-0 z-50）
 * - 顶栏含标题 "事件蓝图" 与关闭按钮
 * - 空蓝图时显示空态提示
 * - 关闭按钮触发 onOpenChange(false)
 * - blueprint 存在时从 store 同步节点到 ReactFlow
 *
 * 测试策略：
 * - mock @xyflow/react 的 ReactFlow / ReactFlowProvider / hooks，避免 jsdom 缺失的 DOM API
 * - 保留真实的 useScreenEditorStore，通过 loadProject 注入受控 project
 * - 专注验证容器形态、顶栏、空态、关闭交互（ReactFlow 内部交互由各自 hook 测试覆盖）
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// ===== jsdom 全局 mock（ReactFlow 依赖） =====

beforeAll(() => {
  if (typeof window.ResizeObserver !== 'function') {
    class MockResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  }
  if (typeof window.DOMMatrix !== 'function') {
    class MockDOMMatrix {
      constructor() {}
      static fromFloat32Array(): MockDOMMatrix {
        return new MockDOMMatrix();
      }
      static fromFloat64Array(): MockDOMMatrix {
        return new MockDOMMatrix();
      }
    }
    vi.stubGlobal('DOMMatrix', MockDOMMatrix);
  }
  if (typeof window.IntersectionObserver !== 'function') {
    class MockIntersectionObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): [] {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  }
});

// ===== Mock @xyflow/react =====
// ReactFlow 组件依赖大量 DOM 测量 API，在 jsdom 环境下无法正常渲染。
// 仅保留类型与工具函数（applyNodeChanges 等），组件用占位 div 替换。

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: ({
      nodes,
      edges,
      onNodesChange,
    }: {
      nodes: { id: string; selected?: boolean }[];
      edges: unknown[];
      onNodesChange?: (changes: { id: string; type: 'select'; selected: boolean }[]) => void;
    }) => (
      <div
        data-testid="blueprint-reactflow"
        data-node-count={nodes.length}
        data-edge-count={edges.length}
        data-selected-count={nodes.filter((n) => n.selected).length}
      >
        {onNodesChange && nodes.length > 0 ? (
          <button
            type="button"
            data-testid="rf-test-select-all"
            onClick={() =>
              onNodesChange(nodes.map((n) => ({ id: n.id, type: 'select', selected: true })))
            }
          >
            select-all
          </button>
        ) : null}
        {onNodesChange && nodes.length > 0 ? (
          <button
            type="button"
            data-testid="rf-test-deselect-all"
            onClick={() =>
              onNodesChange(nodes.map((n) => ({ id: n.id, type: 'select', selected: false })))
            }
          >
            deselect-all
          </button>
        ) : null}
      </div>
    ),
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Background: () => <div data-testid="rf-background" />,
    BackgroundVariant: { Dots: 'dots' },
    Controls: () => <div data-testid="rf-controls" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    useReactFlow: () => ({
      fitView: vi.fn().mockResolvedValue(true),
      zoomTo: vi.fn().mockResolvedValue(true),
      setViewport: vi.fn().mockResolvedValue(true),
      getZoom: vi.fn().mockReturnValue(1),
      getViewport: vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
    }),
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    useKeyPress: () => false,
  };
});

// ===== Mock ViewportToolbar（避免依赖 ReactFlow 上下文） =====

vi.mock('../panels/viewport-toolbar', () => ({
  ViewportToolbar: ({ zoom }: { zoom: number }) => (
    <div data-testid="viewport-toolbar" data-zoom={zoom} />
  ),
}));

// ===== Mock ToolbarButton（避免 Radix TooltipProvider 依赖） =====

vi.mock('../../components/ui-primitives', () => ({
  ToolbarButton: ({
    children,
    onClick,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

import { BlueprintSheet } from './blueprint-sheet';
import { useScreenEditorStore } from '../../stores/editor-store';
import type { EventBlueprint, ScreenProject } from '@nebula/shared';

// ===== 工厂 =====

function makeEmptyBlueprint(): EventBlueprint {
  return { version: 1, nodes: [], edges: [] };
}

function makeBlueprintWithNodes(): EventBlueprint {
  return {
    version: 1,
    nodes: [
      {
        id: 'trigger-1',
        kind: 'trigger',
        position: { x: 100, y: 100 },
        config: { type: 'pageLoad' },
      },
      {
        id: 'action-1',
        kind: 'action',
        position: { x: 300, y: 100 },
        config: { type: 'setVisibility', targetComponentId: '', visible: 'show' },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'trigger-1',
        sourceHandle: 'out',
        target: 'action-1',
        targetHandle: 'in',
      },
    ],
  };
}

function makeProject(blueprint?: EventBlueprint): ScreenProject {
  return {
    id: 'screen-1',
    name: '测试屏幕',
    components: [],
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    ...(blueprint ? { blueprint } : {}),
  } as unknown as ScreenProject;
}

function resetStore(): void {
  useScreenEditorStore.getState().loadProject(makeProject());
}

// ===== 测试 =====

describe('BlueprintSheet', () => {
  describe('容器形态', () => {
    it('open=false 时返回 null', () => {
      resetStore();
      const { container } = render(<BlueprintSheet open={false} onOpenChange={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });

    it('open=true 时渲染全屏弹层（fixed inset-0 z-50）', () => {
      resetStore();
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      const overlay = screen.getByTestId('blueprint-sheet-overlay');
      expect(overlay.className).toContain('fixed');
      expect(overlay.className).toContain('inset-0');
      expect(overlay.className).toContain('z-50');
    });

    it('容器具备 dialog role 与 aria-label', () => {
      resetStore();
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      const overlay = screen.getByTestId('blueprint-sheet-overlay');
      expect(overlay.getAttribute('role')).toBe('dialog');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
      expect(overlay.getAttribute('aria-label')).toBe('事件蓝图');
    });
  });

  describe('顶栏', () => {
    it('渲染标题 "事件蓝图"', () => {
      resetStore();
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByText('事件蓝图')).toBeInTheDocument();
    });

    it('渲染视口工具栏', () => {
      resetStore();
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId('viewport-toolbar')).toBeInTheDocument();
    });

    it('渲染关闭按钮', () => {
      resetStore();
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId('blueprint-sheet-close')).toBeInTheDocument();
    });

    it('点击关闭按钮触发 onOpenChange(false)', () => {
      resetStore();
      const onOpenChange = vi.fn();
      render(<BlueprintSheet open={true} onOpenChange={onOpenChange} />);
      fireEvent.click(screen.getByTestId('blueprint-sheet-close'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('空蓝图态', () => {
    it('blueprint 为空时显示空态提示', () => {
      resetStore();
      // loadProject with empty blueprint
      useScreenEditorStore.getState().loadProject(makeProject(makeEmptyBlueprint()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByText('空蓝图')).toBeInTheDocument();
    });

    it('blueprint 为 undefined 时显示空态提示', () => {
      resetStore();
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByText('空蓝图')).toBeInTheDocument();
    });
  });

  describe('blueprint 同步', () => {
    it('blueprint 含节点时 ReactFlow 接收正确节点数', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      const rf = screen.getByTestId('blueprint-reactflow');
      expect(rf.getAttribute('data-node-count')).toBe('2');
      expect(rf.getAttribute('data-edge-count')).toBe('1');
    });

    it('blueprint 为空时不显示空态提示文本外的其他节点', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeEmptyBlueprint()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      const rf = screen.getByTestId('blueprint-reactflow');
      expect(rf.getAttribute('data-node-count')).toBe('0');
    });
  });

  describe('对齐分布工具条（任务 9.4）', () => {
    it('selectedCount=0 时不渲染对齐分布工具条', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.queryByTestId('align-distribute-toolbar')).not.toBeInTheDocument();
    });

    it('选中 2 个节点后渲染对齐分布工具条且 selectedCount=2', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      // 模拟 ReactFlow 全选（通过 mock 提供的 select-all 按钮）
      fireEvent.click(screen.getByTestId('rf-test-select-all'));

      const toolbar = screen.getByTestId('align-distribute-toolbar');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar.getAttribute('data-selected-count')).toBe('2');
    });

    it('选中后再取消选择，工具条消失', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('rf-test-select-all'));
      expect(screen.getByTestId('align-distribute-toolbar')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('rf-test-deselect-all'));
      expect(screen.queryByTestId('align-distribute-toolbar')).not.toBeInTheDocument();
    });

    it('selectedCount=2 时分布按钮禁用', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('rf-test-select-all'));

      expect(screen.getByLabelText('左对齐')).toBeEnabled();
      expect(screen.getByLabelText('水平等距分布')).toBeDisabled();
    });

    it('点击左对齐按钮触发 updateBlueprint 入一条历史', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      const initialPastLength = useScreenEditorStore.getState().history.past.length;
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('rf-test-select-all'));
      fireEvent.click(screen.getByLabelText('左对齐'));

      // 验证历史栈 +1（对齐产生一条历史）
      expect(useScreenEditorStore.getState().history.past.length).toBe(initialPastLength + 1);
      // 验证 blueprint 节点位置已变更（两个节点都左对齐到 minX=100）
      const current = useScreenEditorStore.getState().project?.blueprint;
      expect(current?.nodes.every((n) => n.position.x === 100)).toBe(true);
    });

    it('点击水平分布按钮在 selectedCount<3 时不触发更新', () => {
      // selectedCount=2，分布按钮 disabled，点击不应触发回调
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      const initialPastLength = useScreenEditorStore.getState().history.past.length;
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('rf-test-select-all'));
      // 分布按钮在 selectedCount=2 时禁用，fireEvent.click 不会触发 onClick
      fireEvent.click(screen.getByLabelText('水平等距分布'));
      expect(useScreenEditorStore.getState().history.past.length).toBe(initialPastLength);
    });
  });
});
