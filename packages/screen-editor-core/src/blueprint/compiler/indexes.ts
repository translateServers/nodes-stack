import type { BlueprintEdge, BlueprintNode, EventBlueprint } from '@nebula/shared';

import type { BlueprintDiagnostic } from './types.js';

export interface NodeIndexEntry {
  readonly id: string;
  readonly kind: 'component' | 'condition' | 'delay' | 'comment';
  readonly componentId?: string;
  readonly globalType?: string;
  readonly node: BlueprintNode;
}

export type NodeIndex = Map<string, NodeIndexEntry>;
export type EdgeIndex = Map<string, BlueprintEdge[]>;

export interface BlueprintIndexes {
  readonly nodes: NodeIndex;
  readonly outgoingEdges: EdgeIndex;
  readonly incomingEdges: EdgeIndex;
  readonly diagnostics: BlueprintDiagnostic[];
}

export function buildIndexes(blueprint: EventBlueprint): BlueprintIndexes {
  const nodes: NodeIndex = new Map();
  const outgoingEdges: EdgeIndex = new Map();
  const incomingEdges: EdgeIndex = new Map();
  const diagnostics: BlueprintDiagnostic[] = [];

  for (const node of blueprint.nodes) {
    if (nodes.has(node.id)) {
      diagnostics.push({
        level: 'error',
        code: 'duplicate-node-id',
        message: `Duplicate node id: ${node.id}`,
        nodeId: node.id,
      });
      continue;
    }
    nodes.set(node.id, createNodeIndexEntry(node));
  }

  const edgeIds = new Set<string>();
  for (const edge of blueprint.edges) {
    if (edgeIds.has(edge.id)) {
      diagnostics.push({
        level: 'error',
        code: 'duplicate-edge-id',
        message: `Duplicate edge id: ${edge.id}`,
        edgeId: edge.id,
      });
      continue;
    }
    edgeIds.add(edge.id);

    const outgoing = outgoingEdges.get(edge.source) ?? [];
    outgoing.push(edge);
    outgoingEdges.set(edge.source, outgoing);

    const incoming = incomingEdges.get(edge.target) ?? [];
    incoming.push(edge);
    incomingEdges.set(edge.target, incoming);
  }

  return { nodes, outgoingEdges, incomingEdges, diagnostics };
}

function createNodeIndexEntry(node: BlueprintNode): NodeIndexEntry {
  if (node.kind !== 'component') {
    return { id: node.id, kind: node.kind, node };
  }

  return {
    id: node.id,
    kind: node.kind,
    componentId: node.componentId,
    globalType: node.globalType,
    node,
  };
}
