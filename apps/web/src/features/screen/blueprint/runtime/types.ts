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

/** 触发事件类型 */
export type TriggerEventType =
  | { kind: 'componentClick'; componentId: string }
  | { kind: 'pageLoad' };

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
}
