/**
 * useBlueprintRuntimeDeps Hook 测试（任务 3.4）
 *
 * 验证点（对应 tasks.md 3.4 验证要求）：
 * - 刷新触发：refreshDataSource(componentId) 发起 GET 请求，成功后调用 onRefreshComplete
 * - 取消协议：同组件新刷新触发时中止旧请求（signal.aborted=true）
 * - 乱序响应不覆盖：旧请求晚到 resolve 时不上报 onRefreshComplete
 * - 卸载清理：组件卸载时中止所有进行中请求，无浮动 Promise
 * - 失败静默：http/网络错误不抛出，不调用 onRefreshComplete
 * - 可见性覆盖表：applyVisibility/getVisibility 不改写项目数据
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ScreenComponent } from '@nebula/shared';
import { __setNavigateSelfForTest, useBlueprintRuntimeDeps } from './use-blueprint-runtime-deps';

function makeApiComponent(
  id: string,
  url = 'https://example.com/api/chart',
  overrides?: Partial<ScreenComponent>,
): ScreenComponent {
  return {
    id,
    type: 'bar-chart',
    name: `comp-${id}`,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
    dataSource: {
      type: 'api',
      apiConfig: { url, method: 'GET' },
    },
    ...overrides,
  } as unknown as ScreenComponent;
}

function makeStaticComponent(id: string): ScreenComponent {
  return {
    id,
    type: 'text',
    name: `text-${id}`,
    position: { x: 0, y: 0, width: 100, height: 100 },
    style: {},
    zIndex: 0,
    status: { locked: false, hidden: false },
    dataSource: { type: 'static', staticData: [] },
  } as unknown as ScreenComponent;
}

function mockJsonResponse(data: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: () => Promise.resolve(data),
  } as Response;
}

/** fetch mock：永不 resolve，但响应 abort 信号 */
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

describe('useBlueprintRuntimeDeps - refreshDataSource 取消协议（任务 3.4）', () => {
  it('刷新 API 数据源组件：发起 GET 请求，成功后调用 onRefreshComplete', async () => {
    const payload = [{ name: 'A', value: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    await act(async () => {
      await result.current.deps.refreshDataSource('comp-1');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://example.com/api/chart');
    expect((init as RequestInit).method).toBe('GET');
    expect(onRefreshComplete).toHaveBeenCalledTimes(1);
    expect(onRefreshComplete).toHaveBeenCalledWith('comp-1', payload);
  });

  it('刷新非 API 数据源组件：不发起请求，直接返回', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeStaticComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    await act(async () => {
      await result.current.deps.refreshDataSource('comp-1');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onRefreshComplete).not.toHaveBeenCalled();
  });

  it('刷新不存在的组件：不发起请求（dangling 由 executor 处理）', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const { result } = renderHook(() => useBlueprintRuntimeDeps([], onRefreshComplete));

    await act(async () => {
      await result.current.deps.refreshDataSource('non-existent');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onRefreshComplete).not.toHaveBeenCalled();
  });

  it('同组件连续刷新：新请求中止旧请求（竞态防护）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: 'NEW', value: 2 }]));
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    // 第一次请求：不 await，触发后立即发起第二次
    const firstPromise = result.current.deps.refreshDataSource('comp-1');

    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstInit.signal?.aborted).toBe(false);

    // 第二次请求：应中止第一次
    const secondPromise = result.current.deps.refreshDataSource('comp-1');

    // 第一次的 signal 应被中止
    expect(firstInit.signal?.aborted).toBe(true);

    await act(async () => {
      await Promise.all([firstPromise, secondPromise]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 乱序防护：仅第二次（最新）的响应才会上报，第一次的旧响应被丢弃
    expect(onRefreshComplete).toHaveBeenCalledTimes(1);
    expect(onRefreshComplete).toHaveBeenCalledWith('comp-1', [{ name: 'NEW', value: 2 }]);
  });

  it('乱序响应不覆盖：旧请求晚 resolve 时不上报', async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    const firstPayload = [{ name: 'OLD', value: 0 }];
    const secondPayload = [{ name: 'NEW', value: 1 }];

    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
          // 旧请求随后才 resolve（模拟乱序响应），但因被中止会 reject
          setTimeout(() => {
            resolveFirst?.(mockJsonResponse(firstPayload));
          }, 50);
        });
      })
      .mockImplementationOnce(() => Promise.resolve(mockJsonResponse(secondPayload)));
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    // 触发第一次请求（挂起）
    const firstPromise = result.current.deps.refreshDataSource('comp-1');

    // 让第一次的 setTimeout 注册
    await act(async () => {
      await Promise.resolve();
    });

    // 触发第二次请求（应中止第一次）
    const secondPromise = result.current.deps.refreshDataSource('comp-1');

    // 让第二次完成
    await act(async () => {
      await Promise.all([firstPromise, secondPromise]);
    });

    // 仅第二次响应上报
    expect(onRefreshComplete).toHaveBeenCalledTimes(1);
    expect(onRefreshComplete).toHaveBeenCalledWith('comp-1', secondPayload);
  });

  it('卸载清理：进行中请求被中止，无浮动 Promise', async () => {
    const fetchMock = mockPendingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result, unmount } = renderHook(() =>
      useBlueprintRuntimeDeps([component], onRefreshComplete),
    );

    // 触发请求但不 await
    const promise = result.current.deps.refreshDataSource('comp-1');

    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstInit.signal?.aborted).toBe(false);

    // 卸载：应中止进行中请求
    unmount();

    expect(firstInit.signal?.aborted).toBe(true);

    // 卸载后等待 promise 完成（应静默 reject，不浮动）
    let rejectionCaught = false;
    try {
      await promise;
    } catch {
      rejectionCaught = true;
    }
    // rejection 来自 abort，被 Hook 内部 catch 吞掉
    expect(rejectionCaught).toBe(false);
    expect(onRefreshComplete).not.toHaveBeenCalled();
  });

  it('HTTP 非 2xx 响应：静默失败，不调用 onRefreshComplete', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(null, { ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    await act(async () => {
      await result.current.deps.refreshDataSource('comp-1');
    });

    expect(onRefreshComplete).not.toHaveBeenCalled();
  });

  it('网络错误：静默失败，不调用 onRefreshComplete，不抛出', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    await expect(
      act(async () => {
        await result.current.deps.refreshDataSource('comp-1');
      }),
    ).resolves.toBeUndefined();

    expect(onRefreshComplete).not.toHaveBeenCalled();
  });

  it('响应非合法 JSON：静默失败，不调用 onRefreshComplete', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    await act(async () => {
      await result.current.deps.refreshDataSource('comp-1');
    });

    expect(onRefreshComplete).not.toHaveBeenCalled();
  });

  it('查询参数与脱敏请求头正确拼装', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1', 'https://example.com/api?existing=1', {
      dataSource: {
        type: 'api',
        apiConfig: {
          url: 'https://example.com/api',
          method: 'GET',
          params: { type: 'sales', year: 2026 },
          headers: {
            'X-Api-Key': 'secret-key',
            'X-Redacted': '[REDACTED]', // 应被过滤
          },
        },
      },
    });
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    await act(async () => {
      await result.current.deps.refreshDataSource('comp-1');
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('type=sales');
    expect(String(url)).toContain('year=2026');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('secret-key');
    expect(headers['X-Redacted']).toBeUndefined();
  });
});

describe('useBlueprintRuntimeDeps - 可见性覆盖表（任务 3.3 配套）', () => {
  it('applyVisibility 写入覆盖表，getVisibility 读取', () => {
    const { result } = renderHook(() => useBlueprintRuntimeDeps([]));

    act(() => {
      result.current.deps.applyVisibility('comp-1', false);
    });

    expect(result.current.deps.getVisibility('comp-1')).toBe(false);
    expect(result.current.visibilityOverrides.get('comp-1')).toBe(false);
  });

  it('getVisibility 未覆盖时返回 undefined（调用方回退到组件 status.hidden）', () => {
    const { result } = renderHook(() => useBlueprintRuntimeDeps([]));
    expect(result.current.deps.getVisibility('comp-1')).toBeUndefined();
  });

  it('resetVisibility 清空覆盖表（页面卸载/重新加载时调用）', () => {
    const { result } = renderHook(() => useBlueprintRuntimeDeps([]));

    act(() => {
      result.current.deps.applyVisibility('comp-1', false);
      result.current.deps.applyVisibility('comp-2', true);
    });
    expect(result.current.visibilityOverrides.size).toBe(2);

    act(() => {
      result.current.resetVisibility();
    });
    expect(result.current.visibilityOverrides.size).toBe(0);
  });

  it('覆盖表独立于组件数据：不修改 components 数组', () => {
    const component = makeStaticComponent('comp-1');
    const componentSnapshot = JSON.parse(JSON.stringify(component)) as ScreenComponent;
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component]));

    act(() => {
      result.current.deps.applyVisibility('comp-1', false);
    });

    // 组件原始数据未被改写
    expect(component).toEqual(componentSnapshot);
  });
});

describe('useBlueprintRuntimeDeps - hasComponent 判定', () => {
  it('存在的组件返回 true', () => {
    const component = makeStaticComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component]));
    expect(result.current.deps.hasComponent('comp-1')).toBe(true);
  });

  it('不存在的组件返回 false（dangling）', () => {
    const component = makeStaticComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component]));
    expect(result.current.deps.hasComponent('non-existent')).toBe(false);
  });

  it('组件列表更新后 hasComponent 反映最新状态', () => {
    const initial = renderHook(({ components }) => useBlueprintRuntimeDeps(components), {
      initialProps: { components: [makeStaticComponent('comp-1')] as ScreenComponent[] },
    });

    expect(initial.result.current.deps.hasComponent('comp-1')).toBe(true);
    expect(initial.result.current.deps.hasComponent('comp-2')).toBe(false);

    initial.rerender({ components: [makeStaticComponent('comp-2')] });

    // componentsRef 在每次渲染时更新
    expect(initial.result.current.deps.hasComponent('comp-1')).toBe(false);
    expect(initial.result.current.deps.hasComponent('comp-2')).toBe(true);
  });
});

describe('useBlueprintRuntimeDeps - 其他执行器依赖', () => {
  it('openUrl _blank 调用 window.open', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { result } = renderHook(() => useBlueprintRuntimeDeps([]));

    act(() => {
      result.current.deps.openUrl('https://example.com', '_blank');
    });

    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('openUrl _self 调用 navigateSelf', () => {
    // jsdom 中 window.location.href 与 assign 均为 non-configurable，无法直接 spy
    // 通过模块导出的 __setNavigateSelfForTest 临时替换导航实现
    const navigateMock = vi.fn();
    const restore = __setNavigateSelfForTest(navigateMock);
    const { result } = renderHook(() => useBlueprintRuntimeDeps([]));
    act(() => {
      result.current.deps.openUrl('https://example.com', '_self');
    });
    expect(navigateMock).toHaveBeenCalledWith('https://example.com');
    restore();
  });

  it('scrollToComponent 找不到元素时不抛错', () => {
    const { result } = renderHook(() => useBlueprintRuntimeDeps([]));
    expect(() => {
      act(() => {
        result.current.deps.scrollToComponent('non-existent');
      });
    }).not.toThrow();
  });

  it('logWarning 调用 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useBlueprintRuntimeDeps([]));
    act(() => {
      result.current.deps.logWarning('test warning');
    });
    expect(warnSpy).toHaveBeenCalledWith('[blueprint-runtime] test warning');
    warnSpy.mockRestore();
  });
});

describe('useBlueprintRuntimeDeps - deps 引用稳定性', () => {
  it('组件列表未变时 deps 引用稳定（避免 useEffect 重订阅）', () => {
    const components: ScreenComponent[] = [makeStaticComponent('comp-1')];
    const { result, rerender } = renderHook(() => useBlueprintRuntimeDeps(components));

    const firstDeps = result.current.deps;
    rerender();
    expect(result.current.deps).toBe(firstDeps);
  });

  it('onRefreshComplete 变化不导致 deps 引用变化（通过 ref 转发）', () => {
    const components: ScreenComponent[] = [makeStaticComponent('comp-1')];
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const { result, rerender } = renderHook(
      ({ handler }) => useBlueprintRuntimeDeps(components, handler),
      { initialProps: { handler: handler1 as typeof handler1 } },
    );

    const firstDeps = result.current.deps;
    rerender({ handler: handler2 as typeof handler2 });
    expect(result.current.deps).toBe(firstDeps);
  });
});

describe('useBlueprintRuntimeDeps - waitFor 集成验证', () => {
  it('refreshDataSource 异步完成后 onRefreshComplete 被调用（waitFor 异步断言）', async () => {
    const payload = [{ name: 'A', value: 1 }];
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const onRefreshComplete = vi.fn();
    const component = makeApiComponent('comp-1');
    const { result } = renderHook(() => useBlueprintRuntimeDeps([component], onRefreshComplete));

    await act(async () => {
      await result.current.deps.refreshDataSource('comp-1');
    });

    await waitFor(() => {
      expect(onRefreshComplete).toHaveBeenCalledWith('comp-1', payload);
    });
  });
});
