/**
 * 动作执行器（任务 3.3）
 *
 * 薄执行器：依赖注入 RuntimeDeps 处理副作用（DOM / fetch / 状态）。
 * - setVisibility：写入预览可见性覆盖表，不改写项目数据
 * - navigate：按白名单打开（Schema 已强制 http/https，运行时仅执行）
 * - scrollToComponent：平滑滚动至目标组件
 * - refreshDataSource：复用阶段 2 取消协议（任务 3.4 接线）
 * - dangling 动作跳过并记录（spec: "dangling 动作运行时跳过并记录"）
 * - 失败动作不中断后续独立动作（spec: "前一个动作失败不中断后续独立动作"）
 *
 * 页面卸载清理（spec "页面卸载清理"）由调用方在 useEffect cleanup 中处理。
 */

import type { CompiledRule } from '../compiler/types.js';
import { collectRules } from './matcher.js';
import { planActions } from './plan.js';
import type { ActionResult, RuleExecutionLog, RuntimeDeps, TriggerEventType } from './types.js';

/**
 * 执行一条规则的所有动作。
 *
 * - 单条规则内动作按顺序执行
 * - 前一个动作失败不中断后续独立动作
 * - dangling 动作跳过并记录
 * - 深度截断的动作不执行并记录告警
 *
 * @returns 执行日志（用于调试面板）
 */
export async function executeRule(
  rule: CompiledRule,
  deps: RuntimeDeps,
): Promise<RuleExecutionLog> {
  const plan = planActions(rule);
  const results: ActionResult[] = [];

  // 深度截断告警
  for (const warning of plan.truncationWarnings) {
    deps.logWarning(`动作 ${warning.nodeId} 深度 ${warning.depth} 超过上限，已截断`);
  }

  // 按顺序执行动作
  for (const action of plan.actions) {
    const result = await executeAction(action.nodeId, action.config, deps);
    results.push(result);
  }

  return {
    triggerNodeId: rule.triggerNodeId,
    results,
    truncated: plan.truncationWarnings.length > 0,
  };
}

/**
 * 执行单个动作。
 *
 * 包裹 try/catch，失败不抛出，返回 failure 结果。
 */
async function executeAction(
  nodeId: string,
  config: CompiledRule['actions'][number]['config'],
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
    const log = await executeRule(rule, deps);
    logs.push(log);
  }
  return logs;
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}
