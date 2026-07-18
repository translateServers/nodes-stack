import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import type { ScreenComponent } from '@nebula/shared';
import { useScreenEditorStore } from '../stores/editor-store';
import { useModifierKeys } from '../hooks/use-modifier-keys';
import { resolveComponentContainerStyle } from '../registry/component-container-style';
import { ComponentRenderer } from '../registry/renderer';
import { createComponentInstance } from '../registry';
import { handleSelectEnd, type ClickRecord } from '../lib/canvas-event-router';
import { findAlignmentLines, snapPosition, type AlignmentRect } from '../lib/smart-guides';
import { DEFAULT_TEXT_CONTENT } from '../lib/text-editing-contract';
import { computeShapeCreation } from '../lib/shape-creation-geometry';
import { pickImageFile, type ImageFileResult } from '../lib/image-file-adapter';
import { zoomWithBoundary, zoomToolClick, WHEEL_ZOOM_FACTOR } from '../lib/zoom-boundary';
import {
  sampleColorFromElement,
  sampleColorFromCanvas,
  getColorApplyTarget,
  applyColorToStyle,
} from '../lib/color-sampler';
import { SmartGuidesOverlay, useAlignmentLinesStore } from './smart-guides-overlay';
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
  isAltCopy: boolean;
}

interface ResizeDatas {
  id: string;
  origW: number;
  origH: number;
  origX: number;
  origY: number;
  keepRatio: boolean;
  isAltCenter: boolean;
}

interface RotateDatas {
  id: string;
  snapRotate: boolean;
}

interface GroupDragDatas {
  ids: string[];
}

/** OnDragEnd / OnResizeEnd 中 `e.lastEvent` 的最小形状（left/top/width/height/isDrag） */
interface MoveableLastEvent {
  left: number;
  top: number;
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
 * 独立的 dimension 状态 store。
 * 将拖拽过程中的尺寸/位置提示信息从画布主组件中剥离，
 * 避免 onDrag 高频回调触发整个画布重渲染导致拖拽抖动。
 */
const useDimensionStore = create<{
  dimension: DimensionInfo;
  setDimension: (updater: (d: DimensionInfo) => DimensionInfo) => void;
}>((set) => ({
  dimension: initialDimension,
  setDimension: (updater) => set((state) => ({ dimension: updater(state.dimension) })),
}));

/** 尺寸/位置提示浮层，仅订阅 dimension store，不随画布重渲染 */
const DimensionTooltip = memo(function DimensionTooltip() {
  const dimension = useDimensionStore((s) => s.dimension);
  if (!dimension.visible) return null;
  return (
    <div
      className="pointer-events-none fixed z-[9999] rounded bg-black/80 px-2 py-1 font-mono text-xs text-white"
      style={{ left: 10, bottom: 10 }}
    >
      X:{dimension.x}px Y:{dimension.y}px
      {dimension.w > 0 && ` W:${dimension.w}px`}
      {dimension.h > 0 && ` H:${dimension.h}px`}
      {dimension.rotate !== 0 && ` R:${dimension.rotate}°`}
      {dimension.mode && ` [${dimension.mode}]`}
    </div>
  );
});

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
    | 'setActiveColor'
  >;
}) {
  const { activeTool, activeCapabilities: capabilities } = editorSession;
  const { dispatchInteraction } = editorSession;
  const { interactionState } = editorSession;
  const { beginTextEditing } = editorSession;
  // 任务 9.4：吸管工具点击采样后写入会话活动颜色
  const { setActiveColor } = editorSession;

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
  // 任务 4.5：isPanning 从交互状态机派生，避免重复平移布尔状态。
  const isPanning = interactionState === 'panning';
  const project = useScreenEditorStore((s) => s.project);
  const canvasScale = useScreenEditorStore((s) => s.canvasScale);
  const canvasOffset = useScreenEditorStore((s) => s.canvasOffset);
  const selectedComponentIds = useScreenEditorStore((s) => s.selectedComponentIds);
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
  const guides = useScreenEditorStore((s) => s.guides);
  const snapEnabled = useScreenEditorStore((s) => s.snapEnabled);
  const smartGuidesEnabled = useScreenEditorStore((s) => s.smartGuidesEnabled);
  const gridEnabled = useScreenEditorStore((s) => s.gridEnabled);
  const gridSize = useScreenEditorStore((s) => s.gridSize);

  // 从独立 store 获取 setDimension，避免拖拽高频回调触发画布重渲染
  const setDimension = useDimensionStore((s) => s.setDimension);
  // Smart Guides：从独立 store 获取 setLines / clear，避免 onDrag 高频回调触发画布重渲染
  const setAlignmentLines = useAlignmentLinesStore((s) => s.setLines);
  const clearAlignmentLines = useAlignmentLinesStore((s) => s.clear);

  const componentRefs = useRef<Map<string, HTMLElement>>(new Map());
  const moveableRef = useRef<Moveable>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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
  const { shiftRef, shiftHeld, altHeld } = useModifierKeys();

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
   * Memo 化 targets 数组。
   * 依赖包含 project?.components：新增组件并立即选中时，selectedComponentIds 可能
   * 先于 ref 注册变化，加入 components 依赖可在组件挂载后再次重算 targets。
   */
  const targets = useMemo(
    () =>
      selectedComponentIds
        .map((id) => componentRefs.current.get(id))
        .filter((el): el is HTMLElement => el != null),
    [selectedComponentIds, project?.components],
  );

  useEffect(() => {
    if (moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [selectedComponentIds, project?.components]);

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
      if (interactionState !== 'idle' && interactionState !== 'hovering') return;
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
      if (interactionState !== 'idle' && interactionState !== 'hovering') return;
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
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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
      if (interactionState !== 'idle' && interactionState !== 'hovering') return;
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
      if (interactionState !== 'idle' && interactionState !== 'hovering') return;
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

  /**
   * 任务 9.4：吸管工具点击采样颜色
   *
   * 点击流程：
   * 1. 通过 `elementsFromPoint` 找到鼠标下所有元素
   * 2. 跳过 Moveable 控件层 / Radix 浮层（与 findComponentIdAtPoint 同款跳过规则）
   * 3. 找到首个 component 元素时：从该元素采样颜色
   * 4. 未命中组件时：从画布容器采样背景色
   * 5. 采样成功：调用 setActiveColor 写入会话活动颜色
   * 6. 对当前选中的支持颜色的组件应用颜色（任务 9.3 策略），写入历史
   *
   * 与其他工具的互斥：
   * - 不派发 start-pan / start-create（与平移/创建互斥）
   * - 不启动 Selecto/Moveable（capabilities.canSelect/canDrag 为 false）
   *
   * 失败反馈：当所有可采样表面均透明时，不修改 activeColor；
   * 状态栏可在 activeTool === 'eyedropper' 时显示当前 activeColor，
   * 用户可通过对比点击前后的颜色变化感知采样失败。
   */
  const handleEyedropperClick = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const containerEl = containerRef.current;
      if (!containerEl) return;

      e.preventDefault();
      e.stopPropagation();

      // 1. 命中测试：找到鼠标下首个可采样元素
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let sampledElement: Element | null = null;
      for (const el of elements) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.closest('[data-slot="context-menu-content"]')) continue;
        if (el.closest('[data-radix-popper-content-wrapper]')) continue;
        if (el.closest('.moveable-control-box')) continue;
        sampledElement = el;
        break;
      }

      // 2. 采样：优先从组件元素采样，未命中组件时从画布容器采样
      let sampled = sampleColorFromElement(sampledElement);
      if (sampled.color === null && sampledElement !== containerEl) {
        // 元素本身无可采样颜色，尝试画布容器
        sampled = sampleColorFromCanvas(containerEl);
      }
      if (sampled.color === null) {
        // 采样失败：不修改 activeColor，由状态栏反馈
        return;
      }

      // 3. 写入会话活动颜色
      setActiveColor(sampled.color);

      // 4. 任务 9.3：对当前选中的支持颜色的组件应用颜色
      const proj = project;
      if (!proj) return;
      for (const id of selectedComponentIds) {
        const component = proj.components.find((c: ScreenComponent) => c.id === id);
        if (!component) continue;
        const target = getColorApplyTarget(component);
        if (!target) continue;
        const nextStyle = applyColorToStyle(component.style, target, sampled.color);
        updateComponent(component.id, { style: nextStyle });
      }
    },
    [project, selectedComponentIds, setActiveColor, updateComponent],
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
      // 任务 9.4：吸管工具点击采样颜色（不触发选择/拖拽/平移）
      if (activeTool === 'eyedropper' && capabilities.canSample) {
        handleEyedropperClick(e);
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
      if (interactionState !== 'idle' && interactionState !== 'hovering') return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: canvasOffset.x,
        origY: canvasOffset.y,
      };
      // 任务 3.6：镜像平移开始到交互状态机
      dispatchInteraction('start-pan');
    },
    [
      canvasOffset,
      dispatchInteraction,
      activeTool,
      interactionState,
      capabilities.canCreate,
      capabilities.canZoom,
      capabilities.canSample,
      handleCreateText,
      handleCreateShapeStart,
      handleCreateImage,
      handleZoomToolClick,
      handleEyedropperClick,
    ],
  );

  const handlePanMove = useCallback(
    (e: React.PointerEvent) => {
      // 任务 6.3/6.4：形状拖拽创建中，更新预览当前点
      if (shapeCreation) {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
        const canvasY = (e.clientY - rect.top - canvasOffset.y) / canvasScale;
        setShapeCreation((prev) =>
          prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null,
        );
        return;
      }
      if (!panState.current) return;
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      setCanvasScaleAndOffset(canvasScale, {
        x: panState.current.origX + dx,
        y: panState.current.origY + dy,
      });
    },
    [shapeCreation, canvasScale, canvasOffset, setCanvasScaleAndOffset],
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
      // 任务 3.6：镜像平移结束到交互状态机（panning → idle）
      dispatchInteraction('pointer-up');
    },
    [shapeCreation, project, addComponent, selectComponent, dispatchInteraction],
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
  }, [setCanvasScaleAndOffset, project]);

  const components = project?.components ?? [];
  const canvas = project?.canvas;

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
            ...(guides.visible ? guides.vertical.map(String) : []),
            ...(gridEnabled ? gridVerticalLines.map(String) : []),
          ]
        : [],
    [canvas, guides.visible, guides.vertical, gridEnabled, gridVerticalLines],
  );
  const horizontalGuidelines = useMemo(
    () =>
      canvas
        ? [
            '0',
            `${canvas.height}`,
            ...(guides.visible ? guides.horizontal.map(String) : []),
            ...(gridEnabled ? gridHorizontalLines.map(String) : []),
          ]
        : [],
    [canvas, guides.visible, guides.horizontal, gridEnabled, gridHorizontalLines],
  );

  /**
   * Smart Guides 参考矩形数组：所有可见且未选中的组件位置（画布坐标系）。
   * 在 onDrag 中用于 findAlignmentLines 计算，避免每次拖拽都重新 filter。
   * 排除当前选中的组件（自身不需要与自己对齐）。
   */
  const smartGuidesReferenceRects = useMemo<AlignmentRect[]>(
    () =>
      visibleComponents
        .filter((c: ScreenComponent) => !selectedIdSet.has(c.id))
        .map((c: ScreenComponent) => ({
          x: c.position.x,
          y: c.position.y,
          width: c.position.width,
          height: c.position.height,
          id: c.id,
        })),
    [visibleComponents, selectedIdSet],
  );

  /**
   * 在拖拽过程中计算并更新 Smart Guides 对齐线，并返回吸附后的坐标。
   * 仅当 smartGuidesEnabled 为 true 且有参考组件时计算。
   * 返回的 snappedLeft / snappedTop 为吸附后坐标（若无可吸附线则等于输入值）。
   */
  const updateAlignmentLines = useCallback(
    (
      movedX: number,
      movedY: number,
      movedW: number,
      movedH: number,
    ): { snappedLeft: number; snappedTop: number } => {
      if (!smartGuidesEnabled || smartGuidesReferenceRects.length === 0) {
        if (useAlignmentLinesStore.getState().lines.length > 0) {
          clearAlignmentLines();
        }
        return { snappedLeft: movedX, snappedTop: movedY };
      }
      const movedRect: AlignmentRect = {
        x: movedX,
        y: movedY,
        width: movedW,
        height: movedH,
      };
      const lines = findAlignmentLines(movedRect, smartGuidesReferenceRects);
      // 吸附：对距离 < 3px 的对齐线应用吸附
      const snapped = snapPosition(movedX, movedY, movedW, movedH, lines);
      // 更新 overlay 中显示的 movedRect 为吸附后位置，保持辅助线与实际位置同步
      const snappedRect: AlignmentRect = {
        x: snapped.left,
        y: snapped.top,
        width: movedW,
        height: movedH,
      };
      // 重新计算吸附后的对齐线（使 distance=0 的吸附线高亮显示）
      const snappedLines = findAlignmentLines(snappedRect, smartGuidesReferenceRects);
      setAlignmentLines(snappedLines, snappedRect);
      return { snappedLeft: snapped.left, snappedTop: snapped.top };
    },
    [smartGuidesEnabled, smartGuidesReferenceRects, setAlignmentLines, clearAlignmentLines],
  );

  if (!project || !canvas) return null;

  const isGroupSelect = selectedComponentIds.length > 1;

  return (
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
            backgroundImage: canvas.backgroundImage ? `url(${canvas.backgroundImage})` : undefined,
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
            />
          ))}

          {/* 活动分组包围盒：双击进入分组后高亮 */}
          <ActiveGroupOutline groupId={activeGroupId} components={visibleComponents} />

          {/* Smart Guides 智能对齐线浮层 */}
          <SmartGuidesOverlay canvasWidth={canvas.width} canvasHeight={canvas.height} />

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
          snappable={snapEnabled || gridEnabled}
          keepRatio={shiftHeld}
          throttleRotate={shiftHeld ? 15 : 0}
          hideChildMoveableDefaultLines={isGroupSelect}
          snapDirections={{
            top: true,
            bottom: true,
            left: true,
            right: true,
            center: true,
            middle: true,
          }}
          elementSnapDirections={{
            top: true,
            bottom: true,
            left: true,
            right: true,
            center: true,
            middle: true,
          }}
          verticalGuidelines={verticalGuidelines}
          horizontalGuidelines={horizontalGuidelines}
          zoom={1 / canvasScale}
          origin={false}
          renderDirections={['n', 'nw', 'ne', 's', 'se', 'sw', 'e', 'w']}
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
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            const datas = e.datas as unknown as DragDatas;
            datas.id = id;
            datas.startX = comp?.position.x ?? 0;
            datas.startY = comp?.position.y ?? 0;
            datas.origW = comp?.position.width ?? 0;
            datas.origH = comp?.position.height ?? 0;
            // Alt+拖拽复制（适配表 #12）：按下 Alt 启动拖拽时标记，
            // onDragEnd 时复制选中组件到拖拽位置，原件保持原位
            datas.isAltCopy = readAltKey(e.inputEvent);
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
            // Smart Guides：计算对齐线 + 吸附（距离 < 3px 自动吸附）
            const { snappedLeft, snappedTop } = updateAlignmentLines(
              e.left,
              e.top,
              datas.origW || 0,
              datas.origH || 0,
            );
            e.target.style.left = `${snappedLeft}px`;
            e.target.style.top = `${snappedTop}px`;
            setDimension((d) => ({
              ...d,
              x: Math.round(snappedLeft),
              y: Math.round(snappedTop),
              visible: true,
            }));
          }}
          onDragEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<DragDatas>;
            const id = datas.id;
            if (!id) return;
            const last = e.lastEvent as unknown as MoveableLastEvent | undefined;
            if (!last) return;
            // Alt+拖拽复制：拖拽结束时复制选中组件到光标位置，原件保持原位
            if (datas.isAltCopy) {
              duplicateSelectedToPosition(Math.round(last.left), Math.round(last.top));
            } else {
              const comp = components.find((c: ScreenComponent) => c.id === id);
              if (!comp) return;
              updateComponent(id, {
                position: {
                  ...comp.position,
                  x: Math.round(last.left),
                  y: Math.round(last.top),
                },
              });
            }
            setDimension((d) => ({ ...d, visible: false }));
            clearAlignmentLines();
            // 任务 3.3：镜像拖拽结束到交互状态机（恢复正常结束 → idle）
            dispatchInteraction('pointer-up');
          }}
          onResizeStart={(e) => {
            // 任务 12.1：缩放由状态机仲裁，拒绝非法重入
            if (interactionState !== 'idle' && interactionState !== 'hovering') {
              return false;
            }
            const id = getComponentIdFromTarget(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            const datas = e.datas as unknown as ResizeDatas;
            datas.id = id;
            datas.origW = comp?.position.width ?? 0;
            datas.origH = comp?.position.height ?? 0;
            datas.origX = comp?.position.x ?? 0;
            datas.origY = comp?.position.y ?? 0;
            datas.keepRatio = shiftRef.current;
            // Alt 中心变换（适配表 #11）：以组件中心为原点对称缩放，
            // 调整 left/top 抵消 width/height 变化使中心点位置不变
            datas.isAltCenter = readAltKey(e.inputEvent);
            if (datas.isAltCenter) {
              setDimension((d) => ({ ...d, mode: '中心变换' }));
            }
            // 任务 3.4：镜像缩放开始到交互状态机
            dispatchInteraction('start-resize');
          }}
          onResize={(e) => {
            const datas = e.datas as unknown as ResizeDatas;
            let w = e.width;
            let h = e.height;
            if (datas.keepRatio && datas.origW && datas.origH) {
              const ratio = datas.origW / datas.origH;
              const [dx, dy] = e.direction;
              if (dx !== 0 && dy !== 0) {
                const newH = w / ratio;
                const newW = h * ratio;
                if (Math.abs(w - datas.origW) > Math.abs(h - datas.origH)) {
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
            e.target.style.width = `${w}px`;
            e.target.style.height = `${h}px`;
            if (datas.isAltCenter) {
              // 中心变换：左上角 = 原左上 + (origSize - newSize) / 2
              const newX = datas.origX + (datas.origW - w) / 2;
              const newY = datas.origY + (datas.origH - h) / 2;
              e.target.style.left = `${newX}px`;
              e.target.style.top = `${newY}px`;
            } else if (e.drag) {
              e.target.style.left = `${e.drag.left}px`;
              e.target.style.top = `${e.drag.top}px`;
            }
            setDimension((d) => ({
              ...d,
              x: Math.round(Number.parseInt(e.target.style.left || '0')),
              y: Math.round(Number.parseInt(e.target.style.top || '0')),
              w: Math.round(w),
              h: Math.round(h),
              visible: true,
            }));
          }}
          onResizeEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<ResizeDatas>;
            const id = datas.id;
            if (!id) return;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (!comp) return;
            // lastEvent 仅用于 guard，实际值从 e.target.style 读取以避免 any 扩散
            const last = e.lastEvent as unknown as MoveableLastEvent | undefined;
            if (!last) return;
            updateComponent(id, {
              position: {
                ...comp.position,
                x: Math.round(Number.parseInt(e.target.style.left)),
                y: Math.round(Number.parseInt(e.target.style.top)),
                width: Math.round(Number.parseInt(e.target.style.width)),
                height: Math.round(Number.parseInt(e.target.style.height)),
              },
            });
            setDimension((d) => ({ ...d, visible: false, mode: undefined }));
            // 任务 3.4：镜像缩放结束到交互状态机
            dispatchInteraction('pointer-up');
          }}
          onRotateStart={(e) => {
            // 任务 12.1：旋转由状态机仲裁，拒绝非法重入
            if (interactionState !== 'idle' && interactionState !== 'hovering') {
              return false;
            }
            const id = getComponentIdFromTarget(e.target);
            if (!id) return false;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (comp?.status.locked) return false;
            const datas = e.datas as unknown as RotateDatas;
            datas.id = id;
            datas.snapRotate = shiftRef.current;
            // 任务 3.4：镜像旋转开始到交互状态机
            dispatchInteraction('start-rotate');
          }}
          onRotate={(e) => {
            const datas = e.datas as unknown as RotateDatas;
            let rotation = e.rotation;
            if (datas.snapRotate) {
              rotation = Math.round(rotation / 15) * 15;
            }
            const currentTransform = e.target.style.transform || '';
            const rotateMatch = currentTransform.match(/rotate\([^)]*\)/);
            if (rotateMatch) {
              e.target.style.transform = currentTransform.replace(
                rotateMatch[0],
                `rotate(${rotation}deg)`,
              );
            } else {
              e.target.style.transform = `${currentTransform} rotate(${rotation}deg)`.trim();
            }
            setDimension((d) => ({ ...d, rotate: Math.round(rotation), visible: true }));
          }}
          onRotateEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<RotateDatas>;
            const id = datas.id;
            if (!id) return;
            const comp = components.find((c: ScreenComponent) => c.id === id);
            if (!comp) return;
            const transform = e.target.style.transform || '';
            const match = transform.match(/rotate\(([^)]+)deg\)/);
            const rotation = match ? Number.parseFloat(match[1]) : 0;
            updateComponent(id, {
              position: { ...comp.position, rotation: Math.round(rotation) },
            });
            setDimension((d) => ({ ...d, visible: false }));
            // 任务 3.4：镜像旋转结束到交互状态机
            dispatchInteraction('pointer-up');
          }}
          // --- Group target events ---
          onDragGroupStart={(e) => {
            // 任务 12.1：组拖拽由状态机仲裁，拒绝非法重入
            if (
              interactionState !== 'idle' &&
              interactionState !== 'hovering' &&
              interactionState !== 'marquee-selecting'
            ) {
              return false;
            }
            const ids: string[] = [];
            for (const t of e.targets) {
              const id = getComponentIdFromTarget(t);
              if (id) {
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (comp?.status.locked) return false;
                ids.push(id);
              }
            }
            const datas = e.datas as unknown as GroupDragDatas;
            datas.ids = ids;
            // 任务 3.3：镜像组拖拽开始到交互状态机
            dispatchInteraction('start-drag');
          }}
          onDragGroup={(e) => {
            for (const ev of e.events) {
              ev.target.style.left = `${ev.left}px`;
              ev.target.style.top = `${ev.top}px`;
            }
          }}
          onDragGroupEnd={(e) => {
            if (!e.isDrag) return;
            const datas = e.datas as unknown as Partial<GroupDragDatas>;
            const ids = datas.ids;
            if (!ids) return;
            const updates = e.events
              .map((ev) => {
                const id = getComponentIdFromTarget(ev.target);
                if (!id) return null;
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (!comp) return null;
                return {
                  id,
                  changes: {
                    position: {
                      ...comp.position,
                      x: Math.round(Number.parseInt(ev.target.style.left)),
                      y: Math.round(Number.parseInt(ev.target.style.top)),
                    },
                  },
                };
              })
              .filter((u): u is NonNullable<typeof u> => u != null);
            updateComponentsBatch(updates);
            // 任务 3.3：镜像组拖拽结束到交互状态机
            dispatchInteraction('pointer-up');
          }}
          onResizeGroupStart={(e) => {
            // 任务 12.1：组缩放由状态机仲裁，拒绝非法重入
            if (interactionState !== 'idle' && interactionState !== 'hovering') {
              return false;
            }
            for (const t of e.targets) {
              const id = getComponentIdFromTarget(t);
              if (id) {
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (comp?.status.locked) return false;
              }
            }
            // 任务 3.4：镜像组缩放开始到交互状态机
            dispatchInteraction('start-resize');
          }}
          onResizeGroup={(e) => {
            for (const ev of e.events) {
              ev.target.style.width = `${ev.width}px`;
              ev.target.style.height = `${ev.height}px`;
              if (ev.drag) {
                ev.target.style.left = `${ev.drag.left}px`;
                ev.target.style.top = `${ev.drag.top}px`;
              }
            }
          }}
          onResizeGroupEnd={(e) => {
            if (!e.isDrag) return;
            const updates = e.events
              .map((ev) => {
                const id = getComponentIdFromTarget(ev.target);
                if (!id) return null;
                const comp = components.find((c: ScreenComponent) => c.id === id);
                if (!comp) return null;
                return {
                  id,
                  changes: {
                    position: {
                      ...comp.position,
                      x: Math.round(Number.parseInt(ev.target.style.left)),
                      y: Math.round(Number.parseInt(ev.target.style.top)),
                      width: Math.round(Number.parseInt(ev.target.style.width)),
                      height: Math.round(Number.parseInt(ev.target.style.height)),
                    },
                  },
                };
              })
              .filter((u): u is NonNullable<typeof u> => u != null);
            updateComponentsBatch(updates);
            // 任务 3.4：镜像组缩放结束到交互状态机
            dispatchInteraction('pointer-up');
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
          // 任务 4.1：抓手/创建/缩放/吸管工具不允许启动 Selecto
          if (!capabilities.canSelect) {
            e.stop();
            return;
          }
          // 任务 12.2：框选由状态机仲裁，拒绝非法重入。
          // 仅在 idle/hovering 状态下可开始框选，避免与拖拽/缩放/旋转/平移/创建等手势重入。
          // 拒绝时调用 e.stop() 阻止 Selecto 启动拖拽，状态保持不变以便后续从合法状态继续。
          if (interactionState !== 'idle' && interactionState !== 'hovering') {
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
            }
            if (target) {
              const targetId = getComponentIdFromTarget(target);
              if (targetId && selectedComponentIds.includes(targetId)) {
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
          });

          // 应用副作用：lastClick → activeGroupId → selection → Moveable dragStart
          lastClickRef.current = result.newLastClick;
          if (result.newActiveGroupId !== activeGroupId) {
            setActiveGroupId(result.newActiveGroupId);
          }
          selectComponents(result.selection);

          // 任务 5.3：双击文本组件进入编辑，不触发分组进入
          // 仅在选择工具下生效（其他工具的创建行为由各自处理器负责）
          if (result.isDoubleClick && activeTool === 'select' && result.selection.length === 1) {
            const clickedComp = components.find(
              (c: ScreenComponent) => c.id === result.selection[0],
            );
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
              return;
            }
          }

          if (!result.isDoubleClick && e.isDragStart) {
            // Moveable dragStart 期望 MouseEvent；TouchEvent 不支持，跳过以避免运行时错误
            if (inputEvent instanceof MouseEvent) {
              setTimeout(() => {
                // 任务 13.7：异步触发 dragStart 前用 ref 读取最新状态做 guard。
                //
                // onSelectEnd 在 pointerup 时派发 pointer-up（→ idle）后立即调度此
                // setTimeout。若用户在 setTimeout 触发前切换工具或进入其他交互态：
                // - activeTool !== 'select'：Moveable draggable prop 已为 false，
                //   外部调用 dragStart 会让 Moveable 内部进入异常 dragging 态，
                //   后续 onDragEnd 永不触发，选择工具能力永久失效
                // - interactionState 非 idle/hovering/marquee-selecting：与 onDragStart
                //   仲裁条件不一致，调用会绕过状态机触发非法转换
                // 两种情况下都应放弃 dragStart，由用户下次点击重新触发。
                if (activeToolRef.current !== 'select') return;
                const state = interactionStateRef.current;
                if (state !== 'idle' && state !== 'hovering' && state !== 'marquee-selecting') {
                  return;
                }
                moveableRef.current?.dragStart(inputEvent);
              }, 0);
            }
          }
          // 任务 3.5：镜像框选结束到交互状态机（marquee-selecting → idle）
          dispatchInteraction('pointer-up');
        }}
      />

      <DimensionTooltip />
    </div>
  );
}
