/**
 * 动态组件 Custom Element Runtime ABI - Model v2。
 *
 * 在 v1 model 基础上新增 `dataCapability` 与 `dataState`：
 * - `dataCapability`：manifest 声明的数据能力（静态，不可变）
 * - `dataState`：宿主数据执行层回写的运行状态（每次赋值使用 detached snapshot）
 *
 * 组件实现 `element.model = v2 model` 以接收 props 与数据状态；
 * v1 组件（未声明 dataCapability）由宿主降级按 `none` 处理。
 */

import type { ScreenComponentJsonValue, ScreenComponentProps } from '../contracts/json.js';
import type { ScreenComponentDataCapability, ScreenComponentDataState } from './data-capability.js';

export interface ScreenComponentElementModelV2 {
  readonly apiVersion: 2;
  readonly componentId: string;
  readonly mode: 'design' | 'preview' | 'viewer';
  readonly interactive: boolean;
  readonly props: Readonly<ScreenComponentProps>;
  readonly style: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly size: { readonly width: number; readonly height: number };
  readonly dataCapability: ScreenComponentDataCapability;
  readonly dataState: ScreenComponentDataState;
}

/**
 * 动态组件 Custom Element 接口。
 *
 * 宿主通过 `element.model = ...` 赋值 detached snapshot；
 * 组件不得通过 model 修改编辑器/查看器状态。
 */
export interface ScreenDynamicComponentElement extends HTMLElement {
  model: ScreenComponentElementModelV2;
}
