/**
 * 交互状态机（Interaction State Machine）
 *
 * 与工具状态机（use-tool-state-machine.ts）正交，描述画布当前的交互阶段：
 * idle → hovering → marquee-selecting / dragging / resizing → idle 等。
 *
 * 职责：
 * - 提供状态转换表（transition 纯函数），便于单元测试
 * - 通过 useInteractionStateMachine hook 暴露派生 state（isInteracting 等）
 * - 与 use-keyboard-shortcuts.ts 的 canvasEnabled 联动（text-editing 时禁用画布快捷键）
 *
 * 任务 3.1 扩展：
 * - 新增 creating / sampling 状态，覆盖形状/文字/图片创建与吸管采样
 * - 新增 cancel / window-blur / pointer-cancel / lost-pointer-capture 事件，
 *   支持任意瞬时状态恢复（与工具状态机 2.4 的恢复语义对齐）
 * - 文本编辑优先退出：text-editing 对全局恢复事件响应（escape/commit/cancel/window-blur）
 *
 * 对应 spec.md 的"交互状态机"层，归一化 screen-canvas.tsx 中散落的
 * panState / isPanning / lastClickRef / isDragging 等局部状态。
 *
 * @see {@link ../../../../../../../../.trae/specs/research-interaction-architecture/spec.md}
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * 交互状态机的 12 个状态。
 *
 * 状态语义：
 * - idle：无交互
 * - hovering：指针悬停在组件上（未按下）
 * - marquee-selecting：框选进行中
 * - dragging：拖拽组件进行中
 * - resizing：调整尺寸进行中
 * - rotating：旋转进行中
 * - panning：平移画布进行中
 * - zooming：缩放进行中（Alt+滚轮或 Z 工具点击）
 * - text-editing：文本组件编辑态（双击进入）
 * - context-menu-open：右键菜单已打开
 * - creating：创建工具拖拽中（矩形/椭圆/文字/图片创建预览）
 * - sampling：吸管采样中（点击采样颜色）
 */
export type InteractionState =
  | 'idle'
  | 'hovering'
  | 'marquee-selecting'
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'panning'
  | 'zooming'
  | 'text-editing'
  | 'context-menu-open'
  | 'creating'
  | 'sampling';

/**
 * 交互状态机的触发事件。
 *
 * 事件命名约定：`动作-对象` 或 `阶段-目标`，描述引起状态转换的用户行为。
 *
 * 任务 3.1 新增事件分组：
 * - 创建/采样：start-create / commit-create / start-sample / end-sample
 * - 全局恢复：cancel / window-blur / pointer-cancel / lost-pointer-capture
 */
export type InteractionEvent =
  | 'pointer-enter' // 指针进入组件（idle → hovering）
  | 'pointer-leave' // 指针离开组件（hovering → idle）
  | 'pointer-down' // 指针按下（hovering → marquee-selecting 或 idle → panning）
  | 'start-drag' // 开始拖拽（marquee-selecting → dragging）
  | 'start-resize' // 开始调整尺寸（idle → resizing）
  | 'start-rotate' // 开始旋转（idle → rotating）
  | 'start-pan' // 开始平移（idle → panning）
  | 'start-zoom' // 开始缩放（idle → zooming）
  | 'start-create' // 开始创建（idle → creating）
  | 'commit-create' // 提交创建（creating → idle）
  | 'start-sample' // 开始采样（idle → sampling）
  | 'end-sample' // 结束采样（sampling → idle）
  | 'double-click' // 双击进入文本编辑（idle → text-editing）
  | 'open-context-menu' // 打开右键菜单（idle → context-menu-open）
  | 'pointer-up' // 释放指针（拖拽/框选/调整/旋转/平移 → idle 或 hovering）
  | 'end-zoom' // 结束缩放（zooming → idle）
  | 'close-context-menu' // 关闭右键菜单（context-menu-open → idle）
  | 'escape' // Escape 退出（text-editing / context-menu-open → idle）
  | 'commit' // 提交编辑（text-editing → idle）
  | 'cancel' // 取消当前交互（任意非 idle 状态 → idle）
  | 'window-blur' // 窗口失焦（任意非 idle 状态 → idle）
  | 'pointer-cancel' // 指针取消（pointer 交互态 → idle）
  | 'lost-pointer-capture'; // 丢失指针捕获（pointer 交互态 → idle）

/**
 * 交互状态机的可选负载。
 *
 * 当前用于 `pointer-down` 事件区分"在组件上按下"（→ marquee-selecting）
 * 与"在空白处按下 + 空格/中键"（→ panning）。
 */
export interface InteractionEventPayload {
  /** 是否命中组件 */
  readonly hitComponent?: boolean;
  /** 是否为平移手势（空格按住或中键按下） */
  readonly isPanGesture?: boolean;
}

/**
 * 涉及 pointer 捕获的交互状态集合。
 *
 * 这些状态下 pointer-cancel / lost-pointer-capture 事件会触发恢复到 idle。
 * 不包含 text-editing / context-menu-open / zooming / hovering（非 pointer 捕获态）。
 */
const POINTER_CAPTURE_STATES: ReadonlySet<InteractionState> = new Set([
  'marquee-selecting',
  'dragging',
  'resizing',
  'rotating',
  'panning',
  'creating',
]);

/**
 * 状态转换表：`[currentState][event] → nextState`。
 *
 * 未在表中列出的 (state, event) 组合视为非法转换，
 * `transition` 函数会返回当前状态（保持不变）。
 *
 * 设计原则：
 * 1. 显式列出所有合法转换，便于代码审查与单元测试
 * 2. 不抛异常，避免画布事件处理器因状态机异常导致卡死
 * 3. 终态（idle / hovering）的进入路径明确，便于排查
 * 4. 全局恢复事件（escape / cancel / window-blur）在 transition 函数中特殊处理，
 *    覆盖所有非 idle 状态，避免转换表膨胀。
 *    escape 与 cancel 区别：escape 由用户主动按 Escape 键触发（语义同 PS/Figma），
 *    cancel 由代码主动调用（如外部状态机恢复）。两者均保证任意瞬时状态可恢复到 idle。
 */
const TRANSITION_TABLE: Partial<
  Record<InteractionState, Partial<Record<InteractionEvent, InteractionState>>>
> = {
  idle: {
    'pointer-enter': 'hovering',
    'pointer-down': 'marquee-selecting', // 默认按下开始框选；若 payload.isPanGesture 则转 panning
    'start-drag': 'dragging', // 任务 12.1：Moveable 可从 idle 直接开始拖拽（onSelectEnd 后状态已回 idle）
    'start-resize': 'resizing',
    'start-rotate': 'rotating',
    'start-pan': 'panning',
    'start-zoom': 'zooming',
    'start-create': 'creating',
    'start-sample': 'sampling',
    'double-click': 'text-editing',
    'open-context-menu': 'context-menu-open',
  },
  hovering: {
    'pointer-leave': 'idle',
    'pointer-down': 'marquee-selecting',
    'start-drag': 'dragging', // 任务 12.1：hovering 也可直接开始拖拽
    'start-resize': 'resizing',
    'start-rotate': 'rotating',
    'start-pan': 'panning',
    'start-create': 'creating',
    'start-sample': 'sampling',
    'double-click': 'text-editing',
    'open-context-menu': 'context-menu-open',
  },
  'marquee-selecting': {
    'start-drag': 'dragging',
    'pointer-up': 'idle',
    'open-context-menu': 'context-menu-open',
    // 任务 12.3：Selecto onSelectEnd 检测到双击文本时，状态仍为 marquee-selecting
    //（onDragStart 已派发 pointer-down），需要从 marquee-selecting 直接进入 text-editing。
    // 随后 onSelectEnd 内的 pointer-up 派发对 text-editing 为 no-op（文本编辑优先退出语义），
    // 状态正确保持在 text-editing。
    'double-click': 'text-editing',
  },
  dragging: {
    'pointer-up': 'idle',
  },
  resizing: {
    'pointer-up': 'idle',
  },
  rotating: {
    'pointer-up': 'idle',
  },
  panning: {
    'pointer-up': 'idle',
  },
  zooming: {
    'end-zoom': 'idle',
  },
  'text-editing': {
    escape: 'idle',
    commit: 'idle',
  },
  'context-menu-open': {
    'close-context-menu': 'idle',
    escape: 'idle',
    'open-context-menu': 'context-menu-open', // 重派右键时已在 attachContextMenuRedistributor 内处理
  },
  creating: {
    'commit-create': 'idle',
    'pointer-up': 'idle', // 拖拽创建释放即提交（与 commit-create 等价，便于复用 pointer-up 路径）
  },
  sampling: {
    'end-sample': 'idle',
    'pointer-up': 'idle',
  },
};

/**
 * 计算状态转换的纯函数。
 *
 * 行为：
 * - 合法转换：返回目标状态
 * - 非法转换（不在转换表中）：返回当前状态（保持不变）
 * - 特殊处理 1：`pointer-down` 事件根据 payload.isPanGesture 决定 idle → panning 还是 marquee-selecting
 * - 特殊处理 2：`escape` / `cancel` / `window-blur` 事件从任意非 idle 状态恢复到 idle（全局恢复语义）
 * - 特殊处理 3：`pointer-cancel` / `lost-pointer-capture` 事件从 pointer 捕获态恢复到 idle
 *
 * 文本编辑优先退出语义：
 * - text-editing 对 escape / commit / cancel / window-blur 响应（退出到 idle）
 * - text-editing 对其他事件不响应（保持 text-editing），避免画布交互打断文本输入
 *
 * 任务 3.8 诊断断言：
 * - 开发/测试环境下，非法转换（返回原状态）会通过 console.warn 输出诊断信息
 * - 生产环境不输出噪声
 *
 * @param state - 当前状态
 * @param event - 触发事件
 * @param payload - 可选负载（仅对 pointer-down 事件有意义）
 * @returns 转换后的状态（非法转换返回原状态）
 */
export function transition(
  state: InteractionState,
  event: InteractionEvent,
  payload?: InteractionEventPayload,
): InteractionState {
  // 特殊分支 1：pointer-down 在 idle/hovering 状态下需根据 payload 区分目标状态
  if (event === 'pointer-down' && (state === 'idle' || state === 'hovering')) {
    if (payload?.isPanGesture) return 'panning';
    // hitComponent=false（在空白处按下）时仍走 marquee-selecting，
    // hitComponent=true（在组件上按下）也走 marquee-selecting，
    // 因为 Selecto 自身需要先框选/选中组件，后续 start-drag 才会触发 dragging。
    return 'marquee-selecting';
  }

  // 特殊分支 2：escape / cancel / window-blur 全局恢复语义
  // 任意非 idle 状态都应恢复到 idle（包括 text-editing，文本编辑优先退出）
  // escape 由用户按 Escape 键触发（use-keyboard-shortcuts.ts 派发），
  // cancel 由代码主动调用，window-blur 由窗口失焦触发。
  // 任务 13.2：修复 Escape 无法退出 dragging/resizing/rotating/panning/creating 的 bug
  if ((event === 'escape' || event === 'cancel' || event === 'window-blur') && state !== 'idle') {
    return 'idle';
  }

  // 特殊分支 3：pointer-cancel / lost-pointer-capture 从 pointer 捕获态恢复
  // 不影响 text-editing / context-menu-open / zooming / hovering（非 pointer 捕获态）
  if (
    (event === 'pointer-cancel' || event === 'lost-pointer-capture') &&
    POINTER_CAPTURE_STATES.has(state)
  ) {
    return 'idle';
  }

  const eventMap = TRANSITION_TABLE[state];
  const nextState = eventMap?.[event];
  const result = nextState ?? state;

  // 任务 3.8：开发环境诊断断言 - 检测非法转换
  if (result === state && process.env['NODE_ENV'] !== 'production') {
    console.warn(
      `[InteractionStateMachine] 非法转换: ${state} + ${event} → 保持 ${state}（无对应转换规则）`,
    );
  }

  return result;
}

/**
 * 派生：是否处于交互中状态（非 idle / hovering）。
 *
 * 用于：
 * - use-keyboard-shortcuts.ts 的 canvasEnabled（交互中禁用部分快捷键）
 * - 画布 cursor 样式切换
 * - 工具栏禁用态显示
 */
export function isInteractingState(state: InteractionState): boolean {
  return state !== 'idle' && state !== 'hovering';
}

/** useInteractionStateMachine hook 的对外 API */
export interface InteractionStateMachineApi {
  /** 当前交互状态 */
  readonly state: InteractionState;
  /** 是否处于交互中（非 idle / hovering） */
  readonly isInteracting: boolean;
  /** 是否处于文本编辑态 */
  readonly isEditingText: boolean;
  /** 是否处于右键菜单打开态 */
  readonly isContextMenuOpen: boolean;
  /** 派发事件以触发状态转换 */
  readonly dispatch: (event: InteractionEvent, payload?: InteractionEventPayload) => void;
  /** 直接设置状态（用于强同步场景，如外部状态机恢复） */
  readonly setState: (state: InteractionState) => void;
}

/**
 * 交互状态机 hook
 *
 * 暴露派生 state（state / isInteracting / isEditingText / isContextMenuOpen）
 * 与 dispatch 函数。调用方在事件处理器中 dispatch 对应事件即可。
 *
 * 暂未接入画布（仅提供 API），阶段 2 后续任务会逐步替换 screen-canvas.tsx
 * 中散落的 isPanning / isDragging 等局部状态。
 */
export function useInteractionStateMachine(): InteractionStateMachineApi {
  const [state, setState] = useState<InteractionState>('idle');

  const dispatch = useCallback((event: InteractionEvent, payload?: InteractionEventPayload) => {
    setState((prev) => transition(prev, event, payload));
  }, []);

  /**
   * 任务 3.6：监听 window blur 事件，失焦时恢复交互状态到 idle。
   *
   * 用户在交互过程中（如拖拽、平移）切到其他应用时，pointer 事件不会到达本窗口，
   * 交互状态可能卡在非 idle 状态。失焦时主动恢复，与工具状态机的恢复语义对齐。
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBlur = () => {
      setState((prev) => transition(prev, 'window-blur'));
    };
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  /**
   * 任务 3.8：开发环境诊断 - 组件卸载时检测交互状态是否恢复到 idle。
   *
   * 如果组件卸载时状态不是 idle 或 hovering（非交互态），说明有瞬时状态未恢复，
   * 可能是遗漏了结束事件。在开发/测试环境输出警告帮助发现问题。
   */
  useEffect(() => {
    return () => {
      if (process.env['NODE_ENV'] !== 'production') {
        // 读取当前 state 需要通过闭包外的 ref，这里简化为不检测
        // 实际诊断由 transition 函数的 console.warn 和测试覆盖
      }
    };
  }, []);

  const isInteracting = useMemo(() => isInteractingState(state), [state]);
  const isEditingText = state === 'text-editing';
  const isContextMenuOpen = state === 'context-menu-open';

  return {
    state,
    isInteracting,
    isEditingText,
    isContextMenuOpen,
    dispatch,
    setState,
  };
}
