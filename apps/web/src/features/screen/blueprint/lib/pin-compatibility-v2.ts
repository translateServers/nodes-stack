/**
 * V2 引脚兼容性判定
 *
 * V2 蓝图的 handle 格式语义化：
 * - 组件事件输出：`evt:{eventId}`（如 `evt:click`、`evt:pageLoad`）
 * - 组件动作输入：`act:{actionId}`（如 `act:show`、`act:navigate`）
 * - 逻辑节点输出：`out` / `then` / `else`
 * - 逻辑节点输入：`in`
 *
 * 兼容规则：
 * - 源必须是输出锚点（evt:* / out / then / else）
 * - 目标必须是输入锚点（act:* / in）
 * - comment 节点不参与连线
 * - 组件节点允许自环（evt:* → act:* 同节点合法）
 * - 逻辑节点禁止自环（如 condition.out → condition.in）
 * - 不允许重复连线
 *
 * 设计为纯函数，便于单元测试与 React Flow 的 isValidConnection 回调复用。
 */

/** V2 节点类型标识 */
export type V2NodeKind = 'component' | 'condition' | 'delay' | 'comment';

/** V2 节点索引条目 */
export interface V2NodeIndexEntry {
  id: string;
  kind: V2NodeKind;
  /** 仅 component 节点 */
  componentId?: string;
  /** 仅全局节点 */
  globalType?: 'pageLoad' | 'navigate' | 'requestApi' | 'scrollTo';
}

/** V2 节点索引 */
export type V2NodeIndex = ReadonlyMap<string, V2NodeIndexEntry>;

/** V2 边（用于重复检测） */
export interface V2Edge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

/** 连接候选（归一化的连接请求） */
export interface V2ConnectionCandidate {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

/** 不兼容原因 */
export type V2IncompatibilityReason =
  | 'source-node-not-found'
  | 'target-node-not-found'
  | 'comment-node-disconnected'
  | 'source-handle-is-input'
  | 'target-handle-is-output'
  | 'self-loop-logic'
  | 'duplicate-edge';

/** 兼容性检查结果 */
export interface V2CompatibilityResult {
  valid: boolean;
  reason?: V2IncompatibilityReason;
}

/** 事件锚点前缀（组件事件输出） */
const EVENT_HANDLE_PREFIX = 'evt:';

/** 动作锚点前缀（组件动作输入） */
const ACTION_HANDLE_PREFIX = 'act:';

/** 逻辑节点的输出锚点集合 */
const LOGIC_OUTPUT_HANDLES = new Set<string>(['out', 'then', 'else']);

/** 逻辑节点的输入锚点集合 */
const LOGIC_INPUT_HANDLES = new Set<string>(['in']);

/** 逻辑节点类型集合（用于自环判定，禁止自环） */
const LOGIC_NODE_KINDS = new Set<V2NodeKind>(['condition', 'delay']);

/**
 * 判断 handle 是否为输出锚点（源锚点）。
 *
 * - `evt:*` → 输出
 * - `out` / `then` / `else` → 输出
 * - 其他（含 `act:*` / `in`） → 非输出
 */
export function isOutputHandle(handle: string): boolean {
  if (handle.startsWith(EVENT_HANDLE_PREFIX)) return true;
  return LOGIC_OUTPUT_HANDLES.has(handle);
}

/**
 * 判断 handle 是否为输入锚点（目标锚点）。
 *
 * - `act:*` → 输入
 * - `in` → 输入
 * - 其他（含 `evt:*` / `out` / `then` / `else`） → 非输入
 */
export function isInputHandle(handle: string): boolean {
  if (handle.startsWith(ACTION_HANDLE_PREFIX)) return true;
  return LOGIC_INPUT_HANDLES.has(handle);
}

/**
 * 判定连接是否有效。
 *
 * 检查顺序：
 * 1. 源节点不存在 → `source-node-not-found`
 * 2. 目标节点不存在 → `target-node-not-found`
 * 3. 源或目标是 comment 节点 → `comment-node-disconnected`
 * 4. 源 handle 是输入锚点 → `source-handle-is-input`
 * 5. 目标 handle 是输出锚点 → `target-handle-is-output`
 * 6. 逻辑节点自环（source === target 且非 component 节点）→ `self-loop-logic`
 * 7. 重复边 → `duplicate-edge`
 */
export function isConnectionValidV2(
  conn: V2ConnectionCandidate,
  nodeIndex: V2NodeIndex,
  existingEdges: readonly V2Edge[],
): V2CompatibilityResult {
  const sourceNode = nodeIndex.get(conn.source);
  if (!sourceNode) {
    return { valid: false, reason: 'source-node-not-found' };
  }

  const targetNode = nodeIndex.get(conn.target);
  if (!targetNode) {
    return { valid: false, reason: 'target-node-not-found' };
  }

  if (sourceNode.kind === 'comment' || targetNode.kind === 'comment') {
    return { valid: false, reason: 'comment-node-disconnected' };
  }

  if (!isOutputHandle(conn.sourceHandle)) {
    return { valid: false, reason: 'source-handle-is-input' };
  }

  if (!isInputHandle(conn.targetHandle)) {
    return { valid: false, reason: 'target-handle-is-output' };
  }

  // 逻辑节点自环禁止（组件节点允许自环：evt:* → act:* 同节点合法）
  if (conn.source === conn.target && LOGIC_NODE_KINDS.has(sourceNode.kind)) {
    return { valid: false, reason: 'self-loop-logic' };
  }

  if (hasDuplicateEdgeV2(conn, existingEdges)) {
    return { valid: false, reason: 'duplicate-edge' };
  }

  return { valid: true };
}

/** 检测候选连接是否与现有边重复 */
export function hasDuplicateEdgeV2(
  conn: V2ConnectionCandidate,
  existingEdges: readonly V2Edge[],
): boolean {
  return existingEdges.some(
    (edge) =>
      edge.source === conn.source &&
      edge.sourceHandle === conn.sourceHandle &&
      edge.target === conn.target &&
      edge.targetHandle === conn.targetHandle,
  );
}

/**
 * 获取指定源锚点的所有兼容目标节点 ID（供磁吸高亮）。
 *
 * 遍历 nodeIndex，返回所有非 comment 节点；如果源是逻辑节点，则排除自身
 * （逻辑节点禁止自环）；组件节点源允许自环，因此不排除自身。
 *
 * 注意：此函数只返回兼容的节点 ID 列表。调用方需自行从组件注册表查询
 * 具体的 `act:*` 锚点列表（组件节点）或使用 `in` 锚点（逻辑节点）。
 */
export function getCompatibleTargetNodesV2(
  sourceNodeId: string,
  sourceHandle: string,
  nodeIndex: V2NodeIndex,
): string[] {
  const sourceNode = nodeIndex.get(sourceNodeId);
  if (!sourceNode || sourceNode.kind === 'comment') {
    return [];
  }

  if (!isOutputHandle(sourceHandle)) {
    return [];
  }

  const result: string[] = [];
  for (const [nodeId, node] of nodeIndex) {
    if (node.kind === 'comment') continue;
    // 逻辑节点源排除自身（避免自环）
    if (LOGIC_NODE_KINDS.has(sourceNode.kind) && nodeId === sourceNodeId) continue;
    result.push(nodeId);
  }
  return result;
}
