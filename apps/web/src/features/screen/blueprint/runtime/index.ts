/**
 * 蓝图运行时引擎模块入口
 *
 * 公开 API：
 * - `collectRules`：规则匹配纯函数
 * - `planActions`：执行计划展开纯函数
 * - `executeRule` / `triggerAndExecute`：薄执行器
 * - `useBlueprintRuntimeDeps`：执行器依赖注入 Hook（任务 3.4）
 * - `useBlueprintPreviewRuntime`：预览页蓝图运行时集成 Hook（任务 3.5）
 * - `BlueprintPreviewProvider` / `useBlueprintPreview`：预览上下文（任务 3.5）
 * - 类型：TriggerEventType / RuntimeDeps / ActionResult 等
 */

export { collectRules } from './matcher.js';
export { planActions, isTruncated, MAX_TRIGGER_DEPTH } from './plan.js';
export { executeRule, triggerAndExecute } from './executor.js';
export { useBlueprintRuntimeDeps } from './use-blueprint-runtime-deps.js';
export type { RefreshCompleteHandler } from './use-blueprint-runtime-deps.js';
export { useBlueprintPreviewRuntime } from './use-blueprint-preview-runtime.js';
export type { BlueprintPreviewRuntime } from './use-blueprint-preview-runtime.js';
export { BlueprintPreviewProvider, useBlueprintPreview } from './blueprint-preview-context.js';
export type { BlueprintPreviewContextValue } from './blueprint-preview-context.js';

export type {
  ActionResult,
  ExecutionPlan,
  PlannedAction,
  RuleExecutionLog,
  RuntimeDeps,
  TriggerEventType,
  VisibilityOverrides,
} from './types.js';
