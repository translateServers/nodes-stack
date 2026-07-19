/**
 * API 数据源 E2E Mock 工具（阶段 2 任务 0.3）
 *
 * 用 Playwright `page.route` 拦截组件数据源请求，覆盖四种场景：
 * - mockApiSuccess：成功响应（默认 [{ name, value }] 示例数据）
 * - mockApiFailure：失败响应（HTTP 非 2xx 或网络层中止）
 * - mockApiSlow：慢响应（延迟后成功，用于加载态断言）
 * - mockApiEmpty：空数据响应（解析成功零条，用于空态断言）
 *
 * 约定：
 * - 拦截目标是组件 apiConfig.url 指向的"外部数据接口"，不是 Nebula 后端
 *   `/api/v1/*`；Mock 不依赖真实外部网络。
 * - 每个 mock 函数返回 ApiMockHandle，可读取请求计数（供定时刷新计数断言）
 *   或解除拦截。
 * - 本文件只提供 helper 与类型，不包含测试用例；定位契约见
 *   .trae/specs/layer-component-config/baseline.md §0.3。
 */

import type { Page, Route } from '@playwright/test';

/** 默认 Mock 接口地址：不存在的专用域名，必须全程被 route 拦截 */
export const DEFAULT_MOCK_API_URL = 'https://mock-data.nebula.e2e/chart';

/** URL 匹配条件：glob 字符串或正则 */
export type ApiUrlMatch = string | RegExp;

/** 四种场景共用的基础选项 */
export interface ApiMockBaseOptions {
  /** 拦截的 URL，默认 DEFAULT_MOCK_API_URL */
  url?: ApiUrlMatch;
}

/** 成功场景选项 */
export interface ApiMockSuccessOptions extends ApiMockBaseOptions {
  /** 响应 JSON 体，默认 createSampleChartPayload() */
  body?: unknown;
  /** HTTP 状态码，默认 200 */
  status?: number;
  /** 附加响应头 */
  headers?: Record<string, string>;
}

/** 失败场景选项 */
export interface ApiMockFailureOptions extends ApiMockBaseOptions {
  /** 失败模式：http 返回非 2xx（默认）；network 中止连接模拟网络/CORS 失败 */
  mode?: 'http' | 'network';
  /** mode 为 http 时的状态码，默认 500 */
  status?: number;
  /** mode 为 http 时的错误响应体，默认 { message: 'Internal Server Error' } */
  body?: unknown;
}

/** 慢响应场景选项 */
export interface ApiMockSlowOptions extends ApiMockSuccessOptions {
  /** 响应前延迟的毫秒数 */
  delayMs: number;
}

/** 空数据场景选项 */
export interface ApiMockEmptyOptions extends ApiMockBaseOptions {
  /** 空数据响应体，默认空数组；可传 { data: { list: [] } } 验证数据路径空态 */
  body?: unknown;
}

/** Mock 句柄：请求计数与解除拦截 */
export interface ApiMockHandle {
  /** 已被拦截的请求次数（每次命中 route 即加一） */
  requestCount: () => number;
  /** 解除该 URL 的全部拦截 */
  dispose: () => Promise<void>;
}

/** 默认示例数据：与 chart-data-parser 默认推断规则（name→维度、value→数值）一致 */
export function createSampleChartPayload(): Array<{ name: string; value: number }> {
  return [
    { name: '一月', value: 120 },
    { name: '二月', value: 200 },
    { name: '三月', value: 150 },
  ];
}

/** 创建请求计数器与 dispose 句柄 */
function createHandle(page: Page, url: ApiUrlMatch): { handle: ApiMockHandle; hit: () => void } {
  let count = 0;
  return {
    hit: () => {
      count += 1;
    },
    handle: {
      requestCount: () => count,
      dispose: () => page.unroute(url),
    },
  };
}

async function fulfillJson(
  route: Route,
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Promise<void> {
  await route.fulfill({ status, json: body, headers });
}

/**
 * 成功场景：拦截后立即以 2xx JSON 响应。
 */
export async function mockApiSuccess(
  page: Page,
  options?: ApiMockSuccessOptions,
): Promise<ApiMockHandle> {
  const url = options?.url ?? DEFAULT_MOCK_API_URL;
  const { handle, hit } = createHandle(page, url);
  await page.route(url, (route) => {
    hit();
    return fulfillJson(
      route,
      options?.status ?? 200,
      options?.body ?? createSampleChartPayload(),
      options?.headers,
    );
  });
  return handle;
}

/**
 * 失败场景：HTTP 非 2xx 或网络层中止。
 */
export async function mockApiFailure(
  page: Page,
  options?: ApiMockFailureOptions,
): Promise<ApiMockHandle> {
  const url = options?.url ?? DEFAULT_MOCK_API_URL;
  const { handle, hit } = createHandle(page, url);
  await page.route(url, (route) => {
    hit();
    if (options?.mode === 'network') {
      return route.abort('connectionrefused');
    }
    return fulfillJson(
      route,
      options?.status ?? 500,
      options?.body ?? {
        message: 'Internal Server Error',
      },
    );
  });
  return handle;
}

/**
 * 慢响应场景：延迟 delayMs 后以成功 JSON 响应，用于断言加载态。
 */
export async function mockApiSlow(page: Page, options: ApiMockSlowOptions): Promise<ApiMockHandle> {
  const url = options.url ?? DEFAULT_MOCK_API_URL;
  const { handle, hit } = createHandle(page, url);
  await page.route(url, async (route) => {
    hit();
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await fulfillJson(
      route,
      options.status ?? 200,
      options.body ?? createSampleChartPayload(),
      options.headers,
    );
  });
  return handle;
}

/**
 * 空数据场景：以 2xx 返回空数组（或指定空结构），用于断言统一空态。
 */
export async function mockApiEmpty(
  page: Page,
  options?: ApiMockEmptyOptions,
): Promise<ApiMockHandle> {
  const url = options?.url ?? DEFAULT_MOCK_API_URL;
  const { handle, hit } = createHandle(page, url);
  await page.route(url, (route) => {
    hit();
    return fulfillJson(route, 200, options?.body ?? []);
  });
  return handle;
}
