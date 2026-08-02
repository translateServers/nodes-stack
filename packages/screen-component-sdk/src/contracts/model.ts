/**
 * Custom Element Runtime ABI - Model（Spec §9.1）
 *
 * SDK 通过 JavaScript property 原子赋值 model。
 * 每次赋值使用 detached snapshot，组件修改 model 不得改变编辑器 Store。
 */

import type { ScreenComponentProps, ScreenComponentJsonValue } from './json.js';

export interface ScreenComponentElementModelV1 {
  readonly apiVersion: 1;
  readonly componentId: string;
  readonly mode: 'design' | 'preview';
  readonly interactive: boolean;
  readonly props: Readonly<ScreenComponentProps>;
  readonly style: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly size: { readonly width: number; readonly height: number };
}

/**
 * 组件 Custom Element 接口（Spec §9.1）
 *
 * SDK 通过 `element.model = ...` 赋值 detached snapshot。
 * 组件实现此接口以接收渲染数据。
 */
export interface ScreenComponentElement extends HTMLElement {
  model: ScreenComponentElementModelV1;
}
