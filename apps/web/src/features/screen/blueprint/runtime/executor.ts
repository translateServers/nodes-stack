/**
 * 动作执行器（任务 3.3 + 10.1 + 10.3 + 10.5）
 *
 * 薄执行器：依赖注入 RuntimeDeps 处理副作用（DOM / fetch / 状态）。
 * - setVisibility：写入预览可见性覆盖表，不改写项目数据
 * - navigate：按白名单打开（Schema 已强制 http/https，运行时仅执行）
 * - scrollToComponent：平滑滚动至目标组件
 * - refreshDataSource：复用阶段 2 取消协议（任务 3.4 接线）
 * - requestApi：发起 HTTP 请求，支持模板插值与超时取消
 * - condition：按表达式求值结果选择 then/else 分支执行
 * - dangling 动作跳过并记录（spec: "dangling 动作运行时跳过并记录"）
 * - 失败动作不中断后续独立动作（spec: "前一个动作失败不中断后续独立动作"）
 *
 * 页面卸载清理（spec "页面卸载清理"）由调用方在 useEffect cleanup 中处理。
 */

import type {
  BlueprintActionConfig,
  ConditionExpression,
  ConditionOperator,
  ConditionValueSource,
} from '@nebula/shared';
import type { CompiledCondition, CompiledRule } from '../compiler/types.js';
import { interpolateActionConfig, type TemplateContext } from '../lib/template-interpolation.js';
import { collectRules } from './matcher.js';
import { planActions, MAX_TRIGGER_DEPTH } from './plan.js';
import type { ActionResult, RuleExecutionLog, RuntimeDeps, TriggerEventType } from './types.js';

/**
 * 执行一条规则的所有动作。
 *
 * - 单条规则内动作按顺序执行
 * - 前一个动作失败不中断后续独立动作
 * - dangling 动作跳过并记录
 * - 深度截断的动作不执行并记录告警
 * - condition 节点按表达式求值结果选择 then/else 分支
 *
 * @returns 执行日志（用于调试面板）
 */
export async function executeRule(
  rule: CompiledRule,
  event: TriggerEventType,
  deps: RuntimeDeps,
): Promise<RuleExecutionLog> {
  const plan = planActions(rule);
  const results: ActionResult[] = [];
  const templateContext = buildTemplateContext(event, deps);

  // 深度截断告警
  for (const warning of plan.truncationWarnings) {
    deps.logWarning(`动作 ${warning.nodeId} 深度 ${warning.depth} 超过上限，已截断`);
  }

  // 1. 执行主链动作（condition 之前的 actions）
  for (const action of plan.actions) {
    const interpolated = interpolateActionConfig(action.config, templateContext);
    const result = await executeAction(action.nodeId, interpolated, deps);
    results.push(result);
  }

  // 2. 按拓扑顺序执行 condition 节点
  for (const condition of rule.conditions) {
    const branchResult = await executeCondition(condition, event, deps, templateContext, results);
    // branchResult 为 true 表示至少执行了一个分支动作；condition 节点本身不计入 results
    void branchResult;
  }

  return {
    triggerNodeId: rule.triggerNodeId,
    results,
    truncated: plan.truncationWarnings.length > 0,
  };
}

/**
 * 执行单个 condition 节点。
 *
 * - 根据表达式求值结果选择 then/else 分支
 * - 分支内动作按顺序执行，同样应用模板插值
 * - 返回是否执行了任意动作（用于日志统计）
 */
async function executeCondition(
  condition: CompiledCondition,
  event: TriggerEventType,
  deps: RuntimeDeps,
  templateContext: TemplateContext,
  results: ActionResult[],
): Promise<boolean> {
  const branch = evaluateConditionExpression(condition.config.expression, event, deps)
    ? condition.thenActions
    : condition.elseActions;

  if (branch.length === 0) {
    return false;
  }

  let executed = false;
  for (const action of branch) {
    // condition 分支内动作若超出深度上限，同样截断
    if (action.depth >= MAX_TRIGGER_DEPTH) {
      deps.logWarning(`动作 ${action.nodeId} 深度 ${action.depth} 超过上限，已截断`);
      continue;
    }
    const interpolated = interpolateActionConfig(action.config, templateContext);
    const result = await executeAction(action.nodeId, interpolated, deps);
    results.push(result);
    executed = true;
  }
  return executed;
}

/**
 * 求值条件表达式。
 *
 * - componentProp：读取触发组件的 props[key]
 * - componentData：读取触发组件最新解析数据 path（点分隔）
 * - 字段缺失或类型不匹配时，按运算符语义降级（空值对 empty/notEmpty 有效，其余为 false）
 */
function evaluateConditionExpression(
  expression: ConditionExpression,
  event: TriggerEventType,
  deps: RuntimeDeps,
): boolean {
  const actualValue = resolveConditionSource(expression.source, event, deps);
  return compareValue(actualValue, expression.operator, expression.value);
}

/** 解析条件表达式的左值来源 */
function resolveConditionSource(
  source: ConditionValueSource,
  event: TriggerEventType,
  deps: RuntimeDeps,
): unknown {
  const componentId = getEventComponentId(event);
  if (source.kind === 'componentProp') {
    // 若 source 指定了 componentId 则使用指定组件，否则回退到事件触发组件
    const targetId = source.componentId || componentId;
    if (!targetId) return undefined;
    const value = deps.getComponentValue(targetId);
    if (value == null || typeof value !== 'object') return value;
    return (value as Record<string, unknown>)[source.key];
  }

  if (source.kind === 'componentData') {
    const targetId = source.componentId || componentId;
    if (!targetId) return undefined;
    const data = deps.getComponentData(targetId);
    if (data == null) return undefined;
    return resolvePath(data, source.path);
  }

  return undefined;
}

/** 从触发事件中提取组件 ID（若存在） */
function getEventComponentId(event: TriggerEventType): string | undefined {
  switch (event.kind) {
    case 'componentClick':
    case 'componentHover':
    case 'dataLoaded':
    case 'dataError':
      return event.componentId;
    case 'pageLoad':
    case 'interval':
    default:
      return undefined;
  }
}

/** 按点分隔路径从对象中取值 */
function resolvePath(data: Record<string, unknown>, path: string): unknown {
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
      // 数字与字符串比较时，尝试数字比较
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

/**
 * 根据触发事件构造模板插值上下文。
 *
 * - componentClick/componentHover/dataLoaded/dataError：trigger 为事件对应组件
 * - pageLoad/interval：无 trigger 组件上下文，仅保留 event 基本信息
 */
function buildTemplateContext(event: TriggerEventType, deps: RuntimeDeps): TemplateContext {
  const context: TemplateContext = {
    event: { componentId: getEventComponentId(event) },
  };

  if (
    event.kind === 'componentClick' ||
    event.kind === 'componentHover' ||
    event.kind === 'dataLoaded' ||
    event.kind === 'dataError'
  ) {
    const componentId = event.componentId;
    context.trigger = {
      value: deps.getComponentValue(componentId),
      data: deps.getComponentData(componentId),
    };
  }

  if (event.kind === 'dataError') {
    context.event = { ...context.event, error: event.error };
  }

  return context;
}

/**
 * 执行单个动作。
 *
 * 包裹 try/catch，失败不抛出，返回 failure 结果。
 */
async function executeAction(
  nodeId: string,
  config: BlueprintActionConfig,
  deps: RuntimeDeps,
): Promise<ActionResult> {
  const start = performance.now();
  try {
    switch (config.type) {
      case 'setVisibility':
        if (!deps.hasComponent(config.targetComponentId)) {
          return {
            kind: 'skipped',
            nodeId,
            reason: `目标组件 ${config.targetComponentId} 不存在（dangling）`,
          };
        }
        executeSetVisibility(config.targetComponentId, config.visible, deps);
        return { kind: 'success', nodeId, durationMs: elapsed(start) };

      case 'navigate':
        executeNavigate(config.url, config.target, deps);
        return { kind: 'success', nodeId, durationMs: elapsed(start) };

      case 'scrollToComponent':
        if (!deps.hasComponent(config.targetComponentId)) {
          return {
            kind: 'skipped',
            nodeId,
            reason: `目标组件 ${config.targetComponentId} 不存在（dangling）`,
          };
        }
        deps.scrollToComponent(config.targetComponentId);
        return { kind: 'success', nodeId, durationMs: elapsed(start) };

      case 'refreshDataSource':
        if (!deps.hasComponent(config.targetComponentId)) {
          return {
            kind: 'skipped',
            nodeId,
            reason: `目标组件 ${config.targetComponentId} 不存在（dangling）`,
          };
        }
        await deps.refreshDataSource(config.targetComponentId);
        return { kind: 'success', nodeId, durationMs: elapsed(start) };

      case 'requestApi': {
        // requestApi 动作（任务 10.4）
        if (config.url === '') {
          return {
            kind: 'skipped',
            nodeId,
            reason: '请求 URL 为空（未配置）',
          };
        }
        // 调用注入的 requestApi，由调用方实现真实 fetch / 沙盒 no-op
        const result = await deps.requestApi({
          method: config.method,
          url: config.url,
          headers: config.headers,
          body: config.body,
          secretHeaderKeys: config.secretHeaderKeys,
          timeoutMs: config.timeoutMs,
        });
        if (!result.ok) {
          return {
            kind: 'failure',
            nodeId,
            error: `HTTP ${result.status}: ${result.bodyPreview.slice(0, 200)}`,
            durationMs: elapsed(start),
          };
        }
        return { kind: 'success', nodeId, durationMs: elapsed(start) };
      }

      default: {
        // 穷尽性检查：未知动作类型跳过
        const _exhaustive: never = config;
        void _exhaustive;
        return { kind: 'skipped', nodeId, reason: '未知动作类型' };
      }
    }
  } catch (err) {
    return {
      kind: 'failure',
      nodeId,
      error: err instanceof Error ? err.message : String(err),
      durationMs: elapsed(start),
    };
  }
}

/** setVisibility：作用于预览可见性覆盖表，不改写项目数据 */
function executeSetVisibility(
  targetComponentId: string,
  mode: 'show' | 'hide' | 'toggle',
  deps: RuntimeDeps,
): void {
  switch (mode) {
    case 'show':
      deps.applyVisibility(targetComponentId, true);
      break;
    case 'hide':
      deps.applyVisibility(targetComponentId, false);
      break;
    case 'toggle': {
      const current = deps.getVisibility(targetComponentId);
      // 当前可见性未覆盖时，默认从组件 status.hidden 读取（调用方注入 getVisibility）
      deps.applyVisibility(targetComponentId, current !== true);
      break;
    }
  }
}

/** navigate：按白名单打开（Schema 已强制 http/https） */
function executeNavigate(url: string, target: '_blank' | '_self', deps: RuntimeDeps): void {
  if (url === '') {
    // 空 URL 由编译器诊断，运行时跳过
    return;
  }
  deps.openUrl(url, target);
}

/**
 * 触发并执行所有匹配的规则。
 *
 * 多规则聚合：按编译顺序依次执行，每条规则独立执行。
 * 不等待前一条规则完成才执行下一条（spec: "单条规则内动作按顺序执行"）。
 *
 * @returns 所有规则的执行日志
 */
export async function triggerAndExecute(
  rules: readonly CompiledRule[],
  event: TriggerEventType,
  deps: RuntimeDeps,
): Promise<RuleExecutionLog[]> {
  const matched = collectRules(rules, event);
  const logs: RuleExecutionLog[] = [];
  for (const rule of matched) {
    const log = await executeRule(rule, event, deps);
    logs.push(log);
  }
  return logs;
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}
