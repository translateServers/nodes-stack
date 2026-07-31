import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenProject } from '@nebula/shared';
import {
  ScreenAdapterErrorCode,
  ScreenHostController,
  type ScreenHostAdapter,
  type ScreenProjectEnvelopeInput,
} from '@nebula/screen-editor-core/internal';
import type {
  ScreenSnapshotHostAdapter,
  ScreenSnapshotSummary,
  SnapshotCreateInput,
  SnapshotProjectInput,
  SnapshotRemoveInput,
  SnapshotRestoreInput,
} from '../adapters/screen-editor-host-adapter';
import { createScreenEditorStore, ScreenEditorStoreProvider } from '../stores/editor-store';
import { createScreenHostSessionPort } from '../lib/screen-host-session';
import { ScreenEditorNotificationProvider } from './screen-editor-notifications';
import { SnapshotManagerDialog } from './snapshot-manager-dialog';

const SNAPSHOT: ScreenSnapshotSummary = {
  id: '1753843200000',
  name: '初始项目',
  createdAt: '2025-07-30T16:00:00.000Z',
  componentCount: 0,
  canvasWidth: 1920,
  canvasHeight: 1080,
};

function createProject(name = '初始项目'): ScreenProject {
  return {
    id: 'screen-1',
    name,
    description: null,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      scaleMode: 'fit',
    },
    components: [],
    globalVariables: [],
    status: 'draft',
    thumbnail: null,
    createdAt: '2026-07-30 10:00:00',
    updatedAt: '2026-07-30 10:00:00',
  };
}

function createEnvelope(): ScreenProjectEnvelopeInput {
  const project = createProject();
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    revision: project.updatedAt,
    document: {
      schemaVersion: 1,
      canvas: project.canvas,
      components: [],
      globalVariables: [],
    },
  };
}

function createAdapter(overrides: Partial<ScreenSnapshotHostAdapter> = {}) {
  const list = vi.fn((input: SnapshotProjectInput): Promise<ScreenSnapshotSummary[]> => {
    void input;
    return Promise.resolve([SNAPSHOT]);
  });
  const create = vi.fn((input: SnapshotCreateInput): Promise<ScreenSnapshotSummary> => {
    void input;
    return Promise.resolve({ ...SNAPSHOT, id: '1753843200001' });
  });
  const restore = vi.fn((input: SnapshotRestoreInput): Promise<ScreenProject> => {
    void input;
    return Promise.resolve(createProject('恢复后的项目'));
  });
  const remove = vi.fn((input: SnapshotRemoveInput): Promise<void> => {
    void input;
    return Promise.resolve();
  });
  const clear = vi.fn((input: SnapshotProjectInput): Promise<void> => {
    void input;
    return Promise.resolve();
  });
  const adapter: ScreenSnapshotHostAdapter = {
    list,
    create,
    restore,
    remove,
    clear,
    ...overrides,
  };
  return { adapter, list, create, restore };
}

function renderDialog(adapter: ScreenSnapshotHostAdapter) {
  const store = createScreenEditorStore({ persistPreferences: false });
  store.getState().loadProject(createProject());
  const onOpenChange = vi.fn();
  const view = render(
    <ScreenEditorStoreProvider store={store}>
      <ScreenEditorNotificationProvider>
        <SnapshotManagerDialog
          open
          onOpenChange={onOpenChange}
          projectId="screen-1"
          adapter={adapter}
        />
      </ScreenEditorNotificationProvider>
    </ScreenEditorStoreProvider>,
  );
  return { ...view, store, onOpenChange };
}

describe('SnapshotManagerDialog host adapter flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads snapshots and sends a detached project with the current revision on create', async () => {
    const { adapter, list, create } = createAdapter();
    const { store } = renderDialog(adapter);

    expect(await screen.findByText('0 个组件 · 1920×1080')).toBeInTheDocument();
    const listInput = list.mock.calls[0]?.[0];
    expect(listInput?.projectId).toBe('screen-1');
    expect(listInput?.signal).toBeInstanceOf(AbortSignal);

    const storeProject = store.getState().project;
    fireEvent.click(screen.getByRole('button', { name: '创建快照' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    const createInput = create.mock.calls[0]?.[0];
    expect(createInput).toMatchObject({
      projectId: 'screen-1',
      revision: '2026-07-30 10:00:00',
    });
    expect(createInput?.project).toEqual(storeProject);
    expect(createInput?.project).not.toBe(storeProject);
  });

  it('restores the adapter project as a clean Store baseline', async () => {
    const { adapter, restore } = createAdapter();
    const { store, onOpenChange } = renderDialog(adapter);
    await screen.findByText('0 个组件 · 1920×1080');
    store.getState().renameProject('未保存名称');
    expect(store.getState().isDirty).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '恢复快照' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认恢复' }));

    await waitFor(() => expect(restore).toHaveBeenCalledOnce());
    const restoreInput = restore.mock.calls[0]?.[0];
    expect(restoreInput).toMatchObject({
      projectId: 'screen-1',
      snapshotId: SNAPSHOT.id,
      revision: '2026-07-30 10:00:00',
    });
    expect(restoreInput?.signal).toBeInstanceOf(AbortSignal);
    expect(store.getState().project?.name).toBe('恢复后的项目');
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().history).toEqual({ past: [], future: [] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('aborts a pending list operation without showing an error when the dialog unmounts', async () => {
    let listSignal: AbortSignal | undefined;
    const { adapter } = createAdapter({
      list: (input) => {
        listSignal = input.signal;
        return new Promise<ScreenSnapshotSummary[]>((resolve, reject) => {
          void resolve;
          input.signal.addEventListener('abort', () => reject(new Error('adapter abort detail')));
        });
      },
    });
    const { unmount } = renderDialog(adapter);

    expect(listSignal?.aborted).toBe(false);
    unmount();
    expect(listSignal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('routes Host restore conflicts to the reload-or-cancel flow', async () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const conflict = Object.assign(new Error('conflict detail'), {
      code: ScreenAdapterErrorCode.CONFLICT,
    });
    const adapter: ScreenHostAdapter = {
      loadProject: () => Promise.resolve(createEnvelope()),
      saveProject: () => Promise.resolve(createEnvelope()),
      snapshots: {
        list: () => Promise.resolve([SNAPSHOT]),
        create: () => Promise.resolve(SNAPSHOT),
        restore: () => Promise.reject(conflict),
        remove: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      },
    };
    const controller = new ScreenHostController({
      session: createScreenHostSessionPort(store),
    });
    controller.setBinding('screen-1', adapter);
    await vi.waitFor(() => expect(controller.getState().phase).toBe('awaiting-render'));
    controller.markRendered();
    const onConflict = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ScreenEditorStoreProvider store={store}>
        <ScreenEditorNotificationProvider>
          <SnapshotManagerDialog
            open
            onOpenChange={onOpenChange}
            onConflict={onConflict}
            projectId="screen-1"
            hostController={controller}
          />
        </ScreenEditorNotificationProvider>
      </ScreenEditorStoreProvider>,
    );
    await screen.findByText('0 个组件 · 1920×1080');
    fireEvent.click(screen.getByRole('button', { name: '恢复快照' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认恢复' }));

    await waitFor(() => expect(onConflict).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(store.getState().project?.updatedAt).toBe('2026-07-30 10:00:00');
  });
});
