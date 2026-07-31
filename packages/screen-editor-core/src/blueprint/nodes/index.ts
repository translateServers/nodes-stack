/**
 * 蓝图节点组件模块入口
 *
 * 公开 API：
 *
 * V1（保留供迁移使用）：
 * - TriggerNode：触发器节点组件（componentClick / pageLoad）
 * - ActionNode：动作节点组件（setVisibility / navigate / scrollToComponent / refreshDataSource）
 * - CommentNode：注释节点组件
 * - ConditionNode：条件节点组件（then/else 双输出引脚）
 *
 * V2（组件即节点模型）：
 * - ComponentNode：组件节点组件（动态派生事件/动作锚点）
 * - GlobalNode：全局节点组件（pageLoad / navigate / requestApi / scrollTo）
 * - DelayNode：延时节点组件
 * - V2 复用 V1 的 CommentNode / ConditionNode（配置结构不变）
 *
 * 共享：
 * - BaseNodeShell：共享节点外壳（选中态、dangling 标记态、cycle 标记态、动态锚点、虚线边框）
 * - 类型：NodeColorScheme / AnchorDescriptor / *NodeData
 */

// V1 节点（保留）
export { TriggerNode } from './trigger-node';
export { ActionNode } from './action-node';
export { CommentNode } from './comment-node';
export { ConditionNode, summarizeCondition } from './condition-node';

// V2 节点
export { ComponentNode } from './component-node';
export { GlobalNode } from './global-node';
export { DelayNode } from './delay-node';

// 共享外壳
export { BaseNodeShell } from './base-node';
export type { NodeColorScheme, AnchorDescriptor } from './base-node';

// V1 节点 data 类型
export type {
  ActionNodeData,
  BlueprintNodeData,
  CommentNodeData,
  ConditionNodeData,
  TriggerNodeData,
} from './node-data-types';

// V2 节点 data 类型
export type {
  BlueprintNodeV2Data,
  CommentNodeV2Data,
  ComponentNodeData,
  ConditionNodeV2Data,
  DelayNodeData,
  GlobalNodeData,
  GlobalNavigateSummary,
  GlobalRequestApiSummary,
  GlobalScrollToSummary,
} from './v2-node-data-types';
