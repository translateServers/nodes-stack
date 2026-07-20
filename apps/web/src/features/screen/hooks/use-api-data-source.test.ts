/**
 * useApiDataSource Hook 测试（阶段 2 任务 5.1）
 *
 * 验证点（对应 tasks.md 5.1 验证要求）：
 * - GET 成功：拼接查询参数、携带请求头
 * - 失败：网络错误（network）、非 2xx（http 带状态码）、超时（timeout）、JSON 解析失败（parse）
 * - 中止：apiConfig 变更或卸载时中止进行中请求，旧响应不覆盖新状态
 * - 无浮动 Promise（ESLint no-floating-promises 静态保证 + 全异步路径断言）
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ApiDataSourceConfig } from '@nebula/shared';
import { useApiDataSource } from './use-api-data-source';

function makeGetConfig(overrides?: Partial<ApiDataSourceConfig>): ApiDataSourceConfig {
  return { url: 'https://example.com/api/chart', method: 'GET', ...overrides };
}

function mockJsonResponse(data: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: () => Promise.resolve(data),
  } as Response;
}

/** fetch mock：永不 resolve，但响应 abort 信号（用于超时/中止测试） */
function mockPendingFetch() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useApiDataSource', () => {
  it('apiConfig 为 undefined 时保持 idle，不发起请求', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useApiDataSource(undefined));

    expect(result.current).toEqual({ status: 'idle' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET 请求成功：loading 后返回 success 数据', async () => {
    const payload = [{ name: 'A', value: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    // 配置对象提升到回调外保持引用稳定：内联新建对象会让 effect 依赖每轮变化，陷入渲染循环
    const config = makeGetConfig();
    const { result } = renderHook(() => useApiDataSource(config));
    expect(result.current).toEqual({ status: 'loading' });

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: payload });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('查询参数拼接到 URL：undefined/null 跳过，其余转字符串', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig({
      url: 'https://example.com/api/chart?existing=1',
      params: { type: 'sales', year: 2026, skip: undefined, empty: null },
    });
    const { result } = renderHook(() => useApiDataSource(config));

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('existing=1');
    expect(calledUrl).toContain('type=sales');
    expect(calledUrl).toContain('year=2026');
    expect(calledUrl).not.toContain('skip=');
    expect(calledUrl).not.toContain('empty=');
  });

  it('携带配置的请求头发起请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig({ headers: { 'X-Api-Key': 'secret-key' } });
    const { result } = renderHook(() => useApiDataSource(config));

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ 'X-Api-Key': 'secret-key' });
  });

  it('非 2xx 响应返回 http 错误并携带状态码', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(null, { ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig();
    const { result } = renderHook(() => useApiDataSource(config));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    if (result.current.status === 'error') {
      expect(result.current.error.reason).toBe('http');
      expect(result.current.error.httpStatus).toBe(500);
      expect(result.current.error.message).toContain('500');
    }
  });

  it('网络错误（fetch reject）返回 network 错误', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig();
    const { result } = renderHook(() => useApiDataSource(config));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    if (result.current.status === 'error') {
      expect(result.current.error.reason).toBe('network');
    }
  });

  it('响应不是合法 JSON 返回 parse 错误', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig();
    const { result } = renderHook(() => useApiDataSource(config));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    if (result.current.status === 'error') {
      expect(result.current.error.reason).toBe('parse');
    }
  });

  it('超过超时时间未响应返回 timeout 错误并中止请求', async () => {
    // 用真实短超时（timeoutMs 覆盖）代替 fake timers：jsdom 下 fake timers 会拦截 React 调度的宏任务
    const fetchMock = mockPendingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig();
    const { result } = renderHook(() => useApiDataSource(config, { timeoutMs: 50 }));
    expect(result.current).toEqual({ status: 'loading' });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    if (result.current.status === 'error') {
      expect(result.current.error.reason).toBe('timeout');
    }
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
  });

  it('apiConfig 变更时中止进行中请求，旧响应不覆盖新状态', async () => {
    let resolveSecond: ((response: Response) => void) | undefined;
    const firstPayload = [{ name: 'OLD', value: 0 }];
    const secondPayload = [{ name: 'NEW', value: 1 }];
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
          // 旧请求随后才 resolve（模拟乱序响应），不应覆盖新状态
          setTimeout(() => {
            resolve(mockJsonResponse(firstPayload));
          }, 50);
        });
      })
      .mockImplementationOnce(() => {
        return new Promise<Response>((resolve) => {
          resolveSecond = resolve;
        });
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ config }: { config: ApiDataSourceConfig }) => useApiDataSource(config),
      { initialProps: { config: makeGetConfig({ url: 'https://example.com/api/first' }) } },
    );
    expect(result.current).toEqual({ status: 'loading' });

    rerender({ config: makeGetConfig({ url: 'https://example.com/api/second' }) });

    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstInit.signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveSecond?.(mockJsonResponse(secondPayload));
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: secondPayload });
    });
  });

  it('组件卸载时中止进行中请求', () => {
    const fetchMock = mockPendingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig();
    const { result, unmount } = renderHook(() => useApiDataSource(config));
    expect(result.current).toEqual({ status: 'loading' });

    unmount();

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
  });

  it('apiConfig 变为 undefined 时回到 idle 且不保留旧数据', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: 'A', value: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const initialProps: { config: ApiDataSourceConfig | undefined } = { config: makeGetConfig() };
    const { result, rerender } = renderHook(({ config }) => useApiDataSource(config), {
      initialProps,
    });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    rerender({ config: undefined });
    expect(result.current).toEqual({ status: 'idle' });
  });
});

describe('useApiDataSource 定时刷新与竞态防护（任务 7.1-7.2）', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('refreshInterval > 0 时按间隔重新请求', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: 'A', value: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig({ refreshInterval: 5 });
    const { result } = renderHook(() => useApiDataSource(config));

    // 首次立即请求
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('success');

    // 5 秒后第二次请求
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 再 5 秒后第三次请求
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refreshInterval 为 0 时不启动定时刷新', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: 'A', value: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig({ refreshInterval: 0 });
    const { result } = renderHook(() => useApiDataSource(config));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshInterval 未配置时不启动定时刷新', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: 'A', value: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig();
    const { result } = renderHook(() => useApiDataSource(config));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('配置变更时重建计时器（旧间隔不再生效）', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: 'A', value: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ config }: { config: ApiDataSourceConfig }) => useApiDataSource(config),
      { initialProps: { config: makeGetConfig({ refreshInterval: 3 }) } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 切换到 10 秒间隔
    rerender({ config: makeGetConfig({ refreshInterval: 10, url: 'https://example.com/api/v2' }) });
    // 配置变更触发新请求
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 旧 3 秒间隔不再生效
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 新 10 秒间隔生效
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('组件卸载时取消计时器与进行中请求', async () => {
    vi.useFakeTimers();
    const fetchMock = mockPendingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig({ refreshInterval: 5 });
    const { unmount } = renderHook(() => useApiDataSource(config));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;

    unmount();

    // 进行中请求被中止
    expect(firstInit.signal?.aborted).toBe(true);

    // 卸载后计时器不再触发新请求
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('定时刷新时旧响应晚到不覆盖新数据（竞态防护）', async () => {
    vi.useFakeTimers();
    const secondPayload = [{ name: 'NEW', value: 2 }];

    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      })
      .mockImplementation(() => Promise.resolve(mockJsonResponse(secondPayload)));
    vi.stubGlobal('fetch', fetchMock);

    const config = makeGetConfig({ refreshInterval: 5 });
    const { result } = renderHook(() => useApiDataSource(config));

    expect(result.current.status).toBe('loading');

    // 间隔触发第二次请求，中止第一次
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstInit.signal?.aborted).toBe(true);

    // 第二次请求成功，数据为 NEW
    expect(result.current).toEqual({ status: 'success', data: secondPayload });
  });
});
