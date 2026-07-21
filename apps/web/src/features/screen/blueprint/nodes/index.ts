/**
 * 蓝图节点组件模块入口（任务 4.2）
 *
 * 公开 API：
 * - TriggerNode：触发器节点组件（componentClick / pageLoad）
 * - ActionNode：动作节点组件（setVisibility / navigate / scrollToComponent / refreshDataSource）
 * - CommentNode：注释节点组件
 * - BaseNodeShell：共享节点外壳（选中态、dangling 标记态、cycle 标记态）
 * - 类型：TriggerNodeData / ActionNodeData / CommentNodeData / TriggerNode / ActionNode / CommentNode
 */

export { TriggerNode } from './trigger-node';
export { ActionNode } from './action-node';
export { CommentNode } from './comment-node';
export { BaseNodeShell } from './base-node';
export type { NodeColorScheme } from './base-node';

export type {
  ActionNodeData,
  BlueprintNodeData,
  CommentNodeData,
  TriggerNodeData,
} from './node-data-types';
