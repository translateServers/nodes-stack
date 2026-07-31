/**
 * 执行计划展开纯函数（任务 3.1 + 3.2）
 *
 * 给定一条 CompiledRule，展开为有序的执行计划。
 * 深度超过上限（10 层）时截断并记录告警，不死循环。
 *
 * 纯函数：不发起 IO、不产生副作用。
 */

import type { CompiledRule } from '../compiler/types.js';
import type { ExecutionPlan, PlannedAction } from './types.js';

/** 深度上限：动作链触发新事件时递归深度超过此值即截断（spec: 10 层） */
export const MAX_TRIGGER_DEPTH = 10;

/**
 * 展开一条规则的执行计划。
 *
 * @param rule  编译后的规则
 * @returns 执行计划（含截断告警）
 */
export function planActions(rule: CompiledRule): ExecutionPlan {
  const actions: PlannedAction[] = [];
  const truncationWarnings: ExecutionPlan['truncationWarnings'] = [];

  for (const action of rule.actions) {
    if (action.depth >= MAX_TRIGGER_DEPTH) {
      truncationWarnings.push({ nodeId: action.nodeId, depth: action.depth });
      continue;
    }
    actions.push({
      nodeId: action.nodeId,
      config: action.config,
      depth: action.depth,
    });
  }

  return { actions, truncationWarnings };
}

/**
 * 深度截断判定：检查执行计划是否触发了深度上限。
 * 用于运行时告警日志。
 */
export function isTruncated(plan: ExecutionPlan): boolean {
  return plan.truncationWarnings.length > 0;
}
