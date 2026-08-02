import { useCallback, useMemo, useRef, useState } from 'react';
import { GLOBAL_COMPONENT_ID, type EventBlueprint, type ScreenComponent } from '@nebula/shared';

import { compileBlueprint } from '../compiler/compile.js';
import type { BlueprintDiagnostic, CompileResult, CompiledRule } from '../compiler/types.js';
import { executeRule } from './executor.js';
import type { ActionResult, RuleExecutionLog, RuntimeDeps, TriggerEvent } from './types.js';

export interface SandboxSimulationResult {
  readonly logs: RuleExecutionLog[];
  readonly triggerNotFound: boolean;
  readonly refused: boolean;
  readonly refusalReason?: string;
}

export interface BlueprintSandboxRuntime {
  readonly simulateEvent: (nodeId: string, eventId: string) => Promise<SandboxSimulationResult>;
  readonly executionLogs: RuleExecutionLog[];
  readonly sandboxVisibilityOverrides: Map<string, boolean>;
  readonly executedNodeIds: Set<string>;
  readonly isSimulating: boolean;
  readonly resetSandbox: () => void;
  readonly compiledRules: CompiledRule[];
  readonly compileDiagnostics: BlueprintDiagnostic[];
}

export function useBlueprintSandboxRuntime(
  blueprint: EventBlueprint | undefined,
  components: readonly ScreenComponent[],
): BlueprintSandboxRuntime {
  const compileResult = useMemo<CompileResult | null>(() => {
    if (blueprint === undefined) {
      return null;
    }
    return compileBlueprint(blueprint, {
      componentIds: new Set(components.map((component) => component.id)),
    });
  }, [blueprint, components]);
  const compiledRules = compileResult?.rules ?? [];
  const compileDiagnostics = compileResult?.diagnostics ?? [];

  const [sandboxVisibilityOverrides, setSandboxVisibilityOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());
  const [executionLogs, setExecutionLogs] = useState<RuleExecutionLog[]>([]);
  const [executedNodeIds, setExecutedNodeIds] = useState<Set<string>>(() => new Set());
  const [isSimulating, setIsSimulating] = useState(false);

  const componentsRef = useRef(components);
  componentsRef.current = components;
  const visibilityRef = useRef(sandboxVisibilityOverrides);
  visibilityRef.current = sandboxVisibilityOverrides;
  const rulesRef = useRef(compiledRules);
  rulesRef.current = compiledRules;
  const diagnosticsRef = useRef(compileDiagnostics);
  diagnosticsRef.current = compileDiagnostics;
  const blueprintRef = useRef(blueprint);
  blueprintRef.current = blueprint;

  const sandboxDeps = useMemo<RuntimeDeps>(
    () => ({
      applyVisibility: (componentId, visible): void => {
        setSandboxVisibilityOverrides((previous) => new Map(previous).set(componentId, visible));
      },
      getVisibility: (componentId): boolean => visibilityRef.current.get(componentId) ?? true,
      openUrl: (): void => undefined,
      scrollToComponent: (): void => undefined,
      refreshDataSource: (): Promise<void> => Promise.resolve(),
      requestApi: (): Promise<{ ok: boolean; status: number; bodyPreview: string }> =>
        Promise.resolve({
          ok: true,
          status: 200,
          bodyPreview: 'Sandbox request was not sent.',
        }),
      hasComponent: (componentId): boolean =>
        componentId === GLOBAL_COMPONENT_ID ||
        componentsRef.current.some((component) => component.id === componentId),
      logWarning: (message): void => {
        console.warn(`[blueprint-sandbox] ${message}`);
      },
      getComponentValue: (componentId): Record<string, unknown> | undefined => {
        return componentsRef.current.find((component) => component.id === componentId)?.props;
      },
      getComponentData: (): unknown => undefined,
    }),
    [],
  );

  const buildEvent = useCallback((nodeId: string, eventId: string): TriggerEvent | null => {
    const node = blueprintRef.current?.nodes.find((candidate) => candidate.id === nodeId);
    if (node?.kind !== 'component') {
      return null;
    }
    if (
      node.componentId === GLOBAL_COMPONENT_ID &&
      node.globalType === 'pageLoad' &&
      eventId === 'pageLoad'
    ) {
      return { kind: 'pageLoad' };
    }
    if (
      node.componentId === GLOBAL_COMPONENT_ID &&
      node.globalType === 'interval' &&
      eventId === 'interval'
    ) {
      return { kind: 'interval' };
    }
    return { kind: 'componentEvent', componentId: node.componentId, eventId };
  }, []);

  const simulateEvent = useCallback(
    async (nodeId: string, eventId: string): Promise<SandboxSimulationResult> => {
      const event = buildEvent(nodeId, eventId);
      if (event === null) {
        return { logs: [], triggerNotFound: true, refused: false };
      }
      const diagnostic = diagnosticsRef.current.find(
        (candidate) => candidate.nodeId === nodeId && candidate.level === 'error',
      );
      if (diagnostic !== undefined) {
        return {
          logs: [],
          triggerNotFound: false,
          refused: true,
          refusalReason: diagnostic.message,
        };
      }

      const matchingRules = rulesRef.current.filter(
        (rule) =>
          rule.triggerNodeId === nodeId &&
          ((event.kind === 'pageLoad' && rule.triggerEventId === 'pageLoad') ||
            (event.kind === 'interval' && rule.triggerEventId === 'interval') ||
            (event.kind === 'componentEvent' &&
              rule.triggerEventId === event.eventId &&
              rule.triggerComponentId === event.componentId)),
      );
      if (matchingRules.length === 0) {
        return { logs: [], triggerNotFound: true, refused: false };
      }

      setIsSimulating(true);
      try {
        const logs: RuleExecutionLog[] = [];
        const nodeIds = new Set<string>();
        for (const rule of matchingRules) {
          nodeIds.add(rule.triggerNodeId);
          const log = await executeRule(rule, event, sandboxDeps);
          logs.push(log);
          for (const result of log.results) {
            nodeIds.add(result.nodeId);
          }
        }
        setExecutionLogs(logs);
        setExecutedNodeIds(nodeIds);
        return { logs, triggerNotFound: false, refused: false };
      } finally {
        setIsSimulating(false);
      }
    },
    [buildEvent, sandboxDeps],
  );

  const resetSandbox = useCallback((): void => {
    setExecutionLogs([]);
    setExecutedNodeIds(new Set());
    setSandboxVisibilityOverrides(new Map());
  }, []);

  return {
    simulateEvent,
    executionLogs,
    sandboxVisibilityOverrides,
    executedNodeIds,
    isSimulating,
    resetSandbox,
    compiledRules,
    compileDiagnostics,
  };
}

export type { ActionResult, RuleExecutionLog };
