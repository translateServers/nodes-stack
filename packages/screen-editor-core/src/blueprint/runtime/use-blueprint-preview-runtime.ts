/**
 * 蓝图预览运行时集成 Hook（任务 3.3 + 3.5）
 *
 * 在预览页与编辑器画布接入蓝图运行时：
 * 1. 编译 blueprint（如果存在）→ CompiledRule[] + diagnostics
 *    - V1 蓝图：使用 V1 编译器 + V1 执行器
 *    - V2 蓝图：使用 V2 编译器 + V2 执行器（任务 3.3）
 * 2. 使用 useBlueprintRuntimeDeps 构造执行器依赖
 * 3. 维护 apiDataOverrides 状态（refreshDataSource 完成后写入）
 * 4. mount 时触发 pageLoad 事件
 * 5. 暴露 onComponentClick(componentId) 给组件容器 onClick（V1 兼容）
 * 6. 暴露 onComponentEvent(componentId, eventId, payload?) 给组件（任务 3.3 + 7.1）
 * 7. 提供 BlueprintPreviewContextValue 给组件订阅
 *
 * 编辑器画布通过 options.enabled 把状态栏开关作为运行时总闸门；独立预览页默认启用。
 * 页面卸载或运行时关闭时由 useBlueprintRuntimeDeps 中止全部请求。
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EventBlueprint, EventBlueprintV2, ScreenComponent } from '@nebula/shared';
import { EVENT_BLUEPRINT_VERSION_V2 } from '@nebula/shared';
import { compileBlueprint, type CompiledRule } from '../compiler/index.js';
import { compileBlueprintV2 } from '../compiler/v2-compile.js';
import type { V2CompiledRule, V2CompileResult, V2Diagnostic } from '../compiler/v2-types.js';
import { useBlueprintRuntimeDeps } from './use-blueprint-runtime-deps.js';
import { triggerAndExecute } from './executor.js';
import { triggerAndExecuteV2 } from './v2-executor.js';
import type { V2RuntimeDeps, V2TriggerEvent } from './v2-types.js';
import type { RuntimeDeps, TriggerEventType } from './types.js';
import type { BlueprintPreviewContextValue } from './blueprint-preview-context.js';
import type { ComponentEventCallback } from './component-event-context.js';

export interface BlueprintPreviewRuntime {
  /** Context value，传给 BlueprintPreviewProvider */
  contextValue: BlueprintPreviewContextValue;
  /** 组件点击事件处理器（绑定到组件容器 onClick） */
  onComponentClick: (componentId: string) => void;
  /**
   * V2 组件事件回调（任务 3.3 + 7.1）。
   * - V2 蓝图：按 componentId + eventId 派发到匹配规则
   * - V1 蓝图：将 eventId 映射为 V1 触发事件类型（click → componentClick, hover → componentHover, ...）
   * - 编辑态 / 未启用：no-op
   */
  onComponentEvent: ComponentEventCallback;
  /** 是否实际启用了蓝图运行时（宿主允许且 blueprint 存在并编译成功） */
  isEnabled: boolean;
  /** 编译后的规则集（用于调试与诊断展示） */
  compiledRules: CompiledRule[];
  /** V2 编译后的规则集（V2 蓝图时有值，V1 时为空数组） */
  compiledRulesV2: V2CompiledRule[];
}

export interface BlueprintPreviewRuntimeOptions {
  /** 宿主级运行时总闸门。默认 true，独立预览页无需感知编辑器本地偏好。 */
  enabled?: boolean;
  onNavigateRequest?: (url: string, target: '_blank' | '_self') => void;
  queryRoot?: ParentNode;
}

/** V2 eventId → V1 组件事件类型映射；全局 pageLoad/interval 只允许由运行时调度。 */
const V1_EVENT_ID_MAP = {
  click: 'componentClick',
  hover: 'componentHover',
  dataLoaded: 'dataLoaded',
  dataError: 'dataError',
} as const satisfies Record<string, TriggerEventType['kind']>;

/**
 * 构造预览页蓝图运行时集成。
 *
 * @param blueprint 项目蓝图（V1 或 V2，可能为 undefined）
 * @param components 项目组件列表
 * @param options 宿主运行策略；编辑器画布通过 enabled 接入状态栏总开关
 *
 * 行为：
 * - V1 蓝图：保留 V1 编译器/执行器，组件事件回调映射 click / hover /
 *   dataLoaded / dataError；pageLoad / interval 仅由运行时自身调度
 * - V2 蓝图：使用 V2 编译器/执行器，支持任意 eventId（与组件注册表对齐）
 */
export function useBlueprintPreviewRuntime(
  blueprint: EventBlueprint | EventBlueprintV2 | undefined,
  components: readonly ScreenComponent[],
  options: BlueprintPreviewRuntimeOptions = {},
): BlueprintPreviewRuntime {
  const hostEnabled = options.enabled ?? true;
  // ===== 版本检测 =====
  const isV2 = blueprint?.version === EVENT_BLUEPRINT_VERSION_V2;
  const v1Blueprint = !isV2 && blueprint !== undefined ? blueprint : undefined;
  const v2Blueprint = isV2 ? blueprint : undefined;

  // ===== V1 编译（仅 V1 蓝图时执行）=====
  const v1CompileResult = useMemo(() => {
    if (!v1Blueprint) return null;
    const componentIds = new Set(components.map((c) => c.id));
    return compileBlueprint(v1Blueprint, { componentIds });
  }, [v1Blueprint, components]);

  // ===== V2 编译（仅 V2 蓝图时执行）=====
  const v2CompileResult = useMemo<V2CompileResult | null>(() => {
    if (!v2Blueprint) return null;
    const componentIds = new Set(components.map((c) => c.id));
    return compileBlueprintV2(v2Blueprint, { componentIds });
  }, [v2Blueprint, components]);

  // ===== 错误诊断排除（V1 + V2 共用）=====
  const v1AllDiagnostics = v1CompileResult?.diagnostics;
  const v1ErrorTriggerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const diag of v1AllDiagnostics ?? []) {
      if (diag.level === 'error' && diag.nodeId) {
        ids.add(diag.nodeId);
      }
    }
    return ids;
  }, [v1AllDiagnostics]);

  const v1CompiledRules = useMemo(
    () =>
      (v1CompileResult?.rules ?? []).filter((rule) => !v1ErrorTriggerIds.has(rule.triggerNodeId)),
    [v1CompileResult?.rules, v1ErrorTriggerIds],
  );

  // V2：错误级诊断的 trigger 节点对应的规则全部排除
  const v2AllDiagnostics: readonly V2Diagnostic[] | undefined = v2CompileResult?.diagnostics;
  const v2ErrorNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const diag of v2AllDiagnostics ?? []) {
      if (diag.level === 'error' && diag.nodeId) {
        ids.add(diag.nodeId);
      }
    }
    return ids;
  }, [v2AllDiagnostics]);

  const v2CompiledRules = useMemo(
    () => (v2CompileResult?.rules ?? []).filter((rule) => !v2ErrorNodeIds.has(rule.triggerNodeId)),
    [v2CompileResult?.rules, v2ErrorNodeIds],
  );

  const hasExecutableRules = v1CompiledRules.length > 0 || v2CompiledRules.length > 0;
  const isEnabled = hostEnabled && hasExecutableRules;
  const isEnabledRef = useRef(false);
  const runtimeGenerationRef = useRef(0);

  // ===== API 数据源 override =====
  const [apiDataOverrides, setApiDataOverrides] = useState<Map<string, unknown>>(() => new Map());

  const onRefreshComplete = useCallback((componentId: string, data: unknown): void => {
    if (!isEnabledRef.current) return;
    setApiDataOverrides((prev) => {
      const next = new Map(prev);
      next.set(componentId, data);
      return next;
    });
  }, []);

  const apiDataOverridesRef = useRef(apiDataOverrides);
  useLayoutEffect(() => {
    apiDataOverridesRef.current = apiDataOverrides;
  }, [apiDataOverrides]);

  const getComponentData = useCallback(
    (componentId: string): Record<string, unknown> | undefined => {
      return apiDataOverridesRef.current.get(componentId) as Record<string, unknown> | undefined;
    },
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

  // deps / rules 仅在 commit 后更新，避免并发渲染中事件读取未提交状态。
  const baseDepsRef = useRef(baseDeps);
  const v1RulesRef = useRef(v1CompiledRules);
  const v2RulesRef = useRef(v2CompiledRules);
  useLayoutEffect(() => {
    baseDepsRef.current = baseDeps;
    v1RulesRef.current = v1CompiledRules;
    v2RulesRef.current = v2CompiledRules;
  }, [baseDeps, v1CompiledRules, v2CompiledRules]);

  /**
   * 每次启停或蓝图切换都开启新执行代际。旧异步链持有旧代际，即使随后重新开启，
   * 也无法继续执行副作用；cleanup 同时覆盖卸载场景。
   */
  useLayoutEffect(() => {
    runtimeGenerationRef.current += 1;
    isEnabledRef.current = isEnabled;
    cancelPendingRequests();
    resetVisibility();
    setApiDataOverrides((prev) => (prev.size === 0 ? prev : new Map()));
    return () => {
      isEnabledRef.current = false;
      runtimeGenerationRef.current += 1;
      cancelPendingRequests();
    };
  }, [isEnabled, blueprint, cancelPendingRequests, resetVisibility]);

  const getExecutionDeps = useCallback((): {
    v1: RuntimeDeps;
    v2: V2RuntimeDeps;
  } | null => {
    if (!isEnabledRef.current) return null;
    const generation = runtimeGenerationRef.current;
    const isActive = (): boolean =>
      isEnabledRef.current && runtimeGenerationRef.current === generation;
    const v1 = createGuardedRuntimeDeps(baseDepsRef.current, isActive);
    return { v1, v2: adaptV1DepsToV2(v1) };
  }, []);

  // mount 时触发 pageLoad 事件（仅当蓝图启用时）
  useEffect(() => {
    if (!isEnabled) return;
    const executionDeps = getExecutionDeps();
    if (!executionDeps) return;
    // V2 优先：V2 蓝图使用 V2 触发事件
    if (v2RulesRef.current.length > 0) {
      const run = async (): Promise<void> => {
        await triggerAndExecuteV2(v2RulesRef.current, { kind: 'pageLoad' }, executionDeps.v2);
      };
      void run().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[blueprint-preview-v2] pageLoad execution failed: ${message}`);
      });
      return;
    }
    // V1 兼容：V1 蓝图使用 V1 触发事件
    const run = async (): Promise<void> => {
      await triggerAndExecute(v1RulesRef.current, { kind: 'pageLoad' }, executionDeps.v1);
    };
    void run().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[blueprint-preview] pageLoad execution failed: ${message}`);
    });
  }, [isEnabled, blueprint, getExecutionDeps]);

  // ===== V1 interval 触发器调度（任务 5）=====
  // V2 蓝图的 interval 调度在下方独立 effect 中处理。
  // 规则集变化时（依赖变化）自动清理重建，避免浮动定时器与内存泄漏。
  useEffect(() => {
    if (!isEnabled) return;
    // V2 蓝图不建立 V1 interval 调度
    if (v1CompiledRules.length === 0 || v2CompiledRules.length > 0) return;
    const intervalRules = v1CompiledRules.filter((rule) => rule.triggerConfig.type === 'interval');
    if (intervalRules.length === 0) return;
    const intervalIds: ReturnType<typeof setInterval>[] = [];
    for (const rule of intervalRules) {
      const triggerConfig = rule.triggerConfig;
      if (triggerConfig.type !== 'interval') continue;
      const intervalMs = triggerConfig.intervalMs;
      const id = setInterval((): void => {
        const executionDeps = getExecutionDeps();
        if (!executionDeps) return;
        const run = async (): Promise<void> => {
          await triggerAndExecute([rule], { kind: 'interval' }, executionDeps.v1);
        };
        void run().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[blueprint-preview] interval execution failed: ${message}`);
        });
      }, intervalMs);
      intervalIds.push(id);
    }
    return (): void => {
      for (const id of intervalIds) {
        clearInterval(id);
      }
    };
  }, [isEnabled, v1CompiledRules, v2CompiledRules, getExecutionDeps]);

  // ===== V2 interval 触发器调度 =====
  // V2 蓝图的 interval 规则通过 setInterval 周期触发。
  // 规则集变化时（依赖变化）自动清理重建，避免浮动定时器与内存泄漏。
  useEffect(() => {
    if (!isEnabled) return;
    if (v2CompiledRules.length === 0) return;
    const intervalRules = v2CompiledRules.filter((rule) => rule.triggerEventId === 'interval');
    if (intervalRules.length === 0) return;
    const intervalIds: ReturnType<typeof setInterval>[] = [];
    for (const rule of intervalRules) {
      const intervalMs = rule.intervalMs;
      if (intervalMs === undefined || intervalMs <= 0) continue;
      const id = setInterval((): void => {
        const executionDeps = getExecutionDeps();
        if (!executionDeps) return;
        const run = async (): Promise<void> => {
          await triggerAndExecuteV2([rule], { kind: 'interval' }, executionDeps.v2);
        };
        void run().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[blueprint-preview-v2] interval execution failed: ${message}`);
        });
      }, intervalMs);
      intervalIds.push(id);
    }
    return (): void => {
      for (const id of intervalIds) {
        clearInterval(id);
      }
    };
  }, [isEnabled, v2CompiledRules, getExecutionDeps]);

  // ===== V1 onComponentClick =====
  const onComponentClick = useCallback(
    (componentId: string): void => {
      const executionDeps = getExecutionDeps();
      if (!executionDeps) return;
      // V2 优先：将 click 映射为 V2 componentEvent
      if (v2RulesRef.current.length > 0) {
        const run = async (): Promise<void> => {
          await triggerAndExecuteV2(
            v2RulesRef.current,
            { kind: 'componentEvent', componentId, eventId: 'click' },
            executionDeps.v2,
          );
        };
        void run().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[blueprint-preview-v2] componentClick execution failed: ${message}`);
        });
        return;
      }
      // V1 兼容
      const run = async (): Promise<void> => {
        await triggerAndExecute(
          v1RulesRef.current,
          { kind: 'componentClick', componentId },
          executionDeps.v1,
        );
      };
      void run().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[blueprint-preview] componentClick execution failed: ${message}`);
      });
    },
    [getExecutionDeps],
  );

  // ===== V2 onComponentEvent（任务 3.3 + 7.1）=====
  const onComponentEvent = useCallback<ComponentEventCallback>(
    (componentId, eventId): void => {
      const executionDeps = getExecutionDeps();
      if (!executionDeps) return;
      // V2 优先
      if (v2RulesRef.current.length > 0) {
        const event: V2TriggerEvent = { kind: 'componentEvent', componentId, eventId };
        const run = async (): Promise<void> => {
          await triggerAndExecuteV2(v2RulesRef.current, event, executionDeps.v2);
        };
        void run().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[blueprint-preview-v2] componentEvent execution failed: ${message}`);
        });
        return;
      }
      // V1 兼容：将 V2 eventId 映射回 V1 触发事件类型
      const v1TriggerKind = V1_EVENT_ID_MAP[eventId as keyof typeof V1_EVENT_ID_MAP];
      if (!v1TriggerKind) return; // V1 不支持的事件类型，静默
      const event: TriggerEventType = { kind: v1TriggerKind, componentId };
      const run = async (): Promise<void> => {
        await triggerAndExecute(v1RulesRef.current, event, executionDeps.v1);
      };
      void run().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[blueprint-preview] componentEvent execution failed: ${message}`);
      });
    },
    [getExecutionDeps],
  );

  const contextValue = useMemo<BlueprintPreviewContextValue>(
    () => ({
      visibilityOverrides,
      apiDataOverrides,
    }),
    [visibilityOverrides, apiDataOverrides],
  );

  return {
    contextValue,
    onComponentClick,
    onComponentEvent,
    isEnabled,
    compiledRules: v1CompiledRules,
    compiledRulesV2: v2CompiledRules,
  };
}

/** 为单次执行创建带代际校验的依赖快照。 */
function createGuardedRuntimeDeps(baseDeps: RuntimeDeps, isActive: () => boolean): RuntimeDeps {
  return {
    applyVisibility: (componentId, visible) => {
      if (isActive()) baseDeps.applyVisibility(componentId, visible);
    },
    getVisibility: baseDeps.getVisibility,
    openUrl: (url, target) => {
      if (isActive()) baseDeps.openUrl(url, target);
    },
    scrollToComponent: (componentId) => {
      if (isActive()) baseDeps.scrollToComponent(componentId);
    },
    refreshDataSource: async (componentId) => {
      if (!isActive()) return;
      await baseDeps.refreshDataSource(componentId);
    },
    requestApi: async (params) => {
      if (!isActive()) {
        return { ok: false, status: 0, bodyPreview: 'Blueprint runtime disabled' };
      }
      return baseDeps.requestApi(params);
    },
    hasComponent: baseDeps.hasComponent,
    logWarning: (message) => {
      if (isActive()) baseDeps.logWarning(message);
    },
    getComponentValue: baseDeps.getComponentValue,
    getComponentData: baseDeps.getComponentData,
  };
}

/**
 * 将 V1 RuntimeDeps 适配为 V2RuntimeDeps。
 *
 * 差异点：
 * - getVisibility：V1 返回 `boolean | undefined`，V2 期望 `boolean`（undefined 视为 true）
 * - getComponentValue：V1 返回 `unknown`，V2 期望 `Record<string, unknown> | undefined`
 * - requestApi：参数与返回类型结构一致，但 V1 method 为字面量联合，V2 为 string
 *   （运行时一致，仅类型层差异，直接复用即可）
 */
function adaptV1DepsToV2(deps: RuntimeDeps): V2RuntimeDeps {
  return {
    hasComponent: deps.hasComponent,
    getComponentValue: (componentId: string): Record<string, unknown> | undefined => {
      const value = deps.getComponentValue(componentId);
      if (value == null) return undefined;
      if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
      return undefined;
    },
    getComponentData: deps.getComponentData,
    applyVisibility: deps.applyVisibility,
    getVisibility: (componentId: string): boolean => {
      return deps.getVisibility(componentId) ?? true;
    },
    refreshDataSource: deps.refreshDataSource,
    scrollToComponent: deps.scrollToComponent,
    openUrl: deps.openUrl,
    requestApi: async (config) => {
      const result = await deps.requestApi({
        method: config.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url: config.url,
        headers: config.headers,
        body: config.body,
        secretHeaderKeys: config.secretHeaderKeys,
        timeoutMs: config.timeoutMs,
      });
      return {
        ok: result.ok,
        status: result.status,
        bodyPreview: result.bodyPreview,
      };
    },
    logWarning: deps.logWarning,
  };
}
