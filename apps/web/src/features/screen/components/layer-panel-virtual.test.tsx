import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

/**
 * LayerPanel 虚拟滚动测试
 *
 * 覆盖：
 * - 阈值以下保持原有 dnd-kit 渲染路径（不出现虚拟列表容器）
 * - 阈值以上启用虚拟滚动（出现 layer-virtual-list），扁平化渲染所有行
 * - 虚拟滚动下顶层组件行保留 data-testid="layer-row" 与 data-component-id（E2E 定位契约）
 * - 虚拟滚动下分组头与子组件均正确渲染；折叠分组不渲染子组件
 * - 虚拟滚动下右键未选中行 → 选中该行（与非虚拟化路径行为一致）
 *
 * 测试策略：
 * - mock @tanstack/react-virtual 的 useVirtualizer：依据传入 count 返回全部虚拟项
 *   （视口视为无限大），从而验证 LayerPanel 与虚拟化路径的集成渲染结构，
 *   而非 virtualizer 自身的滚动计算（那是第三方库职责）。
 * - mock editor-store / @dnd-kit / context-menu 与 layer-panel.test.tsx 保持一致。
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

// mock useVirtualizer：依据 count 返回全部虚拟项，使虚拟化路径完整渲染所有扁平行。
// 每个虚拟项 start = index * ROW_SIZE（与 estimateSize=40 一致），便于断言 transform。
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 40,
        size: 40,
        end: i * 40 + 40,
        key: i,
        lane: 0,
      })),
    getTotalSize: () => count * 40,
    measureElement: vi.fn(),
  }),
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
  };
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
  mockUseStore.mockImplementation((selector?: (s: StoreState) => unknown) => {
    if (typeof selector === 'function') return selector(state);
    return state;
  });
  mockUseStore.getState = () => state;
}

/** 构造 N 个顶层组件（zIndex 降序，与 buildLayerTree 排序一致） */
function makeTopLevelComponents(n: number): ScreenComponent[] {
  return Array.from({ length: n }, (_, i) =>
    makeComp({ id: `c${i}`, name: `组件 ${i}`, zIndex: n - i }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LayerPanel · 虚拟滚动启用条件', () => {
  it('扁平行数 ≤ 阈值（50）→ 不启用虚拟滚动，沿用 DndContext 渲染路径', () => {
    // 49 个顶层组件：扁平行数 = 49，未超阈值
    setStoreState(makeStore({ project: { components: makeTopLevelComponents(49) } }));

    render(<LayerPanel />);

    expect(screen.queryByTestId('layer-virtual-list')).toBeNull();
    // 49 个组件均通过 SortableLayerRow 渲染（data-testid="layer-row" 由 SortableLayerRow 提供）
    expect(screen.getAllByTestId('layer-row')).toHaveLength(49);
  });

  it('扁平行数 > 阈值（50）→ 启用虚拟滚动，出现 layer-virtual-list', () => {
    setStoreState(makeStore({ project: { components: makeTopLevelComponents(60) } }));

    render(<LayerPanel />);

    expect(screen.getByTestId('layer-virtual-list')).toBeInTheDocument();
    // 60 个顶层组件行均渲染（mock 视口为无限大）
    expect(screen.getAllByTestId('layer-row')).toHaveLength(60);
  });
});

describe('LayerPanel · 虚拟滚动下顶层组件行属性契约', () => {
  it('顶层组件行保留 data-testid="layer-row" 与 data-component-id（E2E 定位契约）', () => {
    const comps = makeTopLevelComponents(60);
    setStoreState(makeStore({ project: { components: comps } }));

    render(<LayerPanel />);

    // 第一个顶层组件（zIndex 最高，排在最前）。虚拟化路径下 60 行均有 testid，取首个。
    const firstRow = screen.getAllByTestId('layer-row')[0];
    expect(firstRow.getAttribute('data-component-id')).toBe(comps[0].id);
    // 验证 translateY 偏移：首行 start=0
    expect(firstRow.style.transform).toBe('translateY(0px)');
  });

  it('虚拟行应用 transform: translateY 定位（按虚拟项 start 偏移）', () => {
    setStoreState(makeStore({ project: { components: makeTopLevelComponents(60) } }));

    render(<LayerPanel />);

    const rows = screen.getAllByTestId('layer-row');
    // 第 3 行（index=2）的 start = 2 * 40 = 80
    expect(rows[2].style.transform).toBe('translateY(80px)');
  });
});

describe('LayerPanel · 虚拟滚动下分组渲染', () => {
  it('展开的分组：分组头与所有子组件均渲染为独立扁平行', () => {
    // 1 个分组（49 子组件）+ 1 个顶层组件 = 51 行，超过阈值启用虚拟化
    const groupChildren = Array.from({ length: 49 }, (_, i) =>
      makeComp({ id: `g-c${i}`, name: `子组件 ${i}`, parentId: 'group-1', zIndex: 49 - i }),
    );
    const top = makeComp({ id: 'top', name: '顶层', zIndex: 100 });
    setStoreState(makeStore({ project: { components: [top, ...groupChildren] } }));

    render(<LayerPanel />);

    expect(screen.getByTestId('layer-virtual-list')).toBeInTheDocument();
    // 分组头存在
    expect(screen.getByText('组 1')).toBeInTheDocument();
    // 顶层组件存在
    expect(screen.getByText('顶层')).toBeInTheDocument();
    // 子组件全部渲染（虚拟化 mock 视口无限大）
    expect(screen.getAllByText(/^子组件 \d+$/)).toHaveLength(49);
  });

  it('折叠的分组：仅渲染分组头，子组件不渲染', () => {
    const groupChildren = Array.from({ length: 49 }, (_, i) =>
      makeComp({ id: `g-c${i}`, name: `子组件 ${i}`, parentId: 'group-1', zIndex: 49 - i }),
    );
    const top = makeComp({ id: 'top', name: '顶层', zIndex: 100 });
    setStoreState(makeStore({ project: { components: [top, ...groupChildren] } }));

    render(<LayerPanel />);

    // 折叠分组：buildLayerTree 默认全部展开（collapsed 初始空 Set），需要手动触发折叠
    const groupHeader = screen.getByText('组 1').closest('div');
    if (!groupHeader) throw new Error('分组头未渲染');
    // 点击折叠按钮（aria-label="折叠"）
    const collapseBtn = screen.getByLabelText('折叠');
    fireEvent.click(collapseBtn);

    // 折叠后子组件不再渲染
    expect(screen.queryAllByText(/^子组件 \d+$/)).toHaveLength(0);
    // 分组头仍在
    expect(screen.getByText('组 1')).toBeInTheDocument();
  });
});

describe('LayerPanel · 虚拟滚动下右键菜单行为', () => {
  it('右键未选中行 → 调用 selectComponent(id)（与非虚拟化路径一致）', () => {
    const comps = makeTopLevelComponents(60);
    const store = makeStore({
      project: { components: comps },
      selectedComponentIds: [comps[1].id], // 已选中第二行
    });
    setStoreState(store);

    render(<LayerPanel />);

    // 虚拟化路径下 testid 在外层定位 div，但 onContextMenu 绑定在内层 renderComponent 的 div 上。
    // 通过组件名文本定位内层 div，再触发 contextmenu，确保事件目标在内层 onContextMenu 路径上。
    const firstRow = screen.getByText(comps[0].name).closest('div');
    if (!firstRow) throw new Error('首行未渲染');
    fireEvent.contextMenu(firstRow);

    expect(store.selectComponent).toHaveBeenCalledWith(comps[0].id);
  });

  it('右键已选中行 → 不重复调用 selectComponent', () => {
    const comps = makeTopLevelComponents(60);
    const store = makeStore({
      project: { components: comps },
      selectedComponentIds: [comps[0].id], // 已选中第一行
    });
    setStoreState(store);

    render(<LayerPanel />);

    const firstRow = screen.getByText(comps[0].name).closest('div');
    if (!firstRow) throw new Error('首行未渲染');
    fireEvent.contextMenu(firstRow);

    expect(store.selectComponent).not.toHaveBeenCalled();
  });

  it('右键分组头 → 选中所有子组件', () => {
    const groupChildren = Array.from({ length: 49 }, (_, i) =>
      makeComp({ id: `g-c${i}`, name: `子组件 ${i}`, parentId: 'group-1', zIndex: 49 - i }),
    );
    const top = makeComp({ id: 'top', name: '顶层', zIndex: 100 });
    const store = makeStore({ project: { components: [top, ...groupChildren] } });
    setStoreState(store);

    render(<LayerPanel />);

    // 分组头 onContextMenu 绑定在 renderGroupHeader 的 groupRow div 上，通过文本定位该 div
    const groupHeader = screen.getByText('组 1').closest('div');
    if (!groupHeader) throw new Error('分组头未渲染');
    fireEvent.contextMenu(groupHeader);

    expect(store.selectComponents).toHaveBeenCalledWith(groupChildren.map((c) => c.id));
  });

  it('分组行右键菜单：锁定/显隐/删除显示，重命名/复制/置顶隐藏', () => {
    const groupChildren = Array.from({ length: 49 }, (_, i) =>
      makeComp({ id: `g-c${i}`, name: `子组件 ${i}`, parentId: 'group-1', zIndex: 49 - i }),
    );
    const top = makeComp({ id: 'top', name: '顶层', zIndex: 100 });
    setStoreState(
      makeStore({
        project: { components: [top, ...groupChildren] },
        selectedComponentIds: groupChildren.map((c) => c.id),
      }),
    );

    render(<LayerPanel />);

    // mock 的 ContextMenuContent 始终渲染（绕过 Radix 开闭），所有菜单 div 按 DOM 顺序排列。
    // flatRows = [top(0), group-1(1), g-c0(2), ...]，对应菜单顺序：menus[0]=top, menus[1]=group。
    const menus = screen.getAllByTestId('layer-context-menu');
    const groupMenu = menus[1];

    expect(within(groupMenu).queryByTestId('layer-command-rename')).toBeNull();
    expect(within(groupMenu).queryByTestId('layer-command-copy')).toBeNull();
    expect(within(groupMenu).queryByTestId('layer-command-bring-to-front')).toBeNull();
    expect(within(groupMenu).getByTestId('layer-command-toggle-lock')).toBeInTheDocument();
    expect(within(groupMenu).getByTestId('layer-command-toggle-hide')).toBeInTheDocument();
    expect(within(groupMenu).getByTestId('layer-command-delete')).toBeInTheDocument();
  });
});
