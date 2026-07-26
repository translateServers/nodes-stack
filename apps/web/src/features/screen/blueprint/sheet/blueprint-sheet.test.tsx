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
 *
 * 注意：编辑器内存已全量迁移至 V2 蓝图（editor-store.loadProject 自动 V1→V2），
 * V1 BlueprintSheet 在生产环境已由 BlueprintSheetV2 替代。以下需要加载 V1 节点蓝图的
 * 测试用例已 skip，待后续迁移至 BlueprintSheetV2 测试文件。容器形态与空态测试仍有效。
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
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
      onConnect,
    }: {
      nodes: { id: string; selected?: boolean }[];
      edges: unknown[];
      onNodesChange?: (changes: { id: string; type: 'select'; selected: boolean }[]) => void;
      onConnect?: (conn: {
        source: string;
        target: string;
        sourceHandle: string;
        targetHandle: string;
      }) => void;
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
        {onNodesChange && nodes.length > 0 ? (
          <button
            type="button"
            data-testid="rf-test-select-first"
            onClick={() =>
              onNodesChange([
                { id: nodes[0].id, type: 'select', selected: true },
                ...nodes
                  .slice(1)
                  .map((n) => ({ id: n.id, type: 'select' as const, selected: false })),
              ])
            }
          >
            select-first
          </button>
        ) : null}
        {onConnect && nodes.length >= 2 ? (
          <button
            type="button"
            data-testid="rf-test-connect-self"
            onClick={() =>
              onConnect({
                source: nodes[0].id,
                target: nodes[0].id,
                sourceHandle: 'out',
                targetHandle: 'in',
              })
            }
          >
            connect-self
          </button>
        ) : null}
        {onConnect && nodes.length >= 2 ? (
          <button
            type="button"
            data-testid="rf-test-connect-valid"
            onClick={() =>
              onConnect({
                source: nodes[0].id,
                target: nodes[1].id,
                sourceHandle: 'out',
                targetHandle: 'in',
              })
            }
          >
            connect-valid
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
      setCenter: vi.fn().mockResolvedValue(true),
      getZoom: vi.fn().mockReturnValue(1),
      getViewport: vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
      screenToFlowPosition: vi.fn().mockImplementation((p: { x: number; y: number }) => p),
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
import { EVENT_BLUEPRINT_VERSION } from '@nebula/shared';

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
    components: [
      { id: 'comp-a', name: '柱状图' } as unknown as ScreenProject['components'][number],
      { id: 'comp-b', name: '按钮' } as unknown as ScreenProject['components'][number],
    ],
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
    it('blueprint 为空时显示空态引导（EmptyBlueprintState）', () => {
      resetStore();
      // loadProject with empty blueprint
      useScreenEditorStore.getState().loadProject(makeProject(makeEmptyBlueprint()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId('empty-blueprint-state')).toBeInTheDocument();
    });

    it('blueprint 为 undefined 时显示空态引导（EmptyBlueprintState）', () => {
      resetStore();
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId('empty-blueprint-state')).toBeInTheDocument();
    });
  });

  describe('blueprint 同步', () => {
    // SKIP：编辑器 store 已全量迁移 V2，V1 节点蓝图加载后自动迁移为 V2，
    // V1 BlueprintSheet 无法识别 V2 节点导致 data-node-count=0。待迁移至 BlueprintSheetV2 测试。
    it.skip('blueprint 含节点时 ReactFlow 接收正确节点数', () => {
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

    // SKIP：V1 节点经 store 自动 V2 迁移后 BlueprintSheet 不渲染节点，select-all 无目标。待迁移至 V2 测试。
    it.skip('选中 2 个节点后渲染对齐分布工具条且 selectedCount=2', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      // 模拟 ReactFlow 全选（通过 mock 提供的 select-all 按钮）
      fireEvent.click(screen.getByTestId('rf-test-select-all'));

      const toolbar = screen.getByTestId('align-distribute-toolbar');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar.getAttribute('data-selected-count')).toBe('2');
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('选中后再取消选择，工具条消失', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('rf-test-select-all'));
      expect(screen.getByTestId('align-distribute-toolbar')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('rf-test-deselect-all'));
      expect(screen.queryByTestId('align-distribute-toolbar')).not.toBeInTheDocument();
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('selectedCount=2 时分布按钮禁用', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('rf-test-select-all'));

      expect(screen.getByLabelText('左对齐')).toBeEnabled();
      expect(screen.getByLabelText('水平等距分布')).toBeDisabled();
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('点击左对齐按钮触发 updateBlueprint 入一条历史', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      const initialPastLength = useScreenEditorStore.getState().history.past.length;
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('rf-test-select-all'));
      fireEvent.click(screen.getByLabelText('左对齐'));

      // 验证历史栈 +1（对齐产生一条历史）
      expect(useScreenEditorStore.getState().history.past.length).toBe(initialPastLength + 1);
      // 验证 blueprint 节点位置已变更（两个节点都左对齐到 minX=100）
      const current = useScreenEditorStore.getState().project?.blueprint;
      const v1Current =
        current !== undefined && current.version === EVENT_BLUEPRINT_VERSION ? current : undefined;
      expect(v1Current?.nodes.every((n) => n.position.x === 100)).toBe(true);
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('点击水平分布按钮在 selectedCount<3 时不触发更新', () => {
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

  describe('节点参数配置面板（任务 4.8）', () => {
    function makeBlueprintWithComponentClick(): EventBlueprint {
      return {
        version: 1,
        nodes: [
          {
            id: 'trigger-1',
            kind: 'trigger',
            position: { x: 100, y: 100 },
            config: { type: 'componentClick', componentId: '' },
          },
        ],
        edges: [],
      };
    }

    it('未选中节点时不显示配置面板', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithComponentClick()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.queryByTestId('node-config-panel')).not.toBeInTheDocument();
    });

    // SKIP：V1 trigger 节点经 store 自动 V2 迁移后无对应节点可选。待迁移至 V2 测试。
    it.skip('选中单个节点后显示配置面板', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithComponentClick()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('rf-test-select-first'));

      const panel = screen.getByTestId('node-config-panel');
      expect(panel).toBeInTheDocument();
      expect(panel.getAttribute('data-node-kind')).toBe('trigger');
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('多选时不显示配置面板', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      // 全选（2 个节点 -> 多选）
      fireEvent.click(screen.getByTestId('rf-test-select-all'));
      expect(screen.queryByTestId('node-config-panel')).not.toBeInTheDocument();
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('在配置面板选择组件后 blueprint 即时同步，编辑会话结算产生单条历史', () => {
      vi.useFakeTimers();
      try {
        useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithComponentClick()));
        const initialPastLength = useScreenEditorStore.getState().history.past.length;
        render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

        // 选中 trigger 节点
        fireEvent.click(screen.getByTestId('rf-test-select-first'));

        // 在配置面板选择组件 comp-a
        fireEvent.change(screen.getByTestId('config-component-id'), {
          target: { value: 'comp-a' },
        });

        // 数据即时同步（transient：gesture 期间不入历史栈，避免每个键击一条历史）
        const blueprint = useScreenEditorStore.getState().project?.blueprint;
        expect(blueprint?.nodes[0].config).toEqual({
          type: 'componentClick',
          componentId: 'comp-a',
        });
        expect(useScreenEditorStore.getState().history.past.length).toBe(initialPastLength);

        // 编辑后选中态保留（effect A 合并 ephemeral 字段），配置面板不消失
        expect(screen.getByTestId('node-config-panel')).toBeInTheDocument();

        // 停止输入 600ms 后 gesture 结算，补一条历史（undo 回到编辑会话前）
        act(() => {
          vi.advanceTimersByTime(600);
        });
        expect(useScreenEditorStore.getState().history.past.length).toBe(initialPastLength + 1);
      } finally {
        vi.useRealTimers();
      }
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('取消选择后配置面板消失', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithComponentClick()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);

      fireEvent.click(screen.getByTestId('rf-test-select-first'));
      expect(screen.getByTestId('node-config-panel')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('rf-test-deselect-all'));
      expect(screen.queryByTestId('node-config-panel')).not.toBeInTheDocument();
    });
  });

  describe('空态死局修复', () => {
    it('点击"从空白开始"后关闭空态遮罩（blueprint 仍为空但遮罩不再死锁画布）', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeEmptyBlueprint()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId('empty-blueprint-state')).toBeInTheDocument();

      fireEvent.click(screen.getByText('从空白开始'));

      // 空态遮罩关闭，ReactFlow 画布露出可交互
      expect(screen.queryByTestId('empty-blueprint-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('blueprint-reactflow')).toBeInTheDocument();
    });

    // SKIP：V1 节点蓝图经 store 自动 V2 迁移后 BlueprintSheet 不渲染节点。待迁移至 V2 测试。
    it.skip('插入模板后空态遮罩关闭', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeEmptyBlueprint()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId('empty-blueprint-state')).toBeInTheDocument();

      // 插入模板后 blueprint 非空，isEmpty 变 false，遮罩自动关闭
      const template = useScreenEditorStore.getState().project;
      expect(template).not.toBeNull();
      act(() => {
        useScreenEditorStore.getState().updateBlueprint(makeBlueprintWithNodes());
      });
      expect(screen.queryByTestId('empty-blueprint-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('blueprint-reactflow').getAttribute('data-node-count')).toBe('2');
    });
  });

  describe('连线守卫（isConnectionValid 集成）', () => {
    // SKIP：V1 节点蓝图经 store 自动 V2 迁移后 BlueprintSheet 不渲染节点，data-edge-count=0。
    // 待迁移至 BlueprintSheetV2 测试。
    it.skip('自环连线被拒绝（onConnect 兜底拦截）', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      const rf = screen.getByTestId('blueprint-reactflow');
      expect(rf.getAttribute('data-edge-count')).toBe('1');

      fireEvent.click(screen.getByTestId('rf-test-connect-self'));

      // 自环被拒绝，边数不变
      expect(screen.getByTestId('blueprint-reactflow').getAttribute('data-edge-count')).toBe('1');
      expect(useScreenEditorStore.getState().project?.blueprint?.edges).toHaveLength(1);
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('重复连线被拒绝（已存在同向边）', () => {
      useScreenEditorStore.getState().loadProject(makeProject(makeBlueprintWithNodes()));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      // makeBlueprintWithNodes 已含 trigger-1 -> action-1 的边，rf-test-connect-valid 与其重复
      expect(screen.getByTestId('blueprint-reactflow').getAttribute('data-edge-count')).toBe('1');

      fireEvent.click(screen.getByTestId('rf-test-connect-valid'));

      // 重复边被拒绝，边数不变
      expect(screen.getByTestId('blueprint-reactflow').getAttribute('data-edge-count')).toBe('1');
    });

    // SKIP：同上，V1 节点经 V2 迁移后无目标可选。待迁移至 V2 测试。
    it.skip('合法连线被接受并写回 blueprint', () => {
      const twoTriggers: EventBlueprint = {
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
        edges: [],
      };
      useScreenEditorStore.getState().loadProject(makeProject(twoTriggers));
      render(<BlueprintSheet open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId('blueprint-reactflow').getAttribute('data-edge-count')).toBe('0');

      fireEvent.click(screen.getByTestId('rf-test-connect-valid'));

      // 合法连线被接受：边数 +1 且写回 store
      expect(screen.getByTestId('blueprint-reactflow').getAttribute('data-edge-count')).toBe('1');
      const bpEdges = useScreenEditorStore.getState().project?.blueprint?.edges;
      expect(bpEdges).toHaveLength(1);
      expect(bpEdges?.[0]).toMatchObject({
        source: 'trigger-1',
        sourceHandle: 'out',
        target: 'action-1',
        targetHandle: 'in',
      });
    });
  });
});
