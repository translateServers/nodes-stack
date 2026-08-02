/**
 * Fake 宿主数据适配器（测试/演示）。
 *
 * 模拟 XJ 后端 `host/xj-metric` 执行：
 * - execute 按 metricId 返回模拟数据
 * - 可注入失败与延迟
 * - 尊重 AbortSignal
 *
 * 仅用于 A1 契约切片与测试；生产由 XJ Vue adapter 实现。
 */

import type {
  ScreenDataAdapterPort,
  ScreenDataExecutionContext,
  ScreenDataExecuteRequest,
  ScreenDataMetricResource,
} from '@nebula/screen-editor-core/dynamic';

export interface FakeMetricDataset {
  readonly metricId: number;
  readonly code: string;
  readonly name: string;
  readonly rows: Array<Record<string, string | number | null>>;
}

export interface FakeScreenDataAdapterOptions {
  readonly datasets: readonly FakeMetricDataset[];
  readonly delayMs?: number;
  readonly failMetricIds?: readonly number[];
  readonly contextHistory?: string[];
}

export function createFakeScreenDataAdapter(
  options: FakeScreenDataAdapterOptions,
): ScreenDataAdapterPort & {
  readonly openedContexts: ScreenDataExecutionContext[];
  readonly closedContexts: string[];
  readonly syncCount: number;
} {
  const openedContexts: ScreenDataExecutionContext[] = [];
  const closedContexts: string[] = [];
  let syncCount = 0;
  const delay = (ms: number, signal: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        if (signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        resolve();
      }, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('aborted', 'AbortError'));
        },
        { once: true },
      );
    });

  return {
    openedContexts,
    closedContexts,
    syncCount,
    resourceList: async (signal) => {
      const resources: ScreenDataMetricResource[] = options.datasets.map((dataset) => ({
        metricId: dataset.metricId,
        code: dataset.code,
        name: dataset.name,
        status: 1,
      }));
      if (options.delayMs !== undefined) {
        await delay(options.delayMs, signal ?? new AbortController().signal);
      }
      return resources;
    },
    openContext: (context) => {
      openedContexts.push(context);
      return Promise.resolve();
    },
    syncContext: () => {
      syncCount += 1;
      return Promise.resolve();
    },
    closeContext: (contextId) => {
      closedContexts.push(contextId);
      return Promise.resolve();
    },
    execute: async (request: ScreenDataExecuteRequest, signal) => {
      if (options.delayMs !== undefined) {
        await delay(options.delayMs, signal);
      }
      const params = request.intent.params as
        | { metricId?: number; binding?: Record<string, unknown> }
        | undefined;
      const metricId = params?.metricId;
      const dataset = options.datasets.find((item) => item.metricId === metricId);
      if (dataset === undefined) {
        throw new Error(`指标 ${metricId ?? 'unknown'} 不存在`);
      }
      if (options.failMetricIds?.includes(metricId ?? -1)) {
        throw new Error(`指标 ${metricId} 执行失败（fake）`);
      }
      return { data: dataset.rows };
    },
  };
}
