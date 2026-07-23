/**
 * 蓝图预览运行时集成 Hook（任务 3.5）
 *
 * 在公开预览页接入蓝图运行时：
 * 1. 编译 blueprint（如果存在）→ CompiledRule[] + diagnostics
 * 2. 使用 useBlueprintRuntimeDeps 构造执行器依赖
 * 3. 维护 apiDataOverrides 状态（refreshDataSource 完成后写入）
 * 4. mount 时触发 pageLoad 事件
 * 5. 暴露 onComponentClick(componentId) 给组件容器 onClick
 * 6. 提供 BlueprintPreviewContextValue 给组件订阅
 *
 * 编辑器画布不调用本 Hook（spec: "编辑器画布不触发蓝图"）。
 * 页面卸载清理由 useBlueprintRuntimeDeps 内部 useEffect 处理（abort 全部请求）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventBlueprint, ScreenComponent } from '@nebula/shared';
import { compileBlueprint, type CompiledRule } from '../compiler/index.js';
import { useBlueprintRuntimeDeps } from './use-blueprint-runtime-deps.js';
import { triggerAndExecute } from './executor.js';
import type { BlueprintPreviewContextValue } from './blueprint-preview-context.js';

export interface BlueprintPreviewRuntime {
  /** Context value，传给 BlueprintPreviewProvider */
  contextValue: BlueprintPreviewContextValue;
  /** 组件点击事件处理器（绑定到组件容器 onClick） */
  onComponentClick: (componentId: string) => void;
  /** 是否实际启用了蓝图运行时（blueprint 存在且编译成功） */
  isEnabled: boolean;
  /** 编译后的规则集（用于调试与诊断展示） */
  compiledRules: CompiledRule[];
}

/**
 * 构造预览页蓝图运行时集成。
 *
 * @param blueprint 项目蓝图（可能为 undefined）
 * @param components 项目组件列表
 */
export function useBlueprintPreviewRuntime(
  blueprint: EventBlueprint | undefined,
  components: readonly ScreenComponent[],
): BlueprintPreviewRuntime {
  // 编译蓝图（仅一次，blueprint 引用变化时重新编译）
  const compileResult = useMemo(() => {
    if (!blueprint) return null;
    const componentIds = new Set(components.map((c) => c.id));
    return compileBlueprint(blueprint, { componentIds });
  }, [blueprint, components]);

  // 任务 4.9：显式排除带 error 级诊断的触发器（spec: "错误级诊断对应的触发器在预览运行时不执行"）
  // 不依赖参数空串匹配等副作用，与沙盒运行时的 refused 语义对齐
  const allDiagnostics = compileResult?.diagnostics ?? [];
  const errorTriggerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const diag of allDiagnostics) {
      if (diag.level === 'error' && diag.nodeId) {
        ids.add(diag.nodeId);
      }
    }
    return ids;
  }, [allDiagnostics]);

  const compiledRules = useMemo(
    () => (compileResult?.rules ?? []).filter((rule) => !errorTriggerIds.has(rule.triggerNodeId)),
    [compileResult?.rules, errorTriggerIds],
  );
  const isEnabled = compiledRules.length > 0;

  // API 数据源 override：refreshDataSource 完成后写入
  const [apiDataOverrides, setApiDataOverrides] = useState<Map<string, unknown>>(() => new Map());

  // 通过 ref 暴露给 useBlueprintRuntimeDeps 的 onRefreshComplete 回调
  // 这样 deps 引用稳定，但回调始终能访问最新的 setState
  const onRefreshComplete = useCallback((componentId: string, data: unknown): void => {
    setApiDataOverrides((prev) => {
      const next = new Map(prev);
      next.set(componentId, data);
      return next;
    });
  }, []);

  // apiDataOverrides 通过 ref 暴露给 getComponentData，避免 deps 频繁重建
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

  // deps 通过 ref 暴露给 onComponentClick 与 pageLoad effect，避免重订阅
  const depsRef = useRef(deps);
  depsRef.current = deps;
  // rules 通过 ref 暴露给事件处理器
  const rulesRef = useRef(compiledRules);
  rulesRef.current = compiledRules;

  // mount 时触发 pageLoad 事件（仅当蓝图启用时）
  useEffect(() => {
    if (!isEnabled) return;
    // 异步触发，避免在 effect 中同步执行产生阻塞
    const run = async (): Promise<void> => {
      await triggerAndExecute(rulesRef.current, { kind: 'pageLoad' }, depsRef.current);
    };
    // 浮动 Promise 由 useEffect 内部 catch 吞掉，避免 unhandled rejection
    void run().catch((err: unknown) => {
      // 静默处理：执行器内部已有 try/catch，此处仅防御
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[blueprint-preview] pageLoad execution failed: ${message}`);
    });
    // 注意：仅 mount 时触发，rules/deps 变化不重新触发（避免重复执行）
  }, [isEnabled]);

  // 组件点击事件处理器
  const onComponentClick = useCallback(
    (componentId: string): void => {
      if (!isEnabled) return;
      const run = async (): Promise<void> => {
        await triggerAndExecute(
          rulesRef.current,
          { kind: 'componentClick', componentId },
          depsRef.current,
        );
      };
      // 浮动 Promise 由内部 catch 吞掉
      void run().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[blueprint-preview] componentClick execution failed: ${message}`);
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
    isEnabled,
    compiledRules,
  };
}
