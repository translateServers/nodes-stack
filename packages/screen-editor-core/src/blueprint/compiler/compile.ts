/**
 * 蓝图编译器主入口（任务 2.2 + 10.1）
 *
 * 纯函数：图 → 诊断 + 拓扑序线性规则集
 *
 * 编译流程：
 * 1. 构建节点与边索引，检测重复 id 与非法引用
 * 2. 对每个 trigger 节点做 DFS，检测环
 * 3. 对所有可达节点做参数诊断（dangling / empty-param）
 * 4. 对每个 trigger 做拓扑展开，产出 CompiledRule
 *    - action 节点直接加入 actions 列表
 *    - condition 节点按 `then` / `else` 输出引脚分组，分别展开为 thenActions / elseActions，
 *      产出 CompiledCondition 加入 conditions 列表（任务 10.1）
 * 5. comment 节点与未连接到任何 trigger 的子图产出 info 诊断
 *
 * 限制：
 * - 不修改输入
 * - 不发起 IO、不产生副作用
 * - 节点与规则不被静默删除，仅通过诊断反映问题
 *
 * condition 分支语义（任务 10.1）：
 * - condition 节点有两个输出引脚 `then` 与 `else`
 * - 编译期无法预知表达式求值结果，因此同时保留 then/else 两条分支动作链
 * - 未连接的分支引脚对应空数组（合法，运行时跳过该分支）
 * - 环检测兼容：condition 分支中的节点参与 cycle.ts 的 DFS 环检测
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
  CompiledCondition,
  CompiledRule,
} from './types.js';

const MAX_COMPILE_DEPTH = 100;

/** condition 节点 then 输出引脚标识 */
const CONDITION_THEN_HANDLE = 'then';
/** condition 节点 else 输出引脚标识 */
const CONDITION_ELSE_HANDLE = 'else';

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
  const conditions: CompiledCondition[] = [];
  const visited = new Set<string>();
  // 使用 visited 防止同一 trigger 链路内重复访问（环已由 cycle.ts 处理）

  // 起始栈：trigger 的直接后继（按出边顺序）
  // trigger 节点本身标记为已访问（不计入 actions）
  visited.add(trigger.id);
  const outgoingEdges = indexes.outgoingEdges.get(trigger.id) ?? [];
  const stack: Array<{ nodeId: string; depth: number }> = outgoingEdges.map((edge) => ({
    nodeId: edge.target,
    depth: 0, // trigger 直连节点为 depth 0
  }));

  while (stack.length > 0) {
    const { nodeId, depth } = stack.shift()!;
    if (visited.has(nodeId)) continue;
    if (depth > MAX_COMPILE_DEPTH) continue;
    visited.add(nodeId);

    const node = indexes.nodes.get(nodeId);
    if (!node) continue;

    if (node.kind === 'action') {
      actions.push({
        nodeId: node.id,
        config: node.config,
        depth,
      });
      // 继续遍历 action 的出边（串联动作）
      pushOutgoing(nodeId, depth + 1, indexes, stack);
    } else if (node.kind === 'condition') {
      // condition 节点：按 then/else 引脚分组展开分支
      const compiled = compileConditionBranches(node, depth, indexes, visited);
      conditions.push(compiled);
      // condition 节点的 then/else 分支内部 visited 已被填充
    }
    // comment 节点不参与执行流，但其后继若被连入执行流也展开
    // （实际场景下 comment 不应有出边，但保持稳健：不展开 comment 后继）
  }

  // trigger 本身即使无 action 也产出一条规则（便于 UI 高亮与调试）
  return {
    rule: {
      triggerNodeId: trigger.id,
      triggerConfig: trigger.config,
      actions,
      conditions,
    },
    visited,
  };
}

/**
 * 对 condition 节点的 then/else 输出引脚分别展开分支动作链。
 *
 * - 按 sourceHandle 分组出边：'then' / 'else'（其他 handle 视为非法忽略，由 buildIndexes 不强制 handle 值）
 * - 分支内部独立 DFS（避免 then 与 else 间共享 visited 导致一边先走完另一边被忽略）
 * - 分支内遇到嵌套 condition：递归产出 CompiledCondition 并加入分支返回的嵌套 conditions 列表
 *   （当前实现仅记录 condition 节点到顶层 conditions，分支内的嵌套 condition 不递归到顶层，
 *    仅作为 actions 之外的信息保留；如需运行时支持嵌套分支执行，后续任务 10.3 扩展）
 *
 * @returns 该 condition 节点的 CompiledCondition
 */
function compileConditionBranches(
  conditionNode: Extract<BlueprintNode, { kind: 'condition' }>,
  depth: number,
  indexes: BlueprintIndexes,
  parentVisited: Set<string>,
): CompiledCondition {
  // 标记 condition 节点为已访问（避免上层重复展开）
  parentVisited.add(conditionNode.id);

  const outEdges = indexes.outgoingEdges.get(conditionNode.id) ?? [];

  // 按 sourceHandle 分组（保留原始顺序）
  const thenTargets: string[] = [];
  const elseTargets: string[] = [];
  for (const edge of outEdges) {
    if (edge.sourceHandle === CONDITION_THEN_HANDLE) {
      thenTargets.push(edge.target);
    } else if (edge.sourceHandle === CONDITION_ELSE_HANDLE) {
      elseTargets.push(edge.target);
    }
    // 其他 handle 值忽略（不强制诊断，由 UI 引脚连接约束）
  }

  // then 分支独立展开
  const thenResult = expandBranch(thenTargets, depth + 1, indexes, parentVisited);
  // else 分支独立展开（与 then 共享 parentVisited 防止重复访问）
  const elseResult = expandBranch(elseTargets, depth + 1, indexes, parentVisited);

  return {
    nodeId: conditionNode.id,
    config: conditionNode.config,
    thenActions: thenResult.actions,
    elseActions: elseResult.actions,
    depth,
  };
}

/** 分支展开结果：动作链 + 嵌套 condition 列表 */
interface BranchExpandResult {
  actions: CompiledAction[];
  /** 嵌套 condition 列表（任务 10.1 暂不向顶层暴露，但保留接口供后续扩展） */
  nestedConditions: CompiledCondition[];
}

/**
 * 展开 condition 分支的后续动作链。
 *
 * 分支内部独立 DFS，与另一分支共享 parentVisited 防止重复访问。
 * 嵌套 condition 节点的 then/else 子分支递归展开，但当前实现仅记录 condition 节点本身到
 * nestedConditions，运行时执行（任务 10.3）负责递归求值。
 */
function expandBranch(
  targets: readonly string[],
  startDepth: number,
  indexes: BlueprintIndexes,
  parentVisited: Set<string>,
): BranchExpandResult {
  const actions: CompiledAction[] = [];
  const nestedConditions: CompiledCondition[] = [];

  const stack: Array<{ nodeId: string; depth: number }> = targets.map((nodeId) => ({
    nodeId,
    depth: startDepth,
  }));

  while (stack.length > 0) {
    const { nodeId, depth } = stack.shift()!;
    if (parentVisited.has(nodeId)) continue;
    if (depth > MAX_COMPILE_DEPTH) continue;
    parentVisited.add(nodeId);

    const node = indexes.nodes.get(nodeId);
    if (!node) continue;

    if (node.kind === 'action') {
      actions.push({
        nodeId: node.id,
        config: node.config,
        depth,
      });
      pushOutgoing(nodeId, depth + 1, indexes, stack);
    } else if (node.kind === 'condition') {
      // 嵌套 condition：递归展开 then/else 子分支，产出 CompiledCondition
      const nested = compileConditionBranches(node, depth, indexes, parentVisited);
      nestedConditions.push(nested);
      // 嵌套 condition 的 then/else 动作链已展开到 nested.thenActions/elseActions
      // 任务 10.1 暂不向顶层 CompiledRule.conditions 透传嵌套 condition，
      // 运行时执行器需在任务 10.3 中按嵌套结构递归求值执行
    }
    // comment 节点不参与执行流
  }

  return { actions, nestedConditions };
}

/** 将节点的所有出边对应的后继入栈（保持稳定顺序） */
function pushOutgoing(
  nodeId: string,
  nextDepth: number,
  indexes: BlueprintIndexes,
  stack: Array<{ nodeId: string; depth: number }>,
): void {
  const outEdges = indexes.outgoingEdges.get(nodeId) ?? [];
  for (const edge of outEdges) {
    stack.push({ nodeId: edge.target, depth: nextDepth });
  }
}
