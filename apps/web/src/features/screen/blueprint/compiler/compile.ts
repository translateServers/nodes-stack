/**
 * 蓝图编译器主入口（任务 2.2）
 *
 * 纯函数：图 → 诊断 + 拓扑序线性规则集
 *
 * 编译流程：
 * 1. 构建节点与边索引，检测重复 id 与非法引用
 * 2. 对每个 trigger 节点做 DFS，检测环
 * 3. 对所有可达节点做参数诊断（dangling / empty-param）
 * 4. 对每个 trigger 做拓扑展开，产出 CompiledRule
 * 5. comment 节点与未连接到任何 trigger 的子图产出 info 诊断
 *
 * 限制：
 * - 不修改输入
 * - 不发起 IO、不产生副作用
 * - 节点与规则不被静默删除，仅通过诊断反映问题
 */

import type { BlueprintNode, EventBlueprint } from '@nebula/shared';
import { buildIndexes } from './indexes.js';
import { detectCycles } from './cycle.js';
import { diagnoseNode } from './validate.js';
import type {
  BlueprintIndexes,
  CompileContext,
  CompileResult,
  CompiledAction,
  CompiledRule,
} from './types.js';

const MAX_COMPILE_DEPTH = 100;

/**
 * 编译蓝图。
 *
 * @param blueprint 蓝图图结构
 * @param context   编译上下文（componentIds 用于 dangling 诊断）
 */
export function compileBlueprint(
  blueprint: EventBlueprint,
  context: CompileContext,
): CompileResult {
  const { indexes, diagnostics } = buildIndexes(blueprint);
  const { nodes, incomingEdges } = indexes;

  // 1. 收集 trigger 节点
  const triggers = [...nodes.values()].filter(
    (n): n is Extract<BlueprintNode, { kind: 'trigger' }> => n.kind === 'trigger',
  );

  // 2. 环检测
  const { cycles, diagnostics: cycleDiagnostics } = detectCycles(triggers, indexes);
  diagnostics.push(...cycleDiagnostics);

  // 3. 收集环涉及的节点：含环的 trigger 不产出规则；环中所有节点不产 orphan 诊断
  const cycleNodeIds = new Set<string>();
  for (const cycle of cycles) {
    for (const nodeId of cycle) {
      cycleNodeIds.add(nodeId);
    }
  }
  const cycleTriggerIds = new Set<string>();
  for (const nodeId of cycleNodeIds) {
    if (nodes.get(nodeId)?.kind === 'trigger') {
      cycleTriggerIds.add(nodeId);
    }
  }

  // 4. 对每个 trigger 做拓扑展开产出规则（环 trigger 跳过）
  const rules: CompiledRule[] = [];
  const visitedNodes = new Set<string>();

  for (const trigger of triggers) {
    if (cycleTriggerIds.has(trigger.id)) continue;

    const { rule, visited } = compileTrigger(trigger, indexes);
    if (rule) {
      rules.push(rule);
      for (const id of visited) {
        visitedNodes.add(id);
      }
    }
  }

  // 5. 对所有节点做参数诊断（dangling / empty-param）
  for (const node of nodes.values()) {
    diagnostics.push(...diagnoseNode(node, context));
  }

  // 6. 孤立子图诊断：未连接到任何 trigger 的非 comment 节点产出 info
  for (const node of nodes.values()) {
    if (node.kind === 'comment') continue; // comment 节点不诊断孤立
    if (visitedNodes.has(node.id)) continue; // 已被某 trigger 规则覆盖
    if (cycleNodeIds.has(node.id)) continue; // 环中节点已有 cycle 诊断
    // trigger 节点本身如果无出边也算孤立
    const hasIncoming = (incomingEdges.get(node.id) ?? []).length > 0;
    if (!hasIncoming || node.kind === 'trigger') {
      diagnostics.push({
        level: 'info',
        code: 'orphan-subgraph',
        message: `节点未连接到任何触发器：${node.id}`,
        nodeId: node.id,
      });
    }
  }

  // 7. comment 节点 info 诊断（设计上不参与执行，但提示用户）
  for (const node of nodes.values()) {
    if (node.kind === 'comment') {
      diagnostics.push({
        level: 'info',
        code: 'orphan-subgraph',
        message: `注释节点不参与编译执行：${node.id}`,
        nodeId: node.id,
      });
    }
  }

  return { rules, diagnostics };
}

/** 从单个 trigger 出发做 DFS 拓扑展开，产出一条 CompiledRule */
function compileTrigger(
  trigger: Extract<BlueprintNode, { kind: 'trigger' }>,
  indexes: BlueprintIndexes,
): { rule: CompiledRule | null; visited: Set<string> } {
  const actions: CompiledAction[] = [];
  const visited = new Set<string>();
  // 使用 visited 防止同一 trigger 链路内重复访问（环已由 cycle.ts 处理）

  const stack: Array<{ nodeId: string; depth: number }> = [{ nodeId: trigger.id, depth: 0 }];

  while (stack.length > 0) {
    const { nodeId, depth } = stack.shift()!;
    if (visited.has(nodeId)) continue;
    if (depth > MAX_COMPILE_DEPTH) continue;
    visited.add(nodeId);

    const node = indexes.nodes.get(nodeId);
    if (!node) continue;

    // action 节点加入规则
    if (node.kind === 'action') {
      actions.push({
        nodeId: node.id,
        config: node.config,
        depth: depth - 1, // trigger 为 depth 0，直连 action 为 depth 0
      });
    }

    // 遍历出边，按出现顺序入栈（保持稳定顺序）
    const outEdges = indexes.outgoingEdges.get(nodeId) ?? [];
    for (const edge of outEdges) {
      stack.push({ nodeId: edge.target, depth: depth + 1 });
    }
  }

  // trigger 本身即使无 action 也产出一条规则（便于 UI 高亮与调试）
  return {
    rule: {
      triggerNodeId: trigger.id,
      triggerConfig: trigger.config,
      actions,
    },
    visited,
  };
}
