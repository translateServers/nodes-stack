/**
 * 蓝图预览运行时集成 Hook（任务 3.3 + 3.5）
 *
 * 在公开预览页接入蓝图运行时：
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
 * 编辑器画布不调用本 Hook（spec: "编辑器画布不触发蓝图"）。
 * 页面卸载清理由 useBlueprintRuntimeDeps 内部 useEffect 处理（abort 全部请求）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventBlueprint, EventBlueprintV2, ScreenComponent } from '@nebula/shared';
import { EVENT_BLUEPRINT_VERSION_V2 } from '@nebula/shared';
import { compileBlueprint, type CompiledRule } from '../compiler/index.js';
import { compileBlueprintV2 } from '../compiler/v2-compile.js';
import type { V2CompiledRule, V2CompileResult, V2Diagnostic } from '../compiler/v2-types.js';
import { useBlueprintRuntimeDeps } from './use-blueprint-runtime-deps.js';
import { triggerAndExecute } from './executor.js';
import { triggerAndExecuteV2 } from './v2-executor.js';
import type { V2RuntimeDeps, V2TriggerEvent } from './v2-types.js';
import type { RuntimeDeps } from './types.js';
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
  /** 是否实际启用了蓝图运行时（blueprint 存在且编译成功） */
  isEnabled: boolean;
  /** 编译后的规则集（用于调试与诊断展示） */
  compiledRules: CompiledRule[];
  /** V2 编译后的规则集（V2 蓝图时有值，V1 时为空数组） */
  compiledRulesV2: V2CompiledRule[];
}

/** V1 trigger 事件类型 → V2 eventId 映射（反向用于 V1 蓝图兼容 V2 事件回调） */
const V1_EVENT_ID_MAP: Record<string, string> = {
  click: 'componentClick',
  hover: 'componentHover',
  dataLoaded: 'dataLoaded',
  dataError: 'dataError',
  pageLoad: 'pageLoad',
  interval: 'interval',
};

/**
 * 构造预览页蓝图运行时集成。
 *
 * @param blueprint 项目蓝图（V1 或 V2，可能为 undefined）
 * @param components 项目组件列表
 *
 * 行为：
 * - V1 蓝图：保留 V1 编译器/执行器，仅支持 onComponentClick（componentClick）
 *   onComponentEvent 调用时仅 'click' / 'hover' 事件被映射到 V1 componentClick/componentHover
 * - V2 蓝图：使用 V2 编译器/执行器，支持任意 eventId（与组件注册表对齐）
 */
export function useBlueprintPreviewRuntime(
  blueprint: EventBlueprint | EventBlueprintV2 | undefined,
  components: readonly ScreenComponent[],
): BlueprintPreviewRuntime {
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
  const v1AllDiagnostics = v1CompileResult?.diagnostics ?? [];
  const v1ErrorTriggerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const diag of v1AllDiagnostics) {
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
  const v2AllDiagnostics: readonly V2Diagnostic[] = v2CompileResult?.diagnostics ?? [];
  const v2ErrorNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const diag of v2AllDiagnostics) {
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

  const isEnabled = v1CompiledRules.length > 0 || v2CompiledRules.length > 0;

  // ===== API 数据源 override =====
  const [apiDataOverrides, setApiDataOverrides] = useState<Map<string, unknown>>(() => new Map());

  const onRefreshComplete = useCallback((componentId: string, data: unknown): void => {
    setApiDataOverrides((prev) => {
      const next = new Map(prev);
      next.set(componentId, data);
      return next;
    });
  }, []);

  const apiDataOverridesRef = useRef(apiDataOverrides);
  apiDataOverridesRef.current = apiDataOverrides;

  const getComponentData = useCallback(
    (componentId: string): Record<string, unknown> | undefined => {
      return apiDataOverridesRef.current.get(componentId) as Record<string, unknown> | undefined;
    },
    [],
  );

  const { deps, visibilityOverrides } = useBlueprintRuntimeDeps(
    components,
    onRefreshComplete,
    getComponentData,
  );

  // V2 RuntimeDeps 适配器：将 V1 RuntimeDeps 适配为 V2RuntimeDeps
  // 主要差异：getVisibility 返回 boolean（V2 不允许 undefined）；getComponentValue 返回 Record | undefined
  const v2Deps = useMemo<V2RuntimeDeps>(() => adaptV1DepsToV2(deps), [deps]);

  // deps / rules 通过 ref 暴露，避免重订阅
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const v2DepsRef = useRef(v2Deps);
  v2DepsRef.current = v2Deps;
  const v1RulesRef = useRef(v1CompiledRules);
  v1RulesRef.current = v1CompiledRules;
  const v2RulesRef = useRef(v2CompiledRules);
  v2RulesRef.current = v2CompiledRules;

  // mount 时触发 pageLoad 事件（仅当蓝图启用时）
  useEffect(() => {
    if (!isEnabled) return;
    // V2 优先：V2 蓝图使用 V2 触发事件
    if (v2RulesRef.current.length > 0) {
      const run = async (): Promise<void> => {
        await triggerAndExecuteV2(v2RulesRef.current, { kind: 'pageLoad' }, v2DepsRef.current);
      };
      void run().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[blueprint-preview-v2] pageLoad execution failed: ${message}`);
      });
      return;
    }
    // V1 兼容：V1 蓝图使用 V1 触发事件
    const run = async (): Promise<void> => {
      await triggerAndExecute(v1RulesRef.current, { kind: 'pageLoad' }, depsRef.current);
    };
    void run().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[blueprint-preview] pageLoad execution failed: ${message}`);
    });
  }, [isEnabled]);

  // ===== V1 interval 触发器调度（任务 5）=====
  // V2 蓝图不支持 interval 触发器（globalType enum 不包含 interval），仅在 V1 模式下启用。
  // 规则集变化时（依赖变化）自动清理重建，避免浮动定时器与内存泄漏。
  useEffect(() => {
    if (!isEnabled) return;
    // V2 蓝图不建立 interval 调度
    if (v1CompiledRules.length === 0 || v2CompiledRules.length > 0) return;
    const intervalRules = v1CompiledRules.filter((rule) => rule.triggerConfig.type === 'interval');
    if (intervalRules.length === 0) return;
    const intervalIds: ReturnType<typeof setInterval>[] = [];
    for (const rule of intervalRules) {
      const triggerConfig = rule.triggerConfig;
      if (triggerConfig.type !== 'interval') continue;
      const intervalMs = triggerConfig.intervalMs;
      const id = setInterval((): void => {
        const run = async (): Promise<void> => {
          await triggerAndExecute(v1RulesRef.current, { kind: 'interval' }, depsRef.current);
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
  }, [isEnabled, v1CompiledRules, v2CompiledRules]);

  // ===== V1 onComponentClick =====
  const onComponentClick = useCallback(
    (componentId: string): void => {
      if (!isEnabled) return;
      // V2 优先：将 click 映射为 V2 componentEvent
      if (v2RulesRef.current.length > 0) {
        const run = async (): Promise<void> => {
          await triggerAndExecuteV2(
            v2RulesRef.current,
            { kind: 'componentEvent', componentId, eventId: 'click' },
            v2DepsRef.current,
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
          depsRef.current,
        );
      };
      void run().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[blueprint-preview] componentClick execution failed: ${message}`);
      });
    },
    [isEnabled],
  );

  // ===== V2 onComponentEvent（任务 3.3 + 7.1）=====
  const onComponentEvent = useCallback<ComponentEventCallback>(
    (componentId, eventId): void => {
      if (!isEnabled) return;
      // V2 优先
      if (v2RulesRef.current.length > 0) {
        const event: V2TriggerEvent = { kind: 'componentEvent', componentId, eventId };
        const run = async (): Promise<void> => {
          await triggerAndExecuteV2(v2RulesRef.current, event, v2DepsRef.current);
        };
        void run().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[blueprint-preview-v2] componentEvent execution failed: ${message}`);
        });
        return;
      }
      // V1 兼容：将 V2 eventId 映射回 V1 触发事件类型
      const v1TriggerKind = V1_EVENT_ID_MAP[eventId];
      if (!v1TriggerKind) return; // V1 不支持的事件类型，静默
      const run = async (): Promise<void> => {
        await triggerAndExecute(
          v1RulesRef.current,
          // V1 触发事件 kind 与 V2 eventId 一一对应（componentClick / componentHover / ...）
          { kind: v1TriggerKind as 'componentClick' | 'componentHover', componentId },
          depsRef.current,
        );
      };
      void run().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[blueprint-preview] componentEvent execution failed: ${message}`);
      });
    },
    [isEnabled],
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
