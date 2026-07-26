/**
 * V2 蓝图索引构建
 *
 * 将线性 nodes[]/edges[] 转换为 O(1) 查找的索引结构：
 * - nodes: 节点 id → 节点索引条目（含 kind / componentId / globalType）
 * - outgoingEdges: 节点 id → 出边列表
 * - incomingEdges: 节点 id → 入边列表
 *
 * 同时检测重复节点 id 与重复边 id（error 诊断）。
 * 边引用不存在的节点时不在此处诊断（由 v2-compile.ts 的 validateNodes 处理）。
 */

import type { BlueprintEdgeV2, BlueprintNodeV2, EventBlueprintV2 } from '@nebula/shared';
import type { V2Diagnostic } from './v2-types.js';

/** V2 节点索引条目 */
export interface V2NodeIndexEntry {
  id: string;
  kind: 'component' | 'condition' | 'delay' | 'comment';
  componentId?: string;
  globalType?: string;
  node: BlueprintNodeV2;
}

export type V2NodeIndex = Map<string, V2NodeIndexEntry>;
export type V2EdgeIndex = Map<string, BlueprintEdgeV2[]>;

export interface V2BlueprintIndexes {
  nodes: V2NodeIndex;
  outgoingEdges: V2EdgeIndex;
  incomingEdges: V2EdgeIndex;
  diagnostics: V2Diagnostic[];
}

/** 构建 V2 索引：节点索引 + 出边/入边索引 + 重复 ID 诊断 */
export function buildV2Indexes(blueprint: EventBlueprintV2): V2BlueprintIndexes {
  const nodes: V2NodeIndex = new Map();
  const outgoingEdges: V2EdgeIndex = new Map();
  const incomingEdges: V2EdgeIndex = new Map();
  const diagnostics: V2Diagnostic[] = [];

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
    nodes.set(node.id, makeNodeIndexEntry(node));
  }

  // 边索引 + 重复 id 检测（边引用不存在节点不在此处诊断）
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

    const out = outgoingEdges.get(edge.source) ?? [];
    out.push(edge);
    outgoingEdges.set(edge.source, out);

    const inc = incomingEdges.get(edge.target) ?? [];
    inc.push(edge);
    incomingEdges.set(edge.target, inc);
  }

  return { nodes, outgoingEdges, incomingEdges, diagnostics };
}

/** 根据节点 kind 构造索引条目，提取 componentId / globalType 用于后续诊断 */
function makeNodeIndexEntry(node: BlueprintNodeV2): V2NodeIndexEntry {
  const entry: V2NodeIndexEntry = {
    id: node.id,
    kind: node.kind,
    node,
  };
  if (node.kind === 'component') {
    entry.componentId = node.componentId;
    entry.globalType = node.globalType;
  }
  return entry;
}
