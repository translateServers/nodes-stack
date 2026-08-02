import type { BlueprintIndexes } from './indexes.js';
import type { BlueprintDiagnostic } from './types.js';

type Color = 0 | 1 | 2;

const WHITE: Color = 0;
const GRAY: Color = 1;
const BLACK: Color = 2;

export function detectCycles(indexes: BlueprintIndexes): BlueprintDiagnostic[] {
  const colors = new Map<string, Color>();
  const pathStack: string[] = [];
  const diagnostics: BlueprintDiagnostic[] = [];

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
  indexes: BlueprintIndexes,
  colors: Map<string, Color>,
  pathStack: string[],
  diagnostics: BlueprintDiagnostic[],
): void {
  const color = colors.get(nodeId);
  if (color === BLACK) {
    return;
  }
  if (color === GRAY) {
    const cycleStart = pathStack.indexOf(nodeId);
    if (cycleStart >= 0) {
      diagnostics.push({
        level: 'error',
        code: 'cycle',
        message: `Execution cycle detected: ${[...pathStack.slice(cycleStart), nodeId].join(' -> ')}`,
        nodeId,
      });
    }
    return;
  }

  colors.set(nodeId, GRAY);
  pathStack.push(nodeId);

  for (const edge of indexes.outgoingEdges.get(nodeId) ?? []) {
    const source = indexes.nodes.get(nodeId);
    if (
      source?.kind === 'component' &&
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
