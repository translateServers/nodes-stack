import type { ConditionExpression, ConditionOperator, ConditionValueSource } from '@nebula/shared';

import type { ActionStep, CompiledRule, CompiledStep } from '../compiler/types.js';
import { collectRules } from './matcher.js';
import type { ActionResult, RuleExecutionLog, RuntimeDeps, TriggerEvent } from './types.js';

export async function executeRule(
  rule: CompiledRule,
  event: TriggerEvent,
  deps: RuntimeDeps,
): Promise<RuleExecutionLog> {
  const results: ActionResult[] = [];
  await executeSteps(rule.steps, event, deps, results);

  return {
    triggerNodeId: rule.triggerNodeId,
    triggerEventId: rule.triggerEventId,
    triggerComponentId: rule.triggerComponentId,
    results,
    truncated: false,
  };
}

export async function triggerAndExecute(
  rules: readonly CompiledRule[],
  event: TriggerEvent,
  deps: RuntimeDeps,
): Promise<RuleExecutionLog[]> {
  const logs: RuleExecutionLog[] = [];
  for (const rule of collectRules(rules, event)) {
    logs.push(await executeRule(rule, event, deps));
  }
  return logs;
}

async function executeSteps(
  steps: readonly CompiledStep[],
  event: TriggerEvent,
  deps: RuntimeDeps,
  results: ActionResult[],
): Promise<void> {
  for (const step of steps) {
    if (step.kind === 'action') {
      results.push(await executeActionStep(step, deps));
    } else if (step.kind === 'condition') {
      const branch = evaluateConditionExpression(step.expression, event, deps)
        ? step.thenSteps
        : step.elseSteps;
      await executeSteps(branch, event, deps, results);
    } else {
      await sleep(step.delayMs);
    }
  }
}

async function executeActionStep(step: ActionStep, deps: RuntimeDeps): Promise<ActionResult> {
  const { nodeId, componentId, config } = step;
  const start = performance.now();

  try {
    switch (config.actionId) {
      case 'show':
        return executeVisibilityAction(nodeId, componentId, config.actionId, true, deps, start);
      case 'hide':
        return executeVisibilityAction(nodeId, componentId, config.actionId, false, deps, start);
      case 'toggleVisibility': {
        const reason = validateTargetComponent(componentId, deps);
        if (reason !== undefined) {
          return skippedResult(nodeId, config.actionId, reason);
        }
        deps.applyVisibility(componentId, !deps.getVisibility(componentId));
        return successResult(nodeId, config.actionId, start);
      }
      case 'refreshData': {
        const reason = validateTargetComponent(componentId, deps);
        if (reason !== undefined) {
          return skippedResult(nodeId, config.actionId, reason);
        }
        await deps.refreshDataSource(componentId);
        return successResult(nodeId, config.actionId, start);
      }
      case 'scrollTo': {
        const reason = validateTargetComponent(componentId, deps);
        if (reason !== undefined) {
          return skippedResult(nodeId, config.actionId, reason);
        }
        deps.scrollToComponent(componentId);
        return successResult(nodeId, config.actionId, start);
      }
      case 'navigate':
        if (config.config.url === '') {
          return skippedResult(nodeId, config.actionId, 'Navigate URL is empty.');
        }
        deps.openUrl(config.config.url, config.config.target);
        return successResult(nodeId, config.actionId, start);
      case 'requestApi': {
        const request = config.config;
        if (request.url === '') {
          return skippedResult(nodeId, config.actionId, 'Request API URL is empty.');
        }
        const result = await deps.requestApi({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
          secretHeaderKeys: request.secretHeaderKeys,
          timeoutMs: request.timeoutMs,
        });
        return result.ok
          ? successResult(nodeId, config.actionId, start)
          : {
              kind: 'failure',
              nodeId,
              actionId: config.actionId,
              error: `HTTP ${result.status}: ${result.bodyPreview.slice(0, 200)}`,
              durationMs: elapsed(start),
            };
      }
    }
  } catch (error) {
    return {
      kind: 'failure',
      nodeId,
      actionId: config.actionId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: elapsed(start),
    };
  }
}

function executeVisibilityAction(
  nodeId: string,
  componentId: string,
  actionId: 'show' | 'hide',
  visible: boolean,
  deps: RuntimeDeps,
  start: number,
): ActionResult {
  const reason = validateTargetComponent(componentId, deps);
  if (reason !== undefined) {
    return skippedResult(nodeId, actionId, reason);
  }
  deps.applyVisibility(componentId, visible);
  return successResult(nodeId, actionId, start);
}

function validateTargetComponent(componentId: string, deps: RuntimeDeps): string | undefined {
  if (componentId === '') {
    return 'Target component is not configured.';
  }
  return deps.hasComponent(componentId)
    ? undefined
    : `Target component ${componentId} does not exist.`;
}

function evaluateConditionExpression(
  expression: ConditionExpression,
  event: TriggerEvent,
  deps: RuntimeDeps,
): boolean {
  return compareValue(
    resolveConditionSource(expression.source, event, deps),
    expression.operator,
    expression.value,
  );
}

function resolveConditionSource(
  source: ConditionValueSource,
  event: TriggerEvent,
  deps: RuntimeDeps,
): unknown {
  const fallbackComponentId = event.kind === 'componentEvent' ? event.componentId : undefined;
  const componentId = source.componentId || fallbackComponentId;
  if (componentId === undefined || componentId === '') {
    return undefined;
  }

  if (source.kind === 'componentProp') {
    return deps.getComponentValue(componentId)?.[source.key];
  }
  return resolvePath(deps.getComponentData(componentId), source.path);
}

function resolvePath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
    case 'contains':
      return (
        (typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected)) ||
        (Array.isArray(actual) && actual.some((item) => item === expected))
      );
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
  }
}

function looseEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return Number.isNaN(left) && Number.isNaN(right);
  }
  const normalizedLeft = toNumber(left);
  const normalizedRight = toNumber(right);
  return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
}

function compareNumbers(left: unknown, right: unknown): number {
  const normalizedLeft = toNumber(left);
  const normalizedRight = toNumber(right);
  return normalizedLeft === null || normalizedRight === null ? 0 : normalizedLeft - normalizedRight;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized === '' || !Number.isFinite(Number(normalized)) ? null : Number(normalized);
  }
  return typeof value === 'boolean' ? (value ? 1 : 0) : null;
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function successResult(nodeId: string, actionId: string, start: number): ActionResult {
  return { kind: 'success', nodeId, actionId, durationMs: elapsed(start) };
}

function skippedResult(nodeId: string, actionId: string, reason: string): ActionResult {
  return { kind: 'skipped', nodeId, actionId, reason };
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}
