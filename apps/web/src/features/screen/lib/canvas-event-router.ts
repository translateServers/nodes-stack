/**
 * 画布事件路由层（Canvas Event Routing Layer）
 *
 * 职责：基于 DOM 捕获/冒泡阶段与命中区域（hit-region）的优先级仲裁，
 * 决定事件是交给画布、组件、Moveable 控件层、上下文菜单还是浮层。
 *
 * 对应 spec.md 的"事件路由层"层，归一化 canvas-context-menu.tsx
 * 中散落的事件命中逻辑（modal={false} 补丁、双击判定、wheel 缩放、
 * Selecto onSelectEnd 副作用、flushSync 双 rAF 重新派发右键等）。
 *
 * @see {@link ../../../../../../../../.trae/specs/research-interaction-architecture/spec.md}
 */

/**
 * 上下文菜单浮层 pointer-events 契约。
 *
 * 归一化 spec.md 热点 1：
 * 1. 画布右键菜单浮层（Radix ContextMenu Content）**禁止**设置
 *    `body { pointer-events: none }`，否则画布元素会继承 none 导致
 *    Moveable 无法接收 pointerdown，用户右键菜单后无法直接拖拽组件。
 * 2. 通过在 `<ContextMenu modal={false}>` 关闭 modal 来禁用 Radix 的
 *    `disableOutsidePointerEvents`（同时取消 trapFocus/scrollLock/aria-hide），
 *    保留 DismissableLayer 的外部点击关闭与 Esc 关闭能力。
 * 3. `redistributeContextMenu` 在重派发事件前调用 `restorePointerEvents`
 *    清除 body/html/#root 的内联 pointer-events，作为兜底防止
 *    Radix 在某些过渡态短暂设置 pointer-events 阻塞 Moveable。
 *
 * 该常量仅为文档化目的（无运行时副作用），便于在代码搜索时快速
 * 定位"为什么 modal={false}"与"为什么需要 restorePointerEvents"。
 */
export const CONTEXT_MENU_POINTER_EVENTS_CONTRACT = `
画布右键菜单浮层 hit-region 不设置 body pointer-events: none
- 实现：<ContextMenu modal={false}>
- 兜底：restorePointerEvents 在 redistributeContextMenu 前调用
- 影响：Moveable 可在菜单打开期间接收 pointerdown，支持拖拽
` as const;

/**
 * 命中区域种类。
 *
 * 用于事件路由层在 `elementsFromPoint` 遍历中决定跳过哪些元素，
 * 以及上下文菜单根据命中种类切换 mode（component / canvas）。
 */
export type HitRegionKind =
  /** 命中数据组件（带 data-component-id） */
  | 'component'
  /** 命中画布空白处 */
  | 'canvas'
  /** 命中 Moveable 控件层（应跳过） */
  | 'moveable-control'
  /** 命中 Radix Popper 浮层容器（应跳过） */
  | 'radix-popper'
  /** 命中上下文菜单内容（应跳过） */
  | 'context-menu-content';

/**
 * 命中区域描述。
 *
 * 由 `findHitRegion` 返回，描述鼠标坐标命中的区域种类与（如适用）
 * 关联的组件 ID。
 */
export interface HitRegion {
  /** 命中区域种类 */
  readonly kind: HitRegionKind;
  /** 当 kind === 'component' 时为组件 ID；否则为 null */
  readonly componentId: string | null;
  /** 命中的原始 DOM 元素（用于调试或后续派发事件） */
  readonly element: HTMLElement | null;
}

/**
 * 从 DOM 元素向上查找 `data-component-id`。
 *
 * 遇到 Moveable 控件层（`.moveable-control-box`）时立即终止并返回 null，
 * 因为控件层不属于任何组件，向上查找会越过画布边界。
 *
 * @param el - 起始 DOM 元素（通常是事件 target）
 * @returns 命中的组件 ID；若未命中或遇到 Moveable 控件层则返回 null
 */
export function getComponentIdFromElement(el: HTMLElement | null): string | null {
  let current: HTMLElement | null = el;
  while (current) {
    if (current.classList?.contains('moveable-control-box')) break;
    const id = current.getAttribute('data-component-id');
    if (id) return id;
    current = current.parentElement;
  }
  return null;
}

/**
 * 基于坐标做 hit-test 查找组件 ID。
 *
 * Moveable 会在选中组件上方渲染控制边框（`.moveable-area` /
 * `.moveable-control` / `.moveable-line` 等）覆盖在组件上方拦截事件，
 * 导致 `event.target` 不是组件本身。因此需要 `elementsFromPoint`
 * 遍历鼠标下所有元素，按命中区域优先级跳过 Moveable 控件层与
 * Radix 浮层，找到真正的 `data-component-id`。
 *
 * 跳过规则：
 * 1. `[data-slot="context-menu-content"]` — 上下文菜单内容
 * 2. `[data-radix-popper-content-wrapper]` — Radix Popper 浮层容器
 * 3. `.moveable-control-box` — Moveable 控件层
 *
 * @param clientX - 鼠标 client 坐标 X
 * @param clientY - 鼠标 client 坐标 Y
 * @returns 命中的组件 ID；若鼠标下方仅有画布空白则返回 null
 */
export function findComponentIdAtPoint(clientX: number, clientY: number): string | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest('[data-slot="context-menu-content"]')) continue;
    if (el.closest('[data-radix-popper-content-wrapper]')) continue;
    if (el.closest('.moveable-control-box')) continue;
    const id = getComponentIdFromElement(el);
    if (id) return id;
  }
  return null;
}

/**
 * 恢复 `body` / `html` / `#root` 的 `pointer-events` 内联样式。
 *
 * 当 Radix ContextMenu 以 `modal={true}` 打开时会设置这些元素为 `none`，
 * 导致 Moveable 无法接收 pointerdown。调用本函数可清除这些内联样式，
 * 让画布元素重新可交互。
 *
 * 即使 `modal={false}`，Radix 在某些过渡态仍可能短暂设置 `pointer-events`，
 * 因此在重新派发右键事件前始终调用以兜底。
 */
function restorePointerEvents(): void {
  document.body.style.pointerEvents = '';
  document.documentElement.style.pointerEvents = '';
  const root = document.getElementById('root');
  if (root) root.style.pointerEvents = '';
}

/**
 * 在指定坐标处重新派发右键事件序列。
 *
 * 用于"菜单已打开时再次右键"场景：先关闭旧菜单并递增 `menuKey` 强制重建，
 * 等待双 rAF 确保 DOM 清理后，在原坐标重新派发完整事件序列
 * （pointerdown → mousedown → pointerup → mouseup → contextmenu），
 * 让 Radix 认为这是一次全新的右键，从而锚定到新坐标。
 *
 * 事件序列中：
 * - `pointerdown` / `pointerup` 使用 `buttons: 2` / `buttons: 0`（右键按下/松开）
 * - `mousedown` / `mouseup` 使用 `button: 2` / `buttons: 2` → `buttons: 0`
 * - `contextmenu` 使用 `button: 2` / `buttons: 0`
 *
 * @param x - 目标 client 坐标 X
 * @param y - 目标 client 坐标 Y
 */
export function redistributeContextMenu(x: number, y: number): void {
  restorePointerEvents();

  // 与 findComponentIdAtPoint 同款跳过规则，找到真实派发目标元素
  const elements = document.elementsFromPoint(x, y);
  let target: Element | null = null;
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest('[data-slot="context-menu-content"]')) continue;
    if (el.closest('[data-radix-popper-content-wrapper]')) continue;
    if (el.closest('.moveable-control-box')) continue;
    target = el;
    break;
  }
  if (!target) target = document.body;

  const common = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    view: window,
    button: 2,
    pointerId: 1,
    isPrimary: true,
    pointerType: 'mouse' as const,
  };

  target.dispatchEvent(new PointerEvent('pointerdown', { ...common, buttons: 2 }));
  target.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window,
      button: 2,
      buttons: 2,
    }),
  );
  target.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 }));
  target.dispatchEvent(
    new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window,
      button: 2,
      buttons: 0,
    }),
  );
  target.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window,
      button: 2,
      buttons: 0,
    }),
  );
}

/**
 * `attachContextMenuRedistributor` 的回调集合。
 *
 * 通过回调而非直接传 state，避免本模块依赖具体 React 实现，
 * 让调用方自行决定如何读取 `openRef` 与触发重渲染。
 */
export interface ContextMenuRedistributorCallbacks {
  /** 返回当前菜单是否处于打开状态（含退出动画期间的过渡态） */
  readonly isOpen: () => boolean;
  /** 关闭菜单（设置 open=false） */
  readonly onClose: () => void;
  /** 递增 menuKey 强制 ContextMenu 重建（清空 DOM 状态） */
  readonly onMenuKeyBump: () => void;
  /** 在重派发完成后若菜单仍未打开，则重新打开（恢复 open=true） */
  readonly onReopenIfClosed: () => void;
}

/**
 * 注册"菜单已打开时再次右键"的重派发逻辑。
 *
 * 修复 Radix ContextMenu 的已知问题：
 * 1. 快速右键时 `pointerdown`→`contextmenu` 间隔约 30ms，
 *    Radix Presence 因退出动画（duration-100）保持旧 Content 在 DOM 中未卸载。
 * 2. DismissableLayer 在 `pointerdown` 捕获阶段触发异步关闭，与 Radix Trigger
 *    的 `contextmenu` 处理产生竞态——新 `contextmenu` 到达时 `open` 状态尚未完成切换，
 *    Radix 认为菜单仍处于 `open=true` 状态，跳过锚点坐标更新，直接复用旧位置。
 *
 * 处理策略：
 * - `pointerdown` capture：仅视觉隐藏旧菜单，不阻止事件传播，
 *   让 DismissableLayer 自然接收 `pointerdown` 触发异步关闭。
 * - `contextmenu` capture：拦截事件，同步关闭菜单并递增 key 强制重建，
 *   等待双 rAF 确保 DOM 清理后重派完整事件序列。
 *
 * @param callbacks - 回调集合
 * @returns cleanup 函数（移除事件监听）
 */
export function attachContextMenuRedistributor(
  callbacks: ContextMenuRedistributorCallbacks,
): () => void {
  /** 防止重派发的事件再次触发本处理逻辑（无限循环） */
  let isRedistributing = false;

  /** 视觉隐藏已存在的菜单 Content（避免重派发期间闪烁） */
  const hideExistingContent = (): void => {
    const existingContent = document.querySelector('[data-slot="context-menu-content"]');
    if (existingContent instanceof HTMLElement) {
      existingContent.style.setProperty('animation', 'none', 'important');
      existingContent.style.setProperty('transition', 'none', 'important');
      existingContent.style.setProperty('opacity', '0', 'important');
      existingContent.style.pointerEvents = 'none';
    }
  };

  const handlePointerDownCapture = (e: PointerEvent): void => {
    if (e.button !== 2) return;
    if (!callbacks.isOpen() || isRedistributing) return;
    hideExistingContent();
  };

  const handleContextMenuCapture = (e: MouseEvent): void => {
    if (e.button !== 2) return;
    if (isRedistributing) return;
    if (!callbacks.isOpen()) return;

    e.stopImmediatePropagation();
    e.preventDefault();

    const x = e.clientX;
    const y = e.clientY;

    callbacks.onClose();
    callbacks.onMenuKeyBump();

    isRedistributing = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        redistributeContextMenu(x, y);

        // 使用 requestIdleCallback 替代 setTimeout，减少主线程阻塞；
        // 兜底 100ms 超时确保在极端繁忙场景下仍能复位
        const resetRedistributing = (): void => {
          isRedistributing = false;
          if (!callbacks.isOpen()) {
            callbacks.onReopenIfClosed();
          }
        };
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(resetRedistributing, { timeout: 100 });
        } else {
          setTimeout(resetRedistributing, 50);
        }
      });
    });
  };

  document.addEventListener('contextmenu', handleContextMenuCapture, true);
  document.addEventListener('pointerdown', handlePointerDownCapture, true);

  return () => {
    document.removeEventListener('contextmenu', handleContextMenuCapture, true);
    document.removeEventListener('pointerdown', handlePointerDownCapture, true);
  };
}

// ============================================================================
// 双击判定（detectDoubleClick）— 归一化 spec.md 热点 2
// ============================================================================

/**
 * 双击判定的负载：上一次（或当前）点击的组件 ID、时间戳与屏幕坐标。
 */
export interface ClickRecord {
  /** 命中组件 ID */
  readonly id: string;
  /** 点击时间戳（通常是 Date.now()） */
  readonly time: number;
  /** 点击的屏幕 X 坐标 */
  readonly x?: number;
  /** 点击的屏幕 Y 坐标 */
  readonly y?: number;
}

/**
 * 判定两次点击是否构成双击（同一组件 + 时间间隔 < 阈值 + 位置偏移 < 阈值）。
 *
 * 归一化场景（spec.md 热点 2）：
 * 原本 `screen-canvas.tsx` 在 `onSelectEnd` 中内联实现双击判定，
 * 因 react-selecto 的 click 事件 `preventDefault()` 阻断原生 dblclick，
 * 必须手动基于 timestamp 实现。该逻辑被多处需要复用（图层面板双击重命名等），
 * 抽取为纯函数便于单元测试。
 *
 * 位置偏移阈值：防止用户在 400ms 内点击同一组件的不同位置被误判为双击。
 * 若未传入坐标（向后兼容），则仅按时间阈值判定。
 *
 * @param prev - 上一次点击记录（null 表示无历史）
 * @param current - 当前点击记录
 * @param thresholdMs - 双击时间阈值，默认 400ms
 * @param positionThresholdPx - 双击位置偏移阈值，默认 5px
 * @returns true 表示构成双击
 */
export function detectDoubleClick(
  prev: ClickRecord | null,
  current: ClickRecord,
  thresholdMs = 400,
  positionThresholdPx = 5,
): boolean {
  if (prev === null) return false;
  if (prev.id !== current.id) return false;
  if (current.time - prev.time < 0) return false;
  if (current.time - prev.time > thresholdMs) return false;

  // 若两次点击均携带坐标，校验位置偏移
  if (
    typeof prev.x === 'number' &&
    typeof prev.y === 'number' &&
    typeof current.x === 'number' &&
    typeof current.y === 'number'
  ) {
    const dx = Math.abs(current.x - prev.x);
    const dy = Math.abs(current.y - prev.y);
    if (dx > positionThresholdPx || dy > positionThresholdPx) return false;
  }

  return true;
}

// ============================================================================
// 缩放数学（zoomAtPoint）— 归一化 spec.md 热点 3
// ============================================================================

/**
 * 缩放计算参数。
 */
export interface ZoomAtPointParams {
  /** 当前缩放比例 */
  readonly currentScale: number;
  /** 当前画布偏移（屏幕坐标 → 画布坐标的平移量） */
  readonly currentOffset: { readonly x: number; readonly y: number };
  /** 光标在屏幕坐标系下的 x 坐标 */
  readonly cursorX: number;
  /** 光标在屏幕坐标系下的 y 坐标 */
  readonly cursorY: number;
  /**
   * 缩放因子：
   * - > 1：放大（如 wheel deltaY < 0 时 factor = 1.1）
   * - < 1：缩小（如 wheel deltaY > 0 时 factor = 1/1.1）
   * - = 1：无变化
   */
  readonly factor: number;
}

/**
 * 缩放计算结果：新的缩放比例与画布偏移。
 */
export interface ZoomAtPointResult {
  readonly scale: number;
  readonly offset: { readonly x: number; readonly y: number };
}

/**
 * 以光标为锚点计算缩放后的 scale 与 offset。
 *
 * 归一化场景（spec.md 热点 3）：
 * 原本 `screen-canvas.tsx` 的 wheel handler 内联实现缩放数学，逻辑与
 * Z 工具点击放大、`Ctrl+=`/`Ctrl+-` 快捷键的缩放数学重复 3 次。
 * 抽取为纯函数便于复用与单元测试。
 *
 * 数学原理：
 * 假设画布坐标系原点为 (0, 0)，屏幕坐标 = 画布坐标 * scale + offset。
 * 缩放前后应保持"光标点对应的画布坐标不变"：
 *   (cursor - offset_old) / scale_old = (cursor - offset_new) / scale_new
 * 推导得：
 *   offset_new = cursor - (cursor - offset_old) * (scale_new / scale_old)
 *
 * @param params - 缩放参数
 * @returns 缩放后的 scale 与 offset
 */
export function zoomAtPoint(params: ZoomAtPointParams): ZoomAtPointResult {
  const { currentScale, currentOffset, cursorX, cursorY, factor } = params;
  const newScale = currentScale * factor;
  if (newScale <= 0) return { scale: currentScale, offset: currentOffset };
  const scaleRatio = newScale / currentScale;
  const offsetX = cursorX - (cursorX - currentOffset.x) * scaleRatio;
  const offsetY = cursorY - (cursorY - currentOffset.y) * scaleRatio;
  return { scale: newScale, offset: { x: offsetX, y: offsetY } };
}

// ============================================================================
// 选择结束处理（handleSelectEnd）— 归一化 spec.md 热点 5
// ============================================================================

/**
 * Selecto onSelectEnd 事件所需的最小 ScreenComponent 形状。
 *
 * 仅需要 id 与 parentId 即可完成判定，避免对完整 ScreenComponent
 * 类型的耦合（便于测试构造 mock 数据）。
 *
 * 注：parentId 类型与 @nebula/shared 的 ScreenComponent.parentId 对齐
 * （`z.string().nullable().optional()` → optional `string | null`）。
 */
export interface SelectableComponent {
  readonly id: string;
  readonly parentId?: string | null;
}

/**
 * handleSelectEnd 的输入参数。
 */
export interface HandleSelectEndParams {
  /** Selecto 返回的已选中元素对应的组件 ID 列表 */
  readonly selected: readonly string[];
  /** Selecto 的原始 inputEvent（用于判断修饰键） */
  readonly inputEvent: MouseEvent;
  /** 上一次点击的记录（来自 lastClickRef） */
  readonly lastClick: ClickRecord | null;
  /** 当前活动分组 ID（来自 editor-store） */
  readonly activeGroupId: string | null;
  /** 画布的全部组件（用于查找 parentId 等） */
  readonly components: readonly SelectableComponent[];
  /** 是否为 Selecto 的 isDragStart（点击而非框选结束） */
  readonly isDragStart: boolean;
  /** 当前时间戳（默认 Date.now()，便于测试注入） */
  readonly currentTime?: number;
  /** 点击的屏幕 X 坐标（用于双击位置偏移判定） */
  readonly clientX?: number;
  /** 点击的屏幕 Y 坐标（用于双击位置偏移判定） */
  readonly clientY?: number;
}

/**
 * handleSelectEnd 的返回结果。
 *
 * 调用方根据返回值应用副作用：
 * 1. 将 `newLastClick` 赋值给 `lastClickRef.current`
 * 2. 调用 `setActiveGroupId(newActiveGroupId)`（即使值未变也调用，Zustand 自动去重）
 * 3. 调用 `selectComponents(selection)`
 * 4. 若 `!isDoubleClick && isDragStart`，触发 `moveableRef.current?.dragStart(inputEvent)`
 */
export interface HandleSelectEndResult {
  /** 最终要应用的选中组件 ID 列表 */
  readonly selection: string[];
  /** 新的活动分组 ID */
  readonly newActiveGroupId: string | null;
  /** 更新后的 lastClick 记录（赋值给 lastClickRef.current） */
  readonly newLastClick: ClickRecord | null;
  /** 本次是否为双击 */
  readonly isDoubleClick: boolean;
}

/**
 * 处理 Selecto onSelectEnd 事件的纯函数（归一化 spec.md 热点 5）。
 *
 * 行为：
 * 1. **修饰键多选 / 框选**：清空 lastClick，selection 即为 selected，保持 activeGroupId
 * 2. **双击检测**（同一组件 + 间隔 < 400ms）：
 *    - 命中分组内组件：进入该分组（activeGroupId = parentId，selection = [clickedId]）
 *    - 命中顶层组件：退出任何分组（activeGroupId = null，selection = [clickedId]）
 * 3. **单击分组中的组件**：
 *    - 已在该分组：仅选中此组件
 *    - 不在该分组：选中整个分组并退出旧分组
 * 4. **单击顶层组件 + 已进入某分组**：退出分组（activeGroupId = null）
 *
 * 不应用任何副作用，仅返回决策结果。调用方负责：
 * - 赋值 lastClickRef.current
 * - 调用 setActiveGroupId / selectComponents
 * - 触发 Moveable dragStart
 */
export function handleSelectEnd(params: HandleSelectEndParams): HandleSelectEndResult {
  const {
    selected,
    inputEvent,
    lastClick,
    activeGroupId,
    components,
    isDragStart,
    currentTime = Date.now(),
    clientX,
    clientY,
  } = params;

  const hasModifier = inputEvent.ctrlKey || inputEvent.metaKey || inputEvent.shiftKey;
  const isSingleClick = isDragStart && !hasModifier && selected.length === 1;

  // 默认：保持原状态，selection 即为 selected
  let selection = [...selected];
  let newActiveGroupId = activeGroupId;
  let newLastClick: ClickRecord | null = lastClick;
  let isDoubleClick = false;

  if (!isSingleClick) {
    // 框选 / Ctrl 多选：清空双击判定状态
    newLastClick = null;
    return { selection, newActiveGroupId, newLastClick, isDoubleClick };
  }

  // 单击场景：检测双击
  const clickedId = selected[0];
  const current: ClickRecord = {
    id: clickedId,
    time: currentTime,
    ...(typeof clientX === 'number' ? { x: clientX } : {}),
    ...(typeof clientY === 'number' ? { y: clientY } : {}),
  };
  newLastClick = current;

  if (detectDoubleClick(lastClick, current)) {
    // 双击：清空记录避免连续触发
    newLastClick = null;
    isDoubleClick = true;
    const clickedComp = components.find((c) => c.id === clickedId);
    if (clickedComp?.parentId) {
      // 进入分组
      newActiveGroupId = clickedComp.parentId;
    } else {
      // 顶层组件双击：退出任何分组
      newActiveGroupId = null;
    }
    selection = [clickedId];
    return { selection, newActiveGroupId, newLastClick, isDoubleClick };
  }

  // 单击（非双击）：处理分组逻辑
  const clickedComp = components.find((c) => c.id === clickedId);
  if (clickedComp?.parentId) {
    // 组件属于某分组
    if (activeGroupId === clickedComp.parentId) {
      // 已进入该分组 → 仅选中此组件
      selection = [clickedComp.id];
    } else {
      // 未进入或进入了别的分组 → 选中整个分组并退出旧分组
      selection = components.filter((c) => c.parentId === clickedComp.parentId).map((c) => c.id);
      newActiveGroupId = null;
    }
  } else if (activeGroupId !== null) {
    // 单击顶层组件：退出当前活动分组
    newActiveGroupId = null;
  }

  return { selection, newActiveGroupId, newLastClick, isDoubleClick };
}
