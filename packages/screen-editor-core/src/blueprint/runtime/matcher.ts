import type { CompiledRule } from '../compiler/types.js';
import type { TriggerEvent } from './types.js';

export function collectRules(rules: readonly CompiledRule[], event: TriggerEvent): CompiledRule[] {
  return rules.filter((rule) => matchesEvent(rule, event));
}

function matchesEvent(rule: CompiledRule, event: TriggerEvent): boolean {
  if (event.kind === 'pageLoad') {
    return rule.triggerEventId === 'pageLoad';
  }
  if (event.kind === 'interval') {
    return rule.triggerEventId === 'interval';
  }
  return (
    event.componentId.length > 0 &&
    rule.triggerComponentId === event.componentId &&
    rule.triggerEventId === event.eventId
  );
}
