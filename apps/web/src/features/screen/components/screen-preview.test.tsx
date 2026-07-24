import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';

/**
 * ScreenPreview 通过 useParams 与 useScreenPreview 自取数据，不接收外部 props。
 * 测试用 vi.mock 替换这两个 hook，使组件渲染受控的 project 数据。
 * ComponentRenderer 也被 mock，返回带 data-testid 的简单 div，便于断言"哪些组件被渲染"
 * 以及让组件容器与编辑器专用 UI（Moveable/Selecto/辅助线/选中态）解耦。
 */
vi.mock('@tanstack/react-router', () => ({
  useParams: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useScreenPreview: vi.fn(),
}));

vi.mock('../registry/renderer', () => ({
  ComponentRenderer: ({ component }: { component: { id: string; name: string } }): JSX.Element => (
    <div data-testid={`renderer-${component.id}`}>{component.name}</div>
  ),
}));

import { useParams } from '@tanstack/react-router';
import { useScreenPreview } from '../hooks';
import { resolveComponentContainerStyle } from '../registry/component-container-style';
import { ScreenPreview } from './screen-preview';
import type { CanvasConfig, ScreenComponent, ScreenProject } from '@nebula/shared';

const mockUseParams = useParams as unknown as ReturnType<typeof vi.fn>;
const mockUseScreenPreview = useScreenPreview as unknown as ReturnType<typeof vi.fn>;

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

/** 组装最小可用 ScreenProject */
function makeProject(components: ScreenComponent[]): ScreenProject {
  return {
    id: 'proj-1',
    name: '测试项目',
    canvas: createCanvas(),
    components,
    status: 'published',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

/** 一次性配置 useParams + useScreenPreview 的返回值 */
function setProject(project: ScreenProject | null, isLoading = false): void {
  mockUseParams.mockReturnValue({ id: project?.id ?? 'proj-1' });
  mockUseScreenPreview.mockReturnValue({ data: project, isLoading });
}

describe('ScreenPreview', () => {
  beforeEach(() => {
    mockUseParams.mockReset();
    mockUseScreenPreview.mockReset();
  });

  describe('隐藏组件过滤', () => {
    it('过滤 status.hidden=true 的组件，不渲染其内容', () => {
      const visible = makeComponent({ id: 'vis', name: '可见组件' });
      const hidden = makeComponent({
        id: 'hid',
        name: '隐藏组件',
        status: { locked: false, hidden: true },
      });
      setProject(makeProject([visible, hidden]));

      render(<ScreenPreview />);

      expect(screen.getByText('可见组件')).toBeDefined();
      expect(screen.getByTestId('renderer-vis')).toBeDefined();
      expect(screen.queryByText('隐藏组件')).toBeNull();
      expect(screen.queryByTestId('renderer-hid')).toBeNull();
    });

    it('所有组件均可见时全部渲染', () => {
      const a = makeComponent({ id: 'comp-a', name: '组件 A', zIndex: 2 });
      const b = makeComponent({ id: 'comp-b', name: '组件 B', zIndex: 1 });
      setProject(makeProject([a, b]));

      render(<ScreenPreview />);

      expect(screen.getByText('组件 A')).toBeDefined();
      expect(screen.getByText('组件 B')).toBeDefined();
    });

    it('所有组件均隐藏时画布为空但不报错', () => {
      const hidden = makeComponent({
        id: 'hid',
        name: '隐藏组件',
        status: { locked: false, hidden: true },
      });
      setProject(makeProject([hidden]));

      const { container } = render(<ScreenPreview />);

      expect(screen.queryByText('隐藏组件')).toBeNull();
      // 画布容器仍应存在，只是没有组件子节点
      expect(container.querySelector('[data-testid="renderer-hid"]')).toBeNull();
    });
  });

  describe('不渲染编辑器选中态', () => {
    it('组件容器不包含 data-component-id 属性（编辑器选中标识）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      const { container } = render(<ScreenPreview />);

      // data-component-id 是 ScreenCanvas 的 CanvasComponentWrapper 专用属性，
      // 用于 Selecto 命中与 Moveable 拖拽目标解析，预览不应出现
      const withId = container.querySelectorAll('[data-component-id]');
      expect(withId).toHaveLength(0);
    });

    it('组件容器无 outline 样式（不渲染未选中辅助边框/选中态边框）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      render(<ScreenPreview />);

      // 找到包裹 ComponentRenderer 的容器 div（resolveComponentContainerStyle 的输出）
      const renderer = screen.getByTestId('renderer-comp-a');
      const wrapper = renderer.parentElement;
      expect(wrapper).not.toBeNull();
      // 编辑器中 CanvasComponentWrapper 会写入 outline（showBorderGuides/选中态），
      // 预览使用 resolveComponentContainerStyle，不应包含 outline
      expect((wrapper as HTMLElement).style.outline).toBe('');
    });
  });

  describe('不渲染辅助线与对齐浮层', () => {
    it('不渲染 Smart Guides 辅助线浮层（无 aria-hidden 对齐线容器）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      const { container } = render(<ScreenPreview />);

      // SmartGuidesOverlay 容器为 <div className="pointer-events-none absolute inset-0 z-50" aria-hidden="true">
      // 预览不应出现该浮层
      const ariaHiddenOverlays = container.querySelectorAll('[aria-hidden="true"]');
      expect(ariaHiddenOverlays).toHaveLength(0);
    });

    it('不渲染任何 dashed border 元素（活动分组包围盒/对齐线均使用虚线）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      const { container } = render(<ScreenPreview />);

      // ActiveGroupOutline 用 '1.5px dashed rgb(59 130 246 / 0.7)'
      // SmartGuidesOverlay 用 borderTop/borderLeft '1px dashed ...'
      // 预览中所有 border* 样式都不应包含 dashed
      const all = container.querySelectorAll('*');
      const dashed = Array.from(all).filter((el) => {
        const style = (el as HTMLElement).style;
        return (
          style.border.includes('dashed') ||
          style.borderTop.includes('dashed') ||
          style.borderLeft.includes('dashed') ||
          style.borderRight.includes('dashed') ||
          style.borderBottom.includes('dashed')
        );
      });
      expect(dashed).toHaveLength(0);
    });
  });

  describe('不渲染交互控件', () => {
    it('不渲染 Moveable 控件（无 moveable 相关 class 元素）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      const { container } = render(<ScreenPreview />);

      // react-moveable 渲染的控件元素 class 均含 "moveable" 前缀
      const moveableEls = container.querySelectorAll('[class*="moveable"]');
      expect(moveableEls).toHaveLength(0);
    });

    it('不渲染 Selecto 框选控件（无 selecto 相关 class 元素）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      const { container } = render(<ScreenPreview />);

      // react-selecto 渲染的选框元素 class 含 "selecto" 前缀
      const selectoEls = container.querySelectorAll('[class*="selecto"]');
      expect(selectoEls).toHaveLength(0);
    });

    it('不渲染尺寸/位置提示浮层（DimensionTooltip 的 X:/Y:/W:/H: 文本）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      render(<ScreenPreview />);

      // DimensionTooltip 文本形如 "X:10px Y:20px W:100px H:50px"
      // 预览不应出现该提示
      expect(screen.queryByText(/X:\d+px\s+Y:\d+px/)).toBeNull();
    });

    it('不渲染选中态相关的 cursor 样式（编辑器专用拖拽/平移光标）', () => {
      const comp = makeComponent({ id: 'comp-a', name: '组件A' });
      setProject(makeProject([comp]));

      const { container } = render(<ScreenPreview />);

      // ScreenCanvas 根容器会根据 spaceHeld/altHeld/isPanning 设置 cursor: grabbing/grab/copy
      // 预览根容器不应携带这些编辑器专用光标
      const root = container.firstElementChild as HTMLElement;
      expect(root).not.toBeNull();
      const cursor = root.style.cursor;
      expect(cursor === 'grabbing' || cursor === 'grab' || cursor === 'copy').toBe(false);
    });
  });

  describe('加载与空态边界', () => {
    it('isLoading 时渲染加载占位（不渲染组件内容）', () => {
      mockUseParams.mockReturnValue({ id: 'proj-1' });
      mockUseScreenPreview.mockReturnValue({ data: null, isLoading: true });

      render(<ScreenPreview />);

      expect(screen.queryByTestId('renderer-comp-a')).toBeNull();
    });

    it('project 为空时渲染未发布提示（不渲染组件内容）', () => {
      setProject(null);

      render(<ScreenPreview />);

      expect(screen.getByText('大屏项目不存在或未发布')).toBeDefined();
      expect(screen.queryByTestId('renderer-comp-a')).toBeNull();
    });
  });

  describe('公共样式解析（任务 10.3）', () => {
    /**
     * 编辑器（screen-canvas.tsx 的 CanvasComponentWrapper）与预览（screen-preview.tsx）
     * 均使用 resolveComponentContainerStyle 解析组件容器样式（任务 3.3/3.4）。
     * 以下测试验证预览容器实际样式与 resolveComponentContainerStyle 输出一致，
     * 并以旋转为强制断言——删除预览旋转逻辑（如停止使用 resolveComponentContainerStyle）
     * 会使测试失败。
     */
    it('预览容器渲染非零旋转的 transform: translate(...) rotate(<angle>deg)', () => {
      const comp = makeComponent({
        id: 'comp-rot',
        name: '旋转组件',
        position: { x: 10, y: 20, width: 100, height: 50, rotation: 45 },
      });
      setProject(makeProject([comp]));

      render(<ScreenPreview />);

      const renderer = screen.getByTestId('renderer-comp-rot');
      const wrapper = renderer.parentElement as HTMLElement;
      expect(wrapper).not.toBeNull();
      // 旋转为强制断言：删除预览旋转逻辑会使此断言失败
      // Canvas Drag Optimization：transform 始终含 translate（位置由 transform 控制）
      expect(wrapper.style.transform).toBe('translate(10px, 20px) rotate(45deg)');
    });

    it('预览容器样式与 resolveComponentContainerStyle 输出一致（编辑器与预览共享同一解析函数）', () => {
      const comp = makeComponent({
        id: 'comp-style',
        name: '样式组件',
        position: { x: 12, y: 34, width: 560, height: 780, rotation: 30 },
        style: {
          opacity: 0.8,
          borderWidth: 2,
          borderColor: '#ff0000',
          borderStyle: 'solid',
          borderRadius: 8,
          backgroundColor: '#abcdef',
          overflow: 'visible',
        },
        zIndex: 9,
      });
      setProject(makeProject([comp]));

      render(<ScreenPreview />);

      const renderer = screen.getByTestId('renderer-comp-style');
      const wrapper = renderer.parentElement as HTMLElement;
      expect(wrapper).not.toBeNull();

      // 预览容器样式应与 resolveComponentContainerStyle 输出一致
      // 编辑器（screen-canvas.tsx）与预览（screen-preview.tsx）共享同一解析函数，
      // 任何字段漂移都会导致此断言失败
      const expected = resolveComponentContainerStyle(comp);
      expect(wrapper.style.position).toBe(expected.position);
      expect(wrapper.style.left).toBe(`${expected.left}px`);
      expect(wrapper.style.top).toBe(`${expected.top}px`);
      expect(wrapper.style.width).toBe(`${expected.width}px`);
      expect(wrapper.style.height).toBe(`${expected.height}px`);
      expect(wrapper.style.zIndex).toBe(`${expected.zIndex}`);
      expect(wrapper.style.opacity).toBe(`${expected.opacity}`);
      expect(wrapper.style.overflow).toBe(expected.overflow);
      // 旋转为强制断言
      expect(wrapper.style.transform).toBe(expected.transform);
    });

    it('零旋转时 transform 仅含 translate（与 resolveComponentContainerStyle 一致）', () => {
      const comp = makeComponent({
        id: 'comp-no-rot',
        name: '无旋转组件',
        position: { x: 10, y: 20, width: 100, height: 50 },
      });
      setProject(makeProject([comp]));

      render(<ScreenPreview />);

      const renderer = screen.getByTestId('renderer-comp-no-rot');
      const wrapper = renderer.parentElement as HTMLElement;
      expect(wrapper).not.toBeNull();
      // Canvas Drag Optimization：零旋转时 transform 仅含 translate（位置由 transform 控制）
      expect(wrapper.style.transform).toBe('translate(10px, 20px)');
    });

    it('负角度旋转同样生成 translate(...) rotate(<angle>deg)', () => {
      const comp = makeComponent({
        id: 'comp-neg-rot',
        name: '负旋转组件',
        position: { x: 10, y: 20, width: 100, height: 50, rotation: -90 },
      });
      setProject(makeProject([comp]));

      render(<ScreenPreview />);

      const renderer = screen.getByTestId('renderer-comp-neg-rot');
      const wrapper = renderer.parentElement as HTMLElement;
      expect(wrapper).not.toBeNull();
      // 旋转为强制断言：负角度也应正确渲染
      expect(wrapper.style.transform).toBe('translate(10px, 20px) rotate(-90deg)');
    });
  });
});
