import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import type { ScreenComponent, ScreenProject } from '@nebula/shared';
import { ScreenCanvas } from './screen-canvas';
import { useScreenEditorStore } from '../stores/editor-store';
import { pickImageFile } from '../lib/image-file-adapter';
import type {
  InteractionState,
  InteractionStateMachineApi,
} from '../hooks/use-interaction-state-machine';
import type { EditorTool } from '../hooks/tool-registry';
import { TOOL_REGISTRY, getToolById } from '../hooks/tool-registry';

/**
 * 共享修饰键 ref：测试用例通过 modifierRefs.shiftRef.current / altRef.current
 * 切换 Shift/Alt 状态，模拟 PS 风格拖拽过程中按键按下/松开。
 * 用 vi.hoisted 声明，保证 vi.mock 工厂提升时能引用到同一份对象。
 */
const modifierRefs = vi.hoisted(() => ({
  spaceRef: { current: false },
  shiftRef: { current: false },
  altRef: { current: false },
  ctrlRef: { current: false },
}));

/**
 * ScreenCanvas 交互测试（任务 2.3 ~ 13.8）
 *
 * 测试策略：
 * - mock react-moveable 和 react-selecto，捕获传入的 props
 * - mock useScreenEditorStore 提供最小可用数据
 * - 不 mock tool-registry，验证画布消费真实 TOOL_REGISTRY 能力定义
 *
 * 减负策略（覆盖率不变）：
 * - 工具能力/cursor/Selecto disabled 等逐工具断言统一收敛为 TOOL_REGISTRY 遍历，
 *   单测即可覆盖全部工具组合，替代按工具逐个展开的重复用例
 * - 状态机互斥矩阵（平移/框选/缩放/拖拽等）收敛为参数化矩阵循环
 * - 相同前置条件的成功/失败场景合并为单测内多场景断言
 */

interface CapturedMoveableProps {
  draggable: boolean;
  resizable: boolean;
  rotatable: boolean;
  target: unknown;
  onDragStart?: (e: unknown) => boolean | void;
  onDrag?: (e: unknown) => void;
  onResizeStart?: (e: unknown) => boolean | void;
  onRotateStart?: (e: unknown) => boolean | void;
  onDragGroupStart?: (e: unknown) => boolean | void;
  onDragGroup?: (e: unknown) => void;
  onResizeGroupStart?: (e: unknown) => boolean | void;
  /**
   * 任务 13.8：捕获 Moveable *End 回调，用于验证零位移手势（isDrag=false）
   * 结束时仍派发 pointer-up 恢复交互状态机。
   */
  onDragEnd?: (e: unknown) => void;
  onResizeEnd?: (e: unknown) => void;
  onRotateEnd?: (e: unknown) => void;
  onDragGroupEnd?: (e: unknown) => void;
  onResizeGroupEnd?: (e: unknown) => void;
  /**
   * 任务 13.7：捕获 Moveable 实例引用，用于测试 dragStart 外部触发。
   *
   * 生产代码中 onSelectEnd 末尾通过 setTimeout(() => moveableRef.current?.dragStart(e), 0)
   * 外部触发拖拽。测试需要调用该方法验证 guard 逻辑。
   */
  dragStart?: (e: unknown) => void;
}

interface CapturedSelectoProps {
  selectByClick: boolean;
  selectableTargets: unknown;
  disabled?: boolean;
  /**
   * 任务 12.2：捕获 Selecto onDragStart 回调，便于在测试中直接调用，
   * 模拟不同 interactionState 下的重入场景。
   */
  onDragStart?: (e: MockSelectoDragEvent) => void | boolean;
  /**
   * 任务 13.7：捕获 Selecto onSelectEnd 回调，用于测试 setTimeout dragStart guard。
   */
  onSelectEnd?: (e: MockSelectoSelectEndEvent) => void;
}

/**
 * Mock Selecto 的 onDragStart 事件形状。
 *
 * 任务 4.1：Selecto 不再使用 disabled prop，而是通过 onDragStart 中 e.stop() 阻止
 * 非选择工具启动框选。mock 在渲染时调用 onDragStart 一次，根据是否调用 stop()
 * 推断 disabled 状态，使测试可继续用 `capturedSelecto.disabled` 断言。
 *
 * 任务 12.2：同时捕获 onDragStart 回调本身，便于测试在不同 interactionState 下
 * 直接调用回调验证状态机仲裁（与 Moveable mock 一致的策略）。
 */
interface MockSelectoDragEvent {
  target: HTMLElement | null;
  datas: Record<string, unknown>;
  stop: () => void;
  inputEvent?: { target?: unknown } | null;
}

/**
 * 任务 13.7：Mock Selecto onSelectEnd 事件形状。
 *
 * 仅包含生产代码 onSelectEnd handler 读取的字段：
 * - selected：被选中的 DOM 元素数组（通过 getComponentIdFromTarget 提取 id）
 * - inputEvent：原始鼠标事件（用于 handleSelectEnd 读取修饰键 + setTimeout dragStart）
 * - isDragStart：是否为点击（非拖拽框选），控制是否触发 dragStart
 */
interface MockSelectoSelectEndEvent {
  selected: HTMLElement[];
  inputEvent: MouseEvent;
  isDragStart: boolean;
}

let capturedMoveable: CapturedMoveableProps | null = null;
let capturedSelecto: CapturedSelectoProps | null = null;

/**
 * 任务 13.7：moveableDragStartSpy 用于跟踪 moveableRef.current?.dragStart(e) 调用。
 *
 * 生产代码 onSelectEnd 末尾通过 setTimeout(() => moveableRef.current?.dragStart(e), 0)
 * 外部触发拖拽。测试需要验证 guard 是否阻止了 dragStart 的调用。
 *
 * 不调用 props.onDragStart 是因为 onDragStart 内部调用 getComponentIdFromTarget(e.target)，
 * 而测试环境 MouseEvent.target 为 null，会导致提前 return false，
 * 无法通过 dispatchInteraction('start-drag') 间接验证 dragStart 是否被调用。
 * 直接 spy dragStart 更准确且不依赖 Moveable 内部事件构造逻辑。
 */
const moveableDragStartSpy = vi.fn();

vi.mock('react-moveable', () => ({
  default: forwardRef(function MockMoveable(
    props: CapturedMoveableProps & { children?: ReactNode },
    ref,
  ) {
    capturedMoveable = {
      draggable: props.draggable,
      resizable: props.resizable,
      rotatable: props.rotatable,
      target: props.target,
      onDragStart: props.onDragStart,
      onDrag: props.onDrag,
      onResizeStart: props.onResizeStart,
      onRotateStart: props.onRotateStart,
      onDragGroupStart: props.onDragGroupStart,
      onDragGroup: props.onDragGroup,
      onResizeGroupStart: props.onResizeGroupStart,
      // 任务 13.8：捕获 *End 回调
      onDragEnd: props.onDragEnd,
      onResizeEnd: props.onResizeEnd,
      onRotateEnd: props.onRotateEnd,
      onDragGroupEnd: props.onDragGroupEnd,
      onResizeGroupEnd: props.onResizeGroupEnd,
      // 任务 13.7：dragStart 作为 spy，不调用 onDragStart（避免 target 依赖）
      dragStart: moveableDragStartSpy,
    };
    // 任务 13.7：通过 useImperativeHandle 设置 moveableRef.current，
    // 使生产代码的 moveableRef.current?.dragStart(e) 调用能路由到 mock。
    // 同时提供 updateRect 等实例方法，避免生产代码 useEffect 调用时 TypeError。
    useImperativeHandle(
      ref,
      () =>
        ({
          ...capturedMoveable,
          updateRect: () => {},
          updateTarget: () => {},
          dragEnd: () => {},
          isMoveableElement: () => false,
        }) as unknown as never,
      [],
    );
    return null;
  }),
}));

vi.mock('react-selecto', () => ({
  default: function MockSelecto(
    props: CapturedSelectoProps & {
      onDragStart?: (e: MockSelectoDragEvent) => void | boolean;
      onSelectEnd?: (e: MockSelectoSelectEndEvent) => void;
    },
  ) {
    let stopped = false;
    const fakeEvent: MockSelectoDragEvent = {
      target: null,
      datas: {},
      stop: () => {
        stopped = true;
      },
    };
    // 调用 onDragStart 以推断 Selecto 是否会被禁用（与生产代码 e.stop() 语义一致）
    props.onDragStart?.(fakeEvent);
    capturedSelecto = {
      selectByClick: props.selectByClick,
      selectableTargets: props.selectableTargets,
      disabled: stopped,
      // 任务 12.2：捕获 onDragStart 回调，便于测试直接调用验证状态机仲裁
      onDragStart: props.onDragStart,
      // 任务 13.7：捕获 onSelectEnd 回调，便于测试触发 setTimeout dragStart
      onSelectEnd: props.onSelectEnd,
    };
    return null;
  },
}));

vi.mock('../stores/editor-store', () => ({
  useScreenEditorStore: vi.fn(),
}));

vi.mock('../hooks/use-modifier-keys', () => ({
  useModifierKeys: () => ({
    ...modifierRefs,
    spaceHeld: modifierRefs.spaceRef.current,
    shiftHeld: modifierRefs.shiftRef.current,
    altHeld: modifierRefs.altRef.current,
    ctrlHeld: modifierRefs.ctrlRef.current,
  }),
}));

/**
 * 任务 7.4：mock pickImageFile 以控制文件选择结果。
 * 默认返回 null（用户取消），各测试可通过 vi.mocked(pickImageFile).mockResolvedValue
 * 覆盖行为。
 */
vi.mock('../lib/image-file-adapter', () => ({
  pickImageFile: vi.fn().mockResolvedValue(null),
  ImageFileError: class ImageFileError extends Error {
    constructor(
      message: string,
      public readonly code: 'INVALID_TYPE' | 'READ_FAILED' | 'LOAD_FAILED',
    ) {
      super(message);
      this.name = 'ImageFileError';
    }
  },
}));

const mockUseStore = useScreenEditorStore as unknown as ReturnType<typeof vi.fn>;

function makeProject(): ScreenProject {
  return {
    id: 'p1',
    name: '测试大屏',
    description: null,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [
      {
        id: 'c1',
        type: 'shape',
        name: '矩形 1',
        position: { x: 100, y: 100, width: 200, height: 150 },
        style: {},
        props: {},
        status: { locked: false, hidden: false },
        zIndex: 0,
      },
    ],
    status: 'draft',
    thumbnail: null,
    createdAt: '2025-06-01 10:00:00',
    updatedAt: '2025-06-01 10:00:00',
  };
}

function setupStore(
  overrides: {
    selectedComponentIds?: string[];
    canvasScale?: number;
    canvasOffset?: { x: number; y: number };
  } = {},
) {
  const project = makeProject();
  const selectedComponentIds = overrides.selectedComponentIds ?? ['c1'];
  const store: Record<string, unknown> = {
    project,
    canvasScale: overrides.canvasScale ?? 1,
    canvasOffset: overrides.canvasOffset ?? { x: 0, y: 0 },
    selectedComponentIds,
    showBorderGuides: false,
    activeGroupId: null,
    guides: { visible: true, vertical: [], horizontal: [] },
    snapEnabled: false,
    smartGuidesEnabled: false,
    gridEnabled: false,
    gridSize: 10,
    selectComponents: vi.fn(),
    clearSelection: vi.fn(),
    setActiveGroupId: vi.fn(),
    updateComponent: vi.fn(),
    updateComponentsBatch: vi.fn(),
    duplicateSelectedToPosition: vi.fn(),
    setCanvasScaleAndOffset: vi.fn(),
    // 任务 5.2：文字工具点击创建需要 addComponent / selectComponent / removeComponent
    addComponent: vi.fn(),
    selectComponent: vi.fn(),
    removeComponent: vi.fn(),
  };
  mockUseStore.mockImplementation(<T,>(selector: (s: typeof store) => T): T => selector(store));
  return store;
}

/**
 * 构造最小可用的 editorSession。
 * 统一各测试重复编写的 session 字面量；dispatchInteraction 可外部传入以便断言。
 */
function makeSession(
  activeTool: EditorTool,
  interactionState: InteractionState = 'idle',
  dispatchInteraction: ReturnType<typeof vi.fn> = vi.fn(),
) {
  const tool = getToolById(activeTool);
  if (!tool) throw new Error(`未知工具: ${activeTool}`);
  return {
    activeTool,
    activeCapabilities: tool.capabilities,
    dispatchInteraction: dispatchInteraction as InteractionStateMachineApi['dispatch'],
    interactionState,
    textEditing: null,
    beginTextEditing: vi.fn(),
    endTextEditing: vi.fn(),
    isEditingText: false,
  };
}

function renderCanvas(activeTool: EditorTool) {
  capturedMoveable = null;
  capturedSelecto = null;
  const session = makeSession(activeTool);
  const { container } = render(<ScreenCanvas editorSession={session} />) as unknown as {
    container: HTMLElement;
  };
  return { container, session };
}

describe('任务 2.3：activeTool 接入 ScreenCanvas 能力派生', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  it('TOOL_REGISTRY 所有工具：Moveable/Selecto props 与能力定义一一对应', () => {
    // 单一数据源验证：画布派生 props 必须严格等于注册表能力。
    // 一次遍历覆盖 select 全能力、hand/创建/缩放工具全禁用等全部组合，
    // 替代按工具逐个展开的重复断言。
    for (const tool of TOOL_REGISTRY) {
      renderCanvas(tool.id);
      const caps = tool.capabilities;
      expect(capturedMoveable!.draggable, `${tool.id} draggable`).toBe(caps.canDrag);
      expect(capturedMoveable!.resizable, `${tool.id} resizable`).toBe(caps.canResize);
      expect(capturedMoveable!.rotatable, `${tool.id} rotatable`).toBe(caps.canRotate);
      expect(capturedSelecto!.selectByClick, `${tool.id} selectByClick`).toBe(caps.canSelect);
    }
  });

  it('TOOL_REGISTRY 所有工具：容器 cursor 与工具 cursor 定义一致', () => {
    for (const tool of TOOL_REGISTRY) {
      const { container } = renderCanvas(tool.id);
      const canvasContainer = container.firstChild as HTMLElement;
      expect(canvasContainer.style.cursor, `${tool.id} cursor`).toBe(tool.cursor);
    }
  });

  it('吸管工具已移除，注册表不再包含 eyedropper', () => {
    // 阶段 1 移除吸管工具：无调色板等应用场景，不宣称无效能力
    expect(getToolById('eyedropper' as EditorTool)).toBeUndefined();
  });

  it('渲染画布容器（验证 mock 渲染正常）', () => {
    cleanup();
    const { container } = renderCanvas('select');
    // 容器 div 应被渲染（mock 的 Moveable/Selecto 返回 null，但外层 div 存在）
    const canvasContainer = container.firstChild as HTMLElement;
    expect(canvasContainer).toBeInTheDocument();
    expect(canvasContainer.className).toContain('bg-muted');
  });
});

describe('任务 4.1：选择工具成为 Selecto/Moveable 能力源', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  it('TOOL_REGISTRY 所有工具：Selecto disabled 与 !canSelect 一致', () => {
    // Selecto mock 渲染时调用一次 onDragStart，根据 e.stop() 推断 disabled。
    // 一次遍历覆盖 select（disabled=false）与全部非选择工具（disabled=true），
    // 替代按工具逐个展开的重复断言；Moveable 侧能力由任务 2.3 注册表遍历覆盖。
    for (const tool of TOOL_REGISTRY) {
      renderCanvas(tool.id);
      expect(capturedSelecto!.disabled, `${tool.id} disabled`).toBe(!tool.capabilities.canSelect);
    }
  });
});

describe('任务 4.2：抓手主工具支持直接平移', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  /**
   * 触发容器 pointerDown 事件，模拟用户在画布空白处按下指针。
   * 返回 dispatchInteraction mock，便于断言是否派发了 start-pan。
   */
  function triggerPointerDown(activeTool: EditorTool, button = 0) {
    const dispatchInteraction = vi.fn();
    const session = makeSession(activeTool, 'idle', dispatchInteraction);
    const { container } = render(<ScreenCanvas editorSession={session} />);
    const canvasContainer = container.firstChild as HTMLElement;
    fireEvent.pointerDown(canvasContainer, { button, clientX: 100, clientY: 100 });
    return dispatchInteraction;
  }

  it('抓手工具下左键按下派发 start-pan（无需 Space）', () => {
    expect(triggerPointerDown('hand')).toHaveBeenCalledWith('start-pan');
  });

  it('非抓手工具下左键按下均不派发 start-pan', () => {
    const nonHandTools: EditorTool[] = ['select', 'text', 'rect', 'ellipse', 'image', 'zoom'];
    for (const tool of nonHandTools) {
      expect(triggerPointerDown(tool), `${tool} 不应派发 start-pan`).not.toHaveBeenCalledWith(
        'start-pan',
      );
    }
  });

  it('抓手工具下右键按下不派发 start-pan（仅左键触发平移）', () => {
    expect(triggerPointerDown('hand', 2)).not.toHaveBeenCalledWith('start-pan');
  });
});

describe('任务 4.4：将平移状态切换为状态机仲裁', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  /**
   * 在指定 interactionState 下触发 hand 工具的 pointerDown，
   * 返回是否派发了 start-pan 事件。
   */
  function triggerPanInState(interactionState: InteractionState): boolean {
    const dispatchInteraction = vi.fn();
    const session = makeSession('hand', interactionState, dispatchInteraction);
    const { container } = render(<ScreenCanvas editorSession={session} />);
    const canvasContainer = container.firstChild as HTMLElement;
    fireEvent.pointerDown(canvasContainer, { button: 0, clientX: 100, clientY: 100 });
    return dispatchInteraction.mock.calls.some((call) => call[0] === 'start-pan');
  }

  it('互斥矩阵：仅 idle/hovering 允许开始平移，其余状态互斥防重入', () => {
    const matrix: Array<[InteractionState, boolean]> = [
      ['idle', true],
      ['hovering', true],
      ['dragging', false],
      ['resizing', false],
      ['rotating', false],
      ['marquee-selecting', false],
      ['panning', false],
      ['creating', false],
      ['text-editing', false],
      ['context-menu-open', false],
    ];
    for (const [state, allowed] of matrix) {
      expect(triggerPanInState(state), `${state} 应${allowed ? '允许' : '禁止'}平移`).toBe(allowed);
    }
  });
});

describe('任务 4.5：删除重复平移布尔状态（isPanning 从交互状态机派生）', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  it('idle→panning 切换时容器 cursor 从工具 cursor 派生为 grabbing', () => {
    // isPanning 派生验证：panning 态 cursor='grabbing'，idle 态 cursor=工具 cursor。
    // idle + 各工具 cursor 的完整映射由任务 2.3 注册表遍历覆盖，此处不重复。
    const dispatchInteraction = vi.fn();
    const session = makeSession('hand', 'idle', dispatchInteraction);
    const { container, rerender } = render(<ScreenCanvas editorSession={session} />);
    const canvasContainer = container.firstChild as HTMLElement;
    expect(canvasContainer.style.cursor).toBe('grab');

    // 模拟状态机进入 panning 后重新渲染
    rerender(<ScreenCanvas editorSession={{ ...session, interactionState: 'panning' }} />);
    expect(canvasContainer.style.cursor).toBe('grabbing');
  });
});

/**
 * 任务 6.3/6.4/6.5：矩形与椭圆拖拽创建
 *
 * 测试策略：
 * - 使用 setupStore 提供的 addComponent/selectComponent mock 捕获创建调用
 * - 触发 pointerDown → pointerMove → pointerUp 序列模拟拖拽
 * - 验证：
 *   1. 有效拖拽派发 start-create + commit-create，调用 addComponent
 *   2. 微小拖拽派发 start-create + cancel，不调用 addComponent
 *   3. 矩形和椭圆工具复用同一创建逻辑
 *   4. 创建期间不启动平移或选择
 */
describe('任务 6.3/6.4/6.5：矩形与椭圆拖拽创建', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    mockUseStore.mockReset();
    store = setupStore();
  });

  /**
   * 在指定工具下触发 pointerDown → pointerMove → pointerUp 拖拽序列。
   * clientX/Y 为屏幕坐标；canvasScale=1, canvasOffset={0,0}，屏幕坐标=画布坐标。
   */
  function triggerShapeDrag(
    activeTool: 'rect' | 'ellipse',
    fromXY: [number, number],
    toXY: [number, number],
  ) {
    const dispatchInteraction = vi.fn();
    const session = makeSession(activeTool, 'idle', dispatchInteraction);
    const { container } = render(<ScreenCanvas editorSession={session} />);
    const canvasContainer = container.firstChild as HTMLElement;
    fireEvent.pointerDown(canvasContainer, {
      button: 0,
      clientX: fromXY[0],
      clientY: fromXY[1],
    });
    fireEvent.pointerMove(canvasContainer, {
      clientX: toXY[0],
      clientY: toXY[1],
    });
    fireEvent.pointerUp(canvasContainer, {
      clientX: toXY[0],
      clientY: toXY[1],
    });
    return dispatchInteraction;
  }

  it('任务 6.3：矩形有效拖拽派发 start-create+commit-create 并写入正确位置', () => {
    const dispatchInteraction = triggerShapeDrag('rect', [100, 100], [300, 200]);
    expect(dispatchInteraction).toHaveBeenCalledWith('start-create');
    expect(dispatchInteraction).toHaveBeenCalledWith('commit-create');

    const addComponentMock = store.addComponent as Mock;
    expect(addComponentMock).toHaveBeenCalledTimes(1);
    const created = addComponentMock.mock.calls[0][0] as ScreenComponent;
    expect(created.type).toBe('rect');
    expect(created.position).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    expect(store.selectComponent).toHaveBeenCalledWith(created.id);
  });

  it('任务 6.4：椭圆有效拖拽创建椭圆组件', () => {
    triggerShapeDrag('ellipse', [50, 50], [250, 250]);

    const addComponentMock = store.addComponent as Mock;
    expect(addComponentMock).toHaveBeenCalledTimes(1);
    const created = addComponentMock.mock.calls[0][0] as ScreenComponent;
    expect(created.type).toBe('ellipse');
    expect(created.position).toEqual({ x: 50, y: 50, width: 200, height: 200 });
  });

  it('任务 6.4：反向拖拽（右下→左上）规范化位置', () => {
    triggerShapeDrag('ellipse', [250, 250], [50, 50]);

    const addComponentMock = store.addComponent as Mock;
    expect(addComponentMock).toHaveBeenCalledTimes(1);
    const created = addComponentMock.mock.calls[0][0] as ScreenComponent;
    expect(created.position).toEqual({ x: 50, y: 50, width: 200, height: 200 });
  });

  it('任务 6.3：微小拖拽（<4px）不创建组件，派发 cancel', () => {
    const dispatchInteraction = triggerShapeDrag('rect', [100, 100], [102, 102]);

    expect(store.addComponent).not.toHaveBeenCalled();
    expect(dispatchInteraction).toHaveBeenCalledWith('start-create');
    expect(dispatchInteraction).toHaveBeenCalledWith('cancel');
    expect(dispatchInteraction).not.toHaveBeenCalledWith('commit-create');
  });

  it('任务 6.5：创建工具拖拽均不派发 start-pan（创建与平移互斥）', () => {
    for (const tool of ['rect', 'ellipse'] as const) {
      const dispatchInteraction = triggerShapeDrag(tool, [100, 100], [300, 200]);
      expect(dispatchInteraction, `${tool} 不应派发 start-pan`).not.toHaveBeenCalledWith(
        'start-pan',
      );
    }
  });

  it('任务 6.5：创建工具右键按下均不派发 start-create', () => {
    for (const tool of ['rect', 'ellipse'] as const) {
      const dispatchInteraction = vi.fn();
      const session = makeSession(tool, 'idle', dispatchInteraction);
      const { container } = render(<ScreenCanvas editorSession={session} />);
      fireEvent.pointerDown(container.firstChild as HTMLElement, {
        button: 2,
        clientX: 100,
        clientY: 100,
      });
      expect(dispatchInteraction, `${tool} 右键`).not.toHaveBeenCalledWith('start-create');
    }
  });
});

/**
 * 任务 7.4：图片工具点击创建
 *
 * 测试策略：
 * - 顶层 vi.mock('../lib/image-file-adapter') 已将 pickImageFile 替换为 mock
 * - 各测试通过 vi.mocked(pickImageFile).mockResolvedValue/mockRejectedValue 控制结果
 * - 触发 pointerDown 模拟用户在画布点击
 * - 验证：
 *   1. 用户选择文件：派发 start-create + commit-create，调用 addComponent
 *   2. 用户取消 / 读取失败：派发 start-create + cancel，不调用 addComponent
 *   3. 图片组件 props.src 为 data URL（任务 7.1 资源契约）
 *   4. 图片尺寸按自然尺寸等比缩放（maxImageDimension 约束）
 */
describe('任务 7.4：图片工具点击创建', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    mockUseStore.mockReset();
    store = setupStore();
    vi.clearAllMocks();
    // 默认重置为用户取消
    vi.mocked(pickImageFile).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 触发图片工具下的 pointerDown，返回 dispatchInteraction mock。
   * 调用前应先配置 vi.mocked(pickImageFile) 的返回值。
   */
  async function triggerImageClick() {
    const dispatchInteraction = vi.fn();
    const session = makeSession('image', 'idle', dispatchInteraction);
    const { container } = render(<ScreenCanvas editorSession={session} />);
    fireEvent.pointerDown(container.firstChild as HTMLElement, {
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    // 等待异步 handleCreateImage 调用 pickImageFile
    await vi.waitFor(() => {
      expect(pickImageFile).toHaveBeenCalled();
    });
    return dispatchInteraction;
  }

  it('任务 7.4：选择文件后派发 start-create+commit-create 并写入图片组件', async () => {
    vi.mocked(pickImageFile).mockResolvedValue({
      dataUrl: 'data:image/png;base64,ABC',
      width: 400,
      height: 300,
      name: 'test.png',
    });
    const dispatchInteraction = await triggerImageClick();
    await vi.waitFor(() => {
      expect(store.addComponent).toHaveBeenCalledTimes(1);
    });
    expect(dispatchInteraction).toHaveBeenCalledWith('start-create');
    expect(dispatchInteraction).toHaveBeenCalledWith('commit-create');

    const created = (store.addComponent as Mock).mock.calls[0][0] as ScreenComponent;
    expect(created.type).toBe('image');
    // 尺寸使用图片自然尺寸（400x300 在 maxImageDimension=800 之内，不缩放）
    expect(created.position).toEqual({ x: 100, y: 100, width: 400, height: 300 });
    // 资源契约：props.src 为 data URL（任务 7.1）
    expect(created.props.src).toBe('data:image/png;base64,ABC');
    expect(created.props.alt).toBe('test.png');
    expect(store.selectComponent).toHaveBeenCalledWith(created.id);
  });

  it('任务 7.4：取消选择或读取失败均派发 start-create+cancel，不创建组件', async () => {
    const scenarios: Array<[string, () => void]> = [
      ['用户取消', () => vi.mocked(pickImageFile).mockResolvedValue(null)],
      ['读取失败', () => vi.mocked(pickImageFile).mockRejectedValue(new Error('读取失败'))],
    ];
    for (const [name, arrange] of scenarios) {
      arrange();
      const dispatchInteraction = await triggerImageClick();
      await vi.waitFor(() => {
        expect(dispatchInteraction, name).toHaveBeenCalledWith('cancel');
      });
      expect(dispatchInteraction, name).toHaveBeenCalledWith('start-create');
      expect(dispatchInteraction, name).not.toHaveBeenCalledWith('commit-create');
      expect(store.addComponent, name).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('任务 7.4：大图按 maxImageDimension 等比缩放', async () => {
    vi.mocked(pickImageFile).mockResolvedValue({
      dataUrl: 'data:image/png;base64,BIG',
      width: 1600,
      height: 1200,
      name: 'big.png',
    });
    await triggerImageClick();
    await vi.waitFor(() => {
      expect(store.addComponent).toHaveBeenCalledTimes(1);
    });

    const created = (store.addComponent as Mock).mock.calls[0][0] as ScreenComponent;
    // 1600x1200 按 800 约束等比缩放 → 800x600
    expect(created.position.width).toBe(800);
    expect(created.position.height).toBe(600);
  });

  it('任务 7.4：图片工具下不派发 start-pan（创建与平移互斥）', async () => {
    const dispatchInteraction = await triggerImageClick();
    expect(dispatchInteraction).not.toHaveBeenCalledWith('start-pan');
  });

  it('任务 7.4：右键按下不触发图片创建', () => {
    const dispatchInteraction = vi.fn();
    const session = makeSession('image', 'idle', dispatchInteraction);
    const { container } = render(<ScreenCanvas editorSession={session} />);
    fireEvent.pointerDown(container.firstChild as HTMLElement, {
      button: 2,
      clientX: 100,
      clientY: 100,
    });
    // 右键不应触发 pickImageFile
    expect(pickImageFile).not.toHaveBeenCalled();
    expect(dispatchInteraction).not.toHaveBeenCalledWith('start-create');
  });
});

/**
 * 任务 8.2/8.3/8.4：缩放工具点击放大 / Alt 反向缩小 / 浏览器默认行为隔离
 *
 * 测试策略：
 * - 捕获 setCanvasScaleAndOffset 调用参数，验证 scale 与 offset
 * - 触发 pointerDown 模拟用户在画布点击
 * - 验证：
 *   1. 左键点击：围绕指针位置放大（factor = ZOOM_TOOL_IN_FACTOR = 1.5）
 *   2. Alt+左键点击：围绕指针位置缩小（factor = ZOOM_TOOL_OUT_FACTOR = 1/1.5）
 *   3. 锚点不变性：放大后光标下画布点保持不变
 *   4. 边界约束：达到 MAX/MIN_SCALE 后点击不再变化
 *   5. 与平移/创建互斥，右键不触发缩放
 *
 * 注意：jsdom 中 getBoundingClientRect 默认返回全 0，故 clientX/Y 直接作为 cursorX/Y。
 */
describe('任务 8.2/8.3/8.4：缩放工具点击放大与反向缩小', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
  });

  /**
   * 触发缩放工具下的 pointerDown。
   * 可指定初始 canvasScale/canvasOffset、altKey、button。
   */
  function triggerZoomClick(
    options: {
      clientX?: number;
      clientY?: number;
      altKey?: boolean;
      button?: number;
      canvasScale?: number;
      canvasOffset?: { x: number; y: number };
    } = {},
  ) {
    const {
      clientX = 100,
      clientY = 100,
      altKey = false,
      button = 0,
      canvasScale = 1,
      canvasOffset = { x: 0, y: 0 },
    } = options;
    const store = setupStore({ canvasScale, canvasOffset });
    const dispatchInteraction = vi.fn();
    const session = makeSession('zoom', 'idle', dispatchInteraction);
    const { container } = render(<ScreenCanvas editorSession={session} />);
    const canvasContainer = container.firstChild as HTMLElement;
    fireEvent.pointerDown(canvasContainer, { button, clientX, clientY, altKey });
    return { store, dispatchInteraction };
  }

  it('任务 8.2：左键点击围绕指针位置放大（factor=1.5）', () => {
    const { store } = triggerZoomClick({ clientX: 100, clientY: 100 });
    const zoomMock = store.setCanvasScaleAndOffset as Mock;
    expect(zoomMock).toHaveBeenCalledTimes(1);
    const [scale, offset] = zoomMock.mock.calls[0] as [number, { x: number; y: number }];
    expect(scale).toBeCloseTo(1.5, 10);
    // 锚点不变性：cursorX=100, offset.x = 100 - (100-0)*1.5 = -50
    expect(offset.x).toBeCloseTo(-50, 10);
    expect(offset.y).toBeCloseTo(-50, 10);
  });

  it('任务 8.3：Alt+左键点击围绕指针位置缩小（factor=1/1.5）', () => {
    const { store } = triggerZoomClick({ clientX: 100, clientY: 100, altKey: true });
    const zoomMock = store.setCanvasScaleAndOffset as Mock;
    expect(zoomMock).toHaveBeenCalledTimes(1);
    const [scale, offset] = zoomMock.mock.calls[0] as [number, { x: number; y: number }];
    expect(scale).toBeCloseTo(1 / 1.5, 10);
    // 锚点不变性：cursorX=100, offset.x = 100 - 100*(1/1.5) = 100 - 66.6667 = 33.3333
    expect(offset.x).toBeCloseTo(100 - 100 * (1 / 1.5), 10);
    expect(offset.y).toBeCloseTo(100 - 100 * (1 / 1.5), 10);
  });

  it('任务 8.2：放大后光标下画布点保持不变（锚点不变性）', () => {
    // 初始 offset = {x: 50, y: 30}, scale = 2
    // 光标 (100, 100) 下画布点 = (100 - 50) / 2 = 25, (100 - 30) / 2 = 35
    // 放大 factor=1.5 → newScale=3
    // newOffset.x = 100 - (100 - 50) * 1.5 = 100 - 75 = 25
    // newOffset.y = 100 - (100 - 30) * 1.5 = 100 - 105 = -5
    // 放大后光标下画布点 = (100 - 25) / 3 = 25, (100 - (-5)) / 3 = 35
    const { store } = triggerZoomClick({
      clientX: 100,
      clientY: 100,
      canvasScale: 2,
      canvasOffset: { x: 50, y: 30 },
    });
    const zoomMock = store.setCanvasScaleAndOffset as Mock;
    const [scale, offset] = zoomMock.mock.calls[0] as [number, { x: number; y: number }];
    expect(scale).toBeCloseTo(3, 10);
    expect(offset.x).toBeCloseTo(25, 10);
    expect(offset.y).toBeCloseTo(-5, 10);
    // 验证锚点不变性：放大前后光标下画布点一致
    const canvasPointBefore = { x: (100 - 50) / 2, y: (100 - 30) / 2 };
    const canvasPointAfter = { x: (100 - offset.x) / scale, y: (100 - offset.y) / scale };
    expect(canvasPointAfter.x).toBeCloseTo(canvasPointBefore.x, 10);
    expect(canvasPointAfter.y).toBeCloseTo(canvasPointBefore.y, 10);
  });

  it('任务 8.1：边界约束——达到 MAX/MIN_SCALE 后点击不再变化', () => {
    // MAX_SCALE=5：actualFactor = clamp(5*1.5)/5 = 1，zoomWithBoundary 直接返回原值
    const maxCase = triggerZoomClick({ canvasScale: 5 });
    expect(maxCase.store.setCanvasScaleAndOffset).toHaveBeenCalledWith(5, { x: 0, y: 0 });

    cleanup();

    // MIN_SCALE=0.1：Alt+点击同理被 clamp 至 0.1
    const minCase = triggerZoomClick({ altKey: true, canvasScale: 0.1 });
    const zoomMock = minCase.store.setCanvasScaleAndOffset as Mock;
    const [scale, offset] = zoomMock.mock.calls[0] as [number, { x: number; y: number }];
    expect(scale).toBeCloseTo(0.1, 10);
    expect(offset).toEqual({ x: 0, y: 0 });
  });

  it('任务 8.2：缩放工具不派发 start-pan / start-create（与其他交互互斥）', () => {
    const { dispatchInteraction } = triggerZoomClick();
    expect(dispatchInteraction).not.toHaveBeenCalledWith('start-pan');
    expect(dispatchInteraction).not.toHaveBeenCalledWith('start-create');
  });

  it('任务 8.2：右键按下不触发缩放', () => {
    const { store } = triggerZoomClick({ button: 2 });
    expect(store.setCanvasScaleAndOffset).not.toHaveBeenCalled();
  });

  it('任务 8.2：连续点击放大累积生效（每次 factor=1.5）', () => {
    // 第一次点击：scale 1 → 1.5
    const first = triggerZoomClick({ clientX: 100, clientY: 100 });
    const firstMock = first.store.setCanvasScaleAndOffset as Mock;
    expect(firstMock.mock.calls[0][0]).toBeCloseTo(1.5, 10);

    cleanup();

    // 第二次点击：基于新 scale 1.5 → 2.25
    const second = triggerZoomClick({
      clientX: 100,
      clientY: 100,
      canvasScale: 1.5,
      canvasOffset: { x: -50, y: -50 },
    });
    const secondMock = second.store.setCanvasScaleAndOffset as Mock;
    expect(secondMock.mock.calls[0][0]).toBeCloseTo(1.5 * 1.5, 10);
  });
});

/**
 * 任务 12.1：拖拽、缩放和旋转由状态机仲裁
 *
 * 测试策略：
 * - 通过扩展的 Moveable mock 捕获 onDragStart/onResizeStart/onRotateStart/
 *   onDragGroupStart/onResizeGroupStart 回调
 * - 直接调用回调，传入伪造的 Moveable 事件，模拟不同 interactionState 下的重入
 * - 验证：
 *   1. 合法源状态下允许开始，dispatchInteraction 被调用
 *   2. 非法源状态下回调返回 false 拒绝重入，dispatchInteraction 不被调用
 *   3. 恢复语义：拒绝后状态保持不变，后续合法交互可继续开始
 */
describe('任务 12.1：拖拽、缩放和旋转由状态机仲裁', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  type MoveableStartCallback =
    | 'onDragStart'
    | 'onResizeStart'
    | 'onRotateStart'
    | 'onDragGroupStart'
    | 'onResizeGroupStart';

  /**
   * 在指定 interactionState 下渲染画布（select 工具，启用全部变换能力）。
   * Moveable mock 渲染时刷新 capturedMoveable。
   */
  function renderCanvasWithState(interactionState: InteractionState) {
    capturedMoveable = null;
    capturedSelecto = null;
    const dispatchInteraction = vi.fn();
    const session = makeSession('select', interactionState, dispatchInteraction);
    render(<ScreenCanvas editorSession={session} />);
    expect(capturedMoveable).not.toBeNull();
    return dispatchInteraction;
  }

  /** 构造单选手势事件（带 data-component-id 目标） */
  function makeSingleEvent() {
    const target = document.createElement('div');
    target.setAttribute('data-component-id', 'c1');
    return { target, datas: {}, inputEvent: { altKey: false } };
  }

  /** 构造组手势事件（targets 数组） */
  function makeGroupEvent() {
    return { targets: [makeSingleEvent().target], datas: {} };
  }

  /** 直接调用捕获的 Moveable Start 回调 */
  function invokeStart(callback: MoveableStartCallback, isGroup: boolean) {
    const handler = capturedMoveable![callback]!;
    return handler(isGroup ? makeGroupEvent() : makeSingleEvent());
  }

  /**
   * 仲裁矩阵：每个回调的合法源状态（允许开始）与非法状态（拒绝重入）。
   * 替代原 26 个逐状态展开的重复用例，断言语义不变。
   */
  const arbitrationMatrix: Array<{
    callback: MoveableStartCallback;
    event: 'start-drag' | 'start-resize' | 'start-rotate';
    isGroup: boolean;
    allowed: InteractionState[];
    rejected: InteractionState[];
  }> = [
    {
      callback: 'onDragStart',
      event: 'start-drag',
      isGroup: false,
      allowed: ['idle', 'hovering', 'marquee-selecting'],
      rejected: ['dragging', 'resizing', 'rotating', 'panning', 'creating', 'text-editing'],
    },
    {
      callback: 'onResizeStart',
      event: 'start-resize',
      isGroup: false,
      allowed: ['idle', 'hovering'],
      rejected: ['dragging', 'resizing', 'panning', 'creating'],
    },
    {
      callback: 'onRotateStart',
      event: 'start-rotate',
      isGroup: false,
      allowed: ['idle', 'hovering'],
      rejected: ['dragging', 'rotating', 'panning'],
    },
    {
      callback: 'onDragGroupStart',
      event: 'start-drag',
      isGroup: true,
      allowed: ['idle'],
      rejected: ['dragging', 'panning'],
    },
    {
      callback: 'onResizeGroupStart',
      event: 'start-resize',
      isGroup: true,
      allowed: ['idle'],
      rejected: ['resizing', 'dragging'],
    },
  ];

  for (const { callback, event, isGroup, allowed, rejected } of arbitrationMatrix) {
    it(`${callback}：合法源状态（${allowed.join('/')}）允许开始并派发 ${event}`, () => {
      for (const state of allowed) {
        const dispatchInteraction = renderCanvasWithState(state);
        expect(invokeStart(callback, isGroup), state).not.toBe(false);
        expect(dispatchInteraction, state).toHaveBeenCalledWith(event);
      }
    });

    it(`${callback}：非法状态（${rejected.join('/')}）拒绝重入且不派发 ${event}`, () => {
      for (const state of rejected) {
        const dispatchInteraction = renderCanvasWithState(state);
        expect(invokeStart(callback, isGroup), state).toBe(false);
        expect(dispatchInteraction, state).not.toHaveBeenCalledWith(event);
      }
    });
  }

  it('恢复语义：非法状态拒绝后，恢复 idle 仍可正常开始对应交互', () => {
    // dragging 状态下拒绝 resize → 恢复 idle 后 resize 可开始
    let dispatchInteraction = renderCanvasWithState('dragging');
    expect(invokeStart('onResizeStart', false)).toBe(false);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('start-resize');

    cleanup();
    dispatchInteraction = renderCanvasWithState('idle');
    expect(invokeStart('onResizeStart', false)).not.toBe(false);
    expect(dispatchInteraction).toHaveBeenCalledWith('start-resize');

    cleanup();
    // panning 状态下拒绝 drag → 恢复 idle 后 drag 可开始
    dispatchInteraction = renderCanvasWithState('panning');
    expect(invokeStart('onDragStart', false)).toBe(false);
    expect(dispatchInteraction).not.toHaveBeenCalledWith('start-drag');

    cleanup();
    dispatchInteraction = renderCanvasWithState('idle');
    expect(invokeStart('onDragStart', false)).not.toBe(false);
    expect(dispatchInteraction).toHaveBeenCalledWith('start-drag');
  });
});

/**
 * 任务 12.2：框选、创建和缩放由状态机仲裁
 *
 * 测试策略：
 * - Selecto 框选：mock 渲染时调用一次 onDragStart，根据 e.stop() 推断 disabled，
 *   并断言是否派发 pointer-down
 * - 缩放工具：渲染 zoom 工具画布并触发 pointerDown，验证 setCanvasScaleAndOffset
 *   与 start-zoom/end-zoom 派发
 * - 创建工具：冒烟验证非法状态点击不创建组件（handleCreate 系列已有状态机检查）
 */
describe('任务 12.2：框选、创建和缩放由状态机仲裁', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
  });

  /** 在指定 interactionState 下渲染 select 工具画布（Selecto mock 渲染时刷新 capturedSelecto） */
  function renderCanvasWithSelecto(interactionState: InteractionState) {
    capturedMoveable = null;
    capturedSelecto = null;
    const dispatchInteraction = vi.fn();
    const session = makeSession('select', interactionState, dispatchInteraction);
    render(<ScreenCanvas editorSession={session} />);
    expect(capturedSelecto).not.toBeNull();
    return dispatchInteraction;
  }

  it('Selecto 框选：idle/hovering 允许开始，其余状态均拒绝重入', () => {
    const allowed: InteractionState[] = ['idle', 'hovering'];
    const rejected: InteractionState[] = [
      'dragging',
      'resizing',
      'rotating',
      'panning',
      'creating',
      'zooming',
      'text-editing',
      'context-menu-open',
    ];
    for (const state of allowed) {
      const dispatchInteraction = renderCanvasWithSelecto(state);
      expect(capturedSelecto!.disabled, state).toBe(false);
      // 应派发 pointer-down（idle/hovering → marquee-selecting）
      expect(dispatchInteraction, state).toHaveBeenCalledWith('pointer-down');
    }
    for (const state of rejected) {
      const dispatchInteraction = renderCanvasWithSelecto(state);
      expect(capturedSelecto!.disabled, state).toBe(true);
      expect(dispatchInteraction, state).not.toHaveBeenCalledWith('pointer-down');
    }
  });

  it('Selecto 恢复语义：dragging 状态下拒绝后，恢复 idle 可继续框选', () => {
    // dragging 状态下被拒绝
    const dispatch1 = renderCanvasWithSelecto('dragging');
    expect(capturedSelecto!.disabled).toBe(true);
    expect(dispatch1).not.toHaveBeenCalledWith('pointer-down');

    // 恢复到 idle 后可继续框选
    cleanup();
    const dispatch2 = renderCanvasWithSelecto('idle');
    expect(capturedSelecto!.disabled).toBe(false);
    expect(dispatch2).toHaveBeenCalledWith('pointer-down');
  });

  /** 在指定 interactionState 下渲染 zoom 工具画布 */
  function renderCanvasWithZoom(interactionState: InteractionState) {
    capturedMoveable = null;
    capturedSelecto = null;
    const store = setupStore();
    const dispatchInteraction = vi.fn();
    const session = makeSession('zoom', interactionState, dispatchInteraction);
    const { container } = render(<ScreenCanvas editorSession={session} />) as unknown as {
      container: HTMLElement;
    };
    return { store, dispatchInteraction, container };
  }

  /** 在画布表面模拟一次左键 pointer-down */
  function fireZoomClick(container: HTMLElement) {
    const canvasSurface = container.querySelector('[data-testid="canvas-surface"]')!;
    fireEvent.pointerDown(canvasSurface, { button: 0, clientX: 100, clientY: 100 });
  }

  it('缩放工具：idle/hovering 允许缩放，其余状态均拒绝重入', () => {
    const allowed: InteractionState[] = ['idle', 'hovering'];
    const rejected: InteractionState[] = [
      'dragging',
      'resizing',
      'rotating',
      'panning',
      'creating',
      'marquee-selecting',
      'text-editing',
      'zooming',
    ];
    for (const state of allowed) {
      const { store, dispatchInteraction, container } = renderCanvasWithZoom(state);
      fireZoomClick(container);
      expect(store.setCanvasScaleAndOffset, state).toHaveBeenCalled();
      // 状态机事件：start-zoom 进入 zooming，end-zoom 退出回 idle
      expect(dispatchInteraction, state).toHaveBeenCalledWith('start-zoom');
      expect(dispatchInteraction, state).toHaveBeenCalledWith('end-zoom');
      cleanup();
    }
    for (const state of rejected) {
      const { store, dispatchInteraction, container } = renderCanvasWithZoom(state);
      fireZoomClick(container);
      // 拒绝重入：不执行缩放也不派发状态事件（zooming 态不会重复派发 start-zoom）
      expect(store.setCanvasScaleAndOffset, state).not.toHaveBeenCalled();
      expect(dispatchInteraction, state).not.toHaveBeenCalledWith('start-zoom');
      cleanup();
    }
  });

  it('缩放工具恢复语义：dragging 状态下拒绝后，恢复 idle 可继续缩放', () => {
    // dragging 状态下被拒绝
    const rejectedCase = renderCanvasWithZoom('dragging');
    fireZoomClick(rejectedCase.container);
    expect(rejectedCase.store.setCanvasScaleAndOffset).not.toHaveBeenCalled();
    expect(rejectedCase.dispatchInteraction).not.toHaveBeenCalledWith('start-zoom');

    // 恢复到 idle 后可继续缩放
    cleanup();
    const allowedCase = renderCanvasWithZoom('idle');
    fireZoomClick(allowedCase.container);
    expect(allowedCase.store.setCanvasScaleAndOffset).toHaveBeenCalled();
    expect(allowedCase.dispatchInteraction).toHaveBeenCalledWith('start-zoom');
    expect(allowedCase.dispatchInteraction).toHaveBeenCalledWith('end-zoom');
  });

  it('创建工具冒烟：非法状态点击不创建组件，idle 合法开始', () => {
    // 创建工具（text/rect/ellipse/image）的 handleCreate 系列函数已有
    // interactionState 检查；此处冒烟验证关键状态组合。
    // image 创建为异步（pickImageFile），非法状态下仅断言不派发 start-create。
    const cases: Array<{
      tool: EditorTool;
      state: InteractionState;
      expectCreate: boolean;
      assertStore: boolean;
    }> = [
      { tool: 'text', state: 'dragging', expectCreate: false, assertStore: true },
      { tool: 'rect', state: 'resizing', expectCreate: false, assertStore: true },
      { tool: 'image', state: 'panning', expectCreate: false, assertStore: false },
      { tool: 'text', state: 'idle', expectCreate: true, assertStore: false },
    ];
    for (const { tool, state, expectCreate, assertStore } of cases) {
      const store = setupStore();
      const dispatchInteraction = vi.fn();
      const session = makeSession(tool, state, dispatchInteraction);
      const { container } = render(<ScreenCanvas editorSession={session} />);
      const canvasSurface = container.querySelector('[data-testid="canvas-surface"]')!;
      fireEvent.pointerDown(canvasSurface, { button: 0, clientX: 100, clientY: 100 });
      const label = `${tool}@${state}`;
      if (expectCreate) {
        expect(dispatchInteraction, label).toHaveBeenCalledWith('start-create');
      } else {
        if (assertStore) {
          expect(store.addComponent, label).not.toHaveBeenCalled();
        }
        expect(dispatchInteraction, label).not.toHaveBeenCalledWith('start-create');
      }
      cleanup();
    }
  });
});

/**
 * 任务 13.7 问题 2 回归测试：onSelectEnd setTimeout dragStart guard
 *
 * 修复 bug：Selecto onSelectEnd 末尾通过 setTimeout(() => moveableRef.current?.dragStart(e), 0)
 * 外部触发拖拽。若用户在 setTimeout 触发前切换工具或进入其他交互态：
 * - activeTool !== 'select'：Moveable draggable prop 已为 false，
 *   外部调用 dragStart 会让 Moveable 内部进入异常 dragging 态，
 *   后续 onDragEnd 永不触发，选择工具能力永久失效
 * - interactionState 非 idle/hovering/marquee-selecting：与 onDragStart 仲裁条件不一致，
 *   调用会绕过状态机触发非法转换
 *
 * 修复方案：setTimeout 回调用 ref 读取最新的 activeTool 和 interactionState，
 * 不满足条件时放弃 dragStart。
 *
 * 测试策略：
 * - 用 vi.useFakeTimers() 控制 setTimeout 触发时机
 * - 触发 capturedSelecto.onSelectEnd 后，在 setTimeout 触发前 rerender 切换工具或交互态
 * - 通过 moveableDragStartSpy 验证 moveableRef.current.dragStart 是否被调用
 */
describe('任务 13.7 问题 2：onSelectEnd setTimeout dragStart guard', () => {
  beforeEach(() => {
    mockUseStore.mockReset();
    setupStore();
    vi.useFakeTimers();
    moveableDragStartSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 构造 Selecto onSelectEnd 事件：点击指定组件（非拖拽框选、非双击）。
   * selected 数组包含一个带 data-component-id 的 DOM 元素，
   * handleSelectEnd 会提取其 id 作为 selection。
   */
  function makeClickSelectEndEvent(componentId: string): MockSelectoSelectEndEvent {
    const el = document.createElement('div');
    el.setAttribute('data-component-id', componentId);
    return {
      selected: [el],
      inputEvent: new MouseEvent('mousedown', { bubbles: true }),
      isDragStart: true,
    };
  }

  /**
   * 渲染 select 工具画布，返回 dispatchInteraction、rerender 和 session。
   * interactionState 默认 idle，可通过参数覆盖。
   */
  function renderSelectCanvas(interactionState: InteractionState = 'idle') {
    capturedMoveable = null;
    capturedSelecto = null;
    const dispatchInteraction = vi.fn();
    const session = makeSession('select', interactionState, dispatchInteraction);
    const { rerender } = render(<ScreenCanvas editorSession={session} />);
    return { dispatchInteraction, rerender, session };
  }

  it('基线：select 工具下 onSelectEnd 点击组件，同步调用 dragStart（无 setTimeout 抖动）', () => {
    renderSelectCanvas('idle');

    // 触发 onSelectEnd（点击 c1 组件，首次点击非双击）
    expect(capturedSelecto).not.toBeNull();
    capturedSelecto!.onSelectEnd!(makeClickSelectEndEvent('c1'));

    // 抖动优化：dragStart 在 onSelectEnd 中同步调用（flushSync + 立即 dragStart），
    // 无需等待 setTimeout，控制框与拖拽在同一帧启动
    expect(moveableDragStartSpy).toHaveBeenCalledTimes(1);
    expect(moveableDragStartSpy).toHaveBeenCalledWith(expect.any(MouseEvent));

    // 不应遗留任何 setTimeout
    vi.runAllTimers();
    expect(moveableDragStartSpy).toHaveBeenCalledTimes(1);
  });

  it('修复：onSelectEnd 时 activeTool 已切到非 select 工具（hand/rect），不调用 dragStart', () => {
    for (const tool of ['hand', 'rect'] as const) {
      const { rerender, session } = renderSelectCanvas('idle');

      // 在 onSelectEnd 触发前切换工具（模拟用户快速切换）
      rerender(
        <ScreenCanvas
          editorSession={{
            ...session,
            activeTool: tool,
            activeCapabilities: getToolById(tool)!.capabilities,
          }}
        />,
      );

      // 触发 onSelectEnd：guard 检测 activeToolRef.current !== 'select'，跳过 dragStart
      capturedSelecto!.onSelectEnd!(makeClickSelectEndEvent('c1'));

      // guard 拦截：activeToolRef.current !== 'select'，不调用 dragStart
      expect(moveableDragStartSpy, `切换到 ${tool}`).not.toHaveBeenCalled();
      cleanup();
      moveableDragStartSpy.mockClear();
    }
  });

  it('修复：onSelectEnd 时 interactionState 已进入非允许态（dragging/panning/creating），不调用 dragStart', () => {
    const blockedStates: InteractionState[] = ['dragging', 'panning', 'creating'];
    for (const state of blockedStates) {
      const { rerender, session } = renderSelectCanvas('idle');

      // 在 onSelectEnd 触发前，interactionState 变为非允许态
      rerender(<ScreenCanvas editorSession={{ ...session, interactionState: state }} />);

      capturedSelecto!.onSelectEnd!(makeClickSelectEndEvent('c1'));

      // guard 拦截：interactionStateRef.current 不在允许列表
      expect(moveableDragStartSpy, `状态 ${state}`).not.toHaveBeenCalled();
      cleanup();
      moveableDragStartSpy.mockClear();
    }
  });

  it('边界：onSelectEnd 时进入允许态（hovering/marquee-selecting），仍同步调用 dragStart', () => {
    const allowedStates: InteractionState[] = ['hovering', 'marquee-selecting'];
    for (const state of allowedStates) {
      const { rerender, session } = renderSelectCanvas('idle');

      // 先切换到允许态
      rerender(<ScreenCanvas editorSession={{ ...session, interactionState: state }} />);

      capturedSelecto!.onSelectEnd!(makeClickSelectEndEvent('c1'));

      // 允许列表内，guard 应通过，同步调用 dragStart
      expect(moveableDragStartSpy, `状态 ${state}`).toHaveBeenCalledTimes(1);
      cleanup();
      moveableDragStartSpy.mockClear();
    }
  });

  it('修复后状态可恢复：切到 hand 后再切回 select，下次 onSelectEnd 仍能同步调用 dragStart', () => {
    const { rerender, session } = renderSelectCanvas('idle');

    // 第一次 onSelectEnd：此时是 select，dragStart 应被调用
    capturedSelecto!.onSelectEnd!(makeClickSelectEndEvent('c1'));
    expect(moveableDragStartSpy).toHaveBeenCalledTimes(1);
    moveableDragStartSpy.mockClear();

    // 切换到 hand 工具
    rerender(
      <ScreenCanvas
        editorSession={{
          ...session,
          activeTool: 'hand',
          activeCapabilities: getToolById('hand')!.capabilities,
        }}
      />,
    );

    // hand 工具下触发 onSelectEnd：guard 拦截，不调用 dragStart
    capturedSelecto!.onSelectEnd!(makeClickSelectEndEvent('c1'));
    expect(moveableDragStartSpy).not.toHaveBeenCalled();

    // 切回 select 工具
    rerender(
      <ScreenCanvas
        editorSession={{
          ...session,
          activeTool: 'select',
          activeCapabilities: getToolById('select')!.capabilities,
        }}
      />,
    );

    // 再次触发 onSelectEnd，guard 应通过，dragStart 被调用。
    // 使用空白点击（selected=[]）避免被 handleSelectEnd 判定为双击（lastClick 仍记 c1）。
    capturedSelecto!.onSelectEnd!({
      selected: [],
      inputEvent: new MouseEvent('mousedown', { bubbles: true }),
      isDragStart: true,
    });

    expect(moveableDragStartSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * onDragStart 未选中组件立即选中并启动拖拽（消除抽帧优化）。
 *
 * 优化前：pointerdown → Selecto onDragStart → 移动阈值 → onSelectEnd →
 *   flushSync(选中) → dragStart。用户已移动一段距离才开始拖拽，视觉上
 *   有"组件原地不动 → 突然开始移动"的抽帧/瞬移感。
 *
 * 优化后：Selecto onDragStart 命中未选中组件时，立即 flushSync 选中 +
 *   dragStart 启动 Moveable 拖拽 + e.stop() 阻止 Selecto。选中与拖拽
 *   启动提前到 onDragStart 阶段，消除等待 onSelectEnd 的延迟。
 */
describe('onDragStart 未选中组件立即选中并启动拖拽', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    mockUseStore.mockReset();
    store = setupStore({ selectedComponentIds: [] });
    moveableDragStartSpy.mockClear();
  });

  function makeComponentTarget(id = 'c1'): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-component-id', id);
    return el;
  }

  it('命中未选中组件：立即调用 selectComponents 并启动 dragStart', () => {
    capturedMoveable = null;
    capturedSelecto = null;
    const dispatchInteraction = vi.fn();
    const session = makeSession('select', 'idle', dispatchInteraction);
    render(<ScreenCanvas editorSession={session} />);

    moveableDragStartSpy.mockClear();

    // 构造 onDragStart 事件：target 是未选中的 c1 组件
    const target = makeComponentTarget('c1');
    let stopped = false;
    capturedSelecto!.onDragStart!({
      target,
      datas: {},
      stop: () => {
        stopped = true;
      },
      inputEvent: { target },
    });

    // 未选中组件 → 立即选中
    expect(store.selectComponents).toHaveBeenCalledWith(['c1']);
    // 立即调用 dragStart（不等 onSelectEnd）
    expect(moveableDragStartSpy).toHaveBeenCalledTimes(1);
    // 阻止 Selecto 继续（Moveable 已接管）
    expect(stopped).toBe(true);
  });

  it('命中已选中组件：仅阻止 Selecto，不重复选中和 dragStart', () => {
    mockUseStore.mockReset();
    store = setupStore({ selectedComponentIds: ['c1'] });
    capturedMoveable = null;
    capturedSelecto = null;
    const session = makeSession('select', 'idle');
    render(<ScreenCanvas editorSession={session} />);

    moveableDragStartSpy.mockClear();

    const target = makeComponentTarget('c1');
    let stopped = false;
    capturedSelecto!.onDragStart!({
      target,
      datas: {},
      stop: () => {
        stopped = true;
      },
      inputEvent: { target },
    });

    // 已选中：不重复调用 selectComponents
    expect(store.selectComponents).not.toHaveBeenCalled();
    // 已选中：不调用 dragStart（Moveable 自己的 onDragStart 会处理）
    expect(moveableDragStartSpy).not.toHaveBeenCalled();
    // 阻止 Selecto
    expect(stopped).toBe(true);
  });

  it('非 select 工具：命中组件不启动拖拽，阻止 Selecto', () => {
    mockUseStore.mockReset();
    store = setupStore({ selectedComponentIds: [] });
    capturedMoveable = null;
    capturedSelecto = null;
    const session = makeSession('rect', 'idle');
    render(<ScreenCanvas editorSession={session} />);

    moveableDragStartSpy.mockClear();

    const target = makeComponentTarget('c1');
    let stopped = false;
    capturedSelecto!.onDragStart!({
      target,
      datas: {},
      stop: () => {
        stopped = true;
      },
      inputEvent: { target },
    });

    // 非选择工具：canSelect=false，onDragStart 开头就 e.stop()+return
    expect(moveableDragStartSpy).not.toHaveBeenCalled();
    expect(stopped).toBe(true);
  });

  it('交互态非允许态：命中组件不启动拖拽', () => {
    mockUseStore.mockReset();
    store = setupStore({ selectedComponentIds: [] });
    capturedMoveable = null;
    capturedSelecto = null;
    const session = makeSession('select', 'dragging');
    render(<ScreenCanvas editorSession={session} />);

    moveableDragStartSpy.mockClear();

    const target = makeComponentTarget('c1');
    let stopped = false;
    capturedSelecto!.onDragStart!({
      target,
      datas: {},
      stop: () => {
        stopped = true;
      },
      inputEvent: { target },
    });

    // dragging 态：onDragStart 开头就 e.stop()，不会进入 target 检测
    expect(moveableDragStartSpy).not.toHaveBeenCalled();
    expect(stopped).toBe(true);
  });

  it('空白处（无 target）：不触发选中和拖拽', () => {
    capturedMoveable = null;
    capturedSelecto = null;
    const session = makeSession('select', 'idle');
    render(<ScreenCanvas editorSession={session} />);

    moveableDragStartSpy.mockClear();

    let stopped = false;
    capturedSelecto!.onDragStart!({
      target: null,
      datas: {},
      stop: () => {
        stopped = true;
      },
      inputEvent: null,
    });

    // 空白处：不选中，不调用 dragStart，不 stop
    expect(store.selectComponents).not.toHaveBeenCalled();
    expect(moveableDragStartSpy).not.toHaveBeenCalled();
    expect(stopped).toBe(false);
  });
});

/**
 * 任务 13.8 回归测试：Moveable *End 处理器在零位移手势（isDrag=false）下
 * 必须无条件派发 pointer-up 恢复交互状态机。
 *
 * 修复 bug：反复"选中组件 → 取消选中"数次后无法选中组件。
 * 根因：纯点击零位移时 Gesto isDrag=false，*End 处理器 `if (!e.isDrag) return;`
 * 早退导致 pointer-up 漏发，交互状态机卡在 dragging/resizing/rotating，
 * 后续 Selecto onDragStart 仲裁（仅允许 idle/hovering）拒绝一切交互。
 * 真实点击大多带 1-2px 抖动（isDrag=true，正常恢复），快速反复点击时偶尔
 * 出现零位移点击即触发，与用户"多做几次相同的操作就出问题"的描述一致。
 *
 * 测试策略：通过 capturedMoveable 捕获 *End 回调，模拟 onXStart → onXEnd
 * （isDrag=false）完整手势，验证 dispatchInteraction 收到 pointer-up。
 */
describe('任务 13.8：零位移手势结束时恢复交互状态机', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    mockUseStore.mockReset();
    store = setupStore();
    vi.useFakeTimers();
    moveableDragStartSpy.mockClear();
    // 重置共享修饰键状态，避免上个测试的 Shift/Alt 残留
    modifierRefs.shiftRef.current = false;
    modifierRefs.altRef.current = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 渲染 select 工具画布（canDrag/canResize/canRotate 均为 true） */
  function renderSelectCanvas(): { dispatchInteraction: ReturnType<typeof vi.fn> } {
    capturedMoveable = null;
    capturedSelecto = null;
    const dispatchInteraction = vi.fn();
    const session = makeSession('select', 'idle', dispatchInteraction);
    render(<ScreenCanvas editorSession={session} />);
    expect(capturedMoveable).not.toBeNull();
    return { dispatchInteraction };
  }

  /** 构造带 data-component-id 的目标元素 */
  function makeComponentTarget(componentId = 'c1'): HTMLElement {
    const target = document.createElement('div');
    target.setAttribute('data-component-id', componentId);
    return target;
  }

  /** 统计 dispatchInteraction 中指定事件的调用次数 */
  function countDispatch(dispatchInteraction: ReturnType<typeof vi.fn>, event: string): number {
    return dispatchInteraction.mock.calls.filter(([e]) => e === event).length;
  }

  it('零位移（isDrag=false）：全部 5 种手势 End 均派发 pointer-up 且不提交变更', () => {
    const { dispatchInteraction } = renderSelectCanvas();

    const makeSingleEvent = () => ({
      target: makeComponentTarget(),
      datas: {},
      inputEvent: { altKey: false },
    });
    const makeGroupEvent = () => ({ targets: [makeComponentTarget()], datas: {} });

    const gestures: Array<{
      start:
        | 'onDragStart'
        | 'onResizeStart'
        | 'onRotateStart'
        | 'onDragGroupStart'
        | 'onResizeGroupStart';
      end: 'onDragEnd' | 'onResizeEnd' | 'onRotateEnd' | 'onDragGroupEnd' | 'onResizeGroupEnd';
      startEvent: 'start-drag' | 'start-resize' | 'start-rotate';
      makeEvent: () => Record<string, unknown>;
      endExtra?: Record<string, unknown>;
      assertNoCommit: () => void;
    }> = [
      {
        start: 'onDragStart',
        end: 'onDragEnd',
        startEvent: 'start-drag',
        makeEvent: makeSingleEvent,
        assertNoCommit: () => {
          expect(store.updateComponent).not.toHaveBeenCalled();
          expect(store.duplicateSelectedToPosition).not.toHaveBeenCalled();
        },
      },
      {
        start: 'onResizeStart',
        end: 'onResizeEnd',
        startEvent: 'start-resize',
        makeEvent: makeSingleEvent,
        assertNoCommit: () => {
          expect(store.updateComponent).not.toHaveBeenCalled();
        },
      },
      {
        start: 'onRotateStart',
        end: 'onRotateEnd',
        startEvent: 'start-rotate',
        makeEvent: makeSingleEvent,
        assertNoCommit: () => {
          expect(store.updateComponent).not.toHaveBeenCalled();
        },
      },
      {
        start: 'onDragGroupStart',
        end: 'onDragGroupEnd',
        startEvent: 'start-drag',
        makeEvent: makeGroupEvent,
        assertNoCommit: () => {
          expect(store.updateComponentsBatch).not.toHaveBeenCalled();
        },
      },
      {
        start: 'onResizeGroupStart',
        end: 'onResizeGroupEnd',
        startEvent: 'start-resize',
        makeEvent: makeGroupEvent,
        endExtra: { events: [] },
        assertNoCommit: () => {
          expect(store.updateComponentsBatch).not.toHaveBeenCalled();
        },
      },
    ];

    for (const { start, end, startEvent, makeEvent, endExtra, assertNoCommit } of gestures) {
      const startEvt = makeEvent();
      capturedMoveable![start]!(startEvt);
      expect(dispatchInteraction, `${start} 应派发 ${startEvent}`).toHaveBeenCalledWith(startEvent);

      capturedMoveable![end]!({ ...startEvt, ...endExtra, isDrag: false });

      // 修复核心：零位移也必须派发 pointer-up，否则状态机卡在对应手势态
      expect(dispatchInteraction, `${end} 零位移应派发 pointer-up`).toHaveBeenCalledWith(
        'pointer-up',
      );
      assertNoCommit();
    }
  });

  it('onDragEnd：实际拖拽（isDrag=true）提交位置并派发 pointer-up', () => {
    const { dispatchInteraction } = renderSelectCanvas();
    const startEvent = { target: makeComponentTarget(), datas: {}, inputEvent: { altKey: false } };
    capturedMoveable!.onDragStart!(startEvent);

    capturedMoveable!.onDragEnd!({
      ...startEvent,
      isDrag: true,
      lastEvent: { beforeTranslate: [130, 160], isDrag: true },
    });

    expect(dispatchInteraction).toHaveBeenCalledWith('pointer-up');
    expect(store.updateComponent).toHaveBeenCalledWith('c1', {
      position: { x: 130, y: 160, width: 200, height: 150 },
    });
  });

  it('onResizeEnd：Alt 中心变换提交位置以中心点为原点（修复跳变 bug）', () => {
    // 组件 c1 初始：x=100, y=100, w=200, h=150，中心点 (200, 175)
    // Alt+拖控制点缩放到 100×100：期望提交 x=150, y=125（中心点仍为 200,175）
    const { dispatchInteraction } = renderSelectCanvas();
    const target = makeComponentTarget();
    const startEvent = { target, datas: {}, inputEvent: { altKey: false } };

    // PS 风格：Alt 状态从 ref 实时读取，而非 inputEvent.altKey
    modifierRefs.altRef.current = true;

    capturedMoveable!.onResizeStart!(startEvent);

    const datas = startEvent.datas as {
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    };
    expect(datas.origX).toBe(100);
    expect(datas.origY).toBe(100);
    expect(datas.origW).toBe(200);
    expect(datas.origH).toBe(150);

    capturedMoveable!.onResizeEnd!({
      ...startEvent,
      isDrag: true,
      lastEvent: {
        width: 100,
        height: 100,
        drag: { beforeTranslate: [50, 50] },
        isDrag: true,
      },
    });

    expect(dispatchInteraction).toHaveBeenCalledWith('pointer-up');
    // 关键断言：x/y 必须按中心变换公式计算，不能用 beforeTranslate=[50,50]
    expect(store.updateComponent).toHaveBeenCalledWith('c1', {
      position: { x: 150, y: 125, width: 100, height: 100 },
    });
  });

  it('onResizeEnd：非 Alt 普通缩放提交用 Moveable beforeTranslate', () => {
    const { dispatchInteraction } = renderSelectCanvas();
    const target = makeComponentTarget();
    const startEvent = { target, datas: {}, inputEvent: { altKey: false } };

    capturedMoveable!.onResizeStart!(startEvent);

    capturedMoveable!.onResizeEnd!({
      ...startEvent,
      isDrag: true,
      lastEvent: {
        width: 120,
        height: 80,
        drag: { beforeTranslate: [30, 40] },
        isDrag: true,
      },
    });

    expect(dispatchInteraction).toHaveBeenCalledWith('pointer-up');
    expect(store.updateComponent).toHaveBeenCalledWith('c1', {
      position: { x: 30, y: 40, width: 120, height: 80 },
    });
  });

  it('PS 风格即时切换：拖拽中按住/松开 Alt 立即切换中心变换模式', () => {
    // 场景：用户开始拖控制点（无 Alt）→ 中途按下 Alt → 松手时仍按住 Alt
    // 期望：onResize 在 Alt 按下后用中心变换公式，onResizeEnd 用 Alt 状态提交
    const { dispatchInteraction } = renderSelectCanvas();
    const target = makeComponentTarget();
    const startEvent = { target, datas: {}, inputEvent: { altKey: false } };

    // 开始时无 Alt
    modifierRefs.altRef.current = false;
    capturedMoveable!.onResizeStart!(startEvent);

    // 第一次 onResize：无 Alt，用 beforeTranslate
    capturedMoveable!.onResize!({
      ...startEvent,
      width: 120,
      height: 100,
      direction: [1, 0],
      drag: { beforeTranslate: [30, 0] },
    });
    expect(target.style.transform).toContain('translate(30px');

    // 中途按下 Alt：下一次 onResize 立即切换为中心变换
    modifierRefs.altRef.current = true;
    capturedMoveable!.onResize!({
      ...startEvent,
      width: 100,
      height: 100,
      direction: [1, 0],
      drag: { beforeTranslate: [50, 0] },
    });
    // 中心变换：tx = origX + (origW - w) / 2 = 100 + (200-100)/2 = 150
    expect(target.style.transform).toContain('translate(150px');

    // 松手时 Alt 仍按住：按中心变换提交
    capturedMoveable!.onResizeEnd!({
      ...startEvent,
      isDrag: true,
      lastEvent: {
        width: 100,
        height: 100,
        drag: { beforeTranslate: [50, 0] },
        isDrag: true,
      },
    });

    expect(dispatchInteraction).toHaveBeenCalledWith('pointer-up');
    expect(store.updateComponent).toHaveBeenCalledWith('c1', {
      position: { x: 150, y: 125, width: 100, height: 100 },
    });
  });

  it('PS 风格即时切换：拖拽中松开 Alt 立即切回普通缩放', () => {
    // 场景：用户按住 Alt 开始拖控制点 → 中途松开 Alt → 松手时无 Alt
    // 期望：onResizeEnd 用无 Alt 状态，按 beforeTranslate 提交
    const { dispatchInteraction } = renderSelectCanvas();
    const target = makeComponentTarget();
    const startEvent = { target, datas: {}, inputEvent: { altKey: false } };

    // 开始时按住 Alt
    modifierRefs.altRef.current = true;
    capturedMoveable!.onResizeStart!(startEvent);

    // onResize：Alt 按住，中心变换
    capturedMoveable!.onResize!({
      ...startEvent,
      width: 100,
      height: 100,
      direction: [1, 0],
      drag: { beforeTranslate: [50, 0] },
    });
    expect(target.style.transform).toContain('translate(150px');

    // 中途松开 Alt：下一次 onResize 立即切回 beforeTranslate
    modifierRefs.altRef.current = false;
    capturedMoveable!.onResize!({
      ...startEvent,
      width: 100,
      height: 100,
      direction: [1, 0],
      drag: { beforeTranslate: [40, 0] },
    });
    expect(target.style.transform).toContain('translate(40px');

    // 松手时无 Alt：按 beforeTranslate 提交
    capturedMoveable!.onResizeEnd!({
      ...startEvent,
      isDrag: true,
      lastEvent: {
        width: 100,
        height: 100,
        drag: { beforeTranslate: [40, 0] },
        isDrag: true,
      },
    });

    expect(dispatchInteraction).toHaveBeenCalledWith('pointer-up');
    expect(store.updateComponent).toHaveBeenCalledWith('c1', {
      position: { x: 40, y: 0, width: 100, height: 100 },
    });
  });

  it('Alt+拖拽复制（PS 风格）：onDragStart 立即创建克隆体，原件全程不动', () => {
    const { dispatchInteraction } = renderSelectCanvas();
    const target = makeComponentTarget();
    // Canvas Drag Optimization：初始位置由 transform translate 控制
    target.style.transform = 'translate(100px, 100px)';
    const startEvent = { target, datas: {}, inputEvent: { altKey: true } };

    capturedMoveable!.onDragStart!(startEvent);

    // PS 风格：onDragStart 时立即创建克隆体
    const datas = startEvent.datas as { altCopyClone: HTMLElement | null; isAltCopy: boolean };
    expect(datas.isAltCopy).toBe(true);
    expect(datas.altCopyClone).not.toBeNull();
    // 克隆体初始 transform 与原件一致（cloneNode 复制 transform）
    expect(datas.altCopyClone!.style.transform).toBe('translate(100px, 100px)');
    // 原件 DOM transform 不动
    expect(target.style.transform).toBe('translate(100px, 100px)');
    expect(dispatchInteraction).toHaveBeenCalledWith('start-drag');
  });

  it('Alt+拖拽复制（PS 风格）：onDrag 移动克隆体，原件不动', () => {
    renderSelectCanvas();
    const target = makeComponentTarget();
    target.style.transform = 'translate(100px, 100px)';
    const startEvent = { target, datas: {}, inputEvent: { altKey: true } };
    capturedMoveable!.onDragStart!(startEvent);
    const datas = startEvent.datas as { altCopyClone: HTMLElement };

    capturedMoveable!.onDrag!({
      ...startEvent,
      beforeTranslate: [150, 180],
      target,
    });

    // PS 风格：克隆体 transform 跟随鼠标移动
    expect(datas.altCopyClone.style.transform).toBe('translate(150px, 180px)');
    // 原件全程不动
    expect(target.style.transform).toBe('translate(100px, 100px)');
  });

  it('Alt+拖拽复制（PS 风格）：onDragEnd 创建真实副本并清理克隆体', () => {
    const { dispatchInteraction } = renderSelectCanvas();
    const target = makeComponentTarget();
    target.style.transform = 'translate(100px, 100px)';
    const startEvent = { target, datas: {}, inputEvent: { altKey: true } };
    capturedMoveable!.onDragStart!(startEvent);

    capturedMoveable!.onDragEnd!({
      ...startEvent,
      isDrag: true,
      lastEvent: { beforeTranslate: [150, 180], isDrag: true },
    });

    expect(dispatchInteraction).toHaveBeenCalledWith('pointer-up');
    // 创建真实副本到最终位置
    expect(store.duplicateSelectedToPosition).toHaveBeenCalledWith(150, 180);
    // 原件 state 不变
    expect(store.updateComponent).not.toHaveBeenCalled();
    // 原件 DOM transform 仍在原位
    expect(target.style.transform).toBe('translate(100px, 100px)');
    // 克隆体已移除
    expect(document.querySelector('[data-alt-copy-clone]')).toBeNull();
  });

  it('Alt+拖拽复制（PS 风格）：零位移点击不创建副本但清理克隆体', () => {
    const { dispatchInteraction } = renderSelectCanvas();
    const target = makeComponentTarget();
    target.style.transform = 'translate(100px, 100px)';
    const startEvent = { target, datas: {}, inputEvent: { altKey: true } };
    capturedMoveable!.onDragStart!(startEvent);

    capturedMoveable!.onDragEnd!({
      ...startEvent,
      isDrag: false,
      lastEvent: { beforeTranslate: [100, 100], isDrag: false },
    });

    expect(dispatchInteraction).toHaveBeenCalledWith('pointer-up');
    // 零位移不创建真实副本
    expect(store.duplicateSelectedToPosition).not.toHaveBeenCalled();
    expect(store.updateComponent).not.toHaveBeenCalled();
    // 克隆体已清理
    expect(document.querySelector('[data-alt-copy-clone]')).toBeNull();
  });

  it('新组件被选中并挂载时 Moveable target 更新（修复 control 框不跟随副本）', () => {
    // 场景：Alt+复制 / 粘贴 / 新建后，新组件被选中但 ref 在 commit 阶段才注册，
    // useMemo 在 render 阶段已计算完毕拿不到新 DOM，Moveable target 为空。
    // 改用 useState + useLayoutEffect：在所有 ref 回调执行后同步通过 querySelector
    // 查找新挂载的 DOM，setTargets 触发重渲染让 Moveable 拿到正确 target。
    capturedMoveable = null;
    capturedSelecto = null;
    const session = makeSession('select', 'idle');
    const { rerender } = render(<ScreenCanvas editorSession={session} />);

    // 初始：c1 被选中，Moveable target 包含 c1 的 DOM
    expect(capturedMoveable!.target).toHaveLength(1);

    // 模拟复制/粘贴：向 store 添加新组件 c2，选中切换到 c2
    const c2: ScreenComponent = {
      id: 'c2',
      type: 'shape',
      name: '矩形 2',
      position: { x: 200, y: 200, width: 200, height: 150 },
      style: {},
      props: {},
      status: { locked: false, hidden: false },
      zIndex: 1,
    };
    const currentProject = store.project as {
      components: ScreenComponent[];
      canvas: unknown;
    };
    store.project = { ...currentProject, components: [...currentProject.components, c2] };
    store.selectedComponentIds = ['c2'];

    // rerender：React 渲染 c2 的 CanvasComponentWrapper，commit 阶段 ref 注册后
    // useLayoutEffect 同步执行 querySelector 拿到 c2 的 DOM 并 setTargets
    rerender(<ScreenCanvas editorSession={session} />);

    // 修复前：targets 为空数组（useMemo 在 render 阶段拿不到新 DOM），控制框不显示
    // 修复后：useLayoutEffect 在 commit 后通过 DOM 查询拿到 c2 的 DOM
    expect(capturedMoveable!.target).toHaveLength(1);
    const targetEl = (capturedMoveable!.target as HTMLElement[])[0];
    expect(targetEl.getAttribute('data-component-id')).toBe('c2');
  });

  it('回归：反复"选中 → 取消选中"循环中零位移手势均恢复状态机', () => {
    const { dispatchInteraction } = renderSelectCanvas();
    const cycles = 6;

    for (let i = 0; i < cycles; i++) {
      // 选中：点击组件（Selecto selectEnd isDragStart=true）→ pointer-up（框选镜像）
      capturedSelecto!.onSelectEnd!({
        selected: [makeComponentTarget()],
        inputEvent: new MouseEvent('mousedown', { bubbles: true }),
        isDragStart: true,
      });
      // setTimeout dragStart 被 spy 拦截；直接模拟 Moveable 手势：零位移点击选中组件
      const startEvent = {
        target: makeComponentTarget(),
        datas: {},
        inputEvent: { altKey: false },
      };
      capturedMoveable!.onDragStart!(startEvent);
      capturedMoveable!.onDragEnd!({ ...startEvent, isDrag: false });

      // 取消选中：点击空白（selected=[]，isDragStart=false）→ pointer-up
      capturedSelecto!.onSelectEnd!({
        selected: [],
        inputEvent: new MouseEvent('mousedown', { bubbles: true }),
        isDragStart: false,
      });

      // 推进假时间：越过双击阈值（400ms）并 flush onSelectEnd 调度的 setTimeout
      vi.advanceTimersByTime(1000);
    }

    // 每轮 3 次 pointer-up：selectEnd(选中) + dragEnd(零位移) + selectEnd(取消)。
    // 修复前零位移 dragEnd 早退漏发，每轮少 1 次，状态机最终卡死在 dragging。
    expect(countDispatch(dispatchInteraction, 'pointer-up')).toBe(cycles * 3);
    // 每轮 1 次 start-drag（零位移点击选中组件触发的 Moveable 手势）
    expect(countDispatch(dispatchInteraction, 'start-drag')).toBe(cycles);
  });
});
