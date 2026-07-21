/**
 * 规则匹配纯函数（任务 3.1）
 *
 * 给定编译后的规则集 + 一个触发事件，返回所有匹配的规则。
 * 不发起 IO、不产生副作用。
 *
 * 匹配规则：
 * - componentClick 事件匹配 config.type === 'componentClick' 且 componentId 相同的规则
 * - pageLoad 事件匹配 config.type === 'pageLoad' 的规则
 * - 多规则聚合：按编译顺序返回所有匹配的规则（保持稳定顺序）
 */

import type { CompiledRule } from '../compiler/types.js';
import type { TriggerEventType } from './types.js';

/**
 * 收集所有匹配触发事件的规则。
 *
 * @param rules  编译后的规则集
 * @param event  触发事件
 * @returns 匹配的规则数组（保持编译顺序）
 */
export function collectRules(
  rules: readonly CompiledRule[],
  event: TriggerEventType,
): CompiledRule[] {
  return rules.filter((rule) => matchesEvent(rule, event));
}

function matchesEvent(rule: CompiledRule, event: TriggerEventType): boolean {
  const { triggerConfig } = rule;
  if (triggerConfig.type !== event.kind) return false;

  // componentClick 需要进一步匹配 componentId
  if (triggerConfig.type === 'componentClick' && event.kind === 'componentClick') {
    // 空字符串 componentId 不匹配任何事件（编译器已诊断 empty-param）
    return triggerConfig.componentId === event.componentId && event.componentId !== '';
  }

  // pageLoad 类型匹配
  return true;
}
