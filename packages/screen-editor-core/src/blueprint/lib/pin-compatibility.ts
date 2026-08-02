/**
 * 引脚兼容性判定（任务 4.3）
 *
 * 基于 schema 蓝图执行流引脚约定：
 * - trigger：输出 `out`（仅输出）
 * - action：输入 `in`、输出 `out`（支持链式触发）
 * - condition：输入 `in`、输出 `then` / `else`（M3 交付，契约先行预留）
 * - comment：无引脚（不参与执行流）
 *
 * 兼容规则：
 * - 源必须是输出引脚（out / then / else）
 * - 目标必须是输入引脚（in）
 * - comment 节点不能参与连线
 * - 不允许自环（sourceNodeId === targetNodeId）
 * - 不允许重复连线（同一 source-target-handle 组合已存在）
 *
 * 设计为纯函数，便于单元测试与 React Flow 的 isValidConnection 回调复用。
 */

import type { BlueprintEdge, BlueprintNode } from '@nebula/shared';

/** 引脚标识（与 schema 注释一致） */
export type PinId = 'out' | 'in' | 'then' | 'else';

/** 引脚类型（用于兼容判定） */
export type PinKind = 'source' | 'target';

/** 节点类型 → 输出引脚集合 */
export const OUTPUT_PINS: Record<BlueprintNode['kind'], readonly PinId[]> = {
  trigger: ['out'],
  action: ['out'],
  // M3 交付 condition 时改为 ['then', 'else']；当前为空数组表示无输出引脚
  condition: ['then', 'else'],
  comment: [],
};

/** 节点类型 → 输入引脚集合 */
export const INPUT_PINS: Record<BlueprintNode['kind'], readonly PinId[]> = {
  trigger: [],
  action: ['in'],
  condition: ['in'],
  comment: [],
};

/** 引脚是否存在 */
export function hasPin(nodeKind: BlueprintNode['kind'], pinId: PinId, pinKind: PinKind): boolean {
  const pins = pinKind === 'source' ? OUTPUT_PINS[nodeKind] : INPUT_PINS[nodeKind];
  return pins.includes(pinId);
}

/** 节点查找表（id → node） */
export type NodeIndex = ReadonlyMap<string, BlueprintNode>;

/** 引脚兼容性判定结果 */
export type PinCompatibility = {
  /** 是否兼容（可作为合法连线） */
  valid: boolean;
  /** 不兼容原因（valid=false 时有值） */
  reason?: PinIncompatibilityReason;
};

/** 不兼容原因 */
export type PinIncompatibilityReason =
  | 'source-node-not-found'
  | 'target-node-not-found'
  | 'source-pin-not-output'
  | 'target-pin-not-input'
  | 'comment-node-disconnected'
  | 'self-loop'
  | 'duplicate-edge';

/** 连线候选（React Flow onConnect 参数子集） */
export interface ConnectionCandidate {
  sourceNodeId: string;
  sourceHandle: PinId;
  targetNodeId: string;
  targetHandle: PinId;
}

/**
 * 判定两节点引脚之间是否可建立连线。
 *
 * @param candidate 连线候选
 * @param nodes 节点查找表
 * @param existingEdges 当前已存在的边（用于重复检测）
 */
export function isConnectionValid(
  candidate: ConnectionCandidate,
  nodes: NodeIndex,
  existingEdges: readonly BlueprintEdge[],
): PinCompatibility {
  const sourceNode = nodes.get(candidate.sourceNodeId);
  if (!sourceNode) {
    return { valid: false, reason: 'source-node-not-found' };
  }

  const targetNode = nodes.get(candidate.targetNodeId);
  if (!targetNode) {
    return { valid: false, reason: 'target-node-not-found' };
  }

  // comment 节点不参与执行流
  if (sourceNode.kind === 'comment' || targetNode.kind === 'comment') {
    return { valid: false, reason: 'comment-node-disconnected' };
  }

  // 源必须是输出引脚
  if (!hasPin(sourceNode.kind, candidate.sourceHandle, 'source')) {
    return { valid: false, reason: 'source-pin-not-output' };
  }

  // 目标必须是输入引脚
  if (!hasPin(targetNode.kind, candidate.targetHandle, 'target')) {
    return { valid: false, reason: 'target-pin-not-input' };
  }

  // 不允许自环
  if (candidate.sourceNodeId === candidate.targetNodeId) {
    return { valid: false, reason: 'self-loop' };
  }

  // 不允许重复连线（同一 source/target/handle 组合）
  if (hasDuplicateEdge(candidate, existingEdges)) {
    return { valid: false, reason: 'duplicate-edge' };
  }

  return { valid: true };
}

/** 检测候选连线是否与现有边重复 */
export function hasDuplicateEdge(
  candidate: ConnectionCandidate,
  existingEdges: readonly BlueprintEdge[],
): boolean {
  return existingEdges.some(
    (edge) =>
      edge.source === candidate.sourceNodeId &&
      edge.sourceHandle === candidate.sourceHandle &&
      edge.target === candidate.targetNodeId &&
      edge.targetHandle === candidate.targetHandle,
  );
}

/**
 * 获取节点的所有可连接引脚（用于 React Flow 渲染时磁吸高亮）。
 *
 * 给定一个源节点 + 源引脚，返回所有可作为合法目标的 (nodeId, handle) 对。
 */
export function getCompatibleTargetPins(
  sourceNodeId: string,
  sourceHandle: PinId,
  nodes: NodeIndex,
  existingEdges: readonly BlueprintEdge[],
): Array<{ nodeId: string; handle: PinId }> {
  const sourceNode = nodes.get(sourceNodeId);
  if (!sourceNode || sourceNode.kind === 'comment') {
    return [];
  }

  if (!hasPin(sourceNode.kind, sourceHandle, 'source')) {
    return [];
  }

  const result: Array<{ nodeId: string; handle: PinId }> = [];
  for (const [nodeId, node] of nodes) {
    if (node.kind === 'comment') continue;
    if (nodeId === sourceNodeId) continue;

    const inputPins = INPUT_PINS[node.kind];
    for (const handle of inputPins) {
      const candidate: ConnectionCandidate = {
        sourceNodeId,
        sourceHandle,
        targetNodeId: nodeId,
        targetHandle: handle,
      };
      if (isConnectionValid(candidate, nodes, existingEdges).valid) {
        result.push({ nodeId, handle });
      }
    }
  }
  return result;
}
