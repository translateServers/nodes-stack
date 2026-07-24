import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { create } from 'zustand';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { useModifierKeys } from '../hooks/use-modifier-keys';
import { BlueprintPreviewProvider, useBlueprintPreviewRuntime } from '../blueprint/runtime';
import {
  resolveComponentContainerStyle,
  composeComponentTransform,
} from '../registry/component-container-style';
import { ComponentRenderer } from '../registry/renderer';
import { createComponentInstance } from '../registry';
import { detectDoubleClick, handleSelectEnd, type ClickRecord } from '../lib/canvas-event-router';
import { DEFAULT_TEXT_CONTENT } from '../lib/text-editing-contract';
import { computeShapeCreation } from '../lib/shape-creation-geometry';
import { pickImageFile, type ImageFileResult } from '../lib/image-file-adapter';
import { zoomWithBoundary, zoomToolClick, WHEEL_ZOOM_FACTOR } from '../lib/zoom-boundary';
import { createRafThrottler, type RafThrottler } from '../lib/raf-throttle';
import { SELECTO_ALLOWED_STATES } from '../hooks/use-interaction-state-machine';
import type { EditorSessionApi } from '../hooks/use-editor-session';
import { getToolById } from '../hooks/tool-registry';

interface DimensionInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  visible: boolean;
  /** 模式提示（如 Alt 中心变换），空时不显示 */
  mode?: string;
}

/**
 * Moveable 事件 datas 袋的类型化描述。
 *
 * react-moveable 0.56 中 `e.datas` 类型为 `IObject<any>`、`e.lastEvent` 为 `any`，
 * 直接读取会触发 `@typescript-eslint/no-unsafe-*` 系列规则。这里以 interface
 * 形式声明各 handler 写入 / 读取的字段，handler 内统一通过 `as unknown as` 单点
 * 转换后访问，避免 `any` 在调用链中扩散。
 */
interface DragDatas {
  id: string;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  /** 组件原始旋转角（来自 store，拖拽期间保持不变） */
  rotation: number;
  /** 组件水平翻转标志（来自 store，拖拽期间保持不变） */
  flipX: boolean;
  /** 组件垂直翻转标志（来自 store，拖拽期间保持不变） */
  flipY: boolean;
  isAltCopy: boolean;
  altCopyClone: HTMLElement | null;
}

interface ResizeDatas {
  id: string;
  origW: number;
  origH: number;
  origX: number;
  origY: number;
  /** 组件原始旋转角（来自 store，缩放期间保持不变） */
  rotation: number;
  /** 组件水平翻转标志（来自 store，缩放期间保持不变） */
  flipX: boolean;
  /** 组件垂直翻转标志（来自 store，缩放期间保持不变） */
  flipY: boolean;
}

interface RotateDatas {
  id: string;
  snapRotate: boolean;
  /** 组件原始位置 x（来自 store，旋转期间保持不变，用于 compose transform 的 translate） */
  origX: number;
  /** 组件原始位置 y（来自 store，旋转期间保持不变） */
  origY: number;
  /** 组件水平翻转标志（来自 store，旋转期间保持不变） */
  flipX: boolean;
  /** 组件垂直翻转标志（来自 store，旋转期间保持不变） */
  flipY: boolean;
}

interface GroupDragDatas {
  ids: string[];
  isAltCopy: boolean;
  altCopyClones: HTMLElement[];
  /** 每个组件的 [rotation, flipX, flipY]，用于 compose transform */
  transforms: Array<{ rotation: number; flipX: boolean; flipY: boolean }>;
}

/** OnDragEnd / OnResizeEnd 中 `e.lastEvent` 的最小形状（beforeTranslate/width/height/isDrag） */
interface MoveableLastEvent {
  beforeTranslate: [number, number];
  width?: number;
  height?: number;
  isDrag: boolean;
}

/**
 * 从 Moveable 的 `e.target`（HTMLElement | SVGElement）中提取 data-component-id。
 *
 * react-moveable 的 target 类型包含 SVGElement，但画布组件一律为 HTMLDivElement，
 * 通过类型守卫收敛到 HTMLElement 后再向上查找，避免对 SVGElement 调用 getAttribute
 * 时行为差异（实际两者都支持，但收敛类型让 TS 更安全）。
 */
function getComponentIdFromTarget(target: HTMLElement | SVGElement): string | null {
  let current: Element | null = target;
  while (current) {
    const id = current.getAttribute('data-component-id');
    if (id) return id;
    current = current.parentElement;
  }
  return null;
}

/** 安全读取 inputEvent 的 altKey，兼容 MouseEvent / PointerEvent / TouchEvent */
function readAltKey(inputEvent: unknown): boolean {
  if (inputEvent && typeof inputEvent === 'object' && 'altKey' in inputEvent) {
    return inputEvent.altKey === true;
  }
  return false;
}

/**
 * 安全地设置指针捕获。
 *
 * 浏览器在指针已不活跃时（如同步 pointerup、触摸指针被系统取消、合成事件等）
 * 对 setPointerCapture 抛出 NotFoundError。指针捕获只是把后续 move/up 事件
 * 重定向到 target 的优化手段，失败时事件仍会沿 DOM 冒泡到容器，拖拽创建/平移
 * 主流程不受影响，因此此处降级为静默失败。
 */
function trySetPointerCapture(target: EventTarget, pointerId: number): void {
  if (!(target instanceof HTMLElement)) return;
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // 指针已不活跃：忽略，交互通过容器冒泡继续
  }
}

const initialDimension: DimensionInfo = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  rotate: 0,
  visible: false,
  mode: undefined,
};

/**
 * H1 性能优化：Moveable 配置常量提升到模块级。
 *
 * react-moveable 内部对 snapDirections / elementSnapDirections / renderDirections
 * 做引用相等性检查决定是否重算吸附方向与渲染控制点。若在组件函数体内以对象/数组
 * 字面量传入，每次渲染都会产生新引用，触发 Moveable 内部全量重算。
 * 提升为模块级常量后引用稳定，仅初始化一次。
 */
const SNAP_DIRECTIONS = {
  top: true,
  bottom: true,
  left: true,
  right: true,
  center: true,
  middle: true,
};
const ELEMENT_SNAP_DIRECTIONS = SNAP_DIRECTIONS;
const RENDER_DIRECTIONS = ['n', 'nw', 'ne', 's', 'se', 'sw', 'e', 'w'];

/**
 * 独立的 dimension 状态 store。
 * 将拖拽过程中的尺寸/位置提示信息从画布主组件中剥离，
 * 避免 onDrag 高频回调触发整个画布重渲染导致拖拽抖动。
 */
export const useDimensionStore = create<{
  dimension: DimensionInfo;
  setDimension: (updater: (d: DimensionInfo) => DimensionInfo) => void;
}>((set) => ({
  dimension: initialDimension,
  setDimension: (updater) => set((state) => ({ dimension: updater(state.dimension) })),
}));

interface ActiveGroupOutlineProps {
  groupId: string | null;
  components: ScreenComponent[];
}

/**
 * 活动分组包围盒：当 activeGroupId 被设置时（用户已双击进入分组），
 * 在画布上以虚线框高亮当前分组所有成员的并集包围盒，提示用户"正在编辑此分组内部"。
 */
const ActiveGroupOutline = memo(function ActiveGroupOutline({
  groupId,
  components,
}: ActiveGroupOutlineProps) {
  if (!groupId) return null;
  const siblings = components.filter((c) => c.parentId === groupId);
  if (siblings.length === 0) return null;
  const minX = Math.min(...siblings.map((c) => c.position.x));
  const minY = Math.min(...siblings.map((c) => c.position.y));
  const maxX = Math.max(...siblings.map((c) => c.position.x + c.position.width));
  const maxY = Math.max(...siblings.map((c) => c.position.y + c.position.height));
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: minX - 4,
        top: minY - 4,
        width: maxX - minX + 8,
        height: maxY - minY + 8,
        border: '1.5px dashed rgb(59 130 246 / 0.7)',
        borderRadius: 4,
      }}
    />
  );
});

interface CanvasComponentWrapperProps {
  component: ScreenComponent;
  selected: boolean;
  showBorderGuides: boolean;
  registerRef: (id: string, el: HTMLElement | null) => void;
  /**
   * 元素点击事件处理器（仅 eventsEnabled 时传入）。
   * - undefined：不派发蓝图事件（默认编辑模式）
   * - 函数：派发蓝图 componentClick 事件，用于在编辑器内预览交互效果
   */
  onComponentClick?: (componentId: string) => void;
}

/**
 * Memo 化的画布组件容器。
 * 拖拽过程中 Moveable 直接操作 DOM style，若父组件重渲染导致此处重新渲染，
 * React 的 style 对象 diff 会覆盖 Moveable 的直接 DOM 操作，造成视觉抖动。
 * 通过 memo 确保仅在 component 数据实际变化时才重新渲染。
 */
const CanvasComponentWrapper = memo(function CanvasComponentWrapper({
  component,
  selected,
  showBorderGuides,
  registerRef,
  onComponentClick,
}: CanvasComponentWrapperProps) {
  return (
    <div
      ref={(el) => registerRef(component.id, el)}
      data-component-id={component.id}
      className="absolute"
      style={{
        ...resolveComponentContainerStyle(component),
        // 编辑器专用叠加：未选中态下显示辅助边框；选中态由 Moveable 控制点接管
        outline: showBorderGuides && !selected ? '1px dashed rgba(147, 197, 253, 0.5)' : undefined,
      }}
      onClick={
        onComponentClick
          ? (e) => {
              // 阻止冒泡到画布容器（避免触发画布空白点击逻辑）
              e.stopPropagation();
              onComponentClick(component.id);
            }
          : undefined
      }
    >
      <ComponentRenderer component={component} />
    </div>
  );
});

/**
 * 任务 2.3：会话控制器接入 ScreenCanvas
 *
 * 画布按活动工具的能力派生 Moveable/Selecto 启用状态：
 * - Moveable 的 `draggable`/`resizable`/`rotatable` 来自 `canDrag`/`canResize`/`canRotate`
 * - Selecto 的 `selectByClick` 来自 `canSelect`
 * - 容器 cursor 来自 `TOOL_REGISTRY` 中工具定义的 cursor，平移期间临时覆盖为 `grabbing`
 *
 * 本任务只交付"不同工具改变画布允许能力"的可观察结果，具体工具行为留给 4.x-9.x。
 */
export function ScreenCanvas({
  onDrop,
  onDragOver,
  editorSession,
}: {
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  editorSession: Pick<
    EditorSessionApi,
    | 'activeTool'
    | 'activeCapabilities'
    | 'dispatchInteraction'
    | 'interactionState'
    | 'textEditing'
    | 'beginTextEditing'
    | 'endTextEditing'
    | 'isEditingText'
  >;
}) {
  const { activeTool, activeCapabilities: capabilities } = editorSession;
  const { dispatchInteraction } = editorSession;
  const { interactionState } = editorSession;
  const { beginTextEditing } = editorSession;

  /**
   * 任务 13.7：用 ref 读取最新的 activeTool 和 interactionState，
   * 供 setTimeout 等异步回调 guard 使用，避免 closure 捕获旧值导致状态卡死。
   *
   * 修复 bug：Selecto onSelectEnd 末尾的 setTimeout(dragStart, 0) 在用户切换工具后
   * 仍会触发 Moveable.dragStart，导致 interactionState 进入 dragging 但 activeTool
   * 已不是 select，后续抓手/形状等工具因 interactionState !== idle 而拒绝交互，
   * 且 Moveable 内部 dragging 状态无法恢复（onDragEnd 不会被调用），最终选择工具
   * 的所有能力失效。
   */
  const activeToolRef = useRef(activeTool);
  const interactionStateRef = useRef(interactionState);
  useEffect(() => {
    activeToolRef.current = activeTool;
    interactionStateRef.current = interactionState;
  }, [activeTool, interactionState]);

  /**
   * L1 性能优化：拖拽/缩放/旋转过程中的高频副作用分两类处理：
   * - DOM style 写入（left/top/width/height/transform）与吸附计算：同步执行。
   *   Moveable 在事件返回后同步 flushSync(updateRect + forceUpdate) 读取目标 DOM
   *   （见 getAbleGesto.ts），若 style 延迟到下一帧写入，控制框按旧位置渲染、
   *   组件下一帧才移动，两者错开一帧造成视觉抖动。
   * - React store 更新（Smart Guides 对齐线浮层、尺寸提示）：rAF 节流，
   *   同帧内多次事件仅执行最后一次，降低重渲染频率与主线程压力。
   *
   * 使用契约（与 raf-throttle.ts 文档一致）：
   * - 手势结束（onDragEnd / onResizeEnd / onRotateEnd）：cancel() 丢弃挂起的
   *   store 更新（End 处理器会同步写入最终 visible:false，挂起任务若执行会覆盖）
   * - 组拖拽/组缩放不做节流：过程中无 store 更新，仅 style 写入，开销极低
   */
  const gestureRafThrottlerRef = useRef<RafThrottler | null>(null);
  if (gestureRafThrottlerRef.current === null) {
    gestureRafThrottlerRef.current = createRafThrottler();
  }
  // 卸载时丢弃挂起任务，防止手势外的延迟任务写入已卸载组件
  useEffect(() => {
    const throttler = gestureRafThrottlerRef.current;
    return () => throttler?.cancel();
  }, []);
  // 任务 4.5：isPanning 从交互状态机派生，避免重复平移布尔状态。
  const isPanning = interactionState === 'panning';
  const project = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const canvasOffset = useScreenEditorStore((s) => s.canvasOffset);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
  // 画布元素事件开关：开启时编辑器画布接入蓝图运行时，组件 onClick 派发 componentClick 事件
  const eventsEnabled = useScreenEditorStore((s) => s.eventsEnabled);

  /**
   * Canvas Pan Optimization：用 ref 镜像 canvasScale / canvasOffset，
   * 供 handlePanMove / handlePanStart / shapeCreation 等高频回调读取最新值，
   * 消除对 canvasOffset 的 closure 依赖（每次平移 canvasOffset 变化会导致回调重建）。
   */
  const canvasScaleRef = useRef(canvasScale);
  const canvasOffsetRef = useRef(canvasOffset);
  canvasScaleRef.current = canvasScale;
  canvasOffsetRef.current = canvasOffset;

  const showBorderGuides = useScreenEditorStore((s) => s.showBorderGuides);
  const selectComponents = useScreenEditorStore((s) => s.selectComponents);
  const clearSelection = useScreenEditorStore((s) => s.clearSelection);
  const activeGroupId = useScreenEditorStore((s) => s.activeGroupId);
  const setActiveGroupId = useScreenEditorStore((s) => s.setActiveGroupId);
  const updateComponent = useScreenEditorStore((s) => s.updateComponent);
  const updateComponentsBatch = useScreenEditorStore((s) => s.updateComponentsBatch);
  // 任务 5.2：文字工具点击创建需要 addComponent / selectComponent
  const addComponent = useScreenEditorStore((s) => s.addComponent);
  const selectComponent = useScreenEditorStore((s) => s.selectComponent);
  // Alt+拖拽复制（适配表 #12）：onDragEnd 时调用，复制选中到光标位置
  const duplicateSelectedToPosition = useScreenEditorStore((s) => s.duplicateSelectedToPosition);
  const setCanvasScaleAndOffset = useScreenEditorStore((s) => s.setCanvasScaleAndOffset);
  // M1 优化：拆分 guides 订阅为独立字段，避免单字段变化触发整个 ScreenCanvas 重渲染。
  // - guides.locked 变化不影响画布渲染（仅状态栏有 toggle 显示），不订阅
  // - guides.vertical / horizontal 是数组引用，addGuide/moveGuide 仅修改对应方向数组，
  //   拆分后另一方向订阅不会触发重渲染
  const guidesVisible = useScreenEditorStore((s) => s.guides.visible);
  const guidesVertical = useScreenEditorStore((s) => s.guides.vertical);
  const guidesHorizontal = useScreenEditorStore((s) => s.guides.horizontal);
  const snapEnabled = useScreenEditorStore((s) => s.snapEnabled);
  const smartGuidesEnabled = useScreenEditorStore((s) => s.smartGuidesEnabled);
  const gridEnabled = useScreenEditorStore((s) => s.gridEnabled);
  const gridSize = useScreenEditorStore((s) => s.gridSize);

  // 从独立 store 获取 setDimension，避免拖拽高频回调触发画布重渲染
  const setDimension = useDimensionStore((s) => s.setDimension);

  const componentRefs = useRef<Map<string, HTMLElement>>(new Map());
  const moveableRef = useRef<Moveable>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /**
   * 画布变换层 div 的 ref（应用 translate3d + scale 的元素）。
   *
   * Canvas Pan Optimization：抓手工具拖拽画布时，直接操作此 DOM 元素的 transform
   * （同步，GPU 合成层），rAF 节流 zustand store 更新，避免每次 pointermove 触发
   * 整个 ScreenCanvas 重渲染（Moveable/Selecto/所有组件）导致掉帧。
   */
  const canvasTransformRef = useRef<HTMLDivElement>(null);
  // 手动双击检测：Selecto 在 click 事件上调用 preventDefault 会抑制原生 dblclick，
  // 因此这里记录上一次单击的 componentId 与时间戳，自行判定双击。
  const lastClickRef = useRef<ClickRecord | null>(null);
  const panState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  // 修饰键状态由 useModifierKeys 集中管理。
  // 任务 4.3：Space 临时抓手不再通过 spaceRef 直接控制画布，而是通过工具栈
  // （pushTemporaryTool('hand')）使 activeTool 变为 'hand'，画布按 activeTool 派生行为。
  // spaceRef/spaceHeld 不再被画布消费，保留修饰键 hook 供未来其他用途。
  // altHeld 用于切换 copy 光标（Alt+拖拽复制，适配表 #12），仅在允许拖拽的工具下生效。
  // altRef 用于 onResize/onResizeEnd 实时读取 Alt 状态，实现 PS 风格的即时中心变换切换。
  const { shiftRef, altRef, shiftHeld, altHeld } = useModifierKeys();

  /**
   * 任务 2.3：按活动工具能力派生 Moveable/Selecto 启用状态。
   *
   * 这是从 `editorSession.activeCapabilities` 到 Moveable/Selecto props 的唯一映射点。
   * 当活动工具不具备某项能力时，对应的交互入口被关闭，确保非选择工具不会误触
   * 组件变换。具体工具行为（如抓手平移、文字创建）由后续任务实现。
   */
  const moveableDraggable = capabilities.canDrag;
  const moveableResizable = capabilities.canResize;
  const moveableRotatable = capabilities.canRotate;
  const selectoSelectByClick = capabilities.canSelect;

  /**
   * 任务 2.3：按活动工具派生容器 cursor。
   *
   * 优先级：平移中（grabbing） > Alt 修饰（copy） > 工具 cursor > Space 临时抓手（grab）。
   * 当工具自身 cursor 与 Space 临时抓手冲突时（如 hand 工具），保持工具 cursor。
   */
  const toolCursor = useMemo(() => {
    const tool = getToolById(activeTool);
    return tool?.cursor ?? 'default';
  }, [activeTool]);

  /** 稳定的 ref 注册回调，避免作为 prop 传入 memo 组件时引起重渲染 */
  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) componentRefs.current.set(id, el);
    else componentRefs.current.delete(id);
  }, []);

  /** 选中 ID 集合，O(1) 查询选中状态 */
  const selectedIdSet = useMemo(() => new Set(selectedComponentIds), [selectedComponentIds]);

  /**
   * Moveable 的 target DOM 元素数组。
   *
   * 使用 useState + useLayoutEffect 而非 useMemo：新组件被选中并挂载时
   * （如 Alt+拖拽复制、粘贴、新建），ref 回调在 commit 阶段执行但 useMemo 在
   * render 阶段已计算完毕拿不到新 DOM。useLayoutEffect 在所有 ref 回调执行后
   * 同步运行，此时通过 componentRefs 或 querySelector 能拿到新挂载的 DOM。
   *
   * 性能优化：setTargets 返回 prev（引用相同）时 React 会 bail out 不重渲染，
   * 所以"相同选中"场景不会触发额外渲染。仅在 target 真正变化时才重渲染。
   */
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  useLayoutEffect(() => {
    if (selectedComponentIds.length === 0) {
      setTargets((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const newTargets = selectedComponentIds
      .map((id) => {
        // 优先用 componentRefs（已注册的组件，O(1)）
        const refEl = componentRefs.current.get(id);
        if (refEl) return refEl;
        // fallback：querySelector（新挂载的组件，ref 可能还没注册但 DOM 已存在）
        return (
          contentRef.current?.querySelector<HTMLElement>(`[data-component-id="${id}"]`) ?? null
        );
      })
      .filter((el): el is HTMLElement => el != null);
    // 引用相同时 bail out，避免无谓渲染
    setTargets((prev) => {
      if (prev.length === newTargets.length && prev.every((el, i) => el === newTargets[i])) {
        return prev;
      }
      return newTargets;
    });
  }, [selectedComponentIds, project?.components]);

  /**
   * 选中组件的位置/尺寸指纹：当 x/y/width/height/rotation 变化时强制刷新 Moveable rect。
   *
   * 背景：通过属性面板修改位置/尺寸时，project.components 引用变化但 DOM 元素引用
   * 不变（React 复用 DOM），导致上方 useLayoutEffect 的 setTargets bail out，
   * targets 不变 → 下方 useEffect([targets]) 不触发 → updateRect() 不调用，
   * Moveable 控制框停留在原地。
   *
   * 这里以位置/尺寸指纹作为额外依赖，仅当真正影响 rect 的字段变化时才触发 updateRect，
   * 避免依赖 project?.components 引用变化导致过度更新（如 props/style 变化不需要刷 rect）。
   */
  const selectedGeometryFingerprint = useMemo(() => {
    if (!project || selectedComponentIds.length === 0) return '';
    const idSet = new Set(selectedComponentIds);
    return project.components
      .filter((c) => idSet.has(c.id))
      .map(
        (c) =>
          `${c.id}:${c.position.x},${c.position.y},${c.position.width},${c.position.height},${c.position.rotation ?? 0}`,
      )
      .join('|');
  }, [project, selectedComponentIds]);

  useEffect(() => {
    if (moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [targets, selectedGeometryFingerprint]);

  /**
   * 任务 5.2：文字工具点击画布创建文本组件。
   *
   * 当 activeTool === 'text' 且 capabilities.canCreate 时，pointer-down 在画布空白处
   * 创建文本组件，选中新组件并进入编辑态。
   *
   * 坐标转换：屏幕坐标 → 画布坐标
   *   canvasX = (clientX - rect.left - canvasOffset.x) / canvasScale
   *   canvasY = (clientY - rect.top - canvasOffset.y) / canvasScale
   *
   * 派发到交互状态机：
   * - 'start-create'：idle → creating（标记创建态）
   * - 'double-click'：creating → text-editing（进入编辑态）
   *
   * 提交/取消语义（任务 5.1 契约）：
   * - 用户输入有效内容提交：写入历史一条
   * - 用户输入空内容提交：删除组件，不写入历史
   * - 用户 Escape 取消：删除组件（新建路径），不写入历史
   */
  const handleCreateText = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // 仅在 idle/hovering 状态下可以开始创建，避免与其他交互重入
      if (!SELECTO_ALLOWED_STATES.has(interactionState)) return;
      const el = containerRef.current;
      const proj = project;
      if (!el || !proj) return;
      const rect = el.getBoundingClientRect();
      // 屏幕坐标 → 画布坐标
      const canvasX = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
      const canvasY = (e.clientY - rect.top - canvasOffset.y) / canvasScale;
      // 计算最大 zIndex
      const maxZ = proj.components.reduce(
        (m: number, c: ScreenComponent) => Math.max(m, c.zIndex),
        0,
      );
      const instance = createComponentInstance('text', canvasX, canvasY, maxZ + 1, proj.components);
      if (!instance) return;
      // 写入 Store
      addComponent(instance);
      selectComponent(instance.id);
      // 进入文本编辑态
      beginTextEditing({
        componentId: instance.id,
        initialContent: DEFAULT_TEXT_CONTENT,
        isNewlyCreated: true,
      });
      // 派发到交互状态机：先标记创建态，再进入编辑态
      dispatchInteraction('start-create');
      dispatchInteraction('double-click');
      e.preventDefault();
      e.stopPropagation();
    },
    [
      interactionState,
      project,
      canvasScale,
      canvasOffset,
      addComponent,
      selectComponent,
      beginTextEditing,
      dispatchInteraction,
    ],
  );

  /**
   * 任务 6.3/6.4：形状（矩形/椭圆）拖拽创建状态。
   *
   * 与文本创建不同，形状需要拖拽确定尺寸：
   * - pointer-down：记录起点，进入 creating 状态
   * - pointer-move：更新当前点，渲染预览矩形
   * - pointer-up：根据 hasValidSize 判定提交或取消
   *
   * 坐标均为画布坐标系（已经过 canvasScale 反向换算）。
   */
  interface ShapeCreationState {
    readonly tool: 'rect' | 'ellipse';
    readonly startX: number;
    readonly startY: number;
    readonly currentX: number;
    readonly currentY: number;
  }

  const [shapeCreation, setShapeCreation] = useState<ShapeCreationState | null>(null);

  /**
   * 任务 13.6：交互状态恢复到 idle/hovering 时清理画布局部状态。
   *
   * 修复 bug：用户在 panning/creating 态直接切换工具时，setToolWithCleanup 派发
   * cancel 让交互状态机回到 idle，但 ScreenCanvas 的 panState（useRef）和
   * shapeCreation（useState）不会自动清理。如果不清理：
   * - panState.current 残留 → 下次 handlePanMove 误以为在平移，offset 异常跳变
   * - shapeCreation 残留 → 下次 handlePanMove 误以为在创建形状，渲染异常预览
   * - pointer capture 残留 → 后续点击事件被原 target 捕获，Selecto 接收不到
   *
   * 触发条件：interactionState 从非 idle/hovering 状态"恢复到" idle/hovering。
   * 用 ref 追踪前一次状态，避免在 idle 状态下 shapeCreation 正常变化时误清理
   *（例如测试中 mock 的 interactionState 固定为 idle，handleCreateShapeStart
   *  设置 shapeCreation 后此 effect 会立即清空它，破坏创建流程）。
   */
  const prevInteractionStateRef = useRef(interactionState);
  useEffect(() => {
    const prev = prevInteractionStateRef.current;
    const curr = interactionState;
    prevInteractionStateRef.current = curr;

    // 仅在"从非 idle/hovering 恢复到 idle/hovering"时清理
    const isRecovery =
      (curr === 'idle' || curr === 'hovering') && prev !== 'idle' && prev !== 'hovering';
    if (!isRecovery) return;

    if (panState.current) {
      panState.current = null;
    }
    if (shapeCreation) {
      setShapeCreation(null);
    }
  }, [interactionState, shapeCreation]);

  /**
   * 任务 6.3/6.4：形状工具拖拽创建起点。
   *
   * 当 activeTool 为 rect/ellipse 且 canCreate 时，pointer-down 记录起点并进入 creating 状态。
   * 实际创建在 pointer-up 时根据拖拽尺寸判定。
   */
  const handleCreateShapeStart = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (!SELECTO_ALLOWED_STATES.has(interactionState)) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
      const canvasY = (e.clientY - rect.top - canvasOffset.y) / canvasScale;
      setShapeCreation({
        tool: activeTool as 'rect' | 'ellipse',
        startX: canvasX,
        startY: canvasY,
        currentX: canvasX,
        currentY: canvasY,
      });
      trySetPointerCapture(e.target, e.pointerId);
      dispatchInteraction('start-create');
      e.preventDefault();
      e.stopPropagation();
    },
    [interactionState, canvasScale, canvasOffset, activeTool, dispatchInteraction],
  );

  /**
   * 任务 7.4：图片工具点击创建图片组件。
   *
   * 与文字/形状工具不同，图片工具需要用户通过文件选择器选择图片文件：
   * - pointer-down：记录点击位置（画布坐标）
   * - 调用 pickImageFile() 弹出文件选择器
   * - 用户选择文件：创建图片组件，按图片自然尺寸设置 customSize（受 maxDimension 约束）
   * - 用户取消：不创建组件，不入历史
   *
   * 派发到交互状态机：
   * - 'start-create'：进入 creating 状态（等待文件选择）
   * - 'commit-create'：用户选择文件并成功创建
   * - 'cancel'：用户取消文件选择或创建失败
   *
   * 提交语义（任务 7.1 资源契约）：
   * - 仅持久化 data URL 或 http(s) URL，拒绝 file:// 和 blob:
   * - 图片尺寸按自然尺寸等比缩放，最大不超过 maxImageDimension
   */
  const handleCreateImage = useCallback(
    async (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (!SELECTO_ALLOWED_STATES.has(interactionState)) return;
      const el = containerRef.current;
      const proj = project;
      if (!el || !proj) return;
      const rect = el.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
      const canvasY = (e.clientY - rect.top - canvasOffset.y) / canvasScale;
      e.preventDefault();
      e.stopPropagation();
      dispatchInteraction('start-create');
      let imageResult: ImageFileResult | null;
      try {
        imageResult = await pickImageFile();
      } catch {
        // 文件读取/类型校验失败：取消创建，不入历史
        dispatchInteraction('cancel');
        return;
      }
      if (!imageResult) {
        // 用户取消文件选择：不创建组件
        dispatchInteraction('cancel');
        return;
      }
      const maxZ = proj.components.reduce(
        (m: number, c: ScreenComponent) => Math.max(m, c.zIndex),
        0,
      );
      // 按图片自然尺寸等比缩放，最大不超过 maxImageDimension
      const maxImageDimension = 800;
      let width = imageResult.width;
      let height = imageResult.height;
      if (width > maxImageDimension || height > maxImageDimension) {
        const ratio = Math.min(maxImageDimension / width, maxImageDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      // 防御性尺寸下限
      if (width < 1) width = 1;
      if (height < 1) height = 1;
      const instance = createComponentInstance(
        'image',
        canvasX,
        canvasY,
        maxZ + 1,
        proj.components,
        {
          customSize: { width, height },
        },
      );
      if (!instance) {
        dispatchInteraction('cancel');
        return;
      }
      // 写入 src 和 alt（任务 7.1 资源契约：data URL 可持久化）
      instance.props.src = imageResult.dataUrl;
      instance.props.alt = imageResult.name;
      addComponent(instance);
      selectComponent(instance.id);
      dispatchInteraction('commit-create');
    },
    [
      interactionState,
      project,
      canvasScale,
      canvasOffset,
      addComponent,
      selectComponent,
      dispatchInteraction,
    ],
  );

  /**
   * 任务 8.2/8.3：缩放工具点击放大/反向缩小。
   *
   * - 左键点击：围绕指针位置放大（factor = ZOOM_TOOL_IN_FACTOR）
   * - Alt+左键点击：围绕指针位置缩小（factor = ZOOM_TOOL_OUT_FACTOR）
   *
   * 与 Alt+拖拽复制（选择工具）的语义不冲突：缩放工具下 canDrag=false，
   * Alt 仅作为缩放反向修饰键，不会触发组件复制。
   *
   * 边界约束由 zoomToolClick 内部调用 zoomWithBoundary 处理，
   * 达到上下限时点击无效果（无变化不写入历史）。
   *
   * 任务 12.2：缩放工具由状态机仲裁。
   * - 仅在 idle/hovering 状态下可开始缩放，避免与拖拽/框选/创建等手势重入。
   * - 派发 start-zoom（idle → zooming）标记进入缩放态，操作完成后派发 end-zoom（zooming → idle）。
   * - 操作本身为同步瞬时行为，状态机事件用于互斥仲裁与诊断断言。
   */
  const handleZoomToolClick = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // 任务 12.2：缩放由状态机仲裁，拒绝非法重入
      if (!SELECTO_ALLOWED_STATES.has(interactionState)) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      // Alt 修饰键：反向缩小（任务 8.3）
      const zoomOut = e.altKey;
      // 任务 12.2：进入 zooming 态以仲裁后续重入
      dispatchInteraction('start-zoom');
      const result = zoomToolClick({
        currentScale: canvasScale,
        currentOffset: canvasOffset,
        cursorX,
        cursorY,
        zoomOut,
      });
      setCanvasScaleAndOffset(result.scale, result.offset);
      // 任务 12.2：缩放操作完成，退出 zooming 态
      dispatchInteraction('end-zoom');
      e.preventDefault();
      e.stopPropagation();
    },
    [interactionState, canvasScale, canvasOffset, setCanvasScaleAndOffset, dispatchInteraction],
  );

  const handlePanStart = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // 任务 5.2：文字工具优先处理点击创建
      if (activeTool === 'text' && capabilities.canCreate) {
        handleCreateText(e);
        return;
      }
      // 任务 6.3/6.4：矩形与椭圆工具拖拽创建
      if ((activeTool === 'rect' || activeTool === 'ellipse') && capabilities.canCreate) {
        handleCreateShapeStart(e);
        return;
      }
      // 任务 7.4：图片工具点击创建（异步弹出文件选择器）
      if (activeTool === 'image' && capabilities.canCreate) {
        void handleCreateImage(e);
        return;
      }
      // 任务 8.2/8.3：缩放工具点击放大/反向缩小
      if (activeTool === 'zoom' && capabilities.canZoom) {
        handleZoomToolClick(e);
        return;
      }
      // 任务 4.3：平移完全由 activeTool 仲裁。
      // - 主工具为抓手：activeTool === 'hand'，可直接平移
      // - 其他工具 + Space 临时抓手：use-keyboard-shortcuts 通过 pushTemporaryTool('hand')
      //   使 activeTool 变为 'hand'，此处自动放行
      // - 其他工具且未按 Space：activeTool !== 'hand'，拒绝平移
      if (activeTool !== 'hand') return;
      // 任务 4.4：平移与其他交互互斥由统一状态机仲裁。
      // 仅在 idle/hovering 状态下可以开始平移，避免拖拽/缩放/旋转/框选中重入平移。
      if (!SELECTO_ALLOWED_STATES.has(interactionState)) return;
      e.preventDefault();
      e.stopPropagation();
      trySetPointerCapture(e.target, e.pointerId);
      // Canvas Pan Optimization：用 ref 读取最新 offset，消除对 canvasOffset 的 closure 依赖
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: canvasOffsetRef.current.x,
        origY: canvasOffsetRef.current.y,
      };
      // 任务 3.6：镜像平移开始到交互状态机
      dispatchInteraction('start-pan');
    },
    [
      dispatchInteraction,
      activeTool,
      interactionState,
      capabilities.canCreate,
      capabilities.canZoom,
      handleCreateText,
      handleCreateShapeStart,
      handleCreateImage,
      handleZoomToolClick,
    ],
  );

  const handlePanMove = useCallback(
    (e: React.PointerEvent) => {
      // 任务 6.3/6.4：形状拖拽创建中，更新预览当前点
      if (shapeCreation) {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Canvas Pan Optimization：用 ref 读取最新 offset/scale
        const off = canvasOffsetRef.current;
        const scale = canvasScaleRef.current;
        const canvasX = (e.clientX - rect.left - off.x) / scale;
        const canvasY = (e.clientY - rect.top - off.y) / scale;
        setShapeCreation((prev) =>
          prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null,
        );
        return;
      }
      if (!panState.current) return;
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      const newX = panState.current.origX + dx;
      const newY = panState.current.origY + dy;
      const scale = canvasScaleRef.current;
      // Canvas Pan Optimization：直接操作 DOM transform（同步，GPU 合成层），
      // 避免 pointermove 触发 zustand store 更新 -> ScreenCanvas 重渲染 -> 掉帧。
      // transform 值与 React 渲染产物一致，store 更新后 React style diff 不会覆盖。
      const transformEl = canvasTransformRef.current;
      if (transformEl) {
        transformEl.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${scale})`;
      }
      // rAF 节流 store 更新：同帧多次 pointermove 仅最后一次生效，降低重渲染频率
      gestureRafThrottlerRef.current?.schedule(() => {
        setCanvasScaleAndOffset(scale, { x: newX, y: newY });
      });
    },
    [shapeCreation, setCanvasScaleAndOffset],
  );

  const handlePanEnd = useCallback(
    (e: React.PointerEvent) => {
      // 任务 6.3/6.4：形状拖拽结束，根据尺寸判定提交或取消
      if (shapeCreation) {
        const proj = project;
        const geometry = computeShapeCreation(
          shapeCreation.startX,
          shapeCreation.startY,
          shapeCreation.currentX,
          shapeCreation.currentY,
        );
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        if (geometry.hasValidSize && proj) {
          const maxZ = proj.components.reduce(
            (m: number, c: ScreenComponent) => Math.max(m, c.zIndex),
            0,
          );
          const instance = createComponentInstance(
            shapeCreation.tool,
            geometry.rect.x,
            geometry.rect.y,
            maxZ + 1,
            proj.components,
            {
              customSize: {
                width: geometry.rect.width,
                height: geometry.rect.height,
              },
            },
          );
          if (instance) {
            addComponent(instance);
            selectComponent(instance.id);
            dispatchInteraction('commit-create');
          } else {
            dispatchInteraction('cancel');
          }
        } else {
          // 微小拖拽或项目未就绪：取消创建，不入历史
          dispatchInteraction('cancel');
        }
        setShapeCreation(null);
        return;
      }
      if (!panState.current) return;
      panState.current = null;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      // Canvas Pan Optimization：丢弃挂起的 rAF store 更新，同步最终值到 store。
      gestureRafThrottlerRef.current?.cancel();
      const transformEl = canvasTransformRef.current;
      if (transformEl) {
        const match = transformEl.style.transform.match(
          /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)\s*scale\(([\d.]+)\)/,
        );
        if (match) {
          setCanvasScaleAndOffset(Number.parseFloat(match[3]), {
            x: Number.parseFloat(match[1]),
            y: Number.parseFloat(match[2]),
          });
        } else {
          setCanvasScaleAndOffset(canvasScaleRef.current, canvasOffsetRef.current);
        }
      }
      dispatchInteraction('pointer-up');
    },
    [
      shapeCreation,
      project,
      addComponent,
      selectComponent,
      dispatchInteraction,
      setCanvasScaleAndOffset,
    ],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // 任务 8.4：浏览器默认行为隔离。
      // 缩放手势：Alt+滚轮（原有）或 Ctrl/Cmd+滚轮（主流编辑器习惯）
      // 拦截浏览器原生页面缩放（Ctrl/Cmd+滚轮）与图片缩放（Alt+滚轮），
      // 统一走 zoomWithBoundary 边界约束。
      const isZoomGesture = e.altKey || e.ctrlKey || e.metaKey;
      if (!isZoomGesture) return;
      e.preventDefault();
      const state = useScreenEditorStore.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      // 任务 8.1：统一调用 zoomWithBoundary，边界约束与锚点不变性由其内部保证
      const factor = e.deltaY > 0 ? 1 / WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR;
      const result = zoomWithBoundary({
        currentScale: state.canvasScale,
        currentOffset: state.canvasOffset,
        cursorX,
        cursorY,
        factor,
      });
      setCanvasScaleAndOffset(result.scale, result.offset);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
    // H4 优化：handleWheel 内通过 useScreenEditorStore.getState() 读取最新状态，
    // 不依赖闭包中的 project，移除该依赖避免每次 project 变化重绑事件监听器。
  }, [setCanvasScaleAndOffset]);

  const components = project?.components ?? [];
  const canvas = project?.canvas;

  /**
   * 蓝图运行时集成（仅 eventsEnabled=true 时启用）。
   *
   * - eventsEnabled=false：传入 undefined 作为 blueprint，hook 内部 compileResult=null、
   *   isEnabled=false，pageLoad effect 不触发，onComponentClick 调用时直接返回
   * - eventsEnabled=true：传入实际 blueprint，hook 编译规则并在 mount 时触发 pageLoad，
   *   组件 onClick 派发 componentClick 事件（与公开预览页一致）
   *
   * BlueprintPreviewProvider 在 eventsEnabled=false 时传 null，
   * 组件回退到既有行为（不消费 Context）。
   */
  const blueprintForRuntime = eventsEnabled ? project?.blueprint : undefined;
  const { contextValue: blueprintContext, onComponentClick } = useBlueprintPreviewRuntime(
    blueprintForRuntime,
    components,
  );

  /**
   * 给 CanvasComponentWrapper 的事件回调。
   * - eventsEnabled=false：undefined（不绑定 onClick，保持编辑模式行为）
   * - eventsEnabled=true：包装 onComponentClick，仅对可见组件派发蓝图事件
   */
  const handleComponentClick = eventsEnabled ? onComponentClick : undefined;

  /**
   * H2 性能优化：构建组件 ID → 组件的 Map，替代 12 处 Array.find 查找。
   *
   * react-moveable 的 onDragStart/onResizeStart/onRotateStart 等高频回调内
   * 需要按 data-component-id 查找组件，原先 O(N) 的 find 在组件数量较多时
   * 累积开销显著。Map.get 为 O(1)，且依赖数组稳定（components 引用不变时
   * Map 引用也不变），不会触发下游 useMemo 重算。
   *
   * 仅依赖 components 引用，组件 CRUD 后 store 返回新数组触发重建。
   */
  const componentMap = useMemo(() => {
    const map = new Map<string, ScreenComponent>();
    for (const c of components) {
      map.set(c.id, c);
    }
    return map;
  }, [components]);

  /**
   * Memo 化可见组件列表（过滤 + 按 zIndex 排序）。
   * 避免每次渲染都重新 filter+sort 产生新数组与新 component 引用，
   * 否则会使 CanvasComponentWrapper 的 memo 失效。
   */
  const visibleComponents = useMemo(
    () =>
      components
        .filter((c: ScreenComponent) => !c.status.hidden)
        .sort((a: ScreenComponent, b: ScreenComponent) => a.zIndex - b.zIndex),
    [components],
  );

  /**
   * 根据画布尺寸与 gridSize 生成网格线坐标数组（数值数组）。
   * 当 gridEnabled=true 时合并到 Moveable guidelines 中作为吸附目标。
   * 仅包含 [0, canvas.width/height] 区间内的整数倍 gridSize 点。
   */
  const gridVerticalLines = useMemo<number[]>(() => {
    if (!canvas || !gridEnabled || gridSize < 1) return [];
    const lines: number[] = [];
    for (let x = gridSize; x < canvas.width; x += gridSize) {
      lines.push(x);
    }
    return lines;
  }, [canvas, gridEnabled, gridSize]);
  const gridHorizontalLines = useMemo<number[]>(() => {
    if (!canvas || !gridEnabled || gridSize < 1) return [];
    const lines: number[] = [];
    for (let y = gridSize; y < canvas.height; y += gridSize) {
      lines.push(y);
    }
    return lines;
  }, [canvas, gridEnabled, gridSize]);

  /** Memo 化 Moveable 的 snap 参考线，避免每次渲染产生新数组引用触发 Moveable 内部重算 */
  const verticalGuidelines = useMemo(
    () =>
      canvas
        ? [
            '0',
            `${canvas.width}`,
            ...(guidesVisible ? guidesVertical.map(String) : []),
            ...(gridEnabled ? gridVerticalLines.map(String) : []),
          ]
        : [],
    [canvas, guidesVisible, guidesVertical, gridEnabled, gridVerticalLines],
  );
  const horizontalGuidelines = useMemo(
    () =>
      canvas
        ? [
            '0',
            `${canvas.height}`,
            ...(guidesVisible ? guidesHorizontal.map(String) : []),
            ...(gridEnabled ? gridHorizontalLines.map(String) : []),
          ]
        : [],
    [canvas, guidesVisible, guidesHorizontal, gridEnabled, gridHorizontalLines],
  );

  /**
   * Moveable elementGuidelines：所有可见且未选中的组件 DOM 元素引用。
   *
   * Canvas Drag Optimization：替代自定义 Smart Guides 的 findAlignmentLines 计算，
   * 由 Moveable 内置 snappable + elementGuidelines 完成组件间对齐吸附与辅助线渲染。
   * 排除当前选中的组件（自身不需要与自己对齐）。
   *
   * 注意：componentRefs.current 是 mutable ref，memo 不会感知 ref 注册时机。
   * 实践中拖拽发生在组件已挂载之后（ref 已注册），一帧滞后不影响功能。
   */
  const elementGuidelines = useMemo<HTMLElement[]>(() => {
    if (!smartGuidesEnabled) return [];
    return visibleComponents
      .filter((c: ScreenComponent) => !selectedIdSet.has(c.id))
      .map((c: ScreenComponent) => componentRefs.current.get(c.id))
      .filter((el): el is HTMLElement => el != null);
  }, [smartGuidesEnabled, visibleComponents, selectedIdSet]);

  if (!project || !canvas) return null;

  const isGroupSelect = selectedComponentIds.length > 1;

  return (
    <BlueprintPreviewProvider value={eventsEnabled ? blueprintContext : null}>
      <div
        ref={containerRef}
        data-testid="canvas-surface"
        className="relative h-full w-full overflow-hidden bg-muted"
        style={{
          // 任务 4.3：cursor 完全由 activeTool 派生（toolCursor 来自 TOOL_REGISTRY）。
          // - hand 工具（主或临时）：toolCursor = 'grab'，平移中 = 'grabbing'
          // - select 工具 + Alt：'copy'（Alt+拖拽复制）
          // - 其他工具：toolCursor
          cursor: isPanning ? 'grabbing' : altHeld && capabilities.canDrag ? 'copy' : toolCursor,
        }}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
      >
        <div
          ref={canvasTransformRef}
          className="absolute"
          style={{
            transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${canvasScale})`,
            transformOrigin: 'top left',
          }}
        >
          <div
            ref={contentRef}
            className="relative"
            style={{
              width: canvas.width,
              height: canvas.height,
              backgroundColor: canvas.backgroundColor,
              backgroundImage: canvas.backgroundImage
                ? `url(${canvas.backgroundImage})`
                : undefined,
              backgroundSize: 'cover',
            }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                // 点击空白画布：退出当前活动分组并清空选中
                if (activeGroupId !== null) {
                  setActiveGroupId(null);
                }
                clearSelection();
              }
            }}
          >
            {visibleComponents.map((component: ScreenComponent) => (
              <CanvasComponentWrapper
                key={component.id}
                component={component}
                selected={selectedIdSet.has(component.id)}
                showBorderGuides={showBorderGuides}
                registerRef={registerRef}
                onComponentClick={handleComponentClick}
              />
            ))}

            {/* 活动分组包围盒：双击进入分组后高亮 */}
            <ActiveGroupOutline groupId={activeGroupId} components={visibleComponents} />

            {/* 任务 6.3/6.4：形状拖拽创建预览（与组件同画布坐标系） */}
            {shapeCreation &&
              (() => {
                const geometry = computeShapeCreation(
                  shapeCreation.startX,
                  shapeCreation.startY,
                  shapeCreation.currentX,
                  shapeCreation.currentY,
                );
                return (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: geometry.rect.x,
                      top: geometry.rect.y,
                      width: geometry.rect.width,
                      height: geometry.rect.height,
                      backgroundColor:
                        shapeCreation.tool === 'rect'
                          ? 'rgba(59, 130, 246, 0.5)'
                          : 'rgba(16, 185, 129, 0.5)',
                      border: '1px dashed #ffffff',
                      borderRadius: shapeCreation.tool === 'ellipse' ? '50%' : 0,
                    }}
                  />
                );
              })()}
          </div>

          <Moveable
            ref={moveableRef}
            target={targets}
            container={contentRef.current}
            draggable={moveableDraggable}
            resizable={moveableResizable}
            rotatable={moveableRotatable}
            // Canvas Drag Optimization：用 Moveable 内置 snappable 替代自定义 Smart Guides。
            // snapEnabled 是状态栏总开关：关闭后所有吸附（组件间/标尺/网格）一律禁用。
            // smartGuidesEnabled / gridEnabled / guidesVisible 仅控制各自吸附目标是否填充
            //（见 elementGuidelines / verticalGuidelines / horizontalGuidelines memo），
            // 不再参与 snappable 的 OR，否则关掉总开关时吸附仍会生效。
            snappable={snapEnabled}
            snapThreshold={5}
            snapGap={false}
            keepRatio={shiftHeld}
            // 整数对齐：避免亚像素渲染抖动（transform 合成层下无布局重排，整数对齐更稳定）
            throttleDrag={1}
            throttleResize={1}
            throttleRotate={shiftHeld ? 15 : 0}
            hideChildMoveableDefaultLines={isGroupSelect}
            snapDirections={SNAP_DIRECTIONS}
            elementSnapDirections={ELEMENT_SNAP_DIRECTIONS}
            elementGuidelines={elementGuidelines}
            verticalGuidelines={verticalGuidelines}
            horizontalGuidelines={horizontalGuidelines}
            isDisplaySnapDigit={true}
            isDisplayInnerSnapDigit={true}
            zoom={1 / canvasScale}
            origin={false}
            renderDirections={RENDER_DIRECTIONS}
            // --- Single target events ---
            onDragStart={(e) => {
              // 任务 12.1：拖拽由状态机仲裁，拒绝非法重入
              if (
                interactionState !== 'idle' &&
                interactionState !== 'hovering' &&
                interactionState !== 'marquee-selecting'
              ) {
                return false;
              }
              const id = getComponentIdFromTarget(e.target);
              if (!id) return false;
              const comp = componentMap.get(id);
              if (comp?.status.locked) return false;
              const datas = e.datas as unknown as DragDatas;
              datas.id = id;
              datas.startX = comp?.position.x ?? 0;
              datas.startY = comp?.position.y ?? 0;
              datas.origW = comp?.position.width ?? 0;
              datas.origH = comp?.position.height ?? 0;
              // Canvas Drag Optimization：记录组件原始 rotation/flip，
              // 拖拽期间保持不变，用于 compose transform（translate 变化，rotate/flip 恒定）
              datas.rotation = comp?.position.rotation ?? 0;
              datas.flipX = comp?.style.flipX === true;
              datas.flipY = comp?.style.flipY === true;
              datas.isAltCopy = readAltKey(e.inputEvent);
              datas.altCopyClone = null;
              // Alt+拖拽复制（PS 风格）：按下 Alt 启动拖拽时立即克隆目标 DOM，
              // 拖拽过程中移动克隆体（原件不动），松手时在克隆位置创建真实副本。
              // cloneNode(true) 复制原 transform（translate + rotate + flip），
              // 拖拽中 onDrag 会覆盖 transform 的 translate 部分。
              if (datas.isAltCopy && contentRef.current) {
                const clone = e.target.cloneNode(true) as HTMLElement;
                clone.style.position = 'absolute';
                clone.style.pointerEvents = 'none';
                clone.style.userSelect = 'none';
                clone.setAttribute('data-alt-copy-clone', 'true');
                contentRef.current.appendChild(clone);
                datas.altCopyClone = clone;
              }
              // 同步 W/H 到 dimension store，使拖拽过程中也显示尺寸
              setDimension((d) => ({
                ...d,
                w: Math.round(comp?.position.width ?? 0),
                h: Math.round(comp?.position.height ?? 0),
              }));
              // 任务 3.3：镜像拖拽开始到交互状态机
              dispatchInteraction('start-drag');
            }}
            onDrag={(e) => {
              const datas = e.datas as unknown as DragDatas;
              const target = e.target as HTMLElement;
              // Canvas Drag Optimization：用 beforeTranslate 替代 left/top DOM 回读。
              // beforeTranslate 是 Moveable 内部维护的累积位移，与 transform 的 translate 一一对应，
              // 无精度损失；吸附由 Moveable 内置 snappable 完成，无需自定义 computeSnappedPosition。
              const { beforeTranslate } = e;
              const tx = beforeTranslate[0];
              const ty = beforeTranslate[1];
              const transform = composeComponentTransform(
                tx,
                ty,
                datas.rotation,
                datas.flipX,
                datas.flipY,
              );
              // Alt+拖拽复制（PS 风格）：移动克隆体，原件不动
              if (datas.isAltCopy && datas.altCopyClone) {
                datas.altCopyClone.style.transform = transform;
              } else {
                target.style.transform = transform;
              }
              // rAF 节流仅保留 dimension store 更新（对齐线由 Moveable 内部渲染）
              gestureRafThrottlerRef.current?.schedule(() => {
                setDimension((d) => ({
                  ...d,
                  x: tx,
                  y: ty,
                  visible: true,
                }));
              });
            }}
            onDragEnd={(e) => {
              // 任务 13.8：手势结束必须无条件恢复交互状态机。
              // 纯点击（零位移）时 Gesto isDrag 为 false，若早退会漏发 pointer-up，
              // 状态机卡在 dragging，后续 Selecto onDragStart 仲裁拒绝一切交互
              //（反复选中/取消数次后出现一次零位移点击即无法选中组件）。
              dispatchInteraction('pointer-up');
              // L1：丢弃挂起帧（最终值取自 e.lastEvent），防止延迟任务覆盖 visible:false
              gestureRafThrottlerRef.current?.cancel();
              const datas = e.datas as unknown as Partial<DragDatas>;
              // Alt+拖拽复制：零位移或异常结束时也要清理克隆体
              if (datas.isAltCopy && datas.altCopyClone) {
                datas.altCopyClone.remove();
                datas.altCopyClone = null;
              }
              if (!e.isDrag) return;
              const id = datas.id;
              if (!id) return;
              const last = e.lastEvent as unknown as MoveableLastEvent | undefined;
              if (!last) return;
              // Alt+拖拽复制（PS 风格）：拖拽结束时在克隆体最终位置创建真实副本
              if (datas.isAltCopy) {
                duplicateSelectedToPosition(last.beforeTranslate[0], last.beforeTranslate[1]);
              } else {
                const comp = componentMap.get(id);
                if (!comp) return;
                updateComponent(id, {
                  position: {
                    ...comp.position,
                    x: last.beforeTranslate[0],
                    y: last.beforeTranslate[1],
                  },
                });
              }
              setDimension((d) => ({ ...d, visible: false }));
            }}
            onResizeStart={(e) => {
              // 任务 12.1：缩放由状态机仲裁，拒绝非法重入
              if (!SELECTO_ALLOWED_STATES.has(interactionState)) {
                return false;
              }
              const id = getComponentIdFromTarget(e.target);
              if (!id) return false;
              const comp = componentMap.get(id);
              if (comp?.status.locked) return false;
              const datas = e.datas as unknown as ResizeDatas;
              datas.id = id;
              datas.origW = comp?.position.width ?? 0;
              datas.origH = comp?.position.height ?? 0;
              datas.origX = comp?.position.x ?? 0;
              datas.origY = comp?.position.y ?? 0;
              // Canvas Drag Optimization：记录组件原始 rotation/flip，缩放期间保持不变
              datas.rotation = comp?.position.rotation ?? 0;
              datas.flipX = comp?.style.flipX === true;
              datas.flipY = comp?.style.flipY === true;
              // Shift/Alt 状态在 onResize 中实时从 ref 读取，支持 PS 风格中途按键切换
              // 初始 mode 提示按当前修饰键状态
              if (altRef.current) {
                setDimension((d) => ({ ...d, mode: '中心变换' }));
              }
              // 任务 3.4：镜像缩放开始到交互状态机
              dispatchInteraction('start-resize');
            }}
            onResize={(e) => {
              const datas = e.datas as unknown as ResizeDatas;
              const target = e.target as HTMLElement;
              const { origW, origH, origX, origY, rotation, flipX, flipY } = datas;
              // PS 风格即时响应：每次 onResize 从 ref 实时读取 Shift/Alt 状态，
              // 支持拖拽过程中按键按下/松开立即切换等比/中心变换模式
              const keepRatio = shiftRef.current;
              const isAltCenter = altRef.current;
              // 尺寸计算 + DOM style 写入同步执行（原因同 onDrag：Moveable 同步读 DOM）
              let w = e.width;
              let h = e.height;
              if (keepRatio && origW && origH) {
                const ratio = origW / origH;
                const [dx, dy] = e.direction;
                if (dx !== 0 && dy !== 0) {
                  const newH = w / ratio;
                  const newW = h * ratio;
                  if (Math.abs(w - origW) > Math.abs(h - origH)) {
                    h = newH;
                  } else {
                    w = newW;
                  }
                } else if (dx !== 0) {
                  h = w / ratio;
                } else if (dy !== 0) {
                  w = h * ratio;
                }
              }
              target.style.width = `${w}px`;
              target.style.height = `${h}px`;
              // Canvas Drag Optimization：用 beforeTranslate 替代 left/top。
              // e.drag.beforeTranslate 是缩放过程中组件的新位置（Moveable 内部计算）。
              let tx: number;
              let ty: number;
              if (isAltCenter) {
                // 中心变换：translate = 原位置 + (origSize - newSize) / 2
                tx = origX + (origW - w) / 2;
                ty = origY + (origH - h) / 2;
              } else if (e.drag) {
                tx = e.drag.beforeTranslate[0];
                ty = e.drag.beforeTranslate[1];
              } else {
                tx = origX;
                ty = origY;
              }
              target.style.transform = composeComponentTransform(tx, ty, rotation, flipX, flipY);
              // rAF 节流仅保留 React store 更新（尺寸提示 + mode 跟随 Alt 实时切换）
              gestureRafThrottlerRef.current?.schedule(() => {
                setDimension((d) => ({
                  ...d,
                  x: tx,
                  y: ty,
                  w: Math.round(w),
                  h: Math.round(h),
                  visible: true,
                  mode: isAltCenter ? '中心变换' : undefined,
                }));
              });
            }}
            onResizeEnd={(e) => {
              // 任务 13.8：手势结束必须无条件恢复交互状态机（同 onDragEnd）。
              dispatchInteraction('pointer-up');
              // L1：DOM style 已同步写入，本处理器可直接读取最终值；
              // 挂起任务仅含 store 更新，丢弃防止覆盖下方的 visible:false
              gestureRafThrottlerRef.current?.cancel();
              if (!e.isDrag) return;
              const datas = e.datas as unknown as Partial<ResizeDatas>;
              const id = datas.id;
              if (!id) return;
              const comp = componentMap.get(id);
              if (!comp) return;
              const last = e.lastEvent as unknown as
                | {
                    width: number;
                    height: number;
                    drag: { beforeTranslate: [number, number] };
                    isDrag: boolean;
                  }
                | undefined;
              if (!last) return;
              // 中心变换提交：onResize 中计算的 tx/ty 只写入了 DOM，
              // Moveable 内部的 drag.beforeTranslate 仍按非中心变换计算。
              // 这里必须复用中心变换公式，否则松手后 store 位置与 DOM 不一致导致跳变。
              // PS 风格：松手瞬间的 Alt 状态决定最终提交模式（与最后一次 onResize 一致）
              const isAltCenter = altRef.current;
              let tx: number;
              let ty: number;
              if (isAltCenter) {
                const origX = datas.origX ?? 0;
                const origY = datas.origY ?? 0;
                const origW = datas.origW ?? 0;
                const origH = datas.origH ?? 0;
                tx = origX + (origW - last.width) / 2;
                ty = origY + (origH - last.height) / 2;
              } else {
                tx = last.drag.beforeTranslate[0];
                ty = last.drag.beforeTranslate[1];
              }
              updateComponent(id, {
                position: {
                  ...comp.position,
                  x: tx,
                  y: ty,
                  width: last.width,
                  height: last.height,
                },
              });
              setDimension((d) => ({ ...d, visible: false, mode: undefined }));
            }}
            onRotateStart={(e) => {
              // 任务 12.1：旋转由状态机仲裁，拒绝非法重入
              if (!SELECTO_ALLOWED_STATES.has(interactionState)) {
                return false;
              }
              const id = getComponentIdFromTarget(e.target);
              if (!id) return false;
              const comp = componentMap.get(id);
              if (comp?.status.locked) return false;
              const datas = e.datas as unknown as RotateDatas;
              datas.id = id;
              datas.snapRotate = shiftRef.current;
              // Canvas Drag Optimization：记录组件原始位置/flip，旋转期间保持不变。
              // translate 在旋转期间不变（旋转围绕组件中心，位置由 translate 决定）。
              datas.origX = comp?.position.x ?? 0;
              datas.origY = comp?.position.y ?? 0;
              datas.flipX = comp?.style.flipX === true;
              datas.flipY = comp?.style.flipY === true;
              // 任务 3.4：镜像旋转开始到交互状态机
              dispatchInteraction('start-rotate');
            }}
            onRotate={(e) => {
              const datas = e.datas as unknown as RotateDatas;
              const target = e.target as HTMLElement;
              const { snapRotate, origX, origY, flipX, flipY } = datas;
              // 旋转角计算 + transform 写入同步执行（原因同 onDrag：Moveable 同步读 DOM）
              let rotation = e.rotation;
              if (snapRotate) {
                rotation = Math.round(rotation / 15) * 15;
              }
              // Canvas Drag Optimization：用 composeComponentTransform 合并 translate + rotate + flip，
              // 替代字符串拼接/正则替换，避免 translate 部分被意外覆盖。
              target.style.transform = composeComponentTransform(
                origX,
                origY,
                rotation,
                flipX,
                flipY,
              );
              // rAF 节流仅保留 React store 更新（尺寸提示）
              gestureRafThrottlerRef.current?.schedule(() => {
                setDimension((d) => ({ ...d, rotate: Math.round(rotation), visible: true }));
              });
            }}
            onRotateEnd={(e) => {
              // 任务 13.8：手势结束必须无条件恢复交互状态机（同 onDragEnd）。
              dispatchInteraction('pointer-up');
              // L1：DOM style 已同步写入，本处理器可直接读取最终值；
              // 挂起任务仅含 store 更新，丢弃防止覆盖下方的 visible:false
              gestureRafThrottlerRef.current?.cancel();
              if (!e.isDrag) return;
              const datas = e.datas as unknown as Partial<RotateDatas>;
              const id = datas.id;
              if (!id) return;
              const comp = componentMap.get(id);
              if (!comp) return;
              const last = e.lastEvent as unknown as
                | { rotation: number; isDrag: boolean }
                | undefined;
              if (!last) return;
              const rotation = datas.snapRotate
                ? Math.round(last.rotation / 15) * 15
                : Math.round(last.rotation);
              updateComponent(id, {
                position: { ...comp.position, rotation },
              });
              setDimension((d) => ({ ...d, visible: false }));
            }}
            // --- Group target events ---
            onDragGroupStart={(e) => {
              // 任务 12.1：组拖拽由状态机仲裁，拒绝非法重入
              // 允许 marquee-selecting：框选后未释放鼠标即可拖拽（与单组件拖拽行为一致）
              if (
                interactionState !== 'idle' &&
                interactionState !== 'hovering' &&
                interactionState !== 'marquee-selecting'
              ) {
                return false;
              }
              const ids: string[] = [];
              const transforms: Array<{ rotation: number; flipX: boolean; flipY: boolean }> = [];
              for (const t of e.targets) {
                const id = getComponentIdFromTarget(t);
                if (id) {
                  const comp = componentMap.get(id);
                  if (comp?.status.locked) return false;
                  ids.push(id);
                  // Canvas Drag Optimization：记录每个组件的 rotation/flip，
                  // 组拖拽期间保持不变，用于 compose transform
                  transforms.push({
                    rotation: comp?.position.rotation ?? 0,
                    flipX: comp?.style.flipX === true,
                    flipY: comp?.style.flipY === true,
                  });
                }
              }
              const datas = e.datas as unknown as GroupDragDatas;
              datas.ids = ids;
              datas.transforms = transforms;
              datas.isAltCopy = readAltKey(e.inputEvent);
              datas.altCopyClones = [];
              // Alt+组拖拽复制（PS 风格）：立即克隆所有选中组件 DOM，
              // 拖拽过程中移动克隆体（原件不动），松手时创建真实副本。
              // cloneNode(true) 复制原 transform，拖拽中 onDragGroup 覆盖 translate 部分。
              if (datas.isAltCopy && contentRef.current) {
                for (const t of e.targets) {
                  const clone = t.cloneNode(true) as HTMLElement;
                  clone.style.position = 'absolute';
                  clone.style.pointerEvents = 'none';
                  clone.style.userSelect = 'none';
                  clone.setAttribute('data-alt-copy-clone', 'true');
                  contentRef.current.appendChild(clone);
                  datas.altCopyClones.push(clone);
                }
              }
              // 任务 3.3：镜像组拖拽开始到交互状态机
              dispatchInteraction('start-drag');
            }}
            onDragGroup={(e) => {
              const datas = e.datas as unknown as GroupDragDatas;
              // Canvas Drag Optimization：用 beforeTranslate + composeComponentTransform 替代 left/top。
              // 每个 target 保留各自的 rotation/flip，仅 translate 跟随组拖拽变化。
              if (datas.isAltCopy && datas.altCopyClones.length > 0) {
                for (let i = 0; i < e.events.length && i < datas.altCopyClones.length; i++) {
                  const ev = e.events[i];
                  const clone = datas.altCopyClones[i];
                  const t = datas.transforms[i] ?? { rotation: 0, flipX: false, flipY: false };
                  const { beforeTranslate } = ev;
                  clone.style.transform = composeComponentTransform(
                    beforeTranslate[0],
                    beforeTranslate[1],
                    t.rotation,
                    t.flipX,
                    t.flipY,
                  );
                }
              } else {
                for (let i = 0; i < e.events.length; i++) {
                  const ev = e.events[i];
                  const t = datas.transforms[i] ?? { rotation: 0, flipX: false, flipY: false };
                  const { beforeTranslate } = ev;
                  ev.target.style.transform = composeComponentTransform(
                    beforeTranslate[0],
                    beforeTranslate[1],
                    t.rotation,
                    t.flipX,
                    t.flipY,
                  );
                }
              }
            }}
            onDragGroupEnd={(e) => {
              // 任务 13.8：手势结束必须无条件恢复交互状态机（同 onDragEnd）。
              dispatchInteraction('pointer-up');
              const datas = e.datas as unknown as Partial<GroupDragDatas>;
              // Alt+组拖拽复制：零位移或异常结束时也要清理克隆体
              if (datas.isAltCopy && datas.altCopyClones && datas.altCopyClones.length > 0) {
                for (const clone of datas.altCopyClones) {
                  clone.remove();
                }
                datas.altCopyClones = [];
              }
              if (!e.isDrag) return;
              const ids = datas.ids;
              if (!ids || ids.length === 0) return;
              // Alt+组拖拽复制（PS 风格）：在克隆体最终位置创建真实副本
              if (datas.isAltCopy) {
                // 用第一个事件的 beforeTranslate 作为副本基准位置
                const firstEvent = e.events[0];
                const last = firstEvent?.lastEvent as unknown as
                  | { beforeTranslate: [number, number] }
                  | undefined;
                if (!last) return;
                duplicateSelectedToPosition(last.beforeTranslate[0], last.beforeTranslate[1]);
              } else {
                const updates = e.events
                  .map((ev) => {
                    const id = getComponentIdFromTarget(ev.target);
                    if (!id) return null;
                    const comp = componentMap.get(id);
                    if (!comp) return null;
                    const last = ev.lastEvent as unknown as
                      | { beforeTranslate: [number, number] }
                      | undefined;
                    if (!last) return null;
                    return {
                      id,
                      changes: {
                        position: {
                          ...comp.position,
                          x: last.beforeTranslate[0],
                          y: last.beforeTranslate[1],
                        },
                      },
                    };
                  })
                  .filter((u): u is NonNullable<typeof u> => u != null);
                // 防御性检查：若部分组件更新失败（如拖拽期间被删除），记录警告并仅更新有效组件
                if (updates.length !== ids.length) {
                  console.warn(
                    `[ScreenCanvas] 组拖拽结束：期望更新 ${ids.length} 个组件，实际有效 ${updates.length} 个`,
                  );
                }
                if (updates.length > 0) {
                  updateComponentsBatch(updates);
                }
              }
            }}
            onResizeGroupStart={(e) => {
              // 任务 12.1：组缩放由状态机仲裁，拒绝非法重入
              if (!SELECTO_ALLOWED_STATES.has(interactionState)) {
                return false;
              }
              for (const t of e.targets) {
                const id = getComponentIdFromTarget(t);
                if (id) {
                  const comp = componentMap.get(id);
                  if (comp?.status.locked) return false;
                }
              }
              // 任务 3.4：镜像组缩放开始到交互状态机
              dispatchInteraction('start-resize');
            }}
            onResizeGroup={(e) => {
              for (const ev of e.events) {
                const id = getComponentIdFromTarget(ev.target);
                const comp = id ? componentMap.get(id) : undefined;
                const rotation = comp?.position.rotation ?? 0;
                const flipX = comp?.style.flipX === true;
                const flipY = comp?.style.flipY === true;
                ev.target.style.width = `${ev.width}px`;
                ev.target.style.height = `${ev.height}px`;
                // Canvas Drag Optimization：用 beforeTranslate 替代 left/top
                if (ev.drag) {
                  const { beforeTranslate } = ev.drag;
                  ev.target.style.transform = composeComponentTransform(
                    beforeTranslate[0],
                    beforeTranslate[1],
                    rotation,
                    flipX,
                    flipY,
                  );
                }
              }
            }}
            onResizeGroupEnd={(e) => {
              // 任务 13.8：手势结束必须无条件恢复交互状态机（同 onDragEnd）。
              dispatchInteraction('pointer-up');
              if (!e.isDrag) return;
              const updates = e.events
                .map((ev) => {
                  const id = getComponentIdFromTarget(ev.target);
                  if (!id) return null;
                  const comp = componentMap.get(id);
                  if (!comp) return null;
                  const last = ev.lastEvent as unknown as
                    | {
                        width: number;
                        height: number;
                        drag: { beforeTranslate: [number, number] };
                      }
                    | undefined;
                  if (!last) return null;
                  return {
                    id,
                    changes: {
                      position: {
                        ...comp.position,
                        x: last.drag.beforeTranslate[0],
                        y: last.drag.beforeTranslate[1],
                        width: last.width,
                        height: last.height,
                      },
                    },
                  };
                })
                .filter((u): u is NonNullable<typeof u> => u != null);
              // 防御性检查：若部分组件更新失败（如缩放期间被删除），记录警告并仅更新有效组件
              if (updates.length !== e.events.length) {
                console.warn(
                  `[ScreenCanvas] 组缩放结束：期望更新 ${e.events.length} 个组件，实际有效 ${updates.length} 个`,
                );
              }
              if (updates.length > 0) {
                updateComponentsBatch(updates);
              }
            }}
            onChangeTargets={() => {}}
          />
        </div>

        <Selecto
          dragContainer={containerRef.current}
          selectableTargets={['[data-component-id]']}
          selectByClick={selectoSelectByClick}
          selectFromInside={false}
          hitRate={0}
          toggleContinueSelect={['ctrl']}
          // 任务 4.1：只有允许选择的工具能启动 Selecto。
          // Selecto 无 disabled prop，通过 onDragStart 中 e.stop() 阻止非选择工具启动框选。
          onDragStart={(e) => {
            // 任务 4.1：抓手/创建/缩放工具不允许启动 Selecto
            if (!capabilities.canSelect) {
              e.stop();
              return;
            }
            // 任务 12.2：框选由状态机仲裁，拒绝非法重入。
            // 仅在 idle/hovering 状态下可开始框选，避免与拖拽/缩放/旋转/平移/创建等手势重入。
            // 拒绝时调用 e.stop() 阻止 Selecto 启动拖拽，状态保持不变以便后续从合法状态继续。
            if (!SELECTO_ALLOWED_STATES.has(interactionState)) {
              e.stop();
              return;
            }
            // 任务 3.5：镜像框选开始到交互状态机（从 idle → marquee-selecting）
            dispatchInteraction('pointer-down');
            if (moveableRef.current) {
              // Selecto inputEvent 为 any，可能是 MouseEvent / TouchEvent / PointerEvent。
              // 通过 instanceof 收敛到 HTMLElement 后再使用，避免 as HTMLElement 越过类型检查
              const rawTarget = (e.inputEvent as { target?: unknown } | null)?.target;
              const target = rawTarget instanceof HTMLElement ? rawTarget : null;
              if (target && moveableRef.current.isMoveableElement(target)) {
                e.stop();
                return;
              }
              if (target) {
                const targetId = getComponentIdFromTarget(target);
                if (targetId) {
                  // 未选中组件：立即选中 + 同步启动 Moveable 拖拽，
                  // 消除等 onSelectEnd 才启动拖拽导致的抽帧/瞬移感。
                  // 已选中组件：直接阻止 Selecto，让 Moveable 接管（原有逻辑）。
                  if (!selectedComponentIds.includes(targetId)) {
                    const rawEvt: unknown = e.inputEvent;
                    const mouseEvt =
                      rawEvt instanceof MouseEvent
                        ? rawEvt
                        : new MouseEvent('mousedown', { bubbles: true });
                    const curState = interactionStateRef.current;
                    if (
                      activeToolRef.current === 'select' &&
                      (curState === 'idle' ||
                        curState === 'hovering' ||
                        curState === 'marquee-selecting')
                    ) {
                      // 点击分组内组件：未进入该分组时选中整个分组（与 handleSelectEnd
                      // 分组逻辑一致），已进入分组则选中单个子组件。顶层组件选中自身。
                      // 双击预判：若为双击的第二次点击，预期 onSelectEnd 会进入分组并选中
                      // 单个子组件，此处直接选中单个以避免"先整组再收缩到单个"的闪烁。
                      const clickedComp = componentMap.get(targetId);
                      const groupPid = clickedComp?.parentId;
                      const isPotentialDoubleClick = detectDoubleClick(lastClickRef.current, {
                        id: targetId,
                        time: Date.now(),
                        x: mouseEvt.clientX,
                        y: mouseEvt.clientY,
                      });
                      const selectionToApply =
                        groupPid != null && activeGroupId !== groupPid && !isPotentialDoubleClick
                          ? components.filter((c) => c.parentId === groupPid).map((c) => c.id)
                          : [targetId];
                      flushSync(() => {
                        selectComponents(selectionToApply);
                      });
                      moveableRef.current.dragStart(mouseEvt);
                    }
                  }
                  e.stop();
                }
              }
            }
          }}
          onSelectEnd={(e) => {
            const selected = e.selected
              .map((el) => getComponentIdFromTarget(el))
              .filter((id): id is string => id != null);

            // Selecto 的 inputEvent 可能是 MouseEvent / TouchEvent / PointerEvent。
            // handleSelectEnd 需要 MouseEvent（读 ctrlKey/metaKey/shiftKey），
            // 非 MouseEvent 时退化为无修饰键的合成事件，保证类型安全。
            const rawEvent: unknown = e.inputEvent;
            const inputEvent: MouseEvent =
              rawEvent instanceof MouseEvent
                ? rawEvent
                : new MouseEvent('mousedown', { bubbles: true });

            // 委托纯函数计算决策（归一化 spec.md 热点 5）
            const result = handleSelectEnd({
              selected,
              inputEvent,
              lastClick: lastClickRef.current,
              activeGroupId,
              components,
              isDragStart: e.isDragStart,
              clientX: inputEvent.clientX,
              clientY: inputEvent.clientY,
            });

            // 应用副作用：lastClick → activeGroupId → selection → Moveable dragStart
            lastClickRef.current = result.newLastClick;
            if (result.newActiveGroupId !== activeGroupId) {
              setActiveGroupId(result.newActiveGroupId);
            }

            // 任务 5.3：双击文本组件进入编辑，不触发分组进入
            // 仅在选择工具下生效（其他工具的创建行为由各自处理器负责）
            if (result.isDoubleClick && activeTool === 'select' && result.selection.length === 1) {
              const clickedComp = componentMap.get(result.selection[0]);
              if (clickedComp?.type === 'text') {
                // 进入文本编辑态
                const content = (clickedComp.props as { content?: unknown }).content;
                const initialContent = typeof content === 'string' ? content : DEFAULT_TEXT_CONTENT;
                beginTextEditing({
                  componentId: clickedComp.id,
                  initialContent,
                  isNewlyCreated: false,
                });
                // 派发到交互状态机：idle → text-editing
                dispatchInteraction('double-click');
                // 文本双击不进入分组，强制保持 activeGroupId 为 null
                if (activeGroupId !== null) {
                  setActiveGroupId(null);
                }
                // 任务 3.5：镜像框选结束到交互状态机
                dispatchInteraction('pointer-up');
                // 双击文本：仍需同步选中，便于退出编辑后控制框已就位
                flushSync(() => {
                  selectComponents(result.selection);
                });
                return;
              }
            }

            if (!result.isDoubleClick && e.isDragStart) {
              // Moveable dragStart 期望 MouseEvent；TouchEvent 不支持，跳过以避免运行时错误
              if (inputEvent instanceof MouseEvent) {
                // 任务 13.7：同步触发 dragStart 前用 ref 读取最新状态做 guard。
                //
                // 抖动优化：原实现用 setTimeout(dragStart, 0) 等待 React 完成
                // selectComponents 导致的重渲染，但 setTimeout 让控制框先 paint、
                // 之后才开始拖拽，造成"先选中再拖拽"的两步视觉。
                // 改用 flushSync 同步完成 selectComponents + 渲染，然后立即 dragStart，
                // 让"选中 + 开始拖拽"在同一帧完成。
                if (activeToolRef.current !== 'select') {
                  // 工具切换：仍需同步选中，但跳过 dragStart
                  flushSync(() => {
                    selectComponents(result.selection);
                  });
                  dispatchInteraction('pointer-up');
                  return;
                }
                const state = interactionStateRef.current;
                if (state !== 'idle' && state !== 'hovering' && state !== 'marquee-selecting') {
                  // 非允许状态：仅同步选中，跳过 dragStart
                  flushSync(() => {
                    selectComponents(result.selection);
                  });
                  dispatchInteraction('pointer-up');
                  return;
                }
                // flushSync 同步完成 selectComponents，Moveable target 立即更新
                flushSync(() => {
                  selectComponents(result.selection);
                });
                // 立即同步 dragStart（无需 setTimeout，Moveable target 已就绪）
                moveableRef.current?.dragStart(inputEvent);
                // 任务 3.5：镜像框选结束到交互状态机
                // dragStart 已同步触发 onDragStart（其中 dispatchInteraction('start-drag')）
                // 此处 pointer-up 在状态机内部按顺序处理：marquee-selecting → idle → dragging
                dispatchInteraction('pointer-up');
                return;
              }
            }

            // 非拖拽启动场景（如纯点击选中、框选）：异步更新即可
            selectComponents(result.selection);
            // 任务 3.5：镜像框选结束到交互状态机（marquee-selecting → idle）
            dispatchInteraction('pointer-up');
          }}
        />
      </div>
    </BlueprintPreviewProvider>
  );
}
