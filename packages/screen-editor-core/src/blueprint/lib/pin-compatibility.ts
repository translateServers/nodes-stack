export type BlueprintNodeKind = 'component' | 'condition' | 'delay' | 'comment';

export interface BlueprintNodeIndexEntry {
  id: string;
  kind: BlueprintNodeKind;
  componentId?: string;
  globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo' | 'interval';
}

export type BlueprintNodeIndex = ReadonlyMap<string, BlueprintNodeIndexEntry>;

export interface BlueprintGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly sourceHandle: string;
  readonly target: string;
  readonly targetHandle: string;
}

export interface ConnectionCandidate {
  readonly source: string;
  readonly sourceHandle: string;
  readonly target: string;
  readonly targetHandle: string;
}

export type ConnectionIncompatibilityReason =
  | 'source-node-not-found'
  | 'target-node-not-found'
  | 'comment-node-disconnected'
  | 'source-handle-is-input'
  | 'target-handle-is-output'
  | 'self-loop-logic'
  | 'duplicate-edge';

export interface ConnectionValidationResult {
  readonly valid: boolean;
  readonly reason?: ConnectionIncompatibilityReason;
}

const eventHandlePrefix = 'evt:';
const actionHandlePrefix = 'act:';
const outputHandles = new Set(['out', 'then', 'else']);
const inputHandles = new Set(['in']);
const logicNodeKinds = new Set<BlueprintNodeKind>(['condition', 'delay']);

export function isOutputHandle(handle: string): boolean {
  return handle.startsWith(eventHandlePrefix) || outputHandles.has(handle);
}

export function isInputHandle(handle: string): boolean {
  return handle.startsWith(actionHandlePrefix) || inputHandles.has(handle);
}

export function isConnectionValid(
  connection: ConnectionCandidate,
  nodeIndex: BlueprintNodeIndex,
  existingEdges: readonly BlueprintGraphEdge[],
): ConnectionValidationResult {
  const source = nodeIndex.get(connection.source);
  if (source === undefined) {
    return { valid: false, reason: 'source-node-not-found' };
  }
  const target = nodeIndex.get(connection.target);
  if (target === undefined) {
    return { valid: false, reason: 'target-node-not-found' };
  }
  if (source.kind === 'comment' || target.kind === 'comment') {
    return { valid: false, reason: 'comment-node-disconnected' };
  }
  if (!isOutputHandle(connection.sourceHandle)) {
    return { valid: false, reason: 'source-handle-is-input' };
  }
  if (!isInputHandle(connection.targetHandle)) {
    return { valid: false, reason: 'target-handle-is-output' };
  }
  if (connection.source === connection.target && logicNodeKinds.has(source.kind)) {
    return { valid: false, reason: 'self-loop-logic' };
  }
  if (hasDuplicateEdge(connection, existingEdges)) {
    return { valid: false, reason: 'duplicate-edge' };
  }
  return { valid: true };
}

export function hasDuplicateEdge(
  connection: ConnectionCandidate,
  existingEdges: readonly BlueprintGraphEdge[],
): boolean {
  return existingEdges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.target === connection.target &&
      edge.targetHandle === connection.targetHandle,
  );
}

export function getCompatibleTargetNodes(
  sourceNodeId: string,
  sourceHandle: string,
  nodeIndex: BlueprintNodeIndex,
): string[] {
  const source = nodeIndex.get(sourceNodeId);
  if (source === undefined || source.kind === 'comment' || !isOutputHandle(sourceHandle)) {
    return [];
  }

  return [...nodeIndex].flatMap(([nodeId, node]) => {
    if (node.kind === 'comment' || (logicNodeKinds.has(source.kind) && nodeId === sourceNodeId)) {
      return [];
    }
    return [nodeId];
  });
}
