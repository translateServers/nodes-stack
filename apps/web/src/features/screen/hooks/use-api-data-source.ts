/**
 * API 数据源单次请求 Hook（阶段 2 任务 5.1）
 *
 * 能力：
 * - GET 请求：拼接查询参数、携带请求头
 * - 超时控制：超过 API_REQUEST_TIMEOUT_MS 未响应则中止并报 timeout 错误
 * - 中止控制：apiConfig 变更或组件卸载时中止进行中请求，旧响应不覆盖新状态
 * - 结构化错误：network（网络/CORS）、http（非 2xx，带状态码）、timeout、parse、unsupported-method
 *
 * 边界：
 * - 阶段 2 仅实现 GET；其他方法返回 unsupported-method 错误且不发请求
 * - 定时刷新（7.x）与竞态防护强化（7.2）不在本任务范围
 * - 产出的 success.data 供 useChartData 的 apiRawData 消费，本 Hook 不做数据解析
 */

import { useEffect, useState } from 'react';
import type { ApiDataSourceConfig } from '@nebula/shared';

/** 单次请求超时时间（毫秒） */
export const API_REQUEST_TIMEOUT_MS = 10_000;

/** 结构化请求错误原因（可区分） */
export type ApiRequestErrorReason =
  | 'network' // 网络错误或跨域被拒绝（fetch TypeError）
  | 'http' // 非 2xx 响应
  | 'timeout' // 超时中止
  | 'parse' // 响应 JSON 解析失败
  | 'unsupported-method'; // 阶段 2 未实现的请求方法

export interface ApiRequestError {
  readonly reason: ApiRequestErrorReason;
  readonly message: string;
  readonly httpStatus?: number;
}

export interface ApiRequestIdle {
  readonly status: 'idle';
}

export interface ApiRequestLoading {
  readonly status: 'loading';
}

export interface ApiRequestSuccess {
  readonly status: 'success';
  readonly data: unknown;
}

export interface ApiRequestErrorState {
  readonly status: 'error';
  readonly error: ApiRequestError;
}

/** 请求状态（判别联合） */
export type ApiRequestState =
  | ApiRequestIdle
  | ApiRequestLoading
  | ApiRequestSuccess
  | ApiRequestErrorState;

/** 参数值序列化：原始值转字符串，对象/数组 JSON 序列化 */
function serializeParamValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

/** 拼接查询参数；undefined/null 值跳过，其余值转字符串（覆盖同名参数） */
function buildUrlWithParams(url: string, params: Record<string, unknown> | undefined): string {
  if (params === undefined || Object.keys(params).length === 0) {
    return url;
  }
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    urlObj.searchParams.set(key, serializeParamValue(value));
  }
  return urlObj.toString();
}

export interface UseApiDataSourceOptions {
  /** 覆盖默认超时时间（毫秒）；默认 API_REQUEST_TIMEOUT_MS */
  timeoutMs?: number;
}

export function useApiDataSource(
  apiConfig: ApiDataSourceConfig | undefined,
  options?: UseApiDataSourceOptions,
): ApiRequestState {
  const [state, setState] = useState<ApiRequestState>({ status: 'idle' });
  const timeoutMs = options?.timeoutMs ?? API_REQUEST_TIMEOUT_MS;

  useEffect(() => {
    if (apiConfig === undefined) {
      setState({ status: 'idle' });
      return;
    }

    // 阶段 2 仅支持 GET；其他方法返回结构化"不支持"状态，不发请求
    if (apiConfig.method !== 'GET') {
      setState({
        status: 'error',
        error: {
          reason: 'unsupported-method',
          message: `当前仅支持 GET 请求，${apiConfig.method} 方法暂不支持`,
        },
      });
      return;
    }

    const controller = new AbortController();
    let timedOut = false;

    setState({ status: 'loading' });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const run = async (): Promise<void> => {
      try {
        const url = buildUrlWithParams(apiConfig.url, apiConfig.params);
        const response = await fetch(url, {
          method: 'GET',
          headers: apiConfig.headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          setState({
            status: 'error',
            error: {
              reason: 'http',
              message: `请求失败（HTTP ${response.status}）`,
              httpStatus: response.status,
            },
          });
          return;
        }

        let data: unknown;
        try {
          data = (await response.json()) as unknown;
        } catch {
          setState({
            status: 'error',
            error: { reason: 'parse', message: '响应不是合法 JSON，无法解析' },
          });
          return;
        }

        if (!controller.signal.aborted) {
          setState({ status: 'success', data });
        }
      } catch {
        if (controller.signal.aborted) {
          // 超时中止：向用户报告超时；非超时中止：配置变更或卸载，状态由新 effect 决定
          if (timedOut) {
            setState({
              status: 'error',
              error: { reason: 'timeout', message: '请求超时，请检查网络或接口可用性' },
            });
          }
          return;
        }
        setState({
          status: 'error',
          error: { reason: 'network', message: '网络请求失败（可能是网络异常或跨域限制）' },
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // 显式标记 Promise 已处理（run 内部捕获全部异常），避免浮动 Promise
    void run();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiConfig, timeoutMs]);

  return state;
}
