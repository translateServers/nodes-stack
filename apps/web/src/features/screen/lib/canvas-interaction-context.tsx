/**
 * 画布交互能力契约（Spec: introduce-canvas-interaction-modes）
 *
 * 统一派生画布交互能力，不让各组件自行读取 Store 的 `interactionMode` 决定行为。
 * 最低能力契约为 `CanvasInteractionCapabilities`，由 Provider 注入到组件树。
 *
 * 能力派生规则：
 * - design：可编辑画布、不可触发组件业务交互、不可派发蓝图事件
 * - interactive：不可直接编辑、可触发组件业务交互、可派发蓝图事件
 *
 * Provider 缺失时（如测试环境未包裹 Provider）安全回退到 design 能力，
 * 确保不会意外触发蓝图副作用。
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CanvasInteractionMode } from '../stores/editor-store';

/**
 * 画布交互能力派生结果。
 *
 * 组件渲染层通过此契约读取能力，不直接读取 Store 的 interactionMode。
 */
export interface CanvasInteractionCapabilities {
  /** 当前画布交互模式 */
  mode: CanvasInteractionMode;
  /** 是否允许画布编辑操作（选择、拖拽、缩放、旋转、框选、创建） */
  canEditCanvas: boolean;
  /** 是否允许触发组件原生交互（click、hover、tooltip 等） */
  canDispatchNativeEvents: boolean;
  /** 是否允许派发蓝图事件 */
  canDispatchBlueprintEvents: boolean;
}

/**
 * 安全默认能力：design 模式。
 *
 * Provider 缺失时使用此值，确保不会意外触发蓝图副作用。
 */
export const DESIGN_CAPABILITIES: CanvasInteractionCapabilities = {
  mode: 'design',
  canEditCanvas: true,
  canDispatchNativeEvents: false,
  canDispatchBlueprintEvents: false,
};

/**
 * 交互调试模式能力。
 */
export const INTERACTIVE_CAPABILITIES: CanvasInteractionCapabilities = {
  mode: 'interactive',
  canEditCanvas: false,
  canDispatchNativeEvents: true,
  canDispatchBlueprintEvents: true,
};

/**
 * 从交互模式派生画布交互能力。
 */
export function deriveCapabilities(mode: CanvasInteractionMode): CanvasInteractionCapabilities {
  return mode === 'interactive' ? INTERACTIVE_CAPABILITIES : DESIGN_CAPABILITIES;
}

const CanvasInteractionContext = createContext<CanvasInteractionCapabilities>(DESIGN_CAPABILITIES);

export const CanvasInteractionProvider = CanvasInteractionContext.Provider;

/**
 * 读取画布交互能力。
 *
 * - 有 Provider 时：返回当前模式派生的能力
 * - 无 Provider 时：安全回退到 design 能力
 */
export function useCanvasInteraction(): CanvasInteractionCapabilities {
  return useContext(CanvasInteractionContext);
}

/**
 * Hook：创建画布交互能力 Provider 的 value，自动 memo 化。
 *
 * 供 ScreenCanvas 等顶层组件使用，避免每次渲染产生新对象。
 */
export function useCanvasInteractionValue(
  mode: CanvasInteractionMode,
): CanvasInteractionCapabilities {
  return useMemo(() => deriveCapabilities(mode), [mode]);
}

/**
 * 包裹组件树注入画布交互能力 Provider。
 * 便捷封装，避免手动调用 useCanvasInteractionValue + CanvasInteractionProvider。
 */
export function CanvasInteractionScope({
  mode,
  children,
}: {
  mode: CanvasInteractionMode;
  children: ReactNode;
}): ReactNode {
  const value = useCanvasInteractionValue(mode);
  return <CanvasInteractionProvider value={value}>{children}</CanvasInteractionProvider>;
}
