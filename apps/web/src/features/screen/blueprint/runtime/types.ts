/**
 * 蓝图运行时类型定义（任务 3.1）
 *
 * 运行时分为两层：
 * 1. 纯函数层（matcher.ts / plan.ts）：规则匹配与执行计划展开，可单元测试
 * 2. 执行器层（executor.ts）：薄执行器，依赖 DOM / fetch 等副作用，仅用于预览与沙盒
 *
 * 编辑器画布不触发蓝图（见 spec "编辑器画布不触发蓝图"）。
 */

import type { CompiledRule } from '../compiler/types.js';

/** 触发事件类型（M1 + 任务 10.3 扩展） */
export type TriggerEventType =
  | { kind: 'componentClick'; componentId: string }
  | { kind: 'pageLoad' }
  | { kind: 'componentHover'; componentId: string }
  | { kind: 'dataLoaded'; componentId: string }
  | { kind: 'dataError'; componentId: string; error?: string }
  | { kind: 'interval' };

/** 执行计划项：一个动作 + 在链路中的深度 */
export interface PlannedAction {
  nodeId: string;
  config: CompiledRule['actions'][number]['config'];
  depth: number;
}

/** 执行计划结果：含截断告警 */
export interface ExecutionPlan {
  actions: PlannedAction[];
  /** 深度截断时记录的告警（深度超过上限） */
  truncationWarnings: Array<{ nodeId: string; depth: number }>;
}

/** 单条动作执行结果 */
export type ActionResult =
  | { kind: 'success'; nodeId: string; durationMs: number }
  | { kind: 'skipped'; nodeId: string; reason: string }
  | { kind: 'failure'; nodeId: string; error: string; durationMs: number };

/** 规则执行日志：一条规则执行后产出 */
export interface RuleExecutionLog {
  triggerNodeId: string;
  results: ActionResult[];
  /** 规则执行是否因深度截断而中止 */
  truncated: boolean;
}

/** 运行时可见性覆盖表：预览中 setVisibility 动作写入此表，不改写项目数据 */
export type VisibilityOverrides = Map<string, boolean>;

/** 运行时执行器依赖：将副作用注入，便于测试与隔离 */
export interface RuntimeDeps {
  /** 应用可见性覆盖（不改写项目数据） */
  applyVisibility: (componentId: string, visible: boolean) => void;
  /** 读取当前可见性覆盖（用于 toggle 判定） */
  getVisibility: (componentId: string) => boolean | undefined;
  /** 打开 URL（navigate 动作） */
  openUrl: (url: string, target: '_blank' | '_self') => void;
  /** 滚动到组件位置（scrollToComponent 动作） */
  scrollToComponent: (componentId: string) => void;
  /** 刷新组件数据源（refreshDataSource 动作）—返回可取消的 Promise */
  refreshDataSource: (componentId: string) => Promise<void>;
  /** 检查组件是否在项目中存在（dangling 跳过判定） */
  hasComponent: (componentId: string) => boolean;
  /** 记录运行时告警（深度截断等） */
  logWarning: (message: string) => void;
  /** 发起 HTTP 请求（requestApi 动作，任务 10.4）
   *
   * @param params 已完成模板插值的请求参数（headers 已脱敏前传入，由执行器内部按 secretHeaderKeys 脱敏日志）
   * @returns 响应状态码与简要正文摘要（避免日志膨胀）
   */
  requestApi: (params: RequestApiRuntimeParams) => Promise<RequestApiRuntimeResult>;
  /** 读取组件 props.value（用于模板插值 {{trigger.value}}） */
  getComponentValue: (componentId: string) => unknown;
  /** 读取组件最新解析数据（用于模板插值 {{trigger.data.xxx}}） */
  getComponentData: (componentId: string) => Record<string, unknown> | undefined;
}

/** requestApi 运行时请求参数（任务 10.4） */
export interface RequestApiRuntimeParams {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body: string;
  secretHeaderKeys: readonly string[];
  timeoutMs: number;
}

/** requestApi 运行时响应结果（任务 10.4） */
export interface RequestApiRuntimeResult {
  /** HTTP 状态码 */
  status: number;
  /** 响应正文摘要（前 500 字符，避免日志膨胀） */
  bodyPreview: string;
  /** 是否成功（2xx 视为成功） */
  ok: boolean;
}
