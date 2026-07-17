/**
 * 交互状态机（Interaction State Machine）
 *
 * 与工具状态机（use-tool-state-machine.ts）正交，描述画布当前的交互阶段：
 * idle → hovering → marquee-selecting / dragging / resizing / rotating → idle 等。
 *
 * 职责：
 * - 提供状态转换表（transition 纯函数），便于单元测试
 * - 通过 useInteractionStateMachine hook 暴露派生 state（isInteracting 等）
 * - 与 use-keyboard-shortcuts.ts 的 canvasEnabled 联动（text-editing 时禁用画布快捷键）
 *
 * 对应 spec.md 的"交互状态机"层，归一化 screen-canvas.tsx 中散落的
 * panState / isPanning / lastClickRef / isDragging 等局部状态。
 *
 * @see {@link ../../../../../../../../.trae/specs/research-interaction-architecture/spec.md}
 */

import { useCallback, useMemo, useState } from 'react';

/**
 * 交互状态机的 10 个状态。
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
  | 'context-menu-open';

/**
 * 交互状态机的触发事件。
 *
 * 事件命名约定：`动作-对象` 或 `阶段-目标`，描述引起状态转换的用户行为。
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
  | 'double-click' // 双击进入文本编辑（idle → text-editing）
  | 'open-context-menu' // 打开右键菜单（idle → context-menu-open）
  | 'pointer-up' // 释放指针（拖拽/框选/调整/旋转/平移 → idle 或 hovering）
  | 'end-zoom' // 结束缩放（zooming → idle）
  | 'close-context-menu' // 关闭右键菜单（context-menu-open → idle）
  | 'escape' // Escape 退出（text-editing / context-menu-open → idle）
  | 'commit'; // 提交编辑（text-editing → idle）

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
 * 状态转换表：`[currentState][event] → nextState`。
 *
 * 未在表中列出的 (state, event) 组合视为非法转换，
 * `transition` 函数会返回当前状态（保持不变）。
 *
 * 设计原则：
 * 1. 显式列出所有合法转换，便于代码审查与单元测试
 * 2. 不抛异常，避免画布事件处理器因状态机异常导致卡死
 * 3. 终态（idle / hovering）的进入路径明确，便于排查
 */
const TRANSITION_TABLE: Partial<
  Record<InteractionState, Partial<Record<InteractionEvent, InteractionState>>>
> = {
  idle: {
    'pointer-enter': 'hovering',
    'pointer-down': 'marquee-selecting', // 默认按下开始框选；若 payload.isPanGesture 则转 panning
    'start-resize': 'resizing',
    'start-rotate': 'rotating',
    'start-pan': 'panning',
    'start-zoom': 'zooming',
    'double-click': 'text-editing',
    'open-context-menu': 'context-menu-open',
  },
  hovering: {
    'pointer-leave': 'idle',
    'pointer-down': 'marquee-selecting',
    'start-resize': 'resizing',
    'start-rotate': 'rotating',
    'start-pan': 'panning',
    'double-click': 'text-editing',
    'open-context-menu': 'context-menu-open',
  },
  'marquee-selecting': {
    'start-drag': 'dragging',
    'pointer-up': 'idle',
    'open-context-menu': 'context-menu-open',
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
};

/**
 * 计算状态转换的纯函数。
 *
 * 行为：
 * - 合法转换：返回目标状态
 * - 非法转换（不在转换表中）：返回当前状态（保持不变）
 * - 特殊处理：`pointer-down` 事件根据 payload.isPanGesture 决定 idle → panning 还是 marquee-selecting
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
  // 特殊分支：pointer-down 在 idle/hovering 状态下需根据 payload 区分目标状态
  if (event === 'pointer-down' && (state === 'idle' || state === 'hovering')) {
    if (payload?.isPanGesture) return 'panning';
    // hitComponent=false（在空白处按下）时仍走 marquee-selecting，
    // hitComponent=true（在组件上按下）也走 marquee-selecting，
    // 因为 Selecto 自身需要先框选/选中组件，后续 start-drag 才会触发 dragging。
    return 'marquee-selecting';
  }

  const eventMap = TRANSITION_TABLE[state];
  const nextState = eventMap?.[event];
  return nextState ?? state;
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
