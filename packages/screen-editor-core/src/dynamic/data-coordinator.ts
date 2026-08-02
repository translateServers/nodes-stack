/**
 * 实例级数据协调器（ScreenDataCoordinator）。
 *
 * 统一管理组件的宿主数据请求：
 * - **去重**：同一 dedupe key（默认 componentId）的 in-flight 请求共享同一 Promise，
 *   不重复执行；结果同时通知所有订阅者
 * - **取消**：每个执行绑定 AbortController；组件卸载/刷新时中止旧请求
 * - **超时**：默认 15 秒（对齐 XJ 后端执行上限），超时进入 error(timeout)
 * - **迟到响应防护**：每个 componentId 维护递增 seq，仅最新 seq 的结果回写状态
 * - **局部失败**：单个组件失败不影响其它组件
 * - **上下文**：open/sync/close 委托宿主 adapter；未打开上下文时禁止执行
 *
 * 状态机（ScreenComponentDataState）：idle → loading → success | error
 */

import type {
  ScreenComponentDataState,
  ScreenComponentHostMetricIntent,
} from '@nebula/screen-component-sdk/dynamic';
import type {
  ScreenDataAdapterPort,
  ScreenDataExecutionContext,
  ScreenDataExecuteRequest,
} from './data-adapter-port.js';

const DEFAULT_EXECUTION_TIMEOUT_MS = 15_000;

export interface ScreenDataCoordinatorOptions {
  readonly adapter: ScreenDataAdapterPort;
  readonly timeoutMs?: number;
}

export interface ScreenDataCoordinatorListener {
  onStateChange(componentId: string, state: ScreenComponentDataState): void;
}

export interface ScreenDataExecutionOptions {
  /** 去重键；缺省使用 componentId */
  readonly dedupeKey?: string;
  /** 外部取消信号（组件卸载等） */
  readonly signal?: AbortSignal;
}

type InFlightEntry = {
  readonly promise: Promise<ScreenComponentDataState>;
};

function abortState(): ScreenComponentDataState {
  return { status: 'error', error: { message: '已取消', reason: 'aborted' } };
}

export class ScreenDataCoordinator {
  readonly #adapter: ScreenDataAdapterPort;
  readonly #timeoutMs: number;
  readonly #listeners = new Set<ScreenDataCoordinatorListener>();
  readonly #inFlight = new Map<string, InFlightEntry>();
  readonly #abortControllers = new Map<string, AbortController>();
  readonly #sequences = new Map<string, number>();
  #context: ScreenDataExecutionContext | null = null;
  #disposed = false;

  constructor(options: ScreenDataCoordinatorOptions) {
    this.#adapter = options.adapter;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  }

  get context(): ScreenDataExecutionContext | null {
    return this.#context;
  }

  subscribe(listener: ScreenDataCoordinatorListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  notify(componentId: string, state: ScreenComponentDataState): void {
    for (const listener of this.#listeners) {
      listener.onStateChange(componentId, state);
    }
  }

  async openContext(context: ScreenDataExecutionContext): Promise<void> {
    if (this.#disposed) throw new Error('coordinator disposed');
    await this.#adapter.openContext(context);
    this.#context = context;
  }

  async syncContext(context: ScreenDataExecutionContext): Promise<void> {
    if (this.#disposed) throw new Error('coordinator disposed');
    await this.#adapter.syncContext(context);
    this.#context = context;
  }

  async closeContext(): Promise<void> {
    const context = this.#context;
    this.#context = null;
    if (context !== null) {
      this.#abortAll();
      await this.#adapter.closeContext(context.contextId);
    }
  }

  /**
   * 执行组件数据请求。
   *
   * 相同 dedupe key 的 in-flight 请求共享结果；返回最终状态。
   * 订阅者通过 onStateChange 收到 loading/success/error 流转。
   */
  execute(
    componentId: string,
    intent: ScreenComponentHostMetricIntent,
    options: ScreenDataExecutionOptions = {},
  ): Promise<ScreenComponentDataState> {
    if (this.#disposed) {
      return Promise.resolve(abortState());
    }
    if (this.#context === null) {
      return Promise.resolve({
        status: 'error',
        error: { message: '数据执行上下文未打开', reason: 'network' },
      });
    }

    const key = options.dedupeKey ?? componentId;
    const existing = this.#inFlight.get(key);
    if (existing !== undefined) {
      return existing.promise;
    }

    const controller = new AbortController();
    const externalSignal = options.signal;
    if (externalSignal !== undefined) {
      if (externalSignal.aborted) {
        return Promise.resolve(abortState());
      }
      externalSignal.addEventListener(
        'abort',
        () => {
          controller.abort();
        },
        { once: true },
      );
    }

    // 迟到的旧执行（同 key）立即中止
    this.#abortControllers.get(key)?.abort();
    this.#abortControllers.set(key, controller);

    const sequence = (this.#sequences.get(componentId) ?? 0) + 1;
    this.#sequences.set(componentId, sequence);

    this.notify(componentId, { status: 'loading' });

    const request: ScreenDataExecuteRequest = {
      componentId,
      intent: {
        type: intent.type,
        params: intent.params,
      },
    };

    const timeout = setTimeout(() => {
      controller.abort();
    }, this.#timeoutMs);

    const promise = (async () => {
      try {
        const result = await this.#adapter.execute(request, controller.signal);
        const state: ScreenComponentDataState = {
          status: 'success',
          data: result.data,
        };
        this.#publishLatest(componentId, sequence, state);
        return state;
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          const state = abortState();
          this.#publishLatest(componentId, sequence, state);
          return state;
        }
        const state: ScreenComponentDataState = {
          status: 'error',
          error: {
            message: error instanceof Error ? error.message : '数据执行失败',
            reason: 'network',
          },
        };
        this.#publishLatest(componentId, sequence, state);
        return state;
      } finally {
        clearTimeout(timeout);
        this.#inFlight.delete(key);
        this.#abortControllers.delete(key);
      }
    })();

    this.#inFlight.set(key, { promise });
    return promise;
  }

  #publishLatest(componentId: string, sequence: number, state: ScreenComponentDataState): void {
    // 迟到响应防护：仅最新 seq 回写；期间可能有更新的执行已启动
    if (this.#sequences.get(componentId) !== sequence) {
      return;
    }
    this.notify(componentId, state);
  }

  #abortAll(): void {
    for (const controller of this.#abortControllers.values()) {
      controller.abort();
    }
    this.#abortControllers.clear();
    this.#inFlight.clear();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#abortAll();
    this.#listeners.clear();
    this.#context = null;
  }
}
