/**
 * 规则匹配纯函数（任务 3.1 + 10.3）
 *
 * 给定编译后的规则集 + 一个触发事件，返回所有匹配的规则。
 * 不发起 IO、不产生副作用。
 *
 * 匹配规则：
 * - componentClick 事件匹配 config.type === 'componentClick' 且 componentId 相同的规则
 * - pageLoad 事件匹配 config.type === 'pageLoad' 的规则
 * - componentHover 事件匹配 config.type === 'componentHover' 且 componentId 相同的规则（任务 10.3）
 * - dataLoaded 事件匹配 config.type === 'dataLoaded' 且 componentId 相同的规则（任务 10.3）
 * - dataError 事件匹配 config.type === 'dataError' 且 componentId 相同的规则（任务 10.3）
 * - interval 事件匹配 config.type === 'interval' 的所有定时器规则（任务 10.3）
 * - 多规则聚合：按编译顺序返回所有匹配的规则（保持稳定顺序）
 *
 * 空字符串 componentId 不匹配任何事件（由编译器诊断 empty-param）。
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

  // 类型相同的窄化匹配
  switch (triggerConfig.type) {
    case 'componentClick':
      // componentClick 需要进一步匹配 componentId
      return (
        event.kind === 'componentClick' &&
        matchComponentId(triggerConfig.componentId, event.componentId)
      );

    case 'componentHover':
      return (
        event.kind === 'componentHover' &&
        matchComponentId(triggerConfig.componentId, event.componentId)
      );

    case 'dataLoaded':
      return (
        event.kind === 'dataLoaded' &&
        matchComponentId(triggerConfig.componentId, event.componentId)
      );

    case 'dataError':
      return (
        event.kind === 'dataError' && matchComponentId(triggerConfig.componentId, event.componentId)
      );

    case 'pageLoad':
      // pageLoad 类型匹配
      return true;

    case 'interval':
      // interval 事件匹配所有 interval 规则（每条定时器规则每次 tick 都触发）
      return true;

    default: {
      // 穷尽性检查
      const _exhaustive: never = triggerConfig;
      void _exhaustive;
      return false;
    }
  }
}

/** componentId 匹配：相同且非空（空字符串视为未配置） */
function matchComponentId(configId: string, eventId: string): boolean {
  return configId === eventId && eventId !== '';
}
