/**
 * 组件事件回调 Context（任务 7.1）
 *
 * 在预览态将蓝图运行时的 `onComponentEvent(componentId, eventId)` 通过 React Context
 * 注入到组件树，使组件渲染时可在 onClick / onHover 等回调中调用，触发对应蓝图规则。
 *
 * 设计约束：
 * - 编辑态（eventsEnabled=false）不注入 Provider，`useComponentEvent` 返回 undefined，
 *   组件回退到既有行为（不触发蓝图事件）
 * - 预览态注入 Provider，组件通过 `useComponentEvent` 获取回调并绑定到事件
 * - 与 V1 `BlueprintPreviewContext`（visibilityOverrides / apiDataOverrides）并存：
 *   - `BlueprintPreviewContext` 提供运行时副作用产物（组件订阅读取）
 *   - `BlueprintEventContext` 提供事件触发入口（组件写入调用）
 * - 保留组件 `interaction` 字段的直接配置能力：组件优先使用自身 props 中的 interaction
 *   配置，未配置时回退到 Context 中的 onComponentEvent
 *
 * 与 V1 `onComponentClick` 的差异：
 * - V1 仅支持 click 事件（onComponentClick(componentId)）
 * - V2 支持任意事件（onComponentEvent(componentId, eventId, payload?)），
 *   eventId 与组件注册表中 ComponentEventDefinition.id 对齐（click / hover / dataLoaded / ...）
 */

import { createContext, useContext } from 'react';

/** 组件事件回调签名 */
export type ComponentEventCallback = (
  componentId: string,
  eventId: string,
  payload?: unknown,
) => void;

const BlueprintEventContext = createContext<ComponentEventCallback | null>(null);

export const BlueprintEventProvider = BlueprintEventContext.Provider;

/**
 * 读取蓝图组件事件回调。
 *
 * - 预览态：返回运行时注入的回调，组件可在 onClick/onHover 等事件中调用
 * - 编辑态：返回 null，组件不触发蓝图事件
 *
 * @returns 事件回调（预览态）或 null（编辑态）
 */
export function useComponentEvent(): ComponentEventCallback | null {
  return useContext(BlueprintEventContext);
}
