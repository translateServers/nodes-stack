import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EventBlueprint, ScreenComponent } from '@nebula/shared';

import { compileBlueprint } from '../compiler/compile.js';
import type { CompiledRule } from '../compiler/types.js';
import type { BlueprintPreviewContextValue } from './blueprint-preview-context.js';
import type { ComponentEventCallback } from './component-event-context.js';
import { triggerAndExecute } from './executor.js';
import { useBlueprintRuntimeDeps } from './use-blueprint-runtime-deps.js';
import type { RuntimeDeps, TriggerEvent } from './types.js';

export interface BlueprintPreviewRuntime {
  readonly contextValue: BlueprintPreviewContextValue;
  readonly onComponentClick: (componentId: string) => void;
  readonly onComponentEvent: ComponentEventCallback;
  readonly isEnabled: boolean;
  readonly compiledRules: CompiledRule[];
}

export interface BlueprintPreviewRuntimeOptions {
  readonly enabled?: boolean;
  readonly onNavigateRequest?: (url: string, target: '_blank' | '_self') => void;
  readonly queryRoot?: ParentNode;
}

export function useBlueprintPreviewRuntime(
  blueprint: EventBlueprint | undefined,
  components: readonly ScreenComponent[],
  options: BlueprintPreviewRuntimeOptions = {},
): BlueprintPreviewRuntime {
  const hostEnabled = options.enabled ?? true;
  const compileResult = useMemo(() => {
    if (blueprint === undefined) {
      return null;
    }
    return compileBlueprint(blueprint, {
      componentIds: new Set(components.map((component) => component.id)),
    });
  }, [blueprint, components]);
  const errorNodeIds = useMemo(() => {
    const nodeIds = new Set<string>();
    for (const diagnostic of compileResult?.diagnostics ?? []) {
      if (diagnostic.level === 'error' && diagnostic.nodeId !== undefined) {
        nodeIds.add(diagnostic.nodeId);
      }
    }
    return nodeIds;
  }, [compileResult?.diagnostics]);
  const compiledRules = useMemo(
    () => (compileResult?.rules ?? []).filter((rule) => !errorNodeIds.has(rule.triggerNodeId)),
    [compileResult?.rules, errorNodeIds],
  );
  const isEnabled = hostEnabled && compiledRules.length > 0;
  const runtimeSignature = useMemo(
    () =>
      JSON.stringify({
        blueprint,
        componentIds: components.map((component) => component.id),
        enabled: hostEnabled,
      }),
    [blueprint, components, hostEnabled],
  );

  const [apiDataOverrides, setApiDataOverrides] = useState<Map<string, unknown>>(() => new Map());
  const onRefreshComplete = useCallback((componentId: string, data: unknown): void => {
    setApiDataOverrides((previous) => new Map(previous).set(componentId, data));
  }, []);
  const apiDataOverridesRef = useRef(apiDataOverrides);
  useLayoutEffect(() => {
    apiDataOverridesRef.current = apiDataOverrides;
  }, [apiDataOverrides]);

  const getComponentData = useCallback(
    (componentId: string): unknown => apiDataOverridesRef.current.get(componentId),
    [],
  );
  const {
    deps: baseDeps,
    visibilityOverrides,
    resetVisibility,
    cancelPendingRequests,
  } = useBlueprintRuntimeDeps(components, onRefreshComplete, getComponentData, {
    openUrl: options.onNavigateRequest,
    queryRoot: options.queryRoot,
  });

  const enabledRef = useRef(false);
  const generationRef = useRef(0);
  const depsRef = useRef(baseDeps);
  const rulesRef = useRef(compiledRules);
  useLayoutEffect(() => {
    depsRef.current = baseDeps;
    rulesRef.current = compiledRules;
  }, [baseDeps, compiledRules]);
  useLayoutEffect(() => {
    generationRef.current += 1;
    enabledRef.current = isEnabled;
    cancelPendingRequests();
    resetVisibility();
    setApiDataOverrides((previous) => (previous.size === 0 ? previous : new Map()));
    return () => {
      enabledRef.current = false;
      generationRef.current += 1;
      cancelPendingRequests();
    };
  }, [isEnabled, runtimeSignature, cancelPendingRequests, resetVisibility]);

  const getExecutionDeps = useCallback((): RuntimeDeps | null => {
    if (!enabledRef.current) {
      return null;
    }
    const generation = generationRef.current;
    return createGuardedRuntimeDeps(
      depsRef.current,
      () => enabledRef.current && generationRef.current === generation,
    );
  }, []);

  const runEvent = useCallback(
    (event: TriggerEvent, rules = rulesRef.current): void => {
      const deps = getExecutionDeps();
      if (deps === null) {
        return;
      }
      void triggerAndExecute(rules, event, deps).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[blueprint-preview] execution failed: ${message}`);
      });
    },
    [getExecutionDeps],
  );

  useEffect(() => {
    if (isEnabled) {
      runEvent({ kind: 'pageLoad' });
    }
  }, [isEnabled, runEvent]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    const timers: ReturnType<typeof setInterval>[] = [];
    for (const rule of compiledRules) {
      if (
        rule.triggerEventId !== 'interval' ||
        rule.intervalMs === undefined ||
        rule.intervalMs <= 0
      ) {
        continue;
      }
      timers.push(setInterval(() => runEvent({ kind: 'interval' }, [rule]), rule.intervalMs));
    }
    return () => {
      for (const timer of timers) {
        clearInterval(timer);
      }
    };
  }, [compiledRules, isEnabled, runEvent]);

  const onComponentEvent = useCallback<ComponentEventCallback>(
    (componentId, eventId, payload): void => {
      runEvent({ kind: 'componentEvent', componentId, eventId, payload });
    },
    [runEvent],
  );
  const onComponentClick = useCallback(
    (componentId: string): void => onComponentEvent(componentId, 'click'),
    [onComponentEvent],
  );
  const contextValue = useMemo<BlueprintPreviewContextValue>(
    () => ({ visibilityOverrides, apiDataOverrides }),
    [visibilityOverrides, apiDataOverrides],
  );

  return { contextValue, onComponentClick, onComponentEvent, isEnabled, compiledRules };
}

function createGuardedRuntimeDeps(baseDeps: RuntimeDeps, isActive: () => boolean): RuntimeDeps {
  return {
    applyVisibility: (componentId, visible) => {
      if (isActive()) {
        baseDeps.applyVisibility(componentId, visible);
      }
    },
    getVisibility: baseDeps.getVisibility,
    openUrl: (url, target) => {
      if (isActive()) {
        baseDeps.openUrl(url, target);
      }
    },
    scrollToComponent: (componentId) => {
      if (isActive()) {
        baseDeps.scrollToComponent(componentId);
      }
    },
    refreshDataSource: async (componentId) => {
      if (isActive()) {
        await baseDeps.refreshDataSource(componentId);
      }
    },
    requestApi: async (params) => {
      if (!isActive()) {
        return { ok: false, status: 0, bodyPreview: 'Blueprint runtime is disabled.' };
      }
      return baseDeps.requestApi(params);
    },
    hasComponent: baseDeps.hasComponent,
    logWarning: (message) => {
      if (isActive()) {
        baseDeps.logWarning(message);
      }
    },
    getComponentValue: baseDeps.getComponentValue,
    getComponentData: baseDeps.getComponentData,
  };
}
