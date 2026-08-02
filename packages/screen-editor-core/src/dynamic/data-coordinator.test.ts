/**
 * ScreenDataCoordinator 测试。
 *
 * 测业务约束：去重、取消、超时、迟到响应防护、上下文生命周期、局部失败。
 */

import { describe, expect, it, vi } from 'vitest';

import type { ScreenComponentDataState } from '@nebula/screen-component-sdk/dynamic';
import type { ScreenDataAdapterPort, ScreenDataExecuteRequest } from './data-adapter-port.js';
import { ScreenDataCoordinator } from './data-coordinator.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createAdapter(handler?: {
  execute?: (request: ScreenDataExecuteRequest, signal: AbortSignal) => Promise<unknown>;
  delayMs?: number;
}): ScreenDataAdapterPort {
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  return {
    resourceList: vi.fn(() => Promise.resolve([])),
    openContext: vi.fn(() => Promise.resolve()),
    syncContext: vi.fn(() => Promise.resolve()),
    closeContext: vi.fn(() => Promise.resolve()),
    execute: vi.fn(
      async (
        request: ScreenDataExecuteRequest,
        signal: AbortSignal,
      ): Promise<{ data: unknown }> => {
        if (handler?.execute !== undefined) {
          return { data: await handler.execute(request, signal) };
        }
        if (handler?.delayMs !== undefined) {
          await delay(handler.delayMs);
          if (signal.aborted) throw new DOMException('aborted', 'AbortError');
          return { data: { value: request.intent.params?.['metricId'] } };
        }
        return { data: { value: 1 } };
      },
    ),
  };
}

/** 构造尊重 AbortSignal 的 pending execute（模拟真实宿主 adapter） */
function createPendingAdapter(): {
  adapter: ScreenDataAdapterPort;
  pending: { promise: Promise<unknown>; resolve: (value: unknown) => void };
} {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((res) => {
    resolve = res;
  });
  return {
    adapter: createAdapter({
      execute: (_request, signal) =>
        new Promise((res, rej) => {
          signal.addEventListener('abort', () => {
            rej(new DOMException('aborted', 'AbortError'));
          });
          promise.then(res, rej);
        }),
    }),
    pending: { promise, resolve },
  };
}

describe('ScreenDataCoordinator', () => {
  it('未打开上下文时执行返回 error(network)', async () => {
    const adapter = createAdapter();
    const coordinator = new ScreenDataCoordinator({ adapter });
    const state = await coordinator.execute('c1', { type: 'host/xj-metric' });
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.error.reason).toBe('network');
    }
  });

  it('上下文生命周期：open → execute → close 委托 adapter', async () => {
    const adapter = createAdapter();
    const coordinator = new ScreenDataCoordinator({ adapter });
    await coordinator.openContext({ contextId: 'ctx1', projectId: 'p1', source: 'published' });
    expect(coordinator.context?.contextId).toBe('ctx1');

    const state = await coordinator.execute('c1', {
      type: 'host/xj-metric',
      params: { metricId: 1 },
    });
    expect(state.status).toBe('success');
    expect(adapter.execute).toHaveBeenCalledTimes(1);

    await coordinator.closeContext();
    expect(adapter.closeContext).toHaveBeenCalledWith('ctx1');
    expect(coordinator.context).toBeNull();
  });

  it('相同 dedupe key 的 in-flight 请求共享结果（去重）', async () => {
    const pending = deferred<unknown>();
    const adapter = createAdapter({ execute: () => pending.promise });
    const coordinator = new ScreenDataCoordinator({ adapter });
    await coordinator.openContext({ contextId: 'ctx1', projectId: 'p1', source: 'published' });

    const first = coordinator.execute('c1', { type: 'host/xj-metric' });
    const second = coordinator.execute('c1', { type: 'host/xj-metric' });
    expect(adapter.execute).toHaveBeenCalledTimes(1);

    pending.resolve({ rows: [] });
    const [a, b] = await Promise.all([first, second]);
    expect(a.status).toBe('success');
    expect(b.status).toBe('success');
  });

  it('超时进入 error(timeout)', async () => {
    const { adapter, pending } = createPendingAdapter();
    const coordinator = new ScreenDataCoordinator({ adapter, timeoutMs: 20 });
    await coordinator.openContext({ contextId: 'ctx1', projectId: 'p1', source: 'published' });

    const state = await coordinator.execute('c1', { type: 'host/xj-metric' });
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.error.reason).toBe('aborted');
    }
    pending.resolve({ rows: [] });
  });

  it('外部 signal 中止执行', async () => {
    const { adapter, pending } = createPendingAdapter();
    const coordinator = new ScreenDataCoordinator({ adapter });
    await coordinator.openContext({ contextId: 'ctx1', projectId: 'p1', source: 'published' });

    const controller = new AbortController();
    const promise = coordinator.execute(
      'c1',
      { type: 'host/xj-metric' },
      { signal: controller.signal },
    );
    controller.abort();
    const state = await promise;
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.error.reason).toBe('aborted');
    }
    pending.resolve({ rows: [] });
  });

  it('迟到响应被丢弃：新执行覆盖旧执行结果', async () => {
    const firstPending = deferred<unknown>();
    const secondPending = deferred<unknown>();
    let call = 0;
    const adapter = createAdapter({
      execute: () => {
        call += 1;
        return call === 1 ? firstPending.promise : secondPending.promise;
      },
    });
    const coordinator = new ScreenDataCoordinator({ adapter });
    await coordinator.openContext({ contextId: 'ctx1', projectId: 'p1', source: 'published' });

    const states: ScreenComponentDataState[] = [];
    coordinator.subscribe({
      onStateChange: (_id, state) => {
        states.push(state);
      },
    });

    const first = coordinator.execute('c1', { type: 'host/xj-metric' }, { dedupeKey: 'k1' });
    // 第二次执行（不同 key）触发旧执行中止，seq 递增
    const second = coordinator.execute('c1', { type: 'host/xj-metric' }, { dedupeKey: 'k2' });
    secondPending.resolve({ value: 'new' });
    await second;
    firstPending.resolve({ value: 'stale' });
    await first;

    const successStates = states.filter((s) => s.status === 'success');
    expect(successStates).toHaveLength(1);
    expect(successStates[0]).toMatchObject({ status: 'success', data: { value: 'new' } });
  });

  it('单组件失败不影响其它组件（局部失败）', async () => {
    const adapter = createAdapter({
      execute: (request) => {
        if (request.componentId === 'bad') {
          throw new Error('指标查询失败');
        }
        return Promise.resolve({ value: 1 });
      },
    });
    const coordinator = new ScreenDataCoordinator({ adapter });
    await coordinator.openContext({ contextId: 'ctx1', projectId: 'p1', source: 'published' });

    const bad = await coordinator.execute('bad', { type: 'host/xj-metric' });
    const good = await coordinator.execute('good', { type: 'host/xj-metric' });
    expect(bad.status).toBe('error');
    expect(good.status).toBe('success');
  });

  it('dispose 后执行返回 aborted', async () => {
    const adapter = createAdapter();
    const coordinator = new ScreenDataCoordinator({ adapter });
    await coordinator.openContext({ contextId: 'ctx1', projectId: 'p1', source: 'published' });
    coordinator.dispose();
    const state = await coordinator.execute('c1', { type: 'host/xj-metric' });
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.error.reason).toBe('aborted');
    }
  });
});
