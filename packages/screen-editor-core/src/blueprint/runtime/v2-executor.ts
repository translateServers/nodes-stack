/**
 * V2 动作执行器
 *
 * 薄执行器：依赖注入 V2RuntimeDeps 处理副作用。
 * - 按 steps 顺序执行
 * - action 步骤按 actionId 分发到 RuntimeDeps
 * - condition 步骤求值表达式后递归执行 then/else 分支
 * - delay 步骤真实等待 delayMs 毫秒后继续执行后续步骤（不产生 ActionResult）
 * - dangling 目标组件跳过并记录
 * - 失败动作不中断后续独立动作
 *
 * 与 V1 executor.ts 的差异：
 * - trigger 信息从 rule.triggerEventId / triggerComponentId 读取
 * - steps 是判别联合（action / condition / delay），按 kind 分支
 * - condition 内联 thenSteps / elseSteps，递归执行
 * - delay 步骤通过 sleep(delayMs) 真实等待，不拆分 rule
 * - 不依赖 planActions，深度截断由编译器在拆分 rule 时处理（truncated 永远为 false）
 */

import type { ConditionExpression, ConditionOperator, ConditionValueSource } from '@nebula/shared';
import type { V2CompiledRule, V2CompiledStep } from '../compiler/v2-types.js';
import { collectV2Rules } from './v2-matcher.js';
import type {
  V2ActionResult,
  V2RuleExecutionLog,
  V2RuntimeDeps,
  V2TriggerEvent,
} from './v2-types.js';

/**
 * 执行一条 V2 规则的所有步骤。
 *
 * - 单条规则内步骤按顺序执行
 * - 前一个步骤失败不中断后续独立步骤
 * - dangling 动作跳过并记录
 * - delay 步骤真实等待 delayMs 毫秒后继续（不产生 ActionResult）
 * - condition 步骤按表达式求值结果选择 then/else 分支递归执行
 *
 * @returns 执行日志（用于调试面板）
 */
export async function executeV2Rule(
  rule: V2CompiledRule,
  event: V2TriggerEvent,
  deps: V2RuntimeDeps,
): Promise<V2RuleExecutionLog> {
  const results: V2ActionResult[] = [];
  await executeSteps(rule.steps, event, deps, results);

  return {
    triggerNodeId: rule.triggerNodeId,
    triggerEventId: rule.triggerEventId,
    triggerComponentId: rule.triggerComponentId,
    results,
    truncated: false,
  };
}

/**
 * 触发并执行所有匹配的 V2 规则。
 *
 * 多规则聚合：按编译顺序依次执行，每条规则独立执行。
 * 不等待前一条规则完成才执行下一条（spec: "单条规则内步骤按顺序执行"）。
 *
 * @returns 所有规则的执行日志
 */
export async function triggerAndExecuteV2(
  rules: readonly V2CompiledRule[],
  event: V2TriggerEvent,
  deps: V2RuntimeDeps,
): Promise<V2RuleExecutionLog[]> {
  const matched = collectV2Rules(rules, event);
  const logs: V2RuleExecutionLog[] = [];
  for (const rule of matched) {
    const log = await executeV2Rule(rule, event, deps);
    logs.push(log);
  }
  return logs;
}

/** 按顺序执行步骤列表（递归用于 condition 分支） */
async function executeSteps(
  steps: readonly V2CompiledStep[],
  event: V2TriggerEvent,
  deps: V2RuntimeDeps,
  results: V2ActionResult[],
): Promise<void> {
  for (const step of steps) {
    if (step.kind === 'action') {
      const result = await executeActionStep(step, deps);
      results.push(result);
      continue;
    }
    if (step.kind === 'condition') {
      const branch = evaluateConditionExpression(step.expression, event, deps)
        ? step.thenSteps
        : step.elseSteps;
      await executeSteps(branch, event, deps, results);
      continue;
    }
    // delay step：真实等待 delayMs 毫秒后继续执行后续步骤（不产生 ActionResult）
    await sleep(step.delayMs);
  }
}

/** 执行单个 action 步骤 */
async function executeActionStep(
  step: V2CompiledStep & { kind: 'action' },
  deps: V2RuntimeDeps,
): Promise<V2ActionResult> {
  const { nodeId, componentId, config } = step;
  const start = performance.now();
  try {
    switch (config.actionId) {
      case 'show': {
        const skipReason = checkTargetComponent(componentId, deps);
        if (skipReason !== null) return skippedResult(nodeId, config.actionId, skipReason);
        deps.applyVisibility(componentId, true);
        return successResult(nodeId, config.actionId, start);
      }

      case 'hide': {
        const skipReason = checkTargetComponent(componentId, deps);
        if (skipReason !== null) return skippedResult(nodeId, config.actionId, skipReason);
        deps.applyVisibility(componentId, false);
        return successResult(nodeId, config.actionId, start);
      }

      case 'toggleVisibility': {
        const skipReason = checkTargetComponent(componentId, deps);
        if (skipReason !== null) return skippedResult(nodeId, config.actionId, skipReason);
        deps.applyVisibility(componentId, !deps.getVisibility(componentId));
        return successResult(nodeId, config.actionId, start);
      }

      case 'refreshData': {
        const skipReason = checkTargetComponent(componentId, deps);
        if (skipReason !== null) return skippedResult(nodeId, config.actionId, skipReason);
        await deps.refreshDataSource(componentId);
        return successResult(nodeId, config.actionId, start);
      }

      case 'scrollTo': {
        const skipReason = checkTargetComponent(componentId, deps);
        if (skipReason !== null) return skippedResult(nodeId, config.actionId, skipReason);
        deps.scrollToComponent(componentId);
        return successResult(nodeId, config.actionId, start);
      }

      case 'navigate': {
        const { url, target } = config.config;
        if (url === '') {
          return skippedResult(nodeId, config.actionId, 'navigate URL 为空');
        }
        deps.openUrl(url, target);
        return successResult(nodeId, config.actionId, start);
      }

      case 'requestApi': {
        const cfg = config.config;
        if (cfg.url === '') {
          return skippedResult(nodeId, config.actionId, 'requestApi URL 为空');
        }
        const result = await deps.requestApi({
          method: cfg.method,
          url: cfg.url,
          headers: cfg.headers,
          body: cfg.body,
          secretHeaderKeys: cfg.secretHeaderKeys,
          timeoutMs: cfg.timeoutMs,
        });
        if (!result.ok) {
          return {
            kind: 'failure',
            nodeId,
            actionId: config.actionId,
            error: `HTTP ${result.status}: ${result.bodyPreview.slice(0, 200)}`,
            durationMs: elapsed(start),
          };
        }
        return successResult(nodeId, config.actionId, start);
      }

      default: {
        // 穷尽性检查：未知 actionId 跳过
        const _exhaustive: never = config;
        void _exhaustive;
        // config 在此处被窄化为 never，使用占位 actionId 标识未知动作
        return skippedResult(nodeId, 'unknown', '未知动作类型');
      }
    }
  } catch (err) {
    return {
      kind: 'failure',
      nodeId,
      actionId: config.actionId,
      error: err instanceof Error ? err.message : String(err),
      durationMs: elapsed(start),
    };
  }
}

/**
 * 校验目标组件是否存在（dangling 跳过判定）。
 *
 * - componentId 为空字符串（未配置）→ 返回未配置原因
 * - componentId 不在项目组件集合中 → 返回 dangling 原因
 * - 校验通过返回 null
 */
function checkTargetComponent(componentId: string, deps: V2RuntimeDeps): string | null {
  if (componentId === '') return '目标组件未配置（componentId 为空）';
  if (!deps.hasComponent(componentId)) return `目标组件 ${componentId} 不存在（dangling）`;
  return null;
}

// ===== 条件表达式求值（复制自 V1 executor.ts，避免与 V1 代码耦合） =====

/**
 * 求值条件表达式。
 *
 * - componentProp：读取组件 props[key]
 * - componentData：读取组件最新解析数据 path（点分隔）
 * - 字段缺失或类型不匹配时，按运算符语义降级（空值对 empty/notEmpty 有效，其余为 false）
 */
function evaluateConditionExpression(
  expression: ConditionExpression,
  event: V2TriggerEvent,
  deps: V2RuntimeDeps,
): boolean {
  const actualValue = resolveConditionSource(expression.source, event, deps);
  return compareValue(actualValue, expression.operator, expression.value);
}

/** 解析条件表达式的左值来源 */
function resolveConditionSource(
  source: ConditionValueSource,
  event: V2TriggerEvent,
  deps: V2RuntimeDeps,
): unknown {
  if (source.kind === 'componentProp') {
    const targetId = source.componentId || getEventComponentId(event);
    if (!targetId) return undefined;
    const value = deps.getComponentValue(targetId);
    if (value == null) return undefined;
    return value[source.key];
  }

  if (source.kind === 'componentData') {
    const targetId = source.componentId || getEventComponentId(event);
    if (!targetId) return undefined;
    const data = deps.getComponentData(targetId);
    if (data == null) return undefined;
    return resolvePath(data, source.path);
  }

  return undefined;
}

/** 从 V2 触发事件中提取组件 ID（仅 componentEvent 有值） */
function getEventComponentId(event: V2TriggerEvent): string | undefined {
  return event.kind === 'componentEvent' ? event.componentId : undefined;
}

/** 按点分隔路径从对象中取值 */
function resolvePath(data: unknown, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = data;
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** 比较实际值与运算符、目标值 */
function compareValue(
  actual: unknown,
  operator: ConditionOperator,
  expected: string | number | boolean | undefined,
): boolean {
  switch (operator) {
    case 'empty':
      return actual === undefined || actual === null || actual === '';
    case 'notEmpty':
      return actual !== undefined && actual !== null && actual !== '';
    case 'contains': {
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected);
      }
      if (Array.isArray(actual)) {
        return actual.some((item) => item === expected);
      }
      return false;
    }
    case 'eq':
      return looseEqual(actual, expected);
    case 'ne':
      return !looseEqual(actual, expected);
    case 'gt':
      return compareNumbers(actual, expected) > 0;
    case 'gte':
      return compareNumbers(actual, expected) >= 0;
    case 'lt':
      return compareNumbers(actual, expected) < 0;
    case 'lte':
      return compareNumbers(actual, expected) <= 0;
    default:
      return false;
  }
}

/** 松散相等：字符串数字与数字视为相等 */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (numA !== null && numB !== null) return numA === numB;
  return false;
}

/** 数值比较：无法转换时返回 0（降级为 false） */
function compareNumbers(a: unknown, b: unknown): number {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (numA === null || numB === null) return 0;
  return numA - numB;
}

/** 将未知值转为数字，失败返回 null */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

// ===== 工具函数 =====

/** 延时等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function successResult(nodeId: string, actionId: string, start: number): V2ActionResult {
  return { kind: 'success', nodeId, actionId, durationMs: elapsed(start) };
}

function skippedResult(nodeId: string, actionId: string, reason: string): V2ActionResult {
  return { kind: 'skipped', nodeId, actionId, reason };
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}
