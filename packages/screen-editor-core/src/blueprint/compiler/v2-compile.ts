/**
 * V2 蓝图编译器主入口
 *
 * 编译流程：
 * 1. buildV2Indexes 构建索引（含重复 id 诊断）
 * 2. detectV2Cycles 环检测
 * 3. validateNodes 节点级诊断（dangling 组件引用、空全局配置、delay 超范围）
 * 4. compileRules 从组件节点的 evt:* 锚点出发 DFS 展开执行计划
 *
 * 纯函数：不修改输入，不发起 IO，不产生副作用。
 */

import type { EventBlueprintV2 } from '@nebula/shared';
import type {
  V2ActionStep,
  V2CompileContext,
  V2CompileResult,
  V2CompiledRule,
  V2CompiledStep,
  V2ConditionStep,
  V2DelayStep,
  V2Diagnostic,
} from './v2-types.js';
import { MAX_COMPILE_DEPTH_V2 } from './v2-types.js';
import { buildV2Indexes, type V2BlueprintIndexes, type V2NodeIndexEntry } from './v2-indexes.js';
import { detectV2Cycles } from './v2-cycle.js';

/** V2 编译主入口 */
export function compileBlueprintV2(
  blueprint: EventBlueprintV2,
  context: V2CompileContext,
): V2CompileResult {
  const indexes = buildV2Indexes(blueprint);
  const diagnostics: V2Diagnostic[] = [...indexes.diagnostics];

  // 环检测
  diagnostics.push(...detectV2Cycles(indexes));

  // 节点级诊断
  diagnostics.push(...validateNodes(indexes, context));

  // 编译规则
  const rules = compileRules(indexes);

  return { rules, diagnostics };
}

// ===== 节点级诊断 =====

/** 对所有节点做参数诊断 */
function validateNodes(indexes: V2BlueprintIndexes, context: V2CompileContext): V2Diagnostic[] {
  const diagnostics: V2Diagnostic[] = [];
  for (const entry of indexes.nodes.values()) {
    switch (entry.kind) {
      case 'component':
        validateComponentNode(entry, context, diagnostics);
        break;
      case 'delay':
        validateDelayNode(entry, diagnostics);
        break;
      case 'condition':
      case 'comment':
        // condition / comment 节点无 V2 专属参数诊断
        break;
    }
  }
  return diagnostics;
}

/** component 节点诊断：dangling 组件引用 + 全局节点空配置 */
function validateComponentNode(
  entry: V2NodeIndexEntry,
  context: V2CompileContext,
  diagnostics: V2Diagnostic[],
): void {
  const node = entry.node;
  if (node.kind !== 'component') return;

  // 普通组件节点：componentId 不在 context.componentIds 中且非 'global' → dangling
  if (node.componentId !== 'global' && !context.componentIds.has(node.componentId)) {
    diagnostics.push({
      level: 'error',
      code: 'dangling-component',
      message: `组件 ${node.componentId} 不存在于项目中（dangling）`,
      nodeId: node.id,
    });
  }

  // 全局节点配置诊断
  switch (node.globalType) {
    case 'navigate': {
      const config = node.config;
      if (config && config.globalType === 'navigate' && config.url === '') {
        diagnostics.push({
          level: 'warning',
          code: 'empty-config',
          message: 'navigate 全局节点未填写 URL',
          nodeId: node.id,
        });
      }
      break;
    }
    case 'requestApi': {
      const config = node.config;
      if (config && config.globalType === 'requestApi' && config.url === '') {
        diagnostics.push({
          level: 'warning',
          code: 'empty-config',
          message: 'requestApi 全局节点未填写 URL',
          nodeId: node.id,
        });
      }
      break;
    }
    case 'scrollTo': {
      const config = node.config;
      if (
        config &&
        config.globalType === 'scrollTo' &&
        !context.componentIds.has(config.targetComponentId)
      ) {
        diagnostics.push({
          level: 'error',
          code: 'dangling-component',
          message: `scrollTo 目标组件 ${config.targetComponentId} 不存在于项目中（dangling）`,
          nodeId: node.id,
        });
      }
      break;
    }
    case 'interval': {
      const config = node.config;
      if (config && config.globalType === 'interval') {
        const { intervalMs } = config;
        if (intervalMs < 100 || intervalMs > 86_400_000) {
          diagnostics.push({
            level: 'error',
            code: 'invalid-delay',
            message: `定时器间隔 ${intervalMs}ms 超出有效范围（100 ~ 86400000）`,
            nodeId: node.id,
          });
        }
      }
      break;
    }
    case 'pageLoad':
    case undefined:
      // pageLoad 全局节点无 config；普通组件节点已由上方 dangling 诊断覆盖
      break;
  }
}

/** delay 节点诊断：delayMs 超范围 */
function validateDelayNode(entry: V2NodeIndexEntry, diagnostics: V2Diagnostic[]): void {
  const node = entry.node;
  if (node.kind !== 'delay') return;
  const { delayMs } = node.config;
  if (delayMs < 0 || delayMs > 60_000) {
    diagnostics.push({
      level: 'error',
      code: 'invalid-delay',
      message: `延时时长 ${delayMs}ms 超出有效范围（0 ~ 60000）`,
      nodeId: node.id,
    });
  }
}

// ===== 规则编译 =====

/** 遍历组件节点的 evt:* 锚点，为每个锚点编译一条规则 */
function compileRules(indexes: V2BlueprintIndexes): V2CompiledRule[] {
  const rules: V2CompiledRule[] = [];

  for (const entry of indexes.nodes.values()) {
    if (entry.kind !== 'component') continue;

    // 收集该组件节点的所有 evt:* 输出锚点
    const outEdges = indexes.outgoingEdges.get(entry.id) ?? [];
    const evtHandles = new Set<string>();
    for (const edge of outEdges) {
      if (edge.sourceHandle.startsWith('evt:')) {
        evtHandles.add(edge.sourceHandle);
      }
    }

    for (const evtHandle of evtHandles) {
      // Phase 4 Task 4.2: V2TriggerEventId 已放宽为 string，允许 manifest 自定义事件
      const eventId = evtHandle.slice('evt:'.length);
      const triggerComponentId = entry.componentId ?? 'global';

      const steps: V2CompiledStep[] = [];
      const visited = new Set<string>();

      compileStepsFromHandle(entry.id, evtHandle, indexes, steps, visited, 0);

      const rule: V2CompiledRule = {
        triggerNodeId: entry.id,
        triggerEventId: eventId,
        triggerComponentId,
        steps,
      };

      // interval 触发规则：从节点 config 中提取 intervalMs 供运行时调度
      if (eventId === 'interval') {
        const node = entry.node;
        if (node.kind === 'component' && node.config?.globalType === 'interval') {
          rule.intervalMs = node.config.intervalMs;
        }
      }

      rules.push(rule);
    }
  }

  return rules;
}

/**
 * 从指定节点的指定源锚点出发 DFS 展开步骤链。
 *
 * - act:* 目标：生成 V2ActionStep（终端步骤，不再展开）
 * - in 目标（condition）：生成 V2ConditionStep，递归编译 then/else 分支
 * - in 目标（delay）：生成 V2DelayStep，继续沿 delay 节点 out 锚点展开（步骤加入当前链）
 *
 * visited 跟踪 (nodeId, handleId) 对，避免重复展开同一节点同一锚点。
 */
function compileStepsFromHandle(
  sourceNodeId: string,
  sourceHandle: string,
  indexes: V2BlueprintIndexes,
  steps: V2CompiledStep[],
  visited: Set<string>,
  depth: number,
): void {
  if (depth > MAX_COMPILE_DEPTH_V2) {
    return;
  }

  const outEdges = indexes.outgoingEdges.get(sourceNodeId) ?? [];
  for (const edge of outEdges) {
    if (edge.sourceHandle !== sourceHandle) continue;

    const targetKey = `${edge.target}:${edge.targetHandle}`;
    if (visited.has(targetKey)) continue;
    visited.add(targetKey);

    const targetEntry = indexes.nodes.get(edge.target);
    if (!targetEntry) continue; // 边引用不存在的节点，由 validateNodes 等处理

    if (edge.targetHandle.startsWith('act:')) {
      const actionId = edge.targetHandle.slice('act:'.length);
      const step = buildActionStep(targetEntry, actionId);
      if (step) steps.push(step);
    } else if (edge.targetHandle === 'in') {
      if (targetEntry.kind === 'condition') {
        const condStep = compileConditionStep(targetEntry, indexes, visited, depth + 1);
        if (condStep) steps.push(condStep);
      } else if (targetEntry.kind === 'delay') {
        const delayStep = buildDelayStep(targetEntry);
        if (delayStep) {
          steps.push(delayStep);
          // 沿 delay 节点 out 锚点继续展开，后续步骤加入当前 steps 链
          compileStepsFromHandle(targetEntry.id, 'out', indexes, steps, visited, depth + 1);
        }
      }
    }
  }
}

/** 编译 condition 节点：递归编译 then/else 分支，生成 V2ConditionStep */
function compileConditionStep(
  condEntry: V2NodeIndexEntry,
  indexes: V2BlueprintIndexes,
  visited: Set<string>,
  depth: number,
): V2ConditionStep | null {
  if (depth > MAX_COMPILE_DEPTH_V2) return null;

  const node = condEntry.node;
  if (node.kind !== 'condition') return null;

  const thenSteps: V2CompiledStep[] = [];
  const elseSteps: V2CompiledStep[] = [];

  // then / else 分支共享 visited，避免跨分支重复展开
  compileStepsFromHandle(node.id, 'then', indexes, thenSteps, visited, depth);
  compileStepsFromHandle(node.id, 'else', indexes, elseSteps, visited, depth);

  return {
    kind: 'condition',
    nodeId: node.id,
    expression: node.config.expression,
    thenSteps,
    elseSteps,
  };
}

/** 构造 V2ActionStep：根据 actionId 选择正确的 V2ActionStepConfig 变体 */
function buildActionStep(targetEntry: V2NodeIndexEntry, actionId: string): V2ActionStep | null {
  if (targetEntry.kind !== 'component') return null;
  const node = targetEntry.node;
  if (node.kind !== 'component') return null;

  switch (actionId) {
    case 'show':
    case 'hide':
    case 'toggleVisibility':
    case 'refreshData':
    case 'scrollTo':
      return {
        kind: 'action',
        nodeId: node.id,
        componentId: node.componentId,
        config: { actionId },
      };
    case 'navigate': {
      if (node.globalType !== 'navigate') return null;
      const cfg = node.config;
      if (!cfg || cfg.globalType !== 'navigate') return null;
      return {
        kind: 'action',
        nodeId: node.id,
        componentId: 'global',
        config: { actionId: 'navigate', config: cfg },
      };
    }
    case 'requestApi': {
      if (node.globalType !== 'requestApi') return null;
      const cfg = node.config;
      if (!cfg || cfg.globalType !== 'requestApi') return null;
      return {
        kind: 'action',
        nodeId: node.id,
        componentId: 'global',
        config: { actionId: 'requestApi', config: cfg },
      };
    }
    default:
      return null;
  }
}

/** 构造 V2DelayStep */
function buildDelayStep(delayEntry: V2NodeIndexEntry): V2DelayStep | null {
  const node = delayEntry.node;
  if (node.kind !== 'delay') return null;
  return {
    kind: 'delay',
    nodeId: node.id,
    delayMs: node.config.delayMs,
  };
}
