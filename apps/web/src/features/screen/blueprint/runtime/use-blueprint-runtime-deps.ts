/**
 * 蓝图运行时执行器依赖注入 Hook（任务 3.4 + 3.5）
 *
 * 职责：
 * - 维护预览可见性覆盖表（setVisibility 动作写入；不改写项目数据）
 * - 实现 refreshDataSource 动作：复用阶段 2 API 数据源 Hook 的取消协议与竞态防护
 *   - 同一组件新刷新请求触发时中止旧请求（ AbortController ）
 *   - 乱序响应不覆盖：仅最新请求的结果才会通过 onRefreshComplete 回调上报
 *   - 组件卸载时中止所有进行中请求，无浮动 Promise
 * - 提供 navigate / scrollToComponent / hasComponent 等执行器依赖
 *
 * 不在这里做的事：
 * - 编辑器画布不调用本 Hook（spec: "编辑器画布不触发蓝图"）
 * - 不改写项目数据，可见性仅作用于预览覆盖表
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import type { RuntimeDeps, VisibilityOverrides } from './types.js';
import { API_REQUEST_TIMEOUT_MS, buildUrlWithParams } from '../../hooks/use-api-data-source.js';

/** 单次刷新请求的内部状态 */
interface RefreshRequest {
  controller: AbortController;
  /** 序号：用于乱序响应检测，仅最新序号的响应才会上报 */
  seq: number;
}

/** 刷新成功回调：将数据回写到组件的 API 数据源缓存 */
export type RefreshCompleteHandler = (componentId: string, data: unknown) => void;

/**
 * 当前页面的导航函数（用于 _self 链接跳转）。
 *
 * 设计为模块级可替换引用，原因：
 * - jsdom 中 `window.location.href` 与 `window.location.assign` 均为 non-configurable，
 *   无法用 vi.spyOn / Object.defineProperty mock
 * - 通过模块级引用，测试可临时替换（详见 `__setNavigateSelfForTest`）
 *
 * 生产代码默认调用 `window.location.assign(url)`，与 `href = url` 语义等价。
 */
let navigateSelf: (url: string) => void = (url: string): void => {
  window.location.assign(url);
};

/**
 * 测试专用：替换 _self 导航实现。
 * 仅在测试环境中使用，生产代码不应调用。
 * @internal
 */
export function __setNavigateSelfForTest(fn: (url: string) => void): () => void {
  const original = navigateSelf;
  navigateSelf = fn;
  return (): void => {
    navigateSelf = original;
  };
}

/** CSS selector 转义：避免特殊字符（如 . / :) 破坏选择器 */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  // 退化：替换常见特殊字符
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * 构造蓝图运行时执行器依赖。
 *
 * @param components 当前项目组件列表（用于 hasComponent 判定）
 * @param onRefreshComplete 数据源刷新成功回调（预览页可据此更新组件 API 缓存）
 */
export function useBlueprintRuntimeDeps(
  components: readonly ScreenComponent[],
  onRefreshComplete?: RefreshCompleteHandler,
): {
  deps: RuntimeDeps;
  visibilityOverrides: VisibilityOverrides;
  resetVisibility: () => void;
} {
  const [visibilityOverrides, setVisibilityOverrides] = useState<VisibilityOverrides>(
    () => new Map<string, boolean>(),
  );
  // 保留最新 components 引用，避免 deps 闭包捕获到过期值
  const componentsRef = useRef(components);
  componentsRef.current = components;
  const onRefreshCompleteRef = useRef(onRefreshComplete);
  onRefreshCompleteRef.current = onRefreshComplete;

  // 每个组件的进行中请求：componentId -> RefreshRequest
  const requestsRef = useRef<Map<string, RefreshRequest>>(new Map());
  // 全局序号：递增分配，用于乱序响应检测
  const seqRef = useRef(0);

  // 卸载时中止所有进行中请求（无浮动 Promise）
  useEffect(() => {
    return () => {
      for (const req of requestsRef.current.values()) {
        req.controller.abort();
      }
      requestsRef.current.clear();
    };
  }, []);

  const hasComponent = useCallback((componentId: string): boolean => {
    return componentsRef.current.some((c) => c.id === componentId);
  }, []);

  const applyVisibility = useCallback((componentId: string, visible: boolean): void => {
    setVisibilityOverrides((prev) => {
      const next = new Map(prev);
      next.set(componentId, visible);
      return next;
    });
  }, []);

  const getVisibility = useCallback(
    (componentId: string): boolean | undefined => {
      return visibilityOverrides.get(componentId);
    },
    [visibilityOverrides],
  );

  const openUrl = useCallback((url: string, target: '_blank' | '_self'): void => {
    if (target === '_blank') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigateSelf(url);
    }
  }, []);

  const scrollToComponent = useCallback((componentId: string): void => {
    // 优先使用预览专属属性（避免与编辑器 CanvasComponentWrapper 的 data-component-id 冲突）
    const escaped = cssEscape(componentId);
    const el = document.querySelector<HTMLElement>(
      `[data-preview-component-id="${escaped}"], [data-component-id="${escaped}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, []);

  const logWarning = useCallback((message: string): void => {
    console.warn(`[blueprint-runtime] ${message}`);
  }, []);

  /**
   * refreshDataSource 实现：复用阶段 2 取消协议。
   *
   * - 同组件新请求触发时中止旧请求
   * - 仅最新序号的响应才会上报（防乱序覆盖）
   * - 失败（network / http / timeout / parse）静默吞掉，仅日志记录，不抛错
   *   （执行器契约：失败动作不中断后续独立动作）
   */
  const refreshDataSource = useCallback(async (componentId: string): Promise<void> => {
    const component = componentsRef.current.find((c) => c.id === componentId);
    // dangling 已由 executor 上层判定跳过；此处仍防御性检查
    if (!component) return;
    const dataSource = component.dataSource;
    if (dataSource?.type !== 'api') return; // 非可刷新数据源，直接成功
    const apiConfig = dataSource.apiConfig;

    // 中止旧请求（竞态防护）
    const old = requestsRef.current.get(componentId);
    if (old) {
      old.controller.abort();
    }
    const controller = new AbortController();
    const seq = ++seqRef.current;
    requestsRef.current.set(componentId, { controller, seq });

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, API_REQUEST_TIMEOUT_MS);

    try {
      const url = buildUrlWithParams(apiConfig.url, apiConfig.params);
      const headers =
        apiConfig.headers !== undefined
          ? Object.fromEntries(
              Object.entries(apiConfig.headers).filter(([, v]) => v !== '[REDACTED]'),
            )
          : undefined;
      const response = await fetch(url, {
        method: 'GET',
        headers: headers !== undefined && Object.keys(headers).length > 0 ? headers : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        return; // http 错误，静默
      }
      const data: unknown = await response.json();
      // 乱序响应检测：仅最新序号响应才回写
      const current = requestsRef.current.get(componentId);
      if (current?.seq !== seq) return;
      if (controller.signal.aborted) return;
      onRefreshCompleteRef.current?.(componentId, data);
    } catch {
      // 网络/超时/中止：静默吞掉，执行器包裹 try/catch 但此处也防御性处理
    } finally {
      clearTimeout(timeoutId);
      // 仅在仍是当前请求时清理
      const current = requestsRef.current.get(componentId);
      if (current?.seq === seq) {
        requestsRef.current.delete(componentId);
      }
    }
  }, []);

  const resetVisibility = useCallback((): void => {
    setVisibilityOverrides(new Map());
  }, []);

  const deps = useMemo<RuntimeDeps>(
    () => ({
      applyVisibility,
      getVisibility,
      openUrl,
      scrollToComponent,
      refreshDataSource,
      hasComponent,
      logWarning,
    }),
    [
      applyVisibility,
      getVisibility,
      openUrl,
      scrollToComponent,
      refreshDataSource,
      hasComponent,
      logWarning,
    ],
  );

  return { deps, visibilityOverrides, resetVisibility };
}
