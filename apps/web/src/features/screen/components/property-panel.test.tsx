import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

// Mock editor-store：属性面板依赖 zustand store，测试用 vi.fn() 替换以便控制返回值
vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: vi.fn(),
}));

import { useScreenEditorStore } from '../stores/editor-store';
import { PropertyPanel } from './property-panel';
import type { ScreenComponent, CanvasConfig } from '@nebula/shared';

/** 测试用 store 状态结构（仅包含 PropertyPanel 读取的字段） */
interface StoreState {
  project: {
    components: ScreenComponent[];
    canvas: CanvasConfig;
  } | null;
  selectedComponentIds: string[];
  updateComponent: ReturnType<typeof vi.fn>;
  updateCanvas: ReturnType<typeof vi.fn>;
  removeComponent: ReturnType<typeof vi.fn>;
}

/** 创建默认画布配置 */
function createCanvas(): CanvasConfig {
  return {
    width: 1920,
    height: 1080,
    backgroundColor: '#000000',
    scaleMode: 'fit',
  };
}

/** 创建最小可用组件（type='shape' 不触发文本/图表专属字段） */
function makeComponent(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'comp-a',
    type: 'shape',
    name: 'Component A',
    position: { x: 10, y: 20, width: 100, height: 50 },
    style: {},
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 0,
    ...overrides,
  };
}

/** 将 mock useScreenEditorStore 转为可操控的 Mock 函数 */
const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn>;

/** 当前测试用 store 状态（mock 闭包读取此变量） */
let currentState: StoreState;

/** 设置 store 状态并让 mock 返回对应字段的值 */
function setStoreState(state: StoreState): void {
  currentState = state;
  mockUseStore.mockImplementation((selector: (s: StoreState) => unknown) => selector(currentState));
}

/** 通过 label 文本查找同级容器内的 input 元素（NumberInput 的 label 与 input 为兄弟节点） */
function findInputByLabel(label: string): HTMLInputElement {
  const labelEl = screen.getByText(label, { exact: true });
  const container = labelEl.parentElement;
  if (!container) throw new Error(`label "${label}" has no parent element`);
  const input = container.querySelector('input');
  if (!input) throw new Error(`no input found for label "${label}"`);
  return input;
}

describe('PropertyPanel', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
  });

  describe('渲染', () => {
    it('选中单个组件时在面板头部显示组件名称', () => {
      const component = makeComponent({ id: 'comp-a', name: '矩形 A' });
      setStoreState({
        project: { components: [component], canvas: createCanvas() },
        selectedComponentIds: ['comp-a'],
        updateComponent: vi.fn(),
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      render(<PropertyPanel />);

      expect(screen.getByText('矩形 A')).toBeDefined();
      expect(screen.getByText('位置与尺寸')).toBeDefined();
    });

    it('未选中组件时显示画布设置', () => {
      setStoreState({
        project: { components: [], canvas: createCanvas() },
        selectedComponentIds: [],
        updateComponent: vi.fn(),
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      render(<PropertyPanel />);

      expect(screen.getByText('画布设置')).toBeDefined();
    });
  });

  describe('切换选中对象时重置输入上下文', () => {
    it('从组件 A 切换到组件 B 后，不会把 A 的草稿提交到 B', () => {
      // 关键场景：A 和 B 的 x 坐标相同（都为 10）。
      // 若无 syncKey，切换后 value 不变（10→10），NumberInput 的 useEffect 不会触发，
      // draft '15' 保留；blur 时 commit 把 15 提交给 B —— 这正是要防止的缺陷。
      const componentA = makeComponent({
        id: 'comp-a',
        name: '组件 A',
        position: { x: 10, y: 20, width: 100, height: 50 },
      });
      const componentB = makeComponent({
        id: 'comp-b',
        name: '组件 B',
        position: { x: 10, y: 20, width: 100, height: 50 },
      });

      const updateComponent = vi.fn();

      setStoreState({
        project: { components: [componentA, componentB], canvas: createCanvas() },
        selectedComponentIds: ['comp-a'],
        updateComponent,
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      const { rerender } = render(<PropertyPanel />);

      // 在 A 的 X 输入框中输入 draft '15'（不提交）
      const xInput = findInputByLabel('X');
      fireEvent.focus(xInput);
      fireEvent.change(xInput, { target: { value: '15' } });
      expect(xInput.value).toBe('15');

      // 切换选中到组件 B（x 值与 A 相同，都为 10）
      currentState.selectedComponentIds = ['comp-b'];
      rerender(<PropertyPanel />);

      // syncKey 变化（comp-a:position.x → comp-b:position.x）后旧 draft 被清除，显示 B 的值 10
      expect(xInput.value).toBe('10');

      // blur 不应把 A 的草稿 '15' 提交到 B
      fireEvent.blur(xInput);
      expect(updateComponent).not.toHaveBeenCalled();
    });

    it('切换到 B 后编辑 B 的字段会正确提交到 B（而非 A）', () => {
      const componentA = makeComponent({
        id: 'comp-a',
        name: '组件 A',
        position: { x: 10, y: 20, width: 100, height: 50 },
      });
      const componentB = makeComponent({
        id: 'comp-b',
        name: '组件 B',
        position: { x: 10, y: 20, width: 100, height: 50 },
      });

      const updateComponent = vi.fn();

      setStoreState({
        project: { components: [componentA, componentB], canvas: createCanvas() },
        selectedComponentIds: ['comp-a'],
        updateComponent,
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      const { rerender } = render(<PropertyPanel />);

      // 在 A 上输入 draft（不提交）
      const xInputA = findInputByLabel('X');
      fireEvent.focus(xInputA);
      fireEvent.change(xInputA, { target: { value: '15' } });

      // 切换到 B
      currentState.selectedComponentIds = ['comp-b'];
      rerender(<PropertyPanel />);

      // 在 B 上正常编辑并提交
      const xInputB = findInputByLabel('X');
      fireEvent.focus(xInputB);
      fireEvent.change(xInputB, { target: { value: '25' } });
      fireEvent.blur(xInputB);

      // 应提交到 B（comp-b），值为 25；不应提交到 A
      expect(updateComponent).toHaveBeenCalledWith('comp-b', {
        position: { x: 25, y: 20, width: 100, height: 50 },
      });
      expect(updateComponent).not.toHaveBeenCalledWith('comp-a', expect.anything());
    });
  });

  describe('变换提交到 Store 后属性面板显示最新值', () => {
    // 当前设计：拖拽/缩放/旋转过程中只修改 DOM，结束时才通过 updateComponent 提交到 Store。
    // 属性面板订阅 components 数组（property-panel.tsx 第 427 行），updateComponent 用 .map()
    // 产生新数组引用（editor-store.ts 第 290-294 行）触发细粒度订阅重渲染，
    // 因此变换结束后属性面板数值会同步到最新值；过程中不实时同步，符合当前设计。

    it('拖拽提交到 Store 后，属性面板显示新的 x/y', () => {
      const component = makeComponent({
        id: 'comp-a',
        name: '矩形 A',
        position: { x: 10, y: 20, width: 100, height: 50 },
      });

      setStoreState({
        project: { components: [component], canvas: createCanvas() },
        selectedComponentIds: ['comp-a'],
        updateComponent: vi.fn(),
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      const { rerender } = render(<PropertyPanel />);

      // 初始值
      expect(findInputByLabel('X').value).toBe('10');
      expect(findInputByLabel('Y').value).toBe('20');

      // 模拟拖拽 onDragEnd 提交到 Store：updateComponent 用 .map() 产生新数组引用
      currentState.project = {
        ...currentState.project!,
        components: [
          {
            ...component,
            position: { ...component.position, x: 150, y: 250 },
          },
        ],
      };
      rerender(<PropertyPanel />);

      // 属性面板显示新的 x/y（验证实际显示值，而非仅数组引用变化）
      expect(findInputByLabel('X').value).toBe('150');
      expect(findInputByLabel('Y').value).toBe('250');
    });

    it('缩放提交到 Store 后，属性面板显示新的 width/height', () => {
      const component = makeComponent({
        id: 'comp-a',
        name: '矩形 A',
        position: { x: 10, y: 20, width: 100, height: 50 },
      });

      setStoreState({
        project: { components: [component], canvas: createCanvas() },
        selectedComponentIds: ['comp-a'],
        updateComponent: vi.fn(),
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      const { rerender } = render(<PropertyPanel />);

      expect(findInputByLabel('宽').value).toBe('100');
      expect(findInputByLabel('高').value).toBe('50');

      // 模拟缩放 onResizeEnd 提交到 Store
      currentState.project = {
        ...currentState.project!,
        components: [
          {
            ...component,
            position: { ...component.position, width: 200, height: 120 },
          },
        ],
      };
      rerender(<PropertyPanel />);

      // 属性面板显示新的 width/height
      expect(findInputByLabel('宽').value).toBe('200');
      expect(findInputByLabel('高').value).toBe('120');
    });

    it('旋转提交到 Store 后，属性面板显示新的 rotation', () => {
      // 初始 rotation 为 30（非 0，使旋转字段可见；PositionFields 仅在 rotation 非零时渲染）
      const component = makeComponent({
        id: 'comp-a',
        name: '矩形 A',
        position: { x: 10, y: 20, width: 100, height: 50, rotation: 30 },
      });

      setStoreState({
        project: { components: [component], canvas: createCanvas() },
        selectedComponentIds: ['comp-a'],
        updateComponent: vi.fn(),
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      const { rerender } = render(<PropertyPanel />);

      expect(findInputByLabel('旋转').value).toBe('30');

      // 模拟旋转 onRotateEnd 提交到 Store
      currentState.project = {
        ...currentState.project!,
        components: [
          {
            ...component,
            position: { ...component.position, rotation: 45 },
          },
        ],
      };
      rerender(<PropertyPanel />);

      // 属性面板显示新的 rotation
      expect(findInputByLabel('旋转').value).toBe('45');
    });
  });

  describe('画布设置连续输入的单条历史语义（任务 8.3）', () => {
    it('宽度数值连续输入仅在提交时调用一次 updateCanvas（draft 提交语义）', () => {
      const updateCanvas = vi.fn();
      setStoreState({
        project: { components: [], canvas: createCanvas() },
        selectedComponentIds: [],
        updateComponent: vi.fn(),
        updateCanvas,
        removeComponent: vi.fn(),
      });

      render(<PropertyPanel />);

      // 连续输入多个字符（模拟用户逐键输入 '1280'）：draft 阶段不提交
      const widthInput = findInputByLabel('宽度');
      fireEvent.focus(widthInput);
      fireEvent.change(widthInput, { target: { value: '1' } });
      fireEvent.change(widthInput, { target: { value: '12' } });
      fireEvent.change(widthInput, { target: { value: '128' } });
      fireEvent.change(widthInput, { target: { value: '1280' } });
      expect(updateCanvas).not.toHaveBeenCalled();

      // Blur 提交：一次业务修改只产生一次 updateCanvas 调用（即只入栈一条历史）
      fireEvent.blur(widthInput);
      expect(updateCanvas).toHaveBeenCalledTimes(1);
      expect(updateCanvas).toHaveBeenCalledWith({ width: 1280 });
    });

    it('宽度数值未变化时提交不调用 updateCanvas（不产生空历史记录）', () => {
      const updateCanvas = vi.fn();
      setStoreState({
        project: { components: [], canvas: createCanvas() },
        selectedComponentIds: [],
        updateComponent: vi.fn(),
        updateCanvas,
        removeComponent: vi.fn(),
      });

      render(<PropertyPanel />);

      // 聚焦后未做任何修改直接 blur：NumberInput 检测到值未变化，不触发 onChange
      const widthInput = findInputByLabel('宽度');
      fireEvent.focus(widthInput);
      fireEvent.blur(widthInput);
      expect(updateCanvas).not.toHaveBeenCalled();
    });

    it('背景颜色选择一次变更只调用一次 updateCanvas', () => {
      const updateCanvas = vi.fn();
      setStoreState({
        project: { components: [], canvas: createCanvas() },
        selectedComponentIds: [],
        updateComponent: vi.fn(),
        updateCanvas,
        removeComponent: vi.fn(),
      });

      const { container } = render(<PropertyPanel />);

      // 画布设置区仅有一个取色器（背景）
      const colorInput = container.querySelector('input[type="color"]');
      if (!colorInput) throw new Error('color input not found');
      fireEvent.change(colorInput, { target: { value: '#ff0000' } });

      expect(updateCanvas).toHaveBeenCalledTimes(1);
      expect(updateCanvas).toHaveBeenCalledWith({ backgroundColor: '#ff0000' });
    });
  });

  describe('bar-chart 四层分组（阶段 2 任务 4.1）', () => {
    function makeBarChartComponent(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
      return makeComponent({
        id: 'chart-1',
        type: 'bar-chart',
        name: '柱状图',
        position: { x: 0, y: 0, width: 400, height: 300 },
        props: { title: '销售', data: [{ name: '一月', value: 30 }] },
        ...overrides,
      });
    }

    function setSelectedComponent(component: ScreenComponent): void {
      setStoreState({
        project: { components: [component], canvas: createCanvas() },
        selectedComponentIds: [component.id],
        updateComponent: vi.fn(),
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });
    }

    it('选中 bar-chart 时按数据、逻辑、视觉、交互四层分组展示且顺序固定', () => {
      setSelectedComponent(makeBarChartComponent());

      const { container } = render(<PropertyPanel />);

      const sections = container.querySelectorAll('section[data-testid$="-section"]');
      expect([...sections].map((el) => el.getAttribute('data-testid'))).toEqual([
        'datasource-section',
        'logic-section',
        'visual-section',
        'interaction-section',
      ]);
      expect(within(screen.getByTestId('datasource-section')).getByText('数据')).toBeDefined();
      expect(within(screen.getByTestId('logic-section')).getByText('逻辑')).toBeDefined();
      expect(within(screen.getByTestId('visual-section')).getByText('视觉')).toBeDefined();
      expect(within(screen.getByTestId('interaction-section')).getByText('交互')).toBeDefined();
    });

    it('分组归属：各层配置项归入对应分组', () => {
      setSelectedComponent(makeBarChartComponent());

      render(<PropertyPanel />);

      // 数据层：静态数据编辑器与字段映射下拉
      const datasource = screen.getByTestId('datasource-section');
      expect(within(datasource).getByTestId('static-data-editor')).toBeDefined();
      expect(within(datasource).getByRole('combobox', { name: '维度字段' })).toBeDefined();
      expect(within(datasource).getByRole('combobox', { name: '数值字段' })).toBeDefined();

      // 逻辑层：排序字段、排序方向、条数限制
      const logic = screen.getByTestId('logic-section');
      expect(within(logic).getByRole('combobox', { name: '排序字段' })).toBeDefined();
      expect(within(logic).getByRole('combobox', { name: '排序方向' })).toBeDefined();
      expect(within(logic).getByRole('spinbutton', { name: '条数限制' })).toBeDefined();

      // 视觉层：标题与既有样式编辑归入视觉分组
      const visual = screen.getByTestId('visual-section');
      expect(within(visual).getByText('标题')).toBeDefined();
      expect(within(visual).getByText('样式')).toBeDefined();
      expect(within(visual).getByText('背景')).toBeDefined();

      // 交互层：悬停提示开关
      const interaction = screen.getByTestId('interaction-section');
      expect(within(interaction).getByRole('switch', { name: '悬停提示' })).toBeDefined();
    });

    it('既有位置与尺寸编辑保留且行为不回退', () => {
      const updateComponent = vi.fn();
      const component = makeBarChartComponent();
      setStoreState({
        project: { components: [component], canvas: createCanvas() },
        selectedComponentIds: [component.id],
        updateComponent,
        updateCanvas: vi.fn(),
        removeComponent: vi.fn(),
      });

      render(<PropertyPanel />);

      const xInput = findInputByLabel('X');
      expect(xInput.value).toBe('0');
      fireEvent.focus(xInput);
      fireEvent.change(xInput, { target: { value: '12' } });
      fireEvent.blur(xInput);
      expect(updateComponent).toHaveBeenCalledTimes(1);
      expect(updateComponent).toHaveBeenCalledWith('chart-1', {
        position: { x: 12, y: 0, width: 400, height: 300 },
      });
    });

    it('非图表组件（shape）不出现四层分组，既有样式编辑不回退', () => {
      setSelectedComponent(makeComponent({ id: 'shape-1', type: 'shape', name: '矩形' }));

      render(<PropertyPanel />);

      expect(screen.queryByTestId('datasource-section')).toBeNull();
      expect(screen.queryByTestId('logic-section')).toBeNull();
      expect(screen.queryByTestId('visual-section')).toBeNull();
      expect(screen.queryByTestId('interaction-section')).toBeNull();
      expect(screen.getByText('位置与尺寸')).toBeDefined();
      expect(screen.getByText('样式')).toBeDefined();
    });

    it('非图表组件（text）不出现数据源分组，文本属性编辑不回退', () => {
      setSelectedComponent(makeComponent({ id: 'text-1', type: 'text', name: '文本' }));

      render(<PropertyPanel />);

      expect(screen.queryByTestId('datasource-section')).toBeNull();
      expect(screen.queryByTestId('logic-section')).toBeNull();
      expect(screen.queryByTestId('interaction-section')).toBeNull();
      expect(screen.getByText('文本属性')).toBeDefined();
    });
  });
});
