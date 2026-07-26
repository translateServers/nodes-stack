/**
 * V2 环检测
 *
 * 基于 DFS 三色标记法：white(0) 未访问 / gray(1) 在当前 DFS 栈中 / black(2) 已完成。
 * 遇到 gray 目标节点表示存在环（diagnostic: cycle, error）。
 *
 * 例外：组件节点 evt:* → act:* 同节点自环不算环（合法自环，表示组件事件直接触发自身动作）。
 * 逻辑节点（condition/delay）自环（out→in / then→in / else→in 同节点）算环。
 */

import type { V2BlueprintIndexes } from './v2-indexes.js';
import type { V2Diagnostic } from './v2-types.js';

type Color = 0 | 1 | 2;

const WHITE: Color = 0;
const GRAY: Color = 1;
const BLACK: Color = 2;

/** DFS 三色环检测，组件节点 evt→act 同节点自环不算环 */
export function detectV2Cycles(indexes: V2BlueprintIndexes): V2Diagnostic[] {
  const colors = new Map<string, Color>();
  const pathStack: string[] = [];
  const diagnostics: V2Diagnostic[] = [];

  for (const nodeId of indexes.nodes.keys()) {
    colors.set(nodeId, WHITE);
  }

  for (const nodeId of indexes.nodes.keys()) {
    if (colors.get(nodeId) === WHITE) {
      visitNode(nodeId, indexes, colors, pathStack, diagnostics);
    }
  }

  return diagnostics;
}

function visitNode(
  nodeId: string,
  indexes: V2BlueprintIndexes,
  colors: Map<string, Color>,
  pathStack: string[],
  diagnostics: V2Diagnostic[],
): void {
  const color = colors.get(nodeId);
  if (color === BLACK) return;
  if (color === GRAY) {
    const cycleStartIdx = pathStack.indexOf(nodeId);
    if (cycleStartIdx !== -1) {
      const cycleNodes = [...pathStack.slice(cycleStartIdx), nodeId];
      diagnostics.push({
        level: 'error',
        code: 'cycle',
        message: `检测到执行流环：${cycleNodes.join(' → ')}`,
        nodeId,
      });
    }
    return;
  }

  colors.set(nodeId, GRAY);
  pathStack.push(nodeId);

  const outEdges = indexes.outgoingEdges.get(nodeId) ?? [];
  const sourceEntry = indexes.nodes.get(nodeId);
  for (const edge of outEdges) {
    // 组件节点 evt:* → act:* 同节点自环不算环
    if (
      sourceEntry?.kind === 'component' &&
      edge.source === edge.target &&
      edge.sourceHandle.startsWith('evt:') &&
      edge.targetHandle.startsWith('act:')
    ) {
      continue;
    }
    visitNode(edge.target, indexes, colors, pathStack, diagnostics);
  }

  pathStack.pop();
  colors.set(nodeId, BLACK);
}
