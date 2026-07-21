/**
 * 蓝图索引构建（任务 2.1/2.2 共用工具）
 *
 * 将线性 nodes[]/edges[] 转换为 O(1) 查找的索引结构。
 * 同时检测重复节点 id 与重复边 id。
 */

import type { EventBlueprint } from '@nebula/shared';
import type { BlueprintIndexes, Diagnostic, EdgeIndex, NodeIndex } from './types.js';

/** 构建节点与边索引，返回诊断（重复 id 等） */
export function buildIndexes(blueprint: EventBlueprint): {
  indexes: BlueprintIndexes;
  diagnostics: Diagnostic[];
} {
  const nodes: NodeIndex = new Map();
  const outgoingEdges: EdgeIndex = new Map();
  const incomingEdges: EdgeIndex = new Map();
  const diagnostics: Diagnostic[] = [];

  // 节点索引 + 重复 id 检测
  for (const node of blueprint.nodes) {
    if (nodes.has(node.id)) {
      diagnostics.push({
        level: 'error',
        code: 'duplicate-node-id',
        message: `节点 id 重复：${node.id}`,
        nodeId: node.id,
      });
      continue;
    }
    nodes.set(node.id, node);
  }

  // 边索引 + 重复 id 检测 + 引用合法性检测
  const seenEdgeIds = new Set<string>();
  for (const edge of blueprint.edges) {
    if (seenEdgeIds.has(edge.id)) {
      diagnostics.push({
        level: 'error',
        code: 'duplicate-edge-id',
        message: `边 id 重复：${edge.id}`,
        edgeId: edge.id,
      });
      continue;
    }
    seenEdgeIds.add(edge.id);

    // source/target 必须存在于节点索引中
    if (!nodes.has(edge.source)) {
      diagnostics.push({
        level: 'error',
        code: 'invalid-edge',
        message: `边的 source 节点不存在：${edge.source}`,
        edgeId: edge.id,
      });
      continue;
    }
    if (!nodes.has(edge.target)) {
      diagnostics.push({
        level: 'error',
        code: 'invalid-edge',
        message: `边的 target 节点不存在：${edge.target}`,
        edgeId: edge.id,
      });
      continue;
    }

    const out = outgoingEdges.get(edge.source) ?? [];
    out.push(edge);
    outgoingEdges.set(edge.source, out);

    const inc = incomingEdges.get(edge.target) ?? [];
    inc.push(edge);
    incomingEdges.set(edge.target, inc);
  }

  return {
    indexes: { nodes, outgoingEdges, incomingEdges },
    diagnostics,
  };
}
