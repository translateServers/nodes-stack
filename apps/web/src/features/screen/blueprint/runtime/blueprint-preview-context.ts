/**
 * 蓝图预览上下文（任务 3.4 + 3.5）
 *
 * 在独立预览页与启用蓝图运行时的编辑器画布中提供：
 * - visibilityOverrides：组件 → boolean；覆盖组件 status.hidden
 * - apiDataOverrides：组件 → API 响应数据；refreshDataSource 完成后写入，
 *   组件渲染时优先使用 override 作为 apiRawData（替代 useApiDataSource state）
 *
 * 编辑器画布关闭 Event 总闸门时 Provider 值为 null，组件回退到项目原始状态。
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
 * 在运行时宿主内消费：组件根据 visibilityOverrides 决定是否渲染（覆盖 status.hidden）；
 * 图表类组件根据 apiDataOverrides 优先使用 override 作为 apiRawData。
 *
 * 未启用运行时的宿主中返回 null，组件回退到既有行为。
 */
export function useBlueprintPreview(): BlueprintPreviewContextValue | null {
  return useContext(BlueprintPreviewContext);
}
