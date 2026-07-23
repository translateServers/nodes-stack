/**
 * 蓝图编译器类型定义（任务 2.1）
 *
 * 编译器为纯函数：接收图结构 + 上下文，输出编译结果与诊断。
 * 不发起 IO、不产生副作用。
 */

import type {
  BlueprintActionConfig,
  BlueprintEdge,
  BlueprintNode,
  BlueprintTriggerConfig,
  ConditionNodeConfig,
  EventBlueprint,
} from '@nebula/shared';

/** 诊断级别 */
export type DiagnosticLevel = 'error' | 'warning' | 'info';

/** 诊断码：标识诊断类别，便于 UI 过滤与国际化 */
export type DiagnosticCode =
  | 'cycle'
  | 'dangling-component'
  | 'empty-param'
  | 'orphan-subgraph'
  | 'duplicate-node-id'
  | 'duplicate-edge-id'
  | 'invalid-edge';

/**
 * 单条诊断信息
 *
 * - `nodeId` / `edgeId`：定位到具体节点或边，便于画布高亮与点击聚焦
 * - `fieldPath`：定位到节点配置的某个字段（空参数诊断）
 * - `message`：面向用户可读，可用于 UI 问题面板
 */
export interface Diagnostic {
  level: DiagnosticLevel;
  code: DiagnosticCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
  fieldPath?: string[];
}

/** 编译后的动作：节点 id + 配置 + 在链路中的深度 */
export interface CompiledAction {
  nodeId: string;
  config: BlueprintActionConfig;
  /** 在触发链路中的深度：trigger 直连为 0，每经过一个节点 +1 */
  depth: number;
}

/**
 * 编译后的条件分支（任务 10.1）
 *
 * condition 节点在编译期无法预知表达式求值结果，
 * 因此同时保留 then 与 else 两条分支的动作链。
 * 运行时（任务 10.3）根据表达式求值结果选择对应分支执行。
 *
 * - `thenActions`：condition 节点 `then` 输出引脚连接的动作链（按拓扑顺序）
 * - `elseActions`：condition 节点 `else` 输出引脚连接的动作链（按拓扑顺序）
 * - 未连接的分支引脚对应空数组（合法，运行时跳过该分支）
 */
export interface CompiledCondition {
  nodeId: string;
  config: ConditionNodeConfig;
  /** then 分支动作链（按拓扑顺序，深度相对 trigger） */
  thenActions: CompiledAction[];
  /** else 分支动作链（按拓扑顺序，深度相对 trigger） */
  elseActions: CompiledAction[];
  /** condition 节点在触发链路中的深度：trigger 直连为 0，每经过一个节点 +1 */
  depth: number;
}

/** 编译后的规则：以一个 trigger 为入口的线性动作链 + 条件分支集合 */
export interface CompiledRule {
  triggerNodeId: string;
  triggerConfig: BlueprintTriggerConfig;
  actions: CompiledAction[];
  /** 条件分支：链路中所有 condition 节点，按拓扑顺序 */
  conditions: CompiledCondition[];
}

/** 编译结果：规则集 + 诊断列表 */
export interface CompileResult {
  rules: CompiledRule[];
  diagnostics: Diagnostic[];
}

/** 编译上下文：提供 componentId 校验所需的项目组件列表 */
export interface CompileContext {
  /** 项目中所有组件的 id 集合（用于悬空引用诊断） */
  componentIds: Set<string>;
}

/** 编译器输入：蓝图 + 上下文 */
export interface CompileInput {
  blueprint: EventBlueprint;
  context: CompileContext;
}

/** 节点索引：id → node，便于 O(1) 查找 */
export type NodeIndex = Map<string, BlueprintNode>;

/** 边索引：sourceId → edges[]，便于从节点出发查找后继 */
export type EdgeIndex = Map<string, BlueprintEdge[]>;

/** 索引结构：节点索引 + 边索引 + 反向边索引（环检测与拓扑排序共用） */
export interface BlueprintIndexes {
  nodes: NodeIndex;
  outgoingEdges: EdgeIndex;
  incomingEdges: EdgeIndex;
}
