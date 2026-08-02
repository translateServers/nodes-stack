/**
 * 历史 trigger/action 蓝图迁移。
 *
 * 旧图仅在读取持久化数据、导入文件和快照时出现。运行时与保存路径只使用正式的
 * "组件即节点"模型。迁移保留动作链的顺序：旧 action 的后继会展开到最近的可执行
 * source，而不是写入不存在的 action 输出锚点。
 */

import {
  EVENT_BLUEPRINT_VERSION,
  GLOBAL_COMPONENT_ID,
  type BlueprintEdge,
  type BlueprintNode,
  type BlueprintNodePosition,
  type ComponentNode,
  type EventBlueprint,
  type GlobalIntervalConfig,
  type GlobalNavigateConfig,
  type GlobalRequestApiConfig,
  type LegacyBlueprintActionConfig,
  type LegacyBlueprintEdge,
  type LegacyBlueprintNode,
  type LegacyBlueprintTriggerType,
  type LegacyEventBlueprint,
} from './blueprint.schema.js';

export interface BlueprintMigrationWarning {
  /** 触发问题的历史边或节点 ID。 */
  sourceId: string;
  /** 面向维护者的迁移失败说明。 */
  message: string;
}

export interface LegacyBlueprintMigrationResult {
  /** 已转换为正式结构的蓝图。 */
  blueprint: EventBlueprint;
  /** 无法无损转换时的警告；调用方必须拒绝保存或报告该记录。 */
  warnings: BlueprintMigrationWarning[];
}

const TRIGGER_EVENT_ID_MAP: Record<LegacyBlueprintTriggerType, string> = {
  componentClick: 'click',
  componentHover: 'hover',
  dataLoaded: 'dataLoaded',
  dataError: 'dataError',
  pageLoad: 'pageLoad',
  interval: 'interval',
};

function getActionId(config: LegacyBlueprintActionConfig): string {
  switch (config.type) {
    case 'setVisibility':
      if (config.visible === 'show') return 'show';
      if (config.visible === 'hide') return 'hide';
      return 'toggleVisibility';
    case 'scrollToComponent':
      return 'scrollTo';
    case 'refreshDataSource':
      return 'refreshData';
    case 'navigate':
      return 'navigate';
    case 'requestApi':
      return 'requestApi';
  }
}

class BlueprintIdGenerator {
  private readonly usedIds = new Set<string>();

  generate(kind: string, identifier: string): string {
    const base = `blueprint-${kind}-${identifier}`;
    if (!this.usedIds.has(base)) {
      this.usedIds.add(base);
      return base;
    }

    let sequence = 2;
    while (this.usedIds.has(`${base}-${sequence}`)) {
      sequence += 1;
    }
    const id = `${base}-${sequence}`;
    this.usedIds.add(id);
    return id;
  }
}

interface CanonicalSource {
  source: string;
  sourceHandle: string;
}

interface MigrationContext {
  readonly nodeById: ReadonlyMap<string, LegacyBlueprintNode>;
  readonly nodeIdMap: ReadonlyMap<string, string>;
  readonly outgoingEdges: ReadonlyMap<string, readonly LegacyBlueprintEdge[]>;
  readonly warnings: BlueprintMigrationWarning[];
  readonly edges: BlueprintEdge[];
  readonly usedEdgeIds: Set<string>;
}

function buildOutgoingEdges(
  edges: readonly LegacyBlueprintEdge[],
): ReadonlyMap<string, readonly LegacyBlueprintEdge[]> {
  const result = new Map<string, LegacyBlueprintEdge[]>();
  for (const edge of edges) {
    const outgoing = result.get(edge.source) ?? [];
    outgoing.push(edge);
    result.set(edge.source, outgoing);
  }
  return result;
}

function addWarning(context: MigrationContext, sourceId: string, message: string): void {
  context.warnings.push({ sourceId, message });
}

function nextEdgeId(edgeId: string, usedEdgeIds: Set<string>): string {
  if (!usedEdgeIds.has(edgeId)) {
    usedEdgeIds.add(edgeId);
    return edgeId;
  }

  let sequence = 2;
  while (usedEdgeIds.has(`${edgeId}-${sequence}`)) {
    sequence += 1;
  }
  const nextId = `${edgeId}-${sequence}`;
  usedEdgeIds.add(nextId);
  return nextId;
}

function createNode(node: LegacyBlueprintNode, id: string): BlueprintNode {
  if (node.kind === 'trigger') {
    if (node.config.type === 'pageLoad') {
      return {
        id,
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'pageLoad',
        position: node.position,
      };
    }
    if (node.config.type === 'interval') {
      const config: GlobalIntervalConfig = {
        globalType: 'interval',
        intervalMs: node.config.intervalMs,
      };
      return {
        id,
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'interval',
        config,
        position: node.position,
      };
    }
    return {
      id,
      kind: 'component',
      componentId: node.config.componentId,
      position: node.position,
    };
  }

  if (node.kind === 'action') {
    if (node.config.type === 'navigate') {
      const config: GlobalNavigateConfig = {
        globalType: 'navigate',
        url: node.config.url,
        target: node.config.target,
      };
      return {
        id,
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'navigate',
        config,
        position: node.position,
      };
    }
    if (node.config.type === 'requestApi') {
      const config: GlobalRequestApiConfig = {
        globalType: 'requestApi',
        method: node.config.method,
        url: node.config.url,
        headers: node.config.headers,
        body: node.config.body,
        secretHeaderKeys: node.config.secretHeaderKeys,
        timeoutMs: node.config.timeoutMs,
      };
      return {
        id,
        kind: 'component',
        componentId: GLOBAL_COMPONENT_ID,
        globalType: 'requestApi',
        config,
        position: node.position,
      };
    }
    return {
      id,
      kind: 'component',
      componentId: node.config.targetComponentId,
      position: node.position,
    };
  }

  if (node.kind === 'condition') {
    return {
      id,
      kind: 'condition',
      position: node.position,
      config: node.config,
    };
  }

  return {
    id,
    kind: 'comment',
    position: node.position,
    config: node.config,
  };
}

function sourceForTrigger(
  node: Extract<LegacyBlueprintNode, { kind: 'trigger' }>,
  nodeIdMap: ReadonlyMap<string, string>,
): CanonicalSource | undefined {
  const source = nodeIdMap.get(node.id);
  if (source === undefined) return undefined;
  return {
    source,
    sourceHandle: `evt:${TRIGGER_EVENT_ID_MAP[node.config.type]}`,
  };
}

function appendEdge(
  context: MigrationContext,
  edge: LegacyBlueprintEdge,
  source: CanonicalSource,
  target: LegacyBlueprintNode,
): void {
  const canonicalTarget = context.nodeIdMap.get(target.id);
  if (canonicalTarget === undefined) {
    addWarning(context, edge.id, `边 ${edge.id} 的目标节点未在映射表中找到`);
    return;
  }

  if (target.kind === 'action') {
    context.edges.push({
      id: nextEdgeId(edge.id, context.usedEdgeIds),
      source: source.source,
      sourceHandle: source.sourceHandle,
      target: canonicalTarget,
      targetHandle: `act:${getActionId(target.config)}`,
    });
    return;
  }

  if (target.kind === 'condition') {
    context.edges.push({
      id: nextEdgeId(edge.id, context.usedEdgeIds),
      source: source.source,
      sourceHandle: source.sourceHandle,
      target: canonicalTarget,
      targetHandle: 'in',
    });
    return;
  }

  addWarning(context, edge.id, `边 ${edge.id} 指向无法作为正式执行目标的 ${target.kind} 节点`);
}

function migrateEdgeTarget(
  context: MigrationContext,
  edge: LegacyBlueprintEdge,
  source: CanonicalSource,
  path: ReadonlySet<string>,
): void {
  const target = context.nodeById.get(edge.target);
  if (target === undefined) {
    addWarning(context, edge.id, `边引用了不存在的目标节点：${edge.target}`);
    return;
  }

  if (path.has(target.id)) {
    addWarning(context, edge.id, `历史蓝图存在执行流环，无法无损迁移：${target.id}`);
    return;
  }

  appendEdge(context, edge, source, target);
  if (target.kind === 'action') {
    const nextPath = new Set(path);
    nextPath.add(target.id);
    for (const successor of context.outgoingEdges.get(target.id) ?? []) {
      migrateEdgeTarget(context, successor, source, nextPath);
    }
    return;
  }

  if (target.kind === 'condition') {
    const conditionSource = context.nodeIdMap.get(target.id);
    if (conditionSource === undefined) {
      addWarning(context, edge.id, `条件节点 ${target.id} 未在映射表中找到`);
      return;
    }
    const nextPath = new Set(path);
    nextPath.add(target.id);
    for (const successor of context.outgoingEdges.get(target.id) ?? []) {
      if (successor.sourceHandle !== 'then' && successor.sourceHandle !== 'else') {
        addWarning(context, successor.id, `条件节点 ${target.id} 使用了不支持的输出锚点`);
        continue;
      }
      migrateEdgeTarget(
        context,
        successor,
        { source: conditionSource, sourceHandle: successor.sourceHandle },
        nextPath,
      );
    }
  }
}

/**
 * 将历史 trigger/action 图迁移为正式蓝图。
 *
 * 调用方必须在 `warnings` 非空时拒绝持久化该结果。这样历史的非法边和环不会被静默
 * 变成不同语义的正式图。
 */
export function migrateLegacyBlueprint(
  legacyBlueprint: LegacyEventBlueprint,
): LegacyBlueprintMigrationResult {
  const idGenerator = new BlueprintIdGenerator();
  const nodeIdMap = new Map<string, string>();
  const nodeById = new Map(legacyBlueprint.nodes.map((node) => [node.id, node]));
  const nodes: BlueprintNode[] = [];

  for (const node of legacyBlueprint.nodes) {
    const id = idGenerator.generate(node.kind, node.id);
    nodeIdMap.set(node.id, id);
    nodes.push(createNode(node, id));
  }

  const warnings: BlueprintMigrationWarning[] = [];
  const context: MigrationContext = {
    nodeById,
    nodeIdMap,
    outgoingEdges: buildOutgoingEdges(legacyBlueprint.edges),
    warnings,
    edges: [],
    usedEdgeIds: new Set(),
  };

  for (const node of legacyBlueprint.nodes) {
    if (node.kind !== 'trigger') continue;
    const source = sourceForTrigger(node, nodeIdMap);
    if (source === undefined) {
      addWarning(context, node.id, `触发器节点 ${node.id} 未在映射表中找到`);
      continue;
    }
    for (const edge of context.outgoingEdges.get(node.id) ?? []) {
      migrateEdgeTarget(context, edge, source, new Set([node.id]));
    }
  }

  for (const edge of legacyBlueprint.edges) {
    const source = nodeById.get(edge.source);
    if (source === undefined) {
      addWarning(context, edge.id, `边引用了不存在的源节点：${edge.source}`);
      continue;
    }
    if (source.kind === 'comment') {
      addWarning(context, edge.id, `注释节点 ${source.id} 不参与执行流，无法迁移其输出边`);
    }
  }

  return {
    blueprint: {
      version: EVENT_BLUEPRINT_VERSION,
      nodes,
      edges: context.edges,
    },
    warnings,
  };
}
