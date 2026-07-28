/**
 * V2 蓝图节点 data 类型定义
 *
 * V2 采用"组件即节点"模型，节点 data 承载渲染所需的额外信息：
 * - 显示名称（组件名 / 全局节点子类型标签 / 注释文本）
 * - 组件类型（component 节点派生事件/动作锚点的源）
 * - dangling / inCycle 标记态（与 V1 一致，由编译器诊断标记）
 *
 * 与 V1 差异：
 * - 触发器/动作节点合并为 component 节点，anchors 从 componentType 派生
 * - 新增 global / delay 节点类型
 * - 配置摘要信息保留在 data 上，便于节点正文展示
 */

import type {
  CommentNodeConfig,
  ConditionNodeConfig,
  GlobalIntervalConfig,
  GlobalNavigateConfig,
  GlobalRequestApiConfig,
  GlobalScrollToConfig,
} from '@nebula/shared';

/** 组件节点 data（V2 核心） */
export interface ComponentNodeData extends Record<string, unknown> {
  /** 组件 ID（普通组件为组件实例 id；全局节点固定为 'global'） */
  componentId: string;
  /** 组件类型（普通组件必填，用于派生事件/动作锚点；全局节点缺省） */
  componentType?: string;
  /** 全局节点子类型（普通组件缺省） */
  globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
  /** 显示名称（组件名 / 全局节点子类型标签） */
  label: string;
  /** 是否被编译器标记为 dangling（componentId 不存在于项目） */
  dangling?: boolean;
  /** 是否在执行流环中 */
  inCycle?: boolean;
}

/** 全局 navigate 节点的配置摘要（用于节点正文展示） */
export interface GlobalNavigateSummary {
  url: string;
  target: '_blank' | '_self';
}

/** 全局 requestApi 节点的配置摘要（用于节点正文展示） */
export interface GlobalRequestApiSummary {
  method: string;
  url: string;
}

/** 全局 scrollTo 节点的配置摘要（用于节点正文展示） */
export interface GlobalScrollToSummary {
  targetComponentId: string;
}

/** 全局 interval 节点的配置摘要（用于节点正文展示） */
export interface GlobalIntervalSummary {
  intervalMs: number;
}

/** 全局节点 data（component 节点的子类型，专门用于全局节点） */
export interface GlobalNodeData extends ComponentNodeData {
  globalType: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
  /** 全局节点配置（pageLoad 无 config；navigate/requestApi/scrollTo/interval 必填） */
  config?:
    | GlobalNavigateConfig
    | GlobalRequestApiConfig
    | GlobalScrollToConfig
    | GlobalIntervalConfig;
}

/** 延时节点 data */
export interface DelayNodeData extends Record<string, unknown> {
  /** 延时配置 */
  config: { delayMs: number };
  /** 显示名称（如 "延时 500ms"） */
  label: string;
  /** 是否在执行流环中 */
  inCycle?: boolean;
}

/** 条件节点 data（V2 复用 V1 配置结构） */
export interface ConditionNodeV2Data extends Record<string, unknown> {
  /** 条件配置（含表达式） */
  config: ConditionNodeConfig;
  /** 显示名称（条件表达式摘要） */
  label: string;
  /** 是否被编译器标记为 dangling（引用的组件不存在） */
  dangling?: boolean;
  /** 是否在执行流环中 */
  inCycle?: boolean;
}

/** 注释节点 data（V2 复用 V1 配置结构） */
export interface CommentNodeV2Data extends Record<string, unknown> {
  /** 注释配置 */
  config: CommentNodeConfig;
  /** 显示文本（与 config.text 一致） */
  label: string;
}

/** V2 节点 data 联合类型 */
export type BlueprintNodeV2Data =
  | ComponentNodeData
  | DelayNodeData
  | ConditionNodeV2Data
  | CommentNodeV2Data;
