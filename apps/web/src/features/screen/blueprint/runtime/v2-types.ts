/**
 * V2 蓝图运行时类型定义
 *
 * V2 运行时与 V1 平行存在，不修改 V1 类型与运行时文件。
 * 设计差异：
 * - 触发事件为 componentEvent / pageLoad 两类（componentEvent 含 componentId + eventId
 *   + 可选 payload）
 * - RuntimeDeps 返回类型显式化（getComponentValue → Record | undefined；
 *   getComponentData → unknown）
 * - V2ExecuteFunction 接收 readonly V2CompiledRule[] + V2TriggerEvent + V2RuntimeDeps
 */

import type { ConditionExpression } from '@nebula/shared';
import type { V2CompiledRule } from '../compiler/v2-types.js';

/** V2 触发事件类型 */
export type V2TriggerEvent =
  | { kind: 'componentEvent'; componentId: string; eventId: string; payload?: unknown }
  | { kind: 'pageLoad' };

/** V2 动作执行结果 */
export type V2ActionResult =
  | { kind: 'success'; nodeId: string; actionId: string; durationMs: number }
  | { kind: 'skipped'; nodeId: string; actionId: string; reason: string }
  | {
      kind: 'failure';
      nodeId: string;
      actionId: string;
      error: string;
      durationMs: number;
    };

/** V2 规则执行日志 */
export interface V2RuleExecutionLog {
  triggerNodeId: string;
  triggerEventId: string;
  triggerComponentId: string;
  results: V2ActionResult[];
  truncated: boolean;
}

/** V2 RuntimeDeps 接口 */
export interface V2RuntimeDeps {
  hasComponent(componentId: string): boolean;
  getComponentValue(componentId: string): Record<string, unknown> | undefined;
  getComponentData(componentId: string): unknown;
  applyVisibility(componentId: string, visible: boolean): void;
  getVisibility(componentId: string): boolean;
  refreshDataSource(componentId: string): Promise<void>;
  scrollToComponent(componentId: string): void;
  openUrl(url: string, target: '_blank' | '_self'): void;
  requestApi(config: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    secretHeaderKeys: string[];
    timeoutMs: number;
  }): Promise<{ ok: boolean; status: number; bodyPreview: string }>;
  logWarning(message: string): void;
}

/** V2 规则集 + 触发事件 → 执行日志 */
export type V2ExecuteFunction = (
  rules: readonly V2CompiledRule[],
  event: V2TriggerEvent,
  deps: V2RuntimeDeps,
) => Promise<V2RuleExecutionLog[]>;

/** 重导出便于运行时模块统一引用（保持显式来源，避免循环依赖） */
export type { ConditionExpression };
