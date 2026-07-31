import {
  ScreenAdapterErrorCode,
  type ScreenHostAdapter,
  type ScreenSnapshotSummary,
} from '../contracts/adapter.js';
import type {
  ScreenProjectDraft,
  ScreenProjectEnvelope,
  ScreenProjectEnvelopeInput,
} from '../contracts/document.js';
import type { ScreenEditorEventDetailMap } from '../events.js';
import {
  ScreenHostController,
  type ScreenHostSessionPort,
  type ScreenSessionApplyCommand,
} from './screen-host-controller.js';

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

function createEnvelope(
  projectId = 'screen-1',
  overrides: Partial<ScreenProjectEnvelopeInput> = {},
): ScreenProjectEnvelopeInput {
  return {
    id: projectId,
    name: `Project ${projectId}`,
    description: null,
    status: 'draft',
    revision: `revision-${projectId}`,
    document: {
      schemaVersion: 1,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [],
      globalVariables: [],
    },
    ...overrides,
  };
}

function toDraft(envelope: ScreenProjectEnvelope): ScreenProjectDraft {
  return {
    name: envelope.name,
    description: envelope.description,
    document: structuredClone(envelope.document),
  };
}

function createSession() {
  let snapshot: ReturnType<ScreenHostSessionPort['getSnapshot']> = null;
  const commands: ScreenSessionApplyCommand[] = [];
  const session: ScreenHostSessionPort = {
    applyEnvelope: (command) => {
      commands.push(structuredClone(command));
      snapshot = {
        projectId: command.envelope.id,
        revision: command.envelope.revision,
        draft: toDraft(command.envelope),
        dirty: false,
      };
    },
    clear: () => {
      snapshot = null;
    },
    getSnapshot: () => (snapshot === null ? null : structuredClone(snapshot)),
  };
  return {
    commands,
    session,
    setDirty: (dirty: boolean) => {
      if (snapshot !== null) snapshot = { ...snapshot, dirty };
    },
  };
}

function createAdapter(overrides: Partial<ScreenHostAdapter> = {}): ScreenHostAdapter {
  return {
    loadProject: ({ projectId }) => Promise.resolve(createEnvelope(projectId)),
    saveProject: ({ projectId, draft }) =>
      Promise.resolve({
        ...createEnvelope(projectId),
        ...draft,
        revision: 'revision-saved',
      }),
    ...overrides,
  };
}

async function flushBinding(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function loadController(
  controller: ScreenHostController,
  adapter: ScreenHostAdapter,
  projectId = 'screen-1',
): Promise<void> {
  controller.setBinding(projectId, adapter);
  await flushBinding();
  expect(controller.getState().phase).toBe('awaiting-render');
  controller.markRendered();
  await controller.whenReady();
}

const SNAPSHOT: ScreenSnapshotSummary = {
  id: 'snapshot-1',
  name: 'Snapshot',
  createdAt: '2026-07-31T08:00:00.000Z',
  componentCount: 0,
  canvasWidth: 1920,
  canvasHeight: 1080,
};

describe('ScreenHostController', () => {
  it('loads once after binding, waits for render, and dispatches ready', async () => {
    const { session, commands } = createSession();
    const target = document.createElement('div');
    const readyListener = vi.fn<(event: Event) => void>();
    target.addEventListener('nebula-ready', readyListener);
    const loadProject = vi.fn(({ projectId }: { projectId: string }) =>
      Promise.resolve(createEnvelope(projectId)),
    );
    const controller = new ScreenHostController({ session, eventTarget: target });
    const adapter = createAdapter({ loadProject });

    controller.setBinding(undefined, adapter);
    controller.setBinding('screen-1', adapter);
    const ready = controller.whenReady();
    await flushBinding();

    expect(loadProject).toHaveBeenCalledOnce();
    expect(commands[0]?.source).toBe('load');
    expect(controller.getState().phase).toBe('awaiting-render');
    expect(readyListener).not.toHaveBeenCalled();
    controller.markRendered();

    await expect(ready).resolves.toBeUndefined();
    expect(controller.getState().phase).toBe('ready');
    expect(readyListener).toHaveBeenCalledOnce();
    const event = readyListener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('ignores a late load response after switching projects', async () => {
    const { session, commands } = createSession();
    const firstLoad = createDeferred<ScreenProjectEnvelopeInput>();
    const adapter = createAdapter({
      loadProject: ({ projectId }) =>
        projectId === 'screen-1' ? firstLoad.promise : Promise.resolve(createEnvelope(projectId)),
    });
    const controller = new ScreenHostController({ session });

    controller.setBinding('screen-1', adapter);
    await flushBinding();
    controller.setBinding('screen-2', adapter);
    await flushBinding();
    firstLoad.resolve(createEnvelope('screen-1'));
    await flushBinding();

    expect(commands.at(-1)?.envelope.id).toBe('screen-2');
    expect(commands.filter((command) => command.envelope.id === 'screen-1')).toHaveLength(0);
  });

  it('ignores a late load rejection after switching projects', async () => {
    const { session, commands } = createSession();
    const firstLoad = createDeferred<ScreenProjectEnvelopeInput>();
    const adapter = createAdapter({
      loadProject: ({ projectId }) =>
        projectId === 'screen-1' ? firstLoad.promise : Promise.resolve(createEnvelope(projectId)),
    });
    const controller = new ScreenHostController({ session });

    controller.setBinding('screen-1', adapter);
    controller.setBinding('screen-2', adapter);
    firstLoad.reject(new Error('late transport failure'));
    await vi.waitFor(() => expect(controller.getState().phase).toBe('awaiting-render'));

    expect(controller.getState().projectId).toBe('screen-2');
    expect(controller.getState().error).toBeUndefined();
    expect(commands.at(-1)?.envelope.id).toBe('screen-2');
  });

  it('starts a new whenReady cycle synchronously when the binding changes', async () => {
    const { session } = createSession();
    const secondLoad = createDeferred<ScreenProjectEnvelopeInput>();
    const firstAdapter = createAdapter();
    const secondAdapter = createAdapter({ loadProject: () => secondLoad.promise });
    const controller = new ScreenHostController({ session });
    await loadController(controller, firstAdapter);

    controller.setBinding('screen-2', secondAdapter);
    const ready = controller.whenReady();
    let resolved = false;
    void ready.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(controller.getState().phase).toBe('loading');

    secondLoad.resolve(createEnvelope('screen-2'));
    await vi.waitFor(() => expect(controller.getState().phase).toBe('awaiting-render'));
    controller.markRendered();
    await expect(ready).resolves.toBeUndefined();
  });

  it('creates a new ready cycle when a failed load is retried', async () => {
    const { session } = createSession();
    let loadCount = 0;
    const adapter = createAdapter({
      loadProject: ({ projectId }) => {
        loadCount += 1;
        return loadCount === 1
          ? Promise.reject(new Error('temporary outage'))
          : Promise.resolve(createEnvelope(projectId));
      },
    });
    const controller = new ScreenHostController({ session });
    controller.setBinding('screen-1', adapter);
    await vi.waitFor(() => expect(controller.getState().phase).toBe('error'));

    await expect(controller.whenReady()).rejects.toMatchObject({
      code: ScreenAdapterErrorCode.UNKNOWN,
    });
    const retry = controller.retry();
    const ready = controller.whenReady();
    await retry;
    expect(controller.getState().phase).toBe('awaiting-render');
    controller.markRendered();

    await expect(ready).resolves.toBeUndefined();
    expect(loadCount).toBe(2);
  });

  it('deduplicates save and serializes restore behind it', async () => {
    const { session, commands } = createSession();
    const saveResponse = createDeferred<ScreenProjectEnvelopeInput>();
    const restore = vi.fn(() =>
      Promise.resolve(createEnvelope('screen-1', { revision: 'revision-restored' })),
    );
    const saveProject = vi.fn(() => saveResponse.promise);
    const adapter = createAdapter({
      saveProject,
      snapshots: {
        list: () => Promise.resolve([]),
        create: () => Promise.resolve(SNAPSHOT),
        restore,
        remove: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
    });
    const controller = new ScreenHostController({ session });
    await loadController(controller, adapter);

    const firstSave = controller.save();
    const secondSave = controller.save();
    const restorePromise = controller.restoreSnapshot('snapshot-1');
    expect(firstSave).toBe(secondSave);
    expect(saveProject).toHaveBeenCalledOnce();
    expect(restore).not.toHaveBeenCalled();

    saveResponse.resolve(createEnvelope('screen-1', { revision: 'revision-saved' }));
    await expect(firstSave).resolves.toMatchObject({ revision: 'revision-saved' });
    await expect(restorePromise).resolves.toMatchObject({ revision: 'revision-restored' });
    expect(restore).toHaveBeenCalledOnce();
    expect(commands.at(-1)?.source).toBe('snapshot-restore');
  });

  it('settles an aborted save immediately and does not reuse it after a project switch', async () => {
    const { session } = createSession();
    const pendingSave = createDeferred<ScreenProjectEnvelopeInput>();
    const firstAdapter = createAdapter({ saveProject: () => pendingSave.promise });
    const secondSave = vi.fn(() =>
      Promise.resolve(createEnvelope('screen-2', { revision: 'revision-screen-2-saved' })),
    );
    const secondAdapter = createAdapter({ saveProject: secondSave });
    const controller = new ScreenHostController({ session });
    await loadController(controller, firstAdapter);

    const oldSave = controller.save();
    const oldSaveResult = oldSave.catch((error: unknown) => error);
    controller.setBinding('screen-2', secondAdapter);
    await expect(oldSaveResult).resolves.toMatchObject({ code: ScreenAdapterErrorCode.ABORTED });
    await vi.waitFor(() => expect(controller.getState().phase).toBe('awaiting-render'));
    controller.markRendered();

    await expect(controller.save()).resolves.toMatchObject({
      revision: 'revision-screen-2-saved',
    });
    expect(secondSave).toHaveBeenCalledOnce();
    pendingSave.resolve(createEnvelope('screen-1', { revision: 'late-save' }));
  });

  it('rejects mutations while reload is in progress', async () => {
    const { session } = createSession();
    const reloadResponse = createDeferred<ScreenProjectEnvelopeInput>();
    const saveProject = vi.fn(() => Promise.resolve(createEnvelope('screen-1')));
    let loadCount = 0;
    const adapter = createAdapter({
      loadProject: () => {
        loadCount += 1;
        return loadCount === 1 ? Promise.resolve(createEnvelope()) : reloadResponse.promise;
      },
      saveProject,
    });
    const controller = new ScreenHostController({ session });
    await loadController(controller, adapter);

    const reload = controller.reload({ discardChanges: true });
    await expect(controller.save()).rejects.toMatchObject({
      code: ScreenAdapterErrorCode.UNAVAILABLE,
    });
    expect(saveProject).not.toHaveBeenCalled();
    reloadResponse.resolve(createEnvelope('screen-1', { revision: 'revision-reloaded' }));
    await reload;
  });

  it('keeps the session untouched and emits a safe conflict error', async () => {
    const { session, commands, setDirty } = createSession();
    const target = document.createElement('div');
    const errorListener = vi.fn<(event: Event) => void>();
    target.addEventListener('nebula-error', errorListener);
    const conflict = Object.assign(new Error('Authorization: Bearer secret-token'), {
      code: ScreenAdapterErrorCode.CONFLICT,
      response: { cookie: 'session=secret' },
    });
    const controller = new ScreenHostController({ session, eventTarget: target });
    await loadController(
      controller,
      createAdapter({ saveProject: () => Promise.reject(conflict) }),
    );
    setDirty(true);

    await expect(controller.save()).rejects.toMatchObject({
      code: ScreenAdapterErrorCode.CONFLICT,
    });

    expect(commands).toHaveLength(1);
    const event = errorListener.mock.calls.at(-1)?.[0] as CustomEvent<
      ScreenEditorEventDetailMap['nebula-error']
    >;
    expect(event.detail.error.message).toBe('项目已被其他操作更新，请重新加载后重试。');
    expect(JSON.stringify(event.detail)).not.toContain('secret');
  });

  it('rejects unsupported documents without creating a session', async () => {
    const { session, commands } = createSession();
    const controller = new ScreenHostController({ session });
    const adapter = createAdapter({
      loadProject: () =>
        Promise.resolve(
          createEnvelope('screen-1', {
            document: {
              ...createEnvelope().document,
              components: [
                {
                  id: 'dynamic-1',
                  type: 'text',
                  name: 'Dynamic',
                  position: { x: 0, y: 0, width: 100, height: 40 },
                  props: { content: 'Dynamic' },
                  style: {},
                  status: { locked: false, hidden: false },
                  zIndex: 0,
                  dataSource: {
                    type: 'api',
                    staticData: [],
                    apiConfig: { url: 'https://example.com' },
                  },
                },
              ],
            },
          }),
        ),
    });

    controller.setBinding('screen-1', adapter);
    await flushBinding();

    await vi.waitFor(() => expect(controller.getState().phase).toBe('unsupported'));
    expect(commands).toHaveLength(0);
  });

  it('validates import before reading and applies valid transfer responses', async () => {
    const { session, commands } = createSession();
    const importProject = vi.fn(({ projectId }: { projectId: string }) =>
      Promise.resolve(createEnvelope(projectId, { revision: 'revision-imported' })),
    );
    const controller = new ScreenHostController({ session });
    await loadController(controller, createAdapter({ importProject }));
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.json', {
      type: 'application/json',
    });
    const textSpy = vi.spyOn(oversized, 'text');

    await expect(controller.prepareImport(oversized)).rejects.toMatchObject({
      code: ScreenAdapterErrorCode.VALIDATION,
    });
    expect(textSpy).not.toHaveBeenCalled();

    const transfer = {
      format: 'nebula-screen',
      formatVersion: 1,
      name: 'Imported',
      description: null,
      document: createEnvelope().document,
    };
    const prepared = await controller.prepareImport(
      new File([JSON.stringify(transfer)], 'screen.json', { type: 'application/json' }),
    );
    await expect(controller.importProject(prepared)).resolves.toMatchObject({
      revision: 'revision-imported',
    });
    expect(commands.at(-1)?.source).toBe('import');
  });

  it('validates snapshot and export adapter responses', async () => {
    const { session } = createSession();
    const controller = new ScreenHostController({ session });
    await loadController(
      controller,
      createAdapter({
        exportProject: () =>
          Promise.resolve({
            fileName: '../unsafe.json',
            blob: new Blob(['{}'], { type: 'text/plain' }),
          }),
        snapshots: {
          list: () => Promise.resolve([{ ...SNAPSHOT, componentCount: -1 }]),
          create: () => Promise.resolve(SNAPSHOT),
          restore: () => Promise.resolve(createEnvelope()),
          remove: () => Promise.resolve(),
          clear: () => Promise.resolve(),
        },
      }),
    );

    await expect(controller.exportProject()).rejects.toMatchObject({
      code: ScreenAdapterErrorCode.VALIDATION,
    });
    await expect(controller.listSnapshots()).rejects.toMatchObject({
      code: ScreenAdapterErrorCode.VALIDATION,
    });
  });

  it('cancels pending snapshot mutations without applying late responses', async () => {
    const { session, commands } = createSession();
    const restoreResponse = createDeferred<ScreenProjectEnvelopeInput>();
    const controller = new ScreenHostController({ session });
    await loadController(
      controller,
      createAdapter({
        snapshots: {
          list: () => Promise.resolve([]),
          create: () => Promise.resolve(SNAPSHOT),
          restore: () => restoreResponse.promise,
          remove: () => Promise.resolve(),
          clear: () => Promise.resolve(),
        },
      }),
    );

    const restore = controller.restoreSnapshot('snapshot-1');
    const restoreResult = restore.catch((error: unknown) => error);
    controller.cancelSnapshotMutations();

    await expect(restoreResult).resolves.toMatchObject({ code: ScreenAdapterErrorCode.ABORTED });
    restoreResponse.resolve(createEnvelope('screen-1', { revision: 'late-restore' }));
    await Promise.resolve();
    expect(commands).toHaveLength(1);
  });

  it('blocks publish while dirty without calling the adapter', async () => {
    const { session, setDirty } = createSession();
    const publishProject = vi.fn(() => Promise.resolve(createEnvelope()));
    const controller = new ScreenHostController({ session });
    await loadController(controller, createAdapter({ publishProject }));
    setDirty(true);

    await expect(controller.publish()).rejects.toMatchObject({
      code: ScreenAdapterErrorCode.DIRTY_STATE,
    });
    expect(publishProject).not.toHaveBeenCalled();
  });

  it('aborts pending adapter work on dispose and ignores late responses', async () => {
    const { session, commands } = createSession();
    const deferred = createDeferred<ScreenProjectEnvelopeInput>();
    let signal: AbortSignal | undefined;
    const controller = new ScreenHostController({ session });
    controller.setBinding(
      'screen-1',
      createAdapter({
        loadProject: (input) => {
          signal = input.signal;
          return deferred.promise;
        },
      }),
    );
    await flushBinding();
    controller.dispose();
    deferred.resolve(createEnvelope());
    await flushBinding();

    expect(signal?.aborted).toBe(true);
    expect(commands).toHaveLength(0);
    expect(controller.getState().phase).toBe('disposed');
  });
});
