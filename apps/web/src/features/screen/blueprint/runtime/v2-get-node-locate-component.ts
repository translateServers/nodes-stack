/**
 * V2 蓝图 → 画布高亮联动：节点关联组件 id 提取
 *
 * 纯函数：从 V2 蓝图节点提取关联的画布组件 id。
 * - component 节点（普通）：取 componentId（非 'global' 时返回）
 * - 全局 scrollTo 节点：取 config.targetComponentId
 * - 全局 pageLoad / navigate / requestApi 节点：无关联画布组件（返回 undefined）
 * - condition / delay / comment 节点：无关联画布组件
 *
 * 设计理由：将"节点 → componentId"映射逻辑提取为纯函数，便于单元测试与复用；
 * Sheet 内 ReactFlow onNodeClick 调用此函数得到 componentId 后通知 screen-editor。
 */

import type { BlueprintNodeV2 } from '@nebula/shared';
import { GLOBAL_COMPONENT_ID } from '@nebula/shared';

/**
 * 从 V2 蓝图节点提取关联的画布组件 id。
 *
 * @param node  V2 蓝图节点
 * @returns 关联的 componentId；不关联画布组件时返回 undefined
 */
export function getV2NodeLocateComponentId(node: BlueprintNodeV2): string | undefined {
  if (node.kind !== 'component') {
    // condition / delay / comment 节点不关联画布组件
    return undefined;
  }

  // 全局节点：仅 scrollTo 关联目标组件
  // 通过 config.globalType 判别联合窄化，确保 targetComponentId 字段存在
  if (node.config?.globalType === 'scrollTo') {
    const targetId = node.config.targetComponentId;
    return targetId.length > 0 ? targetId : undefined;
  }

  // 普通组件节点：componentId 为 'global' 时不关联（全局节点中的 pageLoad/navigate/requestApi）
  if (node.componentId === GLOBAL_COMPONENT_ID) {
    return undefined;
  }

  // 普通组件节点：componentId 为空字符串视为未配置
  return node.componentId.length > 0 ? node.componentId : undefined;
}
