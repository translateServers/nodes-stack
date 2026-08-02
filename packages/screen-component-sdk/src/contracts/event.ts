/**
 * 组件标准事件（Spec §7.5）
 *
 * 组件通过 `nebula-component-event` CustomEvent 上报 manifest 已声明事件。
 * 蓝图 source handle 统一为 `evt:${id}`。
 */

import type { ScreenComponentJsonValue } from './json.js';

export interface ScreenComponentEventDefinition {
  id: string;
  name: string;
  description?: string;
}

export interface ScreenComponentEventDetail {
  name: string;
  payload?: ScreenComponentJsonValue;
}

/** 事件 id 格式：`^[a-z][A-Za-z0-9]*$`（Spec §7.5） */
export const EVENT_ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;

/** 标准组件事件名（CustomEvent type） */
export const COMPONENT_EVENT_TYPE = 'nebula-component-event';

/** 事件 payload 最大体积（64 KiB，Spec §9.2） */
export const MAX_EVENT_PAYLOAD_BYTES = 64 * 1024;

/** 蓝图 source handle 前缀 */
export const EVENT_HANDLE_PREFIX = 'evt:';
