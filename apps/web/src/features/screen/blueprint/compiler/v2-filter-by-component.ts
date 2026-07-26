/**
 * V2 蓝图按组件过滤
 *
 * 返回与指定组件相关的节点 ID 集合（BFS 双向遍历）。
 * 用于画布选中组件时，蓝图过滤展示涉及此组件的节点与链路。
 *
 * 起点：componentId 匹配的所有 component 节点（节点 componentId 字段 === 入参 componentId）。
 * 遍历：沿 outgoingEdges + incomingEdges 双向 BFS，收集所有可达节点 ID。
 */

import type { EventBlueprintV2 } from '@nebula/shared';

/** 返回与指定组件相关的节点 ID 集合（BFS 双向遍历） */
export function filterV2BlueprintByComponent(
  blueprint: EventBlueprintV2,
  componentId: string,
): Set<string> {
  const result = new Set<string>();

  if (componentId.length === 0) return result;

  // 邻接表：双向（出 + 入）
  const adjacency = new Map<string, Set<string>>();
  for (const edge of blueprint.edges) {
    addAdjacency(adjacency, edge.source, edge.target);
    addAdjacency(adjacency, edge.target, edge.source);
  }

  // 起始节点：componentId 匹配的所有 component 节点
  const queue: string[] = [];
  for (const node of blueprint.nodes) {
    if (node.kind === 'component' && node.componentId === componentId) {
      queue.push(node.id);
      result.add(node.id);
    }
  }

  // BFS 双向遍历
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!result.has(neighbor)) {
        result.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return result;
}

function addAdjacency(adjacency: Map<string, Set<string>>, from: string, to: string): void {
  let set = adjacency.get(from);
  if (!set) {
    set = new Set();
    adjacency.set(from, set);
  }
  set.add(to);
}
