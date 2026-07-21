/**
 * 蓝图预览上下文（任务 3.4 + 3.5）
 *
 * 在公开预览页提供：
 * - visibilityOverrides：组件 → boolean；覆盖组件 status.hidden
 * - apiDataOverrides：组件 → API 响应数据；refreshDataSource 完成后写入，
 *   组件渲染时优先使用 override 作为 apiRawData（替代 useApiDataSource state）
 *
 * 编辑器画布不消费此 Context（spec: "编辑器画布不触发蓝图"），
 * 因此编辑器渲染时 Context 默认值为 null，组件回退到既有行为。
 *
 * 不可变快照：每次可见性或 override 变化都产生新的 Map 引用，触发订阅组件重渲染。
 */

import { createContext, useContext } from 'react';
import type { VisibilityOverrides } from './types.js';

export interface BlueprintPreviewContextValue {
  /** 组件 → 可见性覆盖（setVisibility 动作写入） */
  visibilityOverrides: VisibilityOverrides;
  /** 组件 → 蓝图运行时缓存的 API 数据（refreshDataSource 完成后写入） */
  apiDataOverrides: Map<string, unknown>;
}

const BlueprintPreviewContext = createContext<BlueprintPreviewContextValue | null>(null);

export const BlueprintPreviewProvider = BlueprintPreviewContext.Provider;

/**
 * 读取蓝图预览上下文。
 *
 * 在预览页内消费：组件根据 visibilityOverrides 决定是否渲染（覆盖 status.hidden）；
 * 图表类组件根据 apiDataOverrides 优先使用 override 作为 apiRawData。
 *
 * 编辑器画布中此 Hook 返回 null，组件回退到既有行为（不触发蓝图）。
 */
export function useBlueprintPreview(): BlueprintPreviewContextValue | null {
  return useContext(BlueprintPreviewContext);
}
