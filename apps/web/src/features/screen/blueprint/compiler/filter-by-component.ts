/**
 * 画布 → 蓝图过滤联动纯函数（任务 9.2）
 *
 * 当画布选中某个组件时，蓝图过滤展示"涉及此组件"的节点与链路。
 *
 * 过滤规则：
 * - trigger.componentClick 节点：config.componentId 匹配选中组件
 * - trigger.pageLoad 节点：不涉及任何具体组件（不返回）
 * - action 节点：config.targetComponentId 匹配选中组件（navigate 动作无 targetComponentId，不返回）
 * - comment 节点：不涉及任何组件（不返回）
 *
 * 链路保留：
 * - 仅保留两端节点都是"涉及节点"的边
 * - 涉及节点之间可能存在多个 action 节点，保留它们之间的执行流边
 *
 * 返回过滤后的 `{ nodes, edges }`；若没有任何涉及节点，返回空数组。
 *
 * 设计理由：纯函数便于单元测试与 Sheet 集成；Sheet 内调用此函数得到过滤视图，
 * 通过 ReactFlow 的 nodes/edges 状态切换为"过滤模式"。
 */

import type { BlueprintNode, EventBlueprint } from '@nebula/shared';

/** 节点是否涉及指定组件 */
function isNodeRelatedToComponent(node: BlueprintNode, componentId: string): boolean {
  if (node.kind === 'trigger') {
    return node.config.type === 'componentClick' && node.config.componentId === componentId;
  }

  if (node.kind === 'action') {
    // navigate 无 targetComponentId；其他动作类型有 targetComponentId
    if (node.config.type === 'navigate') return false;
    return node.config.targetComponentId === componentId;
  }

  // comment / condition（M3 预留）：不涉及组件
  return false;
}

/** 过滤结果：涉及的节点与边 */
export interface FilteredBlueprint {
  /** 涉及的节点（按 blueprint.nodes 原顺序） */
  nodes: BlueprintNode[];
  /** 两端都是涉及节点的边（按 blueprint.edges 原顺序） */
  edges: EventBlueprint['edges'];
}

/**
 * 过滤蓝图，仅保留涉及指定组件的节点与链路。
 *
 * @param blueprint  当前蓝图
 * @param componentId  画布选中的组件 id；为空字符串或 undefined 时返回空结果
 */
export function filterBlueprintByComponent(
  blueprint: EventBlueprint,
  componentId: string | undefined | null,
): FilteredBlueprint {
  // 无选中组件：返回空
  if (!componentId || componentId.length === 0) {
    return { nodes: [], edges: [] };
  }

  const relatedNodes = blueprint.nodes.filter((node) =>
    isNodeRelatedToComponent(node, componentId),
  );

  // 无涉及节点：返回空
  if (relatedNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // 涉及节点 id 集合，用于 O(1) 判断边两端是否都是涉及节点
  const relatedNodeIds = new Set(relatedNodes.map((n) => n.id));

  const relatedEdges = blueprint.edges.filter(
    (edge) => relatedNodeIds.has(edge.source) && relatedNodeIds.has(edge.target),
  );

  return {
    nodes: relatedNodes,
    edges: relatedEdges,
  };
}
