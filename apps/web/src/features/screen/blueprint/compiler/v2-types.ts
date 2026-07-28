/**
 * V2 蓝图编译器类型定义
 *
 * V2 编译器为纯函数：接收 V2 图结构（组件即节点模型）+ 上下文，输出 V2CompiledRule[]
 * 与诊断。每个 rule 描述一条以组件事件为入口的执行链路，steps 为判别联合
 * （action / condition / delay），按数组顺序执行。
 *
 * 与 V1 的差异：
 * - trigger 不再独立成节点，触发信息内联到 rule 的 triggerEventId / triggerComponentId
 * - action / condition / delay 统一为 step，运行时按 step.kind 判别
 * - condition 直接持有 thenSteps / elseSteps（嵌套），运行时递归执行
 * - delay step 保留在编译产物中，运行时通过 sleep(delayMs) 真实等待后继续执行后续步骤
 */

import type {
  ConditionExpression,
  EventBlueprintV2,
  GlobalNavigateConfig,
  GlobalRequestApiConfig,
} from '@nebula/shared';

/** V2 触发事件 ID（语义化，对应 evt:* 锚点） */
export type V2TriggerEventId =
  | 'click'
  | 'hover'
  | 'dataLoaded'
  | 'dataError'
  | 'pageLoad'
  | 'interval';

/** V2 动作 ID（对应 act:* 锚点） */
export type V2ActionId =
  | 'show'
  | 'hide'
  | 'toggleVisibility'
  | 'refreshData'
  | 'scrollTo'
  | 'navigate'
  | 'requestApi';

/** V2 动作步骤配置（navigate / requestApi 全局动作需要全局节点配置） */
export type V2ActionStepConfig =
  | { actionId: 'show' | 'hide' | 'toggleVisibility' | 'refreshData' | 'scrollTo' }
  | { actionId: 'navigate'; config: GlobalNavigateConfig }
  | { actionId: 'requestApi'; config: GlobalRequestApiConfig };

/** V2 编译后动作步骤 */
export interface V2ActionStep {
  kind: 'action';
  /** 动作步骤对应节点 ID（组件动作 → 组件节点；全局动作 → 全局节点） */
  nodeId: string;
  /** 目标组件 ID（show/hide/toggleVisibility/refreshData/scrollTo 必填） */
  componentId: string;
  /** 动作 ID 与配置 */
  config: V2ActionStepConfig;
}

/** V2 编译后条件步骤 */
export interface V2ConditionStep {
  kind: 'condition';
  /** condition 节点 ID */
  nodeId: string;
  /** 条件表达式 */
  expression: ConditionExpression;
  /** then 分支步骤（按顺序执行） */
  thenSteps: V2CompiledStep[];
  /** else 分支步骤（按顺序执行） */
  elseSteps: V2CompiledStep[];
}

/** V2 编译后延时步骤 */
export interface V2DelayStep {
  kind: 'delay';
  /** delay 节点 ID */
  nodeId: string;
  /** 延时时长（毫秒） */
  delayMs: number;
}

/** V2 编译后步骤判别联合 */
export type V2CompiledStep = V2ActionStep | V2ConditionStep | V2DelayStep;

/** V2 编译后规则：以一个组件事件为入口的执行链 */
export interface V2CompiledRule {
  /** 触发节点 ID（组件节点或全局 pageLoad/interval 节点） */
  triggerNodeId: string;
  /** 触发事件 ID（如 'click' / 'pageLoad' / 'interval'） */
  triggerEventId: V2TriggerEventId;
  /** 触发组件 ID（全局 pageLoad/interval 为 'global'；普通组件为组件 ID） */
  triggerComponentId: string;
  /** 步骤链 */
  steps: V2CompiledStep[];
  /** 定时器间隔（毫秒），仅 triggerEventId === 'interval' 时有值；运行时用于 setInterval */
  intervalMs?: number;
}

/** V2 诊断级别 */
export type V2DiagnosticLevel = 'error' | 'warning' | 'info';

/** V2 诊断码 */
export type V2DiagnosticCode =
  | 'cycle'
  | 'dangling-component'
  | 'empty-config'
  | 'invalid-delay'
  | 'duplicate-node-id'
  | 'duplicate-edge-id'
  | 'invalid-edge-handle';

/** V2 诊断信息 */
export interface V2Diagnostic {
  level: V2DiagnosticLevel;
  code: V2DiagnosticCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/** V2 编译结果 */
export interface V2CompileResult {
  rules: V2CompiledRule[];
  diagnostics: V2Diagnostic[];
}

/** V2 编译上下文 */
export interface V2CompileContext {
  componentIds: Set<string>;
}

/** V2 编译器输入 */
export interface V2CompileInput {
  blueprint: EventBlueprintV2;
  context: V2CompileContext;
}

/** 最大编译深度（防死循环） */
export const MAX_COMPILE_DEPTH_V2 = 100;
