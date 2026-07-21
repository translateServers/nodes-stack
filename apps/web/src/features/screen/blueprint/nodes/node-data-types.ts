/**
 * 蓝图节点 data 类型定义（任务 4.2）
 *
 * React Flow 节点的 data 字段类型，承载节点渲染所需的额外信息：
 * - 节点显示名称（组件名或注释文本，非裸 id）
 * - 类型图标标识
 * - dangling 标记态（编译器诊断标记，UI 显示红色边框）
 * - 选中态由 React Flow 通过 selected prop 直接提供，无需放入 data
 */

import type {
  BlueprintActionConfig,
  BlueprintTriggerConfig,
  CommentNodeConfig,
} from '@nebula/shared';

/** 触发器节点 data */
export interface TriggerNodeData extends Record<string, unknown> {
  /** 触发器配置（componentClick / pageLoad） */
  config: BlueprintTriggerConfig;
  /** 显示名称（组件名或触发类型标签） */
  label: string;
  /** 关联的组件 id（componentClick 时为触发组件，pageLoad 时为空） */
  componentId?: string;
  /** 是否被编译器标记为 dangling（componentId 在项目中不存在） */
  dangling?: boolean;
  /** 是否被编译器标记为 cycle（节点在执行流环中） */
  inCycle?: boolean;
}

/** 动作节点 data */
export interface ActionNodeData extends Record<string, unknown> {
  /** 动作配置（setVisibility / navigate / scrollToComponent / refreshDataSource） */
  config: BlueprintActionConfig;
  /** 显示名称（目标组件名或动作类型标签） */
  label: string;
  /** 关联的目标组件 id（动作的目标） */
  targetComponentId?: string;
  /** 是否被编译器标记为 dangling */
  dangling?: boolean;
  /** 是否被编译器标记为 cycle */
  inCycle?: boolean;
}

/** 注释节点 data */
export interface CommentNodeData extends Record<string, unknown> {
  /** 注释配置（仅 text 字段） */
  config: CommentNodeConfig;
  /** 显示文本（与 config.text 相同，便于 React Flow 渲染） */
  label: string;
}

/** 节点 data 联合类型，便于类型推断 */
export type BlueprintNodeData = TriggerNodeData | ActionNodeData | CommentNodeData;
