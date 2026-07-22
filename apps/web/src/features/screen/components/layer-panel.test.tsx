import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

/**
 * LayerPanel 集成测试（Phase 2 Slice A）
 *
 * 覆盖：
 * - 命令描述符驱动的右键菜单渲染（when/enabled/separator）
 * - 「重命名」触发 inline input；Enter 提交 / Escape 取消
 * - 「右键未选中行 → 先选中该行」的行业惯例
 * - 分组行右键菜单（锁定/显隐/删除作用于子组件批量）
 *
 * 测试策略：
 * - mock editor-store 提供最小可控 state
 * - mock @dnd-kit 以避免 jsdom 中的真实拖拽初始化
 * - mock @/components/ui/context-menu：ContextMenuContent 始终渲染（绕过 Radix 在 jsdom 中
 *   的 pointer event 限制），ContextMenuItem 点击触发 onSelect；这样能直接断言菜单项
 *   渲染与命令执行，Radix 自身的开闭行为由其单元测试覆盖
 */

vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: vi.fn(),
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({
    children,
    ...rest
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid={rest['data-testid'] ?? 'layer-context-menu'}>{children}</div>
  ),
  ContextMenuSeparator: () => <div data-testid="layer-context-menu-separator" />,
  ContextMenuItem: ({
    children,
    onSelect,
    disabled,
    variant,
    ...rest
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
    variant?: string;
  } & Record<string, unknown>) => (
    <div
      data-testid={(rest['data-testid'] as string) ?? 'layer-context-menu-item'}
      data-disabled={disabled ? 'true' : undefined}
      data-variant={variant}
      onClick={() => {
        if (!disabled && onSelect) onSelect();
      }}
    >
      {children}
    </div>
  ),
}));

import { useScreenEditorStore } from '../stores/editor-store';
import { LayerPanel } from './layer-panel';
import type { ScreenComponent } from '@nebula/shared';

interface StoreState {
  project: {
    components: ScreenComponent[];
  } | null;
  selectedComponentIds: string[];
  activeGroupId: string | null;
  selectComponent: ReturnType<typeof vi.fn>;
  selectComponents: ReturnType<typeof vi.fn>;
  setLocked: ReturnType<typeof vi.fn>;
  setHidden: ReturnType<typeof vi.fn>;
  reorderToTop: ReturnType<typeof vi.fn>;
  reorderToBottom: ReturnType<typeof vi.fn>;
  reorderLayerToIndex: ReturnType<typeof vi.fn>;
  groupSelected: ReturnType<typeof vi.fn>;
  ungroupSelected: ReturnType<typeof vi.fn>;
  renameComponent: ReturnType<typeof vi.fn>;
  copySelectedToClipboard: ReturnType<typeof vi.fn>;
  duplicateSelected: ReturnType<typeof vi.fn>;
  removeSelectedComponents: ReturnType<typeof vi.fn>;
  setActiveGroupId: ReturnType<typeof vi.fn>;
}

const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn> & {
  getState: () => StoreState;
};

function makeComp(overrides: Partial<ScreenComponent> & { id: string }): ScreenComponent {
  return {
    type: 'rect',
    name: `comp-${overrides.id}`,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    props: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
    ...overrides,
  } as unknown as ScreenComponent;
}

function makeStore(overrides: Partial<StoreState> = {}): StoreState {
  return {
    project: { components: [] },
    selectedComponentIds: [],
    activeGroupId: null,
    selectComponent: vi.fn(),
    selectComponents: vi.fn(),
    setLocked: vi.fn(),
    setHidden: vi.fn(),
    reorderToTop: vi.fn(),
    reorderToBottom: vi.fn(),
    reorderLayerToIndex: vi.fn(),
    groupSelected: vi.fn(),
    ungroupSelected: vi.fn(),
    renameComponent: vi.fn(),
    copySelectedToClipboard: vi.fn(),
    duplicateSelected: vi.fn(),
    removeSelectedComponents: vi.fn(),
    setActiveGroupId: vi.fn(),
    ...overrides,
  };
}

function setStoreState(state: StoreState): void {
  // useScreenEditorStore 支持两种调用形式：(selector) => value 与无参 getState()
  mockUseStore.mockImplementation((selector?: (s: StoreState) => unknown) => {
    if (typeof selector === 'function') return selector(state);
    return state;
  });
  // 暴露 getState 给 LayerPanel 内部的 useScreenEditorStore.getState() 调用
  mockUseStore.getState = () => state;
}

let originalGetElementById: typeof document.getElementById;

beforeEach(() => {
  originalGetElementById = document.getElementById;
});

/** 触发右键菜单：在 jsdom 中通过 fireEvent.contextMenu 触发 onContextMenu 回调 */
function openContextMenuOnRow(row: HTMLElement): void {
  fireEvent.contextMenu(row);
}

describe('LayerPanel · 命令描述符驱动右键菜单（Phase 2 Slice A）', () => {
  let store: StoreState;

  beforeEach(() => {
    store = makeStore();
    setStoreState(store);
  });

  it('单选时菜单包含架构规定的全部命令', () => {
    const a = makeComp({ id: 'a', zIndex: 1 });
    const b = makeComp({ id: 'b', zIndex: 0 });
    setStoreState(
      makeStore({
        project: { components: [a, b] },
        selectedComponentIds: ['a'],
      }),
    );

    render(<LayerPanel />);
    const menus = screen.getAllByTestId('layer-context-menu');
    // 第一行（顶层 a）的菜单
    const menu = menus[0];
    expect(within(menu).getByTestId('layer-command-rename')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-copy')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-duplicate')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-toggle-lock')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-toggle-hide')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-bring-to-front')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-bring-forward')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-send-backward')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-send-to-back')).toBeInTheDocument();
    expect(within(menu).getByTestId('layer-command-delete')).toBeInTheDocument();
  });

  it('多选时「重命名」「上移/下移一层」隐藏，「成组」显示', () => {
    const a = makeComp({ id: 'a', zIndex: 1 });
    const b = makeComp({ id: 'b', zIndex: 0 });
    setStoreState(
      makeStore({
        project: { components: [a, b] },
        selectedComponentIds: ['a', 'b'],
      }),
    );

    render(<LayerPanel />);
    const menus = screen.getAllByTestId('layer-context-menu');
    const menu = menus[0];
    expect(within(menu).queryByTestId('layer-command-rename')).toBeNull();
    expect(within(menu).queryByTestId('layer-command-bring-forward')).toBeNull();
    expect(within(menu).queryByTestId('layer-command-send-backward')).toBeNull();
    expect(within(menu).getByTestId('layer-command-group')).toBeInTheDocument();
  });

  it('选中<2 时「成组」隐藏', () => {
    const a = makeComp({ id: 'a', zIndex: 1 });
    setStoreState(
      makeStore({
        project: { components: [a] },
        selectedComponentIds: ['a'],
      }),
    );

    render(<LayerPanel />);
    const menu = screen.getByTestId('layer-context-menu');
    expect(within(menu).queryByTestId('layer-command-group')).toBeNull();
  });

  it('右键未选中行 → 调用 selectComponent(id)（行业惯例）', () => {
    const a = makeComp({ id: 'a', name: '组件 A', zIndex: 1 });
    const b = makeComp({ id: 'b', name: '组件 B', zIndex: 0 });
    store = makeStore({
      project: { components: [a, b] },
      selectedComponentIds: ['b'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    // 顶层组件行由 SortableLayerRow（data-testid="layer-row"）包裹，但 onContextMenu
    // 在内层 div 上；通过组件名文本定位内层行，再触发 contextmenu
    const aRow = screen.getByText('组件 A').closest('div');
    if (!aRow) throw new Error('a 行未渲染');
    openContextMenuOnRow(aRow);

    expect(store.selectComponent).toHaveBeenCalledWith('a');
  });

  it('右键已选中行 → 不重复调用 selectComponent', () => {
    const a = makeComp({ id: 'a', zIndex: 1 });
    setStoreState(
      makeStore({
        project: { components: [a] },
        selectedComponentIds: ['a'],
      }),
    );

    render(<LayerPanel />);
    openContextMenuOnRow(screen.getByTestId('layer-row'));

    expect(store.selectComponent).not.toHaveBeenCalled();
  });
});

describe('LayerPanel · 命令执行接入', () => {
  let store: StoreState;

  beforeEach(() => {
    store = makeStore();
    setStoreState(store);
  });

  it('点击「重命名」→ 切到 inline input 编辑态', () => {
    const a = makeComp({ id: 'a', name: '原始名', zIndex: 1 });
    setStoreState(
      makeStore({
        project: { components: [a] },
        selectedComponentIds: ['a'],
      }),
    );

    render(<LayerPanel />);
    fireEvent.click(screen.getByTestId('layer-command-rename'));

    expect(screen.getByTestId('layer-rename-input')).toBeInTheDocument();
    expect((screen.getByTestId('layer-rename-input') as HTMLInputElement).value).toBe('原始名');
  });

  it('inline input: Enter 提交 → renameComponent 调用并退出编辑态', () => {
    const a = makeComp({ id: 'a', name: '原始名', zIndex: 1 });
    store = makeStore({
      project: { components: [a] },
      selectedComponentIds: ['a'],
    });
    setStoreState(store);

    // document.getElementById 被 InlineRenameInput 用于读取当前值
    document.getElementById = vi.fn((id: string) => {
      if (id === 'layer-rename-input-a') {
        return { value: '新名称' } as HTMLInputElement;
      }
      return originalGetElementById.call(document, id);
    });

    render(<LayerPanel />);
    fireEvent.click(screen.getByTestId('layer-command-rename'));

    const input = screen.getByTestId('layer-rename-input');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(store.renameComponent).toHaveBeenCalledWith('a', '新名称');
    expect(screen.queryByTestId('layer-rename-input')).toBeNull();
  });

  it('inline input: Escape 取消 → 不调用 renameComponent，退出编辑态', () => {
    const a = makeComp({ id: 'a', name: '原始名', zIndex: 1 });
    setStoreState(
      makeStore({
        project: { components: [a] },
        selectedComponentIds: ['a'],
      }),
    );

    render(<LayerPanel />);
    fireEvent.click(screen.getByTestId('layer-command-rename'));

    const input = screen.getByTestId('layer-rename-input');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(store.renameComponent).not.toHaveBeenCalled();
    expect(screen.queryByTestId('layer-rename-input')).toBeNull();
  });

  it('inline input: 提交空字符串 → 不调用 renameComponent', () => {
    const a = makeComp({ id: 'a', name: '原始名', zIndex: 1 });
    store = makeStore({
      project: { components: [a] },
      selectedComponentIds: ['a'],
    });
    setStoreState(store);

    document.getElementById = vi.fn((id: string) => {
      if (id === 'layer-rename-input-a') {
        return { value: '   ' } as HTMLInputElement;
      }
      return originalGetElementById.call(document, id);
    });

    render(<LayerPanel />);
    fireEvent.click(screen.getByTestId('layer-command-rename'));
    fireEvent.keyDown(screen.getByTestId('layer-rename-input'), { key: 'Enter' });

    expect(store.renameComponent).not.toHaveBeenCalled();
  });

  it('点击「删除」→ 调用 removeSelectedComponents', () => {
    const a = makeComp({ id: 'a', zIndex: 1 });
    store = makeStore({
      project: { components: [a] },
      selectedComponentIds: ['a'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    fireEvent.click(screen.getByTestId('layer-command-delete'));

    expect(store.removeSelectedComponents).toHaveBeenCalled();
  });

  it('点击「锁定」→ 调用 setLocked(ids, true)', () => {
    const a = makeComp({ id: 'a', zIndex: 1, status: { locked: false, hidden: false } });
    store = makeStore({
      project: { components: [a] },
      selectedComponentIds: ['a'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    fireEvent.click(screen.getByTestId('layer-command-toggle-lock'));

    expect(store.setLocked).toHaveBeenCalledWith(['a'], true);
  });

  it('点击「置于顶层」→ 调用 reorderToTop(id)', () => {
    const a = makeComp({ id: 'a', zIndex: 1 });
    const b = makeComp({ id: 'b', zIndex: 0 });
    store = makeStore({
      project: { components: [a, b] },
      selectedComponentIds: ['a'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    // 顶层菜单是 a 的（zIndex 高者在前）
    const menu = screen.getAllByTestId('layer-context-menu')[0];
    fireEvent.click(within(menu).getByTestId('layer-command-bring-to-front'));

    expect(store.reorderToTop).toHaveBeenCalledWith('a');
  });

  it('点击「上移一层」→ 调用 reorderLayerToIndex(id, idx-1)', () => {
    const top = makeComp({ id: 'top', zIndex: 2 });
    const a = makeComp({ id: 'a', zIndex: 1 });
    store = makeStore({
      project: { components: [top, a] },
      selectedComponentIds: ['a'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    // a 的菜单是第二个（topLevelOrdered = [top, a]）
    const menus = screen.getAllByTestId('layer-context-menu');
    const menuA = menus[1];
    fireEvent.click(within(menuA).getByTestId('layer-command-bring-forward'));

    expect(store.reorderLayerToIndex).toHaveBeenCalledWith('a', 0);
  });

  it('点击「下移一层」→ 调用 reorderLayerToIndex(id, idx+1)', () => {
    const top = makeComp({ id: 'top', zIndex: 2 });
    const a = makeComp({ id: 'a', zIndex: 1 });
    store = makeStore({
      project: { components: [top, a] },
      selectedComponentIds: ['top'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    // top 的菜单是第一个
    const menus = screen.getAllByTestId('layer-context-menu');
    const menuTop = menus[0];
    fireEvent.click(within(menuTop).getByTestId('layer-command-send-backward'));

    expect(store.reorderLayerToIndex).toHaveBeenCalledWith('top', 1);
  });
});

describe('LayerPanel · 分组行右键菜单', () => {
  it('右键分组行 → selectComponents(子组件 ID)', () => {
    const c1 = makeComp({ id: 'c1', parentId: 'group-1', zIndex: 1 });
    const c2 = makeComp({ id: 'c2', parentId: 'group-1', zIndex: 0 });
    const store = makeStore({
      project: { components: [c1, c2] },
      selectedComponentIds: [],
    });
    setStoreState(store);

    render(<LayerPanel />);
    const groupRow = screen.getByText('组 1').closest('div');
    if (!groupRow) throw new Error('分组行未渲染');
    openContextMenuOnRow(groupRow);

    expect(store.selectComponents).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('分组行菜单：rename/copy/bring-to-front 隐藏，锁定/显隐/删除显示', () => {
    const c1 = makeComp({ id: 'c1', parentId: 'group-1', zIndex: 1 });
    const c2 = makeComp({ id: 'c2', parentId: 'group-1', zIndex: 0 });
    const store = makeStore({
      project: { components: [c1, c2] },
      selectedComponentIds: ['c1', 'c2'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    // 分组行渲染在子组件之前：menus[0] 是分组行菜单，其后是 c1/c2 的菜单
    const menus = screen.getAllByTestId('layer-context-menu');
    const groupMenu = menus[0];

    expect(within(groupMenu).queryByTestId('layer-command-rename')).toBeNull();
    expect(within(groupMenu).queryByTestId('layer-command-copy')).toBeNull();
    expect(within(groupMenu).queryByTestId('layer-command-bring-to-front')).toBeNull();
    expect(within(groupMenu).getByTestId('layer-command-toggle-lock')).toBeInTheDocument();
    expect(within(groupMenu).getByTestId('layer-command-toggle-hide')).toBeInTheDocument();
    expect(within(groupMenu).getByTestId('layer-command-delete')).toBeInTheDocument();
  });

  it('分组行点击「锁定」→ setLocked 作用于子组件 ID', () => {
    const c1 = makeComp({ id: 'c1', parentId: 'group-1', zIndex: 1 });
    const c2 = makeComp({ id: 'c2', parentId: 'group-1', zIndex: 0 });
    const store = makeStore({
      project: { components: [c1, c2] },
      selectedComponentIds: ['c1', 'c2'],
    });
    setStoreState(store);

    render(<LayerPanel />);
    const menus = screen.getAllByTestId('layer-context-menu');
    const groupMenu = menus[0];
    fireEvent.click(within(groupMenu).getByTestId('layer-command-toggle-lock'));

    expect(store.setLocked).toHaveBeenCalledWith(['c1', 'c2'], true);
  });
});
