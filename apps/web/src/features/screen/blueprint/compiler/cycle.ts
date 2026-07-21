/**
 * 环检测（任务 2.3）
 *
 * 基于 DFS 三色标记法：white（未访问）/ gray（在当前 DFS 栈中）/ black（已完成）。
 * 遇到 gray 节点即发现环，记录构成环的节点与边。
 *
 * 仅检测从 trigger 出发可达的环；不可达子图不产生环诊断（由 orphan 诊断处理）。
 */

import type { BlueprintNode } from '@nebula/shared';
import type { BlueprintIndexes, Diagnostic } from './types.js';

type Color = 'white' | 'gray' | 'black';

interface CycleDetectionState {
  colors: Map<string, Color>;
  /** DFS 栈：当前路径上的节点 id */
  pathStack: string[];
  /** 已发现的环（节点 id 列表，从入环节点开始） */
  cycles: string[][];
}

/**
 * 检测从 trigger 节点出发可达的所有环。
 * 返回每个环的节点 id 列表（从入环节点开始，到再次回到入环节点结束）。
 */
export function detectCycles(
  triggers: BlueprintNode[],
  indexes: BlueprintIndexes,
): { cycles: string[][]; diagnostics: Diagnostic[] } {
  const state: CycleDetectionState = {
    colors: new Map(),
    pathStack: [],
    cycles: [],
  };

  // 初始化所有节点为 white
  for (const nodeId of indexes.nodes.keys()) {
    state.colors.set(nodeId, 'white');
  }

  const diagnostics: Diagnostic[] = [];

  // 仅从 trigger 出发检测可达环
  for (const trigger of triggers) {
    visitNode(trigger.id, indexes, state, diagnostics);
  }

  return { cycles: state.cycles, diagnostics };
}

function visitNode(
  nodeId: string,
  indexes: BlueprintIndexes,
  state: CycleDetectionState,
  diagnostics: Diagnostic[],
): void {
  const color = state.colors.get(nodeId);
  if (color === 'black') return; // 已完成
  if (color === 'gray') {
    // 发现环：从 pathStack 中找到当前节点位置，截取环
    const cycleStartIdx = state.pathStack.indexOf(nodeId);
    if (cycleStartIdx !== -1) {
      const cycleNodes = [...state.pathStack.slice(cycleStartIdx), nodeId];
      state.cycles.push(cycleNodes);
      diagnostics.push({
        level: 'error',
        code: 'cycle',
        message: `检测到执行流环：${cycleNodes.join(' → ')}`,
        nodeId,
      });
    }
    return;
  }

  // white → gray，进入 DFS
  state.colors.set(nodeId, 'gray');
  state.pathStack.push(nodeId);

  // 遍历出边
  const outEdges = indexes.outgoingEdges.get(nodeId) ?? [];
  for (const edge of outEdges) {
    visitNode(edge.target, indexes, state, diagnostics);
  }

  // 离开 DFS
  state.pathStack.pop();
  state.colors.set(nodeId, 'black');
}
