import type { ScreenOperation } from '../contracts/adapter.js';

export type ScreenMutationOperation =
  | 'save'
  | 'publish'
  | 'import'
  | 'snapshot-create'
  | 'snapshot-restore'
  | 'snapshot-remove'
  | 'snapshot-clear';

export type ScreenReadOperation = 'load' | 'reload' | 'export' | 'snapshot-list';

export interface ScreenOperationContext {
  readonly generation: number;
  readonly operation: ScreenOperation;
  readonly signal: AbortSignal;
  assertCurrent(): void;
}

interface QueuedMutation {
  readonly generation: number;
  readonly operation: ScreenMutationOperation;
  execute(): void;
  abort(): void;
}

interface ActiveOperation {
  readonly controller: AbortController;
  readonly generation: number;
}

interface ActiveMutation extends ActiveOperation {
  readonly operation: ScreenMutationOperation;
  abort(): void;
}

function createAbortError(): DOMException {
  return new DOMException('Operation aborted', 'AbortError');
}

function toRejectionError(error: unknown): Error {
  return error instanceof Error || error instanceof DOMException
    ? error
    : new Error('Operation failed');
}

export class ScreenOperationCoordinator {
  private currentGeneration = 0;
  private disposed = false;
  private activeMutation: ActiveMutation | null = null;
  private readonly queuedMutations: QueuedMutation[] = [];
  private readonly activeReads = new Map<number, ActiveOperation>();
  private readonly latestReads = new Map<ScreenReadOperation, AbortController>();
  private nextReadId = 1;

  get generation(): number {
    return this.currentGeneration;
  }

  advanceGeneration(): number {
    this.assertNotDisposed();
    this.currentGeneration += 1;
    this.abortAll();
    return this.currentGeneration;
  }

  runMutation<Result>(
    operation: ScreenMutationOperation,
    task: (context: ScreenOperationContext) => Promise<Result>,
  ): Promise<Result> {
    this.assertNotDisposed();
    const generation = this.currentGeneration;

    return new Promise<Result>((resolve, reject) => {
      let settled = false;
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        callback();
      };
      const queued: QueuedMutation = {
        generation,
        operation,
        abort: () => settle(() => reject(createAbortError())),
        execute: () => {
          if (!this.isCurrent(generation)) {
            settle(() => reject(createAbortError()));
            this.drainMutations();
            return;
          }
          const controller = new AbortController();
          this.activeMutation = {
            controller,
            generation,
            operation,
            abort: () => queued.abort(),
          };
          const context = this.createContext(operation, generation, controller.signal);
          void task(context)
            .then((result) => {
              context.assertCurrent();
              settle(() => resolve(result));
            })
            .catch((error: unknown) => {
              try {
                context.assertCurrent();
                settle(() => reject(toRejectionError(error)));
              } catch (abortError) {
                settle(() => reject(toRejectionError(abortError)));
              }
            })
            .finally(() => {
              if (this.activeMutation?.controller === controller) this.activeMutation = null;
              this.drainMutations();
            });
        },
      };
      this.queuedMutations.push(queued);
      this.drainMutations();
    });
  }

  runRead<Result>(
    operation: ScreenReadOperation,
    task: (context: ScreenOperationContext) => Promise<Result>,
    options: { latestOnly?: boolean } = {},
  ): Promise<Result> {
    this.assertNotDisposed();
    const generation = this.currentGeneration;
    const controller = new AbortController();
    const readId = this.nextReadId;
    this.nextReadId += 1;

    if (options.latestOnly === true) {
      this.latestReads.get(operation)?.abort();
      this.latestReads.set(operation, controller);
    }
    this.activeReads.set(readId, { controller, generation });
    const context = this.createContext(operation, generation, controller.signal);

    return task(context)
      .then((result) => {
        context.assertCurrent();
        return result;
      })
      .catch((error: unknown) => {
        context.assertCurrent();
        throw toRejectionError(error);
      })
      .finally(() => {
        this.activeReads.delete(readId);
        if (this.latestReads.get(operation) === controller) this.latestReads.delete(operation);
      });
  }

  cancelRead(operation: ScreenReadOperation): void {
    this.latestReads.get(operation)?.abort();
    this.latestReads.delete(operation);
  }

  cancelMutations(operations: ReadonlySet<ScreenMutationOperation>): void {
    const active = this.activeMutation;
    if (active !== null && operations.has(active.operation)) {
      this.activeMutation = null;
      active.controller.abort();
      active.abort();
    }
    for (let index = this.queuedMutations.length - 1; index >= 0; index -= 1) {
      const queued = this.queuedMutations[index];
      if (!operations.has(queued.operation)) continue;
      this.queuedMutations.splice(index, 1);
      queued.abort();
    }
    this.drainMutations();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.currentGeneration += 1;
    this.abortAll();
  }

  private abortAll(): void {
    const activeMutation = this.activeMutation;
    this.activeMutation = null;
    activeMutation?.controller.abort();
    activeMutation?.abort();
    for (const queued of this.queuedMutations.splice(0)) queued.abort();
    for (const active of this.activeReads.values()) active.controller.abort();
    this.activeReads.clear();
    this.latestReads.clear();
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw createAbortError();
  }

  private createContext(
    operation: ScreenOperation,
    generation: number,
    signal: AbortSignal,
  ): ScreenOperationContext {
    return {
      generation,
      operation,
      signal,
      assertCurrent: () => {
        if (signal.aborted || !this.isCurrent(generation)) throw createAbortError();
      },
    };
  }

  private drainMutations(): void {
    if (this.disposed || this.activeMutation !== null) return;
    const next = this.queuedMutations.shift();
    if (next === undefined) return;
    next.execute();
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.currentGeneration;
  }
}
