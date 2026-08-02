import type { EventBlueprint } from '@nebula/shared';

export function filterBlueprintByComponent(
  blueprint: EventBlueprint,
  componentId: string,
): Set<string> {
  const result = new Set<string>();
  if (componentId.length === 0) {
    return result;
  }

  const adjacency = new Map<string, Set<string>>();
  for (const edge of blueprint.edges) {
    addAdjacency(adjacency, edge.source, edge.target);
    addAdjacency(adjacency, edge.target, edge.source);
  }

  const queue: string[] = [];
  for (const node of blueprint.nodes) {
    if (node.kind === 'component' && node.componentId === componentId) {
      queue.push(node.id);
      result.add(node.id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!result.has(neighbor)) {
        result.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return result;
}

function addAdjacency(adjacency: Map<string, Set<string>>, from: string, to: string): void {
  const nodes = adjacency.get(from) ?? new Set<string>();
  nodes.add(to);
  adjacency.set(from, nodes);
}
