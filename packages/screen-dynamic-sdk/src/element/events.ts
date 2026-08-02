/**
 * screen-dynamic-sdk 元素事件工具。
 */

import type { ScreenDynamicEventMap } from './contracts.js';

export function dispatchScreenDynamicEvent<EventName extends keyof ScreenDynamicEventMap>(
  target: EventTarget,
  type: EventName,
  detail: ScreenDynamicEventMap[EventName]['detail'],
): void {
  target.dispatchEvent(
    new CustomEvent(type, {
      bubbles: false,
      composed: true,
      detail,
    }),
  );
}
