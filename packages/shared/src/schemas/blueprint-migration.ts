/**
 * V1 → V2 蓝图迁移（事件蓝图 Spec 迁移任务）
 *
 * V1 蓝图节点：trigger / action / condition / comment
 * V2 蓝图节点：component（含全局子类型）/ condition / delay / comment
 *
 * 迁移核心：
 * - V1 trigger/action 节点淘汰，触发器变为组件节点的输出锚点（evt:*）
 * - 动作变为组件节点的输入锚点（act:*）
 * - pageLoad / navigate / requestApi 提升为全局节点单例
 * - 同一组件的多个 trigger/action 合并为一个组件节点
 *
 * 非破坏原则：无法精确推导的边保留原 handle 并产出 warning，由编译器诊断处理。
 */

import {
  EVENT_BLUEPRINT_VERSION_V2,
  GLOBAL_COMPONENT_ID,
  type BlueprintActionConfig,
  type BlueprintEdgeV2,
  type BlueprintNodePosition,
  type BlueprintNodeV2,
  type BlueprintTriggerType,
  type ComponentNode,
  type EventBlueprint,
  type EventBlueprintV2,
  type GlobalNavigateConfig,
  type GlobalRequestApiConfig,
} from './blueprint.schema.js';

export interface MigrationWarning {
  /** V1 边 ID 或节点 ID */
  sourceId: string;
  /** 警告消息 */
  message: string;
}

export interface MigrationResult {
  /** 迁移后的 V2 蓝图 */
  blueprint: EventBlueprintV2;
  /** 迁移警告（无法推导的边、空配置等） */
  warnings: MigrationWarning[];
}

/** V1 trigger type → V2 eventId 映射 */
const TRIGGER_EVENT_ID_MAP: Record<BlueprintTriggerType, string> = {
  componentClick: 'click',
  componentHover: 'hover',
  dataLoaded: 'dataLoaded',
  dataError: 'dataError',
  pageLoad: 'pageLoad',
  interval: 'interval',
};

/**
 * 根据 V1 action 配置推导 V2 actionId（用于边 targetHandle 推导）
 *
 * setVisibility 按 visible 字段细分为 show / hide / toggleVisibility
 */
function getActionId(config: BlueprintActionConfig): string {
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

/**
 * V2 节点 ID 生成器
 *
 * 格式：`v2-{kind}-{identifier}`，重复时加序号（-2, -3, ...）
 */
class V2IdGenerator {
  private usedIds = new Set<string>();

  generate(kind: string, identifier: string): string {
    const base = `v2-${kind}-${identifier}`;
    if (!this.usedIds.has(base)) {
      this.usedIds.add(base);
      return base;
    }
    let seq = 2;
    while (this.usedIds.has(`${base}-${seq}`)) {
      seq += 1;
    }
    const id = `${base}-${seq}`;
    this.usedIds.add(id);
    return id;
  }
}

/** 组件节点分组（按 componentId 合并 trigger/action） */
interface ComponentGroup {
  componentId: string;
  position: BlueprintNodePosition;
  v2NodeId: string;
}

/**
 * 将 V1 事件蓝图迁移为 V2 蓝图
 *
 * 迁移步骤：
 * 1. 遍历 V1 节点，按组件 ID 分组创建 V2 组件节点（合并同组件的 trigger/action）
 * 2. 创建全局节点（pageLoad / navigate / requestApi 单例）
 * 3. 保留 condition / comment 节点
 * 4. 建立 V1 nodeId → V2 nodeId 映射表
 * 5. 遍历 V1 边，用映射表重写 source/target，推导 handle
 * 6. 无法推导的边保留但加入 warnings
 */
export function migrateBlueprintV1ToV2(v1: EventBlueprint): MigrationResult {
  const warnings: MigrationWarning[] = [];
  const idGen = new V2IdGenerator();

  const v2Nodes: BlueprintNodeV2[] = [];
  const nodeIdMap = new Map<string, string>();
  const componentGroups = new Map<string, ComponentGroup>();

  // 全局节点单例状态
  let pageLoadV2Id: string | undefined;
  let pageLoadPosition: BlueprintNodePosition | undefined;
  let navigateV2Id: string | undefined;
  let navigatePosition: BlueprintNodePosition | undefined;
  let navigateConfig: GlobalNavigateConfig | undefined;
  let requestApiV2Id: string | undefined;
  let requestApiPosition: BlueprintNodePosition | undefined;
  let requestApiConfig: GlobalRequestApiConfig | undefined;

  // ===== 第一阶段：遍历 V1 节点，建立映射 + 创建 condition/comment 节点 =====
  for (const node of v1.nodes) {
    if (node.kind === 'trigger') {
      const config = node.config;
      if (config.type === 'pageLoad') {
        // 全局 pageLoad 节点：多个 pageLoad trigger 合并为一个
        if (pageLoadV2Id === undefined) {
          pageLoadV2Id = idGen.generate('component', 'pageLoad');
          pageLoadPosition = node.position;
        }
        nodeIdMap.set(node.id, pageLoadV2Id);
      } else if (config.type === 'interval') {
        // interval trigger：V1 schema 无 componentId 字段
        // V2 暂不特殊处理 interval 行为，迁移为 componentId 为空的组件节点
        // 使用特殊 groupKey 避免与其他空 componentId 的组件合并
        const groupKey = '__interval__';
        let group = componentGroups.get(groupKey);
        if (group === undefined) {
          const v2Id = idGen.generate('component', 'interval');
          group = { componentId: '', position: node.position, v2NodeId: v2Id };
          componentGroups.set(groupKey, group);
        }
        nodeIdMap.set(node.id, group.v2NodeId);
      } else {
        // 组件 trigger：componentClick / componentHover / dataLoaded / dataError
        const componentId = config.componentId;
        let group = componentGroups.get(componentId);
        if (group === undefined) {
          const v2Id = idGen.generate('component', componentId);
          group = { componentId, position: node.position, v2NodeId: v2Id };
          componentGroups.set(componentId, group);
        }
        nodeIdMap.set(node.id, group.v2NodeId);
      }
    } else if (node.kind === 'action') {
      const config = node.config;
      if (config.type === 'navigate') {
        // 全局 navigate 节点：同类型合并为单例
        if (navigateV2Id === undefined) {
          navigateV2Id = idGen.generate('component', 'navigate');
          navigatePosition = node.position;
          navigateConfig = {
            globalType: 'navigate',
            url: config.url,
            target: config.target,
          };
        }
        nodeIdMap.set(node.id, navigateV2Id);
      } else if (config.type === 'requestApi') {
        // 全局 requestApi 节点：同类型合并为单例
        if (requestApiV2Id === undefined) {
          requestApiV2Id = idGen.generate('component', 'requestApi');
          requestApiPosition = node.position;
          requestApiConfig = {
            globalType: 'requestApi',
            method: config.method,
            url: config.url,
            headers: config.headers,
            body: config.body,
            secretHeaderKeys: config.secretHeaderKeys,
            timeoutMs: config.timeoutMs,
          };
        }
        nodeIdMap.set(node.id, requestApiV2Id);
      } else {
        // 组件 action：setVisibility / scrollToComponent / refreshDataSource
        const componentId = config.targetComponentId;
        let group = componentGroups.get(componentId);
        if (group === undefined) {
          const v2Id = idGen.generate('component', componentId);
          group = { componentId, position: node.position, v2NodeId: v2Id };
          componentGroups.set(componentId, group);
        }
        nodeIdMap.set(node.id, group.v2NodeId);
      }
    } else if (node.kind === 'condition') {
      // condition 节点：结构不变，position 不变
      const v2Id = idGen.generate('condition', node.id);
      nodeIdMap.set(node.id, v2Id);
      v2Nodes.push({
        id: v2Id,
        kind: 'condition',
        position: node.position,
        config: node.config,
      });
    } else if (node.kind === 'comment') {
      // comment 节点：结构不变，position 不变
      const v2Id = idGen.generate('comment', node.id);
      nodeIdMap.set(node.id, v2Id);
      v2Nodes.push({
        id: v2Id,
        kind: 'comment',
        position: node.position,
        config: node.config,
      });
    }
  }

  // ===== 第二阶段：创建组件节点（合并后的） =====
  for (const group of componentGroups.values()) {
    const componentNode: ComponentNode = {
      id: group.v2NodeId,
      kind: 'component',
      componentId: group.componentId,
      position: group.position,
    };
    v2Nodes.push(componentNode);
  }

  // ===== 第三阶段：创建全局节点 =====
  if (pageLoadV2Id !== undefined && pageLoadPosition !== undefined) {
    v2Nodes.push({
      id: pageLoadV2Id,
      kind: 'component',
      componentId: GLOBAL_COMPONENT_ID,
      globalType: 'pageLoad',
      position: pageLoadPosition,
    });
  }
  if (
    navigateV2Id !== undefined &&
    navigatePosition !== undefined &&
    navigateConfig !== undefined
  ) {
    v2Nodes.push({
      id: navigateV2Id,
      kind: 'component',
      componentId: GLOBAL_COMPONENT_ID,
      globalType: 'navigate',
      config: navigateConfig,
      position: navigatePosition,
    });
  }
  if (
    requestApiV2Id !== undefined &&
    requestApiPosition !== undefined &&
    requestApiConfig !== undefined
  ) {
    v2Nodes.push({
      id: requestApiV2Id,
      kind: 'component',
      componentId: GLOBAL_COMPONENT_ID,
      globalType: 'requestApi',
      config: requestApiConfig,
      position: requestApiPosition,
    });
  }

  // ===== 第四阶段：迁移边（重写 source/target，推导 handle） =====
  const v2Edges: BlueprintEdgeV2[] = [];
  for (const edge of v1.edges) {
    const sourceV1 = v1.nodes.find((n) => n.id === edge.source);
    const targetV1 = v1.nodes.find((n) => n.id === edge.target);

    if (sourceV1 === undefined || targetV1 === undefined) {
      warnings.push({
        sourceId: edge.id,
        message: `边引用了不存在的节点（source=${edge.source}, target=${edge.target}）`,
      });
      continue;
    }

    const newSource = nodeIdMap.get(edge.source);
    const newTarget = nodeIdMap.get(edge.target);

    if (newSource === undefined || newTarget === undefined) {
      warnings.push({
        sourceId: edge.id,
        message: `边 ${edge.id} 的源节点或目标节点未在映射表中找到`,
      });
      continue;
    }

    // 推导 sourceHandle
    let newSourceHandle: string;
    if (sourceV1.kind === 'trigger') {
      const eventId = TRIGGER_EVENT_ID_MAP[sourceV1.config.type];
      newSourceHandle = `evt:${eventId}`;
    } else if (sourceV1.kind === 'action') {
      // action 节点有 out 引脚，但 V2 组件节点不自动有 out 锚点
      // 保留为 'out' 并标记 warning
      newSourceHandle = 'out';
      warnings.push({
        sourceId: edge.id,
        message: `边的源节点是 action 节点，V2 组件节点无 out 锚点，保留为 'out'`,
      });
    } else if (sourceV1.kind === 'condition') {
      // condition 节点的 sourceHandle 可能是 'then' 或 'else'，保留不变
      newSourceHandle = edge.sourceHandle;
    } else {
      // comment 节点：不应有输出
      newSourceHandle = edge.sourceHandle;
      warnings.push({
        sourceId: edge.id,
        message: `边的源节点是 comment 节点，不应有输出`,
      });
    }

    // 推导 targetHandle
    let newTargetHandle: string;
    if (targetV1.kind === 'action') {
      const actionId = getActionId(targetV1.config);
      newTargetHandle = `act:${actionId}`;
    } else if (targetV1.kind === 'condition') {
      // condition 节点输入 'in'，保留不变
      newTargetHandle = 'in';
    } else if (targetV1.kind === 'trigger') {
      // trigger 无输入锚点，保留为 'in' 并标记 warning
      newTargetHandle = 'in';
      warnings.push({
        sourceId: edge.id,
        message: `边的目标节点是 trigger 节点，trigger 无输入锚点，保留为 'in'`,
      });
    } else {
      // comment 节点：不应有输入
      newTargetHandle = edge.targetHandle;
      warnings.push({
        sourceId: edge.id,
        message: `边的目标节点是 comment 节点，不应有输入`,
      });
    }

    v2Edges.push({
      id: edge.id,
      source: newSource,
      sourceHandle: newSourceHandle,
      target: newTarget,
      targetHandle: newTargetHandle,
    });
  }

  return {
    blueprint: {
      version: EVENT_BLUEPRINT_VERSION_V2,
      nodes: v2Nodes,
      edges: v2Edges,
    },
    warnings,
  };
}
