/**
 * BlueprintContextMenu 组件测试
 *
 * 验证点：
 * - pane 模式：添加节点/粘贴/全选/视图缩放项齐全，缩放到选区在无选中时禁用
 * - node 模式：剪贴板/对齐/分布/删除项齐全，禁用规则与 AlignDistributeToolbar 一致
 *   （对齐 >=2 可用，分布 >=3 可用）
 * - edge 模式：仅删除连线
 * - 点击菜单项触发对应回调
 *
 * 测试策略：
 * - mock SDK ContextMenu，把 Radix 菜单降级为普通按钮树
 *   （与 canvas-context-menu.test.tsx 同一模式），避免 jsdom 下 Radix 定位依赖
 * - mock ShortcutBadge / shortcuts-registry，避免快捷键注册表内容影响断言
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// ===== Mock Radix ContextMenu 为普通按钮树 =====

vi.mock('@nebula/screen-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nebula/screen-sdk')>()),
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div data-testid="ctx-trigger">{children}</div>
  ),
  ContextMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="blueprint-context-menu">{children}</div>
  ),
  ContextMenuGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onSelect}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr />,
  ContextMenuSub: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuSubTrigger: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
  ContextMenuSubContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/shortcut-badge', () => ({
  ShortcutBadge: () => null,
}));

vi.mock('../../hooks/shortcuts-registry', () => ({
  getShortcutKeys: () => null,
}));

import { BlueprintContextMenu } from './blueprint-context-menu';

// ===== 工厂 =====

function makeProps(overrides: Partial<Parameters<typeof BlueprintContextMenu>[0]> = {}) {
  return {
    mode: 'pane' as const,
    selectedNodeCount: 0,
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onPaste: vi.fn(),
    onDuplicate: vi.fn(),
    onDeleteSelected: vi.fn(),
    onSelectAll: vi.fn(),
    onAlign: vi.fn(),
    onDistribute: vi.fn(),
    onAddNode: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFitView: vi.fn(),
    onFitViewToSelection: vi.fn(),
    // V2 任务 5.5 新增 props（默认未选中节点）
    selectedNodeKind: null,
    selectedNodeGlobalType: null,
    selectedNodeHasComponentId: false,
    onLocateComponent: vi.fn(),
    onConfigureGlobal: vi.fn(),
    ...overrides,
  };
}

function renderMenu(props: ReturnType<typeof makeProps>) {
  return render(
    <BlueprintContextMenu {...props}>
      <div data-testid="canvas-child" />
    </BlueprintContextMenu>,
  );
}

// ===== 测试 =====

describe('BlueprintContextMenu', () => {
  describe('pane 模式（空白处右键）', () => {
    it('渲染画布操作项：添加节点/粘贴/全选/视图缩放', () => {
      renderMenu(makeProps({ mode: 'pane' }));
      expect(screen.getByText('添加节点...')).toBeInTheDocument();
      expect(screen.getByText('粘贴')).toBeInTheDocument();
      expect(screen.getByText('全选')).toBeInTheDocument();
      expect(screen.getByText('放大')).toBeInTheDocument();
      expect(screen.getByText('缩小')).toBeInTheDocument();
      expect(screen.getByText('适应屏幕')).toBeInTheDocument();
      expect(screen.getByText('缩放到选区')).toBeInTheDocument();
    });

    it('不渲染节点/边模式专属项', () => {
      renderMenu(makeProps({ mode: 'pane' }));
      expect(screen.queryByText('复制')).not.toBeInTheDocument();
      expect(screen.queryByText('删除选中')).not.toBeInTheDocument();
      expect(screen.queryByText('删除连线')).not.toBeInTheDocument();
    });

    it('无选中节点时"缩放到选区"禁用', () => {
      renderMenu(makeProps({ mode: 'pane', selectedNodeCount: 0 }));
      expect(screen.getByText('缩放到选区').closest('button')).toBeDisabled();
    });

    it('有选中节点时"缩放到选区"可用', () => {
      renderMenu(makeProps({ mode: 'pane', selectedNodeCount: 2 }));
      expect(screen.getByText('缩放到选区').closest('button')).toBeEnabled();
    });

    it('点击各菜单项触发对应回调', () => {
      const props = makeProps({ mode: 'pane', selectedNodeCount: 1 });
      renderMenu(props);

      fireEvent.click(screen.getByText('添加节点...'));
      expect(props.onAddNode).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('粘贴'));
      expect(props.onPaste).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('全选'));
      expect(props.onSelectAll).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('放大'));
      expect(props.onZoomIn).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('缩小'));
      expect(props.onZoomOut).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('适应屏幕'));
      expect(props.onFitView).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('缩放到选区'));
      expect(props.onFitViewToSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('node 模式（节点右键）', () => {
    it('渲染剪贴板/对齐/分布/删除项', () => {
      renderMenu(makeProps({ mode: 'node', selectedNodeCount: 1 }));
      expect(screen.getByText('复制')).toBeInTheDocument();
      expect(screen.getByText('剪切')).toBeInTheDocument();
      expect(screen.getByText('粘贴')).toBeInTheDocument();
      expect(screen.getByText('创建副本')).toBeInTheDocument();
      expect(screen.getByText('对齐')).toBeInTheDocument();
      expect(screen.getByText('分布')).toBeInTheDocument();
      expect(screen.getByText('删除选中')).toBeInTheDocument();
    });

    it('不渲染 pane/edge 模式专属项', () => {
      renderMenu(makeProps({ mode: 'node', selectedNodeCount: 1 }));
      expect(screen.queryByText('添加节点...')).not.toBeInTheDocument();
      expect(screen.queryByText('全选')).not.toBeInTheDocument();
      expect(screen.queryByText('删除连线')).not.toBeInTheDocument();
    });

    it('selectedNodeCount=1 时对齐/分布子菜单禁用', () => {
      renderMenu(makeProps({ mode: 'node', selectedNodeCount: 1 }));
      expect(screen.getByText('对齐').closest('button')).toBeDisabled();
      expect(screen.getByText('分布').closest('button')).toBeDisabled();
    });

    it('selectedNodeCount=2 时对齐可用、分布禁用（与工具条规则一致）', () => {
      renderMenu(makeProps({ mode: 'node', selectedNodeCount: 2 }));
      expect(screen.getByText('对齐').closest('button')).toBeEnabled();
      expect(screen.getByText('分布').closest('button')).toBeDisabled();
    });

    it('selectedNodeCount=3 时对齐/分布均可用', () => {
      renderMenu(makeProps({ mode: 'node', selectedNodeCount: 3 }));
      expect(screen.getByText('对齐').closest('button')).toBeEnabled();
      expect(screen.getByText('分布').closest('button')).toBeEnabled();
    });

    it('点击复制/创建副本/删除触发对应回调', () => {
      const props = makeProps({ mode: 'node', selectedNodeCount: 2 });
      renderMenu(props);

      fireEvent.click(screen.getByText('复制'));
      expect(props.onCopy).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('剪切'));
      expect(props.onCut).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('创建副本'));
      expect(props.onDuplicate).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('删除选中'));
      expect(props.onDeleteSelected).toHaveBeenCalledTimes(1);
    });

    it('点击对齐/分布子项携带正确模式参数', () => {
      const props = makeProps({ mode: 'node', selectedNodeCount: 3 });
      renderMenu(props);

      fireEvent.click(screen.getByText('左对齐'));
      expect(props.onAlign).toHaveBeenCalledWith('left');

      fireEvent.click(screen.getByText('水平居中'));
      expect(props.onAlign).toHaveBeenCalledWith('center-h');

      fireEvent.click(screen.getByText('顶对齐'));
      expect(props.onAlign).toHaveBeenCalledWith('top');

      fireEvent.click(screen.getByText('水平分布'));
      expect(props.onDistribute).toHaveBeenCalledWith('horizontal');

      fireEvent.click(screen.getByText('垂直分布'));
      expect(props.onDistribute).toHaveBeenCalledWith('vertical');
    });
  });

  describe('edge 模式（边右键）', () => {
    it('仅渲染删除连线', () => {
      renderMenu(makeProps({ mode: 'edge' }));
      expect(screen.getByText('删除连线')).toBeInTheDocument();
      expect(screen.queryByText('复制')).not.toBeInTheDocument();
      expect(screen.queryByText('添加节点...')).not.toBeInTheDocument();
      expect(screen.queryByText('删除选中')).not.toBeInTheDocument();
    });

    it('点击删除连接触发 onDeleteSelected', () => {
      const props = makeProps({ mode: 'edge' });
      renderMenu(props);
      fireEvent.click(screen.getByText('删除连线'));
      expect(props.onDeleteSelected).toHaveBeenCalledTimes(1);
    });
  });

  describe('trigger 包裹', () => {
    it('children 渲染在 ContextMenuTrigger 内', () => {
      renderMenu(makeProps());
      const trigger = screen.getByTestId('ctx-trigger');
      expect(trigger).toBeInTheDocument();
      expect(screen.getByTestId('canvas-child')).toBeInTheDocument();
    });
  });

  describe('V2 任务 5.5：节点专属菜单项', () => {
    it('单选组件节点且关联画布组件时显示「定位到画布组件」', () => {
      renderMenu(
        makeProps({
          mode: 'node',
          selectedNodeCount: 1,
          selectedNodeKind: 'component',
          selectedNodeHasComponentId: true,
        }),
      );
      expect(screen.getByText('定位到画布组件')).toBeInTheDocument();
    });

    it('组件节点未关联画布组件时不显示「定位到画布组件」', () => {
      renderMenu(
        makeProps({
          mode: 'node',
          selectedNodeCount: 1,
          selectedNodeKind: 'component',
          selectedNodeHasComponentId: false,
        }),
      );
      expect(screen.queryByText('定位到画布组件')).not.toBeInTheDocument();
    });

    it('单选全局节点时显示「配置全局节点」', () => {
      renderMenu(
        makeProps({
          mode: 'node',
          selectedNodeCount: 1,
          selectedNodeKind: 'global',
          selectedNodeGlobalType: 'navigate',
        }),
      );
      expect(screen.getByText('配置全局节点')).toBeInTheDocument();
    });

    it('非全局节点不显示「配置全局节点」', () => {
      renderMenu(
        makeProps({
          mode: 'node',
          selectedNodeCount: 1,
          selectedNodeKind: 'component',
          selectedNodeHasComponentId: true,
        }),
      );
      expect(screen.queryByText('配置全局节点')).not.toBeInTheDocument();
    });

    it('多选时即使包含组件节点也不显示「定位到画布组件」', () => {
      renderMenu(
        makeProps({
          mode: 'node',
          selectedNodeCount: 2,
          selectedNodeKind: 'component',
          selectedNodeHasComponentId: true,
        }),
      );
      expect(screen.queryByText('定位到画布组件')).not.toBeInTheDocument();
    });

    it('点击「定位到画布组件」触发 onLocateComponent', () => {
      const props = makeProps({
        mode: 'node',
        selectedNodeCount: 1,
        selectedNodeKind: 'component',
        selectedNodeHasComponentId: true,
      });
      renderMenu(props);
      fireEvent.click(screen.getByText('定位到画布组件'));
      expect(props.onLocateComponent).toHaveBeenCalledTimes(1);
    });

    it('点击「配置全局节点」触发 onConfigureGlobal', () => {
      const props = makeProps({
        mode: 'node',
        selectedNodeCount: 1,
        selectedNodeKind: 'global',
        selectedNodeGlobalType: 'navigate',
      });
      renderMenu(props);
      fireEvent.click(screen.getByText('配置全局节点'));
      expect(props.onConfigureGlobal).toHaveBeenCalledTimes(1);
    });

    it('未传入 onLocateComponent 时即使满足条件也不显示定位项', () => {
      renderMenu(
        makeProps({
          mode: 'node',
          selectedNodeCount: 1,
          selectedNodeKind: 'component',
          selectedNodeHasComponentId: true,
          onLocateComponent: undefined,
        }),
      );
      expect(screen.queryByText('定位到画布组件')).not.toBeInTheDocument();
    });

    it('condition / delay / comment 节点不显示专属项', () => {
      const { rerender } = render(
        <BlueprintContextMenu
          {...makeProps({
            mode: 'node',
            selectedNodeCount: 1,
            selectedNodeKind: 'condition',
          })}
        >
          <div data-testid="canvas-child" />
        </BlueprintContextMenu>,
      );
      expect(screen.queryByText('定位到画布组件')).not.toBeInTheDocument();
      expect(screen.queryByText('配置全局节点')).not.toBeInTheDocument();

      rerender(
        <BlueprintContextMenu
          {...makeProps({
            mode: 'node',
            selectedNodeCount: 1,
            selectedNodeKind: 'delay',
          })}
        >
          <div data-testid="canvas-child" />
        </BlueprintContextMenu>,
      );
      expect(screen.queryByText('定位到画布组件')).not.toBeInTheDocument();
      expect(screen.queryByText('配置全局节点')).not.toBeInTheDocument();
    });
  });
});
