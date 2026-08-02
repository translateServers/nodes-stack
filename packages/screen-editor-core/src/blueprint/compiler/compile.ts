import type { EventBlueprint } from '@nebula/shared';

import { detectCycles } from './cycle.js';
import { buildIndexes, type BlueprintIndexes, type NodeIndexEntry } from './indexes.js';
import { MAX_COMPILE_DEPTH } from './types.js';
import type {
  ActionStep,
  BlueprintDiagnostic,
  CompileContext,
  CompileResult,
  CompiledRule,
  CompiledStep,
  ConditionStep,
  DelayStep,
} from './types.js';

export function compileBlueprint(
  blueprint: EventBlueprint,
  context: CompileContext,
): CompileResult {
  const indexes = buildIndexes(blueprint);
  const diagnostics: BlueprintDiagnostic[] = [...indexes.diagnostics, ...detectCycles(indexes)];
  diagnostics.push(...validateNodes(indexes, context));

  return {
    rules: compileRules(indexes),
    diagnostics,
  };
}

function validateNodes(indexes: BlueprintIndexes, context: CompileContext): BlueprintDiagnostic[] {
  const diagnostics: BlueprintDiagnostic[] = [];
  for (const entry of indexes.nodes.values()) {
    if (entry.kind === 'component') {
      validateComponentNode(entry, context, diagnostics);
    } else if (entry.kind === 'delay') {
      validateDelayNode(entry, diagnostics);
    }
  }
  return diagnostics;
}

function validateComponentNode(
  entry: NodeIndexEntry,
  context: CompileContext,
  diagnostics: BlueprintDiagnostic[],
): void {
  const node = entry.node;
  if (node.kind !== 'component') {
    return;
  }

  if (node.componentId !== 'global' && !context.componentIds.has(node.componentId)) {
    diagnostics.push({
      level: 'error',
      code: 'dangling-component',
      message: `Component ${node.componentId} does not exist in the project.`,
      nodeId: node.id,
    });
  }

  switch (node.globalType) {
    case 'navigate':
      if (node.config?.globalType === 'navigate' && node.config.url === '') {
        diagnostics.push({
          level: 'warning',
          code: 'empty-config',
          message: 'Navigate node has no URL.',
          nodeId: node.id,
        });
      }
      break;
    case 'requestApi':
      if (node.config?.globalType === 'requestApi' && node.config.url === '') {
        diagnostics.push({
          level: 'warning',
          code: 'empty-config',
          message: 'Request API node has no URL.',
          nodeId: node.id,
        });
      }
      break;
    case 'scrollTo':
      if (
        node.config?.globalType === 'scrollTo' &&
        !context.componentIds.has(node.config.targetComponentId)
      ) {
        diagnostics.push({
          level: 'error',
          code: 'dangling-component',
          message: `Scroll target ${node.config.targetComponentId} does not exist in the project.`,
          nodeId: node.id,
        });
      }
      break;
    case 'interval':
      if (node.config?.globalType === 'interval') {
        const { intervalMs } = node.config;
        if (intervalMs < 100 || intervalMs > 86_400_000) {
          diagnostics.push({
            level: 'error',
            code: 'invalid-delay',
            message: `Interval ${intervalMs}ms is outside the valid range.`,
            nodeId: node.id,
          });
        }
      }
      break;
    case 'pageLoad':
    case undefined:
      break;
  }
}

function validateDelayNode(entry: NodeIndexEntry, diagnostics: BlueprintDiagnostic[]): void {
  const node = entry.node;
  if (node.kind !== 'delay') {
    return;
  }
  if (node.config.delayMs < 0 || node.config.delayMs > 60_000) {
    diagnostics.push({
      level: 'error',
      code: 'invalid-delay',
      message: `Delay ${node.config.delayMs}ms is outside the valid range.`,
      nodeId: node.id,
    });
  }
}

function compileRules(indexes: BlueprintIndexes): CompiledRule[] {
  const rules: CompiledRule[] = [];

  for (const entry of indexes.nodes.values()) {
    if (entry.kind !== 'component') {
      continue;
    }

    const eventHandles = new Set<string>();
    for (const edge of indexes.outgoingEdges.get(entry.id) ?? []) {
      if (edge.sourceHandle.startsWith('evt:')) {
        eventHandles.add(edge.sourceHandle);
      }
    }

    for (const eventHandle of eventHandles) {
      const steps: CompiledStep[] = [];
      compileStepsFromHandle(entry.id, eventHandle, indexes, steps, new Set<string>(), 0);

      const intervalMs =
        entry.node.kind === 'component' &&
        entry.node.config?.globalType === 'interval' &&
        eventHandle === 'evt:interval'
          ? entry.node.config.intervalMs
          : undefined;
      const rule: CompiledRule = {
        triggerNodeId: entry.id,
        triggerEventId: eventHandle.slice('evt:'.length),
        triggerComponentId: entry.componentId ?? 'global',
        steps,
        ...(intervalMs === undefined ? {} : { intervalMs }),
      };
      rules.push(rule);
    }
  }

  return rules;
}

function compileStepsFromHandle(
  sourceNodeId: string,
  sourceHandle: string,
  indexes: BlueprintIndexes,
  steps: CompiledStep[],
  visited: Set<string>,
  depth: number,
): void {
  if (depth > MAX_COMPILE_DEPTH) {
    return;
  }

  for (const edge of indexes.outgoingEdges.get(sourceNodeId) ?? []) {
    if (edge.sourceHandle !== sourceHandle) {
      continue;
    }

    const targetKey = `${edge.target}:${edge.targetHandle}`;
    if (visited.has(targetKey)) {
      continue;
    }
    visited.add(targetKey);

    const target = indexes.nodes.get(edge.target);
    if (target === undefined) {
      continue;
    }

    if (edge.targetHandle.startsWith('act:')) {
      const step = buildActionStep(target, edge.targetHandle.slice('act:'.length));
      if (step !== null) {
        steps.push(step);
      }
      continue;
    }

    if (edge.targetHandle !== 'in') {
      continue;
    }
    if (target.kind === 'condition') {
      const step = compileConditionStep(target, indexes, visited, depth + 1);
      if (step !== null) {
        steps.push(step);
      }
    } else if (target.kind === 'delay') {
      const step = buildDelayStep(target);
      if (step !== null) {
        steps.push(step);
        compileStepsFromHandle(target.id, 'out', indexes, steps, visited, depth + 1);
      }
    }
  }
}

function compileConditionStep(
  entry: NodeIndexEntry,
  indexes: BlueprintIndexes,
  visited: Set<string>,
  depth: number,
): ConditionStep | null {
  if (depth > MAX_COMPILE_DEPTH || entry.node.kind !== 'condition') {
    return null;
  }

  const thenSteps: CompiledStep[] = [];
  const elseSteps: CompiledStep[] = [];
  compileStepsFromHandle(entry.id, 'then', indexes, thenSteps, visited, depth);
  compileStepsFromHandle(entry.id, 'else', indexes, elseSteps, visited, depth);

  return {
    kind: 'condition',
    nodeId: entry.id,
    expression: entry.node.config.expression,
    thenSteps,
    elseSteps,
  };
}

function buildActionStep(entry: NodeIndexEntry, actionId: string): ActionStep | null {
  if (entry.node.kind !== 'component') {
    return null;
  }

  const node = entry.node;
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
    case 'navigate':
      if (node.globalType !== 'navigate' || node.config?.globalType !== 'navigate') {
        return null;
      }
      return {
        kind: 'action',
        nodeId: node.id,
        componentId: 'global',
        config: { actionId, config: node.config },
      };
    case 'requestApi':
      if (node.globalType !== 'requestApi' || node.config?.globalType !== 'requestApi') {
        return null;
      }
      return {
        kind: 'action',
        nodeId: node.id,
        componentId: 'global',
        config: { actionId, config: node.config },
      };
    default:
      return null;
  }
}

function buildDelayStep(entry: NodeIndexEntry): DelayStep | null {
  if (entry.node.kind !== 'delay') {
    return null;
  }
  return {
    kind: 'delay',
    nodeId: entry.id,
    delayMs: entry.node.config.delayMs,
  };
}
