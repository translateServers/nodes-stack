/**
 * V2 规则匹配纯函数
 *
 * 给定编译后的 V2 规则集 + 一个 V2 触发事件，返回所有匹配的规则。
 * 不发起 IO、不产生副作用。
 *
 * 匹配规则：
 * - pageLoad 事件匹配 triggerEventId === 'pageLoad' 的规则
 * - componentEvent 事件匹配 triggerComponentId === event.componentId
 *   且 triggerEventId === event.eventId 的规则
 *
 * 空字符串 componentId 不匹配任何 componentEvent（视为未配置）。
 * 多规则聚合：按编译顺序返回所有匹配的规则（保持稳定顺序）。
 */

import type { V2CompiledRule } from '../compiler/v2-types.js';
import type { V2TriggerEvent } from './v2-types.js';

/**
 * 收集所有匹配 V2 触发事件的规则。
 *
 * @param rules  编译后的 V2 规则集
 * @param event  V2 触发事件
 * @returns 匹配的规则数组（保持编译顺序）
 */
export function collectV2Rules(
  rules: readonly V2CompiledRule[],
  event: V2TriggerEvent,
): V2CompiledRule[] {
  return rules.filter((rule) => matchesEvent(rule, event));
}

function matchesEvent(rule: V2CompiledRule, event: V2TriggerEvent): boolean {
  if (event.kind === 'pageLoad') {
    return rule.triggerEventId === 'pageLoad';
  }

  // componentEvent：componentId 与 eventId 都必须匹配
  if (event.componentId === '') return false;
  return rule.triggerEventId === event.eventId && rule.triggerComponentId === event.componentId;
}
