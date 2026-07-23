/**
 * 蓝图 → 画布高亮联动：节点关联组件 id 提取（任务 9.1）
 *
 * 纯函数：从蓝图节点的 data 字段提取关联的画布组件 id。
 * - trigger 节点：取 `data.componentId`（componentClick 类型才有值；pageLoad 无关联组件）
 * - action 节点：取 `data.targetComponentId`（setVisibility / scrollToComponent / refreshDataSource 有目标组件）
 * - comment 节点：无关联组件
 *
 * 返回 undefined 表示该节点不关联画布组件（不应触发闪烁联动）。
 *
 * 设计理由：将"节点 → componentId"映射逻辑提取为纯函数，便于单元测试与复用；
 * Sheet 内 ReactFlow onNodeClick 调用此函数得到 componentId 后通知 screen-editor。
 */

import type { Node } from '@xyflow/react';
import type {
  BlueprintActionConfig,
  BlueprintTriggerConfig,
  CommentNodeConfig,
} from '@nebula/shared';

/** trigger 节点 data 形状（与 nodes/node-data-types.ts 对齐） */
interface TriggerNodeDataLike {
  config: BlueprintTriggerConfig;
  componentId?: string;
}

/** action 节点 data 形状 */
interface ActionNodeDataLike {
  config: BlueprintActionConfig;
  targetComponentId?: string;
}

/** comment 节点 data 形状 */
interface CommentNodeDataLike {
  config: CommentNodeConfig;
}

/**
 * 从 ReactFlow Node 提取关联的画布组件 id。
 *
 * @param node  ReactFlow 节点（含 data 与 type）
 * @returns 关联的 componentId；不关联画布组件时返回 undefined
 */
export function getNodeLocateComponentId(node: Node): string | undefined {
  const { type, data } = node;

  if (type === 'trigger') {
    const triggerData = data as TriggerNodeDataLike;
    // componentClick：取关联组件 id（空字符串视为未配置，返回 undefined）
    return triggerData.componentId && triggerData.componentId.length > 0
      ? triggerData.componentId
      : undefined;
  }

  if (type === 'action') {
    const actionData = data as ActionNodeDataLike;
    return actionData.targetComponentId && actionData.targetComponentId.length > 0
      ? actionData.targetComponentId
      : undefined;
  }

  // comment 节点：data 为 CommentNodeDataLike，无关联组件
  const _commentData = data as CommentNodeDataLike;
  void _commentData;
  return undefined;
}
