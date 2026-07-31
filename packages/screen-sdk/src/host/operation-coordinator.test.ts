import {
  ScreenOperationCoordinator,
  type ScreenMutationOperation,
} from './operation-coordinator.js';

interface Deferred<Value> {
  promise: Promise<Value>;
  reject(error: unknown): void;
  resolve(value: Value): void;
}

function createDeferred<Value>(): Deferred<Value> {
  let resolvePromise: ((value: Value) => void) | undefined;
  let rejectPromise: ((error: unknown) => void) | undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    reject: (error) => rejectPromise?.(error),
    resolve: (value) => resolvePromise?.(value),
  };
}

const MUTATIONS: ScreenMutationOperation[] = [
  'save',
  'publish',
  'import',
  'snapshot-create',
  'snapshot-restore',
  'snapshot-remove',
  'snapshot-clear',
];

describe('ScreenOperationCoordinator', () => {
  it.each(
    MUTATIONS.flatMap((first) => MUTATIONS.map((second) => [first, second] as const)),
  )('serializes %s followed by %s', async (firstOperation, secondOperation) => {
    const coordinator = new ScreenOperationCoordinator();
    const firstDeferred = createDeferred<string>();
    let activeCount = 0;
    let maxActiveCount = 0;
    const calls: ScreenMutationOperation[] = [];

    const first = coordinator.runMutation(firstOperation, async () => {
      calls.push(firstOperation);
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      const result = await firstDeferred.promise;
      activeCount -= 1;
      return result;
    });
    const second = coordinator.runMutation(secondOperation, () => {
      calls.push(secondOperation);
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      activeCount -= 1;
      return Promise.resolve('second');
    });

    expect(calls).toEqual([firstOperation]);
    firstDeferred.resolve('first');
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(calls).toEqual([firstOperation, secondOperation]);
    expect(maxActiveCount).toBe(1);
  });

  it('aborts active and queued mutations when the generation changes', async () => {
    const coordinator = new ScreenOperationCoordinator();
    const deferred = createDeferred<string>();
    let activeSignal: AbortSignal | undefined;
    const active = coordinator.runMutation('save', async (context) => {
      activeSignal = context.signal;
      return deferred.promise;
    });
    const queuedTask = vi.fn(() => Promise.resolve('queued'));
    const queued = coordinator.runMutation('publish', queuedTask);
    const activeResult = active.catch((error: unknown) => error);
    const queuedResult = queued.catch((error: unknown) => error);

    coordinator.advanceGeneration();
    expect(activeSignal?.aborted).toBe(true);
    deferred.resolve('late');

    await expect(activeResult).resolves.toMatchObject({ name: 'AbortError' });
    await expect(queuedResult).resolves.toMatchObject({ name: 'AbortError' });
    expect(queuedTask).not.toHaveBeenCalled();
  });

  it('allows reads to run with a mutation and cancels only the previous latest read', async () => {
    const coordinator = new ScreenOperationCoordinator();
    const mutationDeferred = createDeferred<void>();
    const firstReadDeferred = createDeferred<string>();
    let firstReadSignal: AbortSignal | undefined;

    const mutation = coordinator.runMutation('save', async () => mutationDeferred.promise);
    const firstRead = coordinator.runRead(
      'snapshot-list',
      async (context) => {
        firstReadSignal = context.signal;
        return firstReadDeferred.promise;
      },
      { latestOnly: true },
    );
    const secondRead = coordinator.runRead('snapshot-list', () => Promise.resolve('second'), {
      latestOnly: true,
    });

    expect(firstReadSignal?.aborted).toBe(true);
    firstReadDeferred.resolve('late');
    await expect(firstRead).rejects.toMatchObject({ name: 'AbortError' });
    await expect(secondRead).resolves.toBe('second');
    mutationDeferred.resolve();
    await expect(mutation).resolves.toBeUndefined();
  });

  it('converts a stale read rejection to AbortError', async () => {
    const coordinator = new ScreenOperationCoordinator();
    const deferred = createDeferred<string>();
    const read = coordinator.runRead('load', () => deferred.promise);
    const result = read.catch((error: unknown) => error);

    coordinator.advanceGeneration();
    deferred.reject(new Error('late transport failure'));

    await expect(result).resolves.toMatchObject({ name: 'AbortError' });
  });

  it('settles a cancelled active mutation even when its task ignores AbortSignal', async () => {
    const coordinator = new ScreenOperationCoordinator();
    const never = new Promise<string>(() => undefined);
    const active = coordinator.runMutation('snapshot-restore', () => never);
    const activeResult = active.catch((error: unknown) => error);

    coordinator.cancelMutations(new Set<ScreenMutationOperation>(['snapshot-restore']));
    const next = coordinator.runMutation('save', () => Promise.resolve('saved'));

    await expect(activeResult).resolves.toMatchObject({ name: 'AbortError' });
    await expect(next).resolves.toBe('saved');
  });
});
