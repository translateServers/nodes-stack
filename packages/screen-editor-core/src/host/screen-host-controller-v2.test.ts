import { describe, expect, it, vi } from 'vitest';
import type { ScreenHostAdapterV2 } from '../contracts/adapter.js';
import type {
  ScreenProjectEnvelopeInput,
  ScreenProjectEnvelopeV2,
  ScreenProjectExportV2,
} from '../contracts/document.js';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';
import {
  buildInstanceRegistry,
  type ScreenComponentRegistration,
} from '../registry/instance-registry.js';
import {
  ScreenHostControllerV2,
  type ScreenHostSessionPortV2,
  type ScreenSessionApplyCommandV2,
} from './screen-host-controller-v2.js';

function createV2Envelope(
  projectId = 'screen-1',
  overrides: Partial<ScreenProjectEnvelopeV2> = {},
): ScreenProjectEnvelopeV2 {
  return {
    id: projectId,
    name: `Project ${projectId}`,
    description: null,
    status: 'draft',
    revision: `revision-${projectId}`,
    document: {
      schemaVersion: 2,
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: '#000000',
        scaleMode: 'fit',
      },
      components: [
        {
          id: 'indicator-1',
          type: 'acme.indicator/v1',
          name: 'Indicator',
          position: { x: 0, y: 0, width: 240, height: 120 },
          style: {},
          props: { title: 'Revenue', value: 42 },
          status: { locked: false, hidden: false },
          zIndex: 1,
        },
      ],
      globalVariables: [],
    },
    ...overrides,
  };
}

function createV1Envelope(projectId = 'screen-1'): ScreenProjectEnvelopeInput {
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
  };
}

function createRegistry() {
  const manifest: ScreenComponentManifestV1 = {
    apiVersion: 'nebula.screen-component/v1',
    type: 'acme.indicator/v1',
    implementationVersion: '1.0.0',
    tagName: 'acme-indicator-v1',
    name: 'Indicator',
    category: 'chart',
    defaultSize: { width: 240, height: 120 },
    defaultProps: { title: 'Revenue', value: 0 },
    propsSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, value: { type: 'number' } },
      additionalProperties: false,
    },
  };
  const registration: ScreenComponentRegistration = {
    source: 'host',
    manifest,
    elementConstructor: class extends HTMLElement {},
  };
  return buildInstanceRegistry([registration]);
}

function createSession() {
  let snapshot: ReturnType<ScreenHostSessionPortV2['getSnapshot']> = null;
  const commands: ScreenSessionApplyCommandV2[] = [];
  const session: ScreenHostSessionPortV2 = {
    applyEnvelope: (command) => {
      commands.push(structuredClone(command));
      snapshot = {
        projectId: command.envelope.id,
        revision: command.envelope.revision,
        draft: {
          name: command.envelope.name,
          description: command.envelope.description,
          document: structuredClone(command.envelope.document),
        },
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
    updateDraft: (update: (draft: NonNullable<typeof snapshot>['draft']) => void) => {
      if (snapshot === null) throw new Error('session has not loaded a project');
      const draft = structuredClone(snapshot.draft);
      update(draft);
      snapshot = { ...snapshot, draft, dirty: true };
    },
  };
}

function createAdapter(overrides: Partial<ScreenHostAdapterV2> = {}): ScreenHostAdapterV2 {
  return {
    documentVersion: 2,
    loadProject: ({ projectId }) => Promise.resolve(createV2Envelope(projectId)),
    saveProject: ({ projectId, draft }) =>
      Promise.resolve({
        ...createV2Envelope(projectId, { revision: 'revision-saved' }),
        ...draft,
      }),
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function loadController(
  controller: ScreenHostControllerV2,
  adapter: ScreenHostAdapterV2,
  projectId = 'screen-1',
): Promise<void> {
  controller.setBinding(projectId, adapter);
  await flush();
  expect(controller.getState().phase).toBe('awaiting-render');
  controller.markRendered();
  await controller.whenReady();
}

describe('ScreenHostControllerV2', () => {
  it('loads, saves and reloads a registry-validated V2 document', async () => {
    const { session, commands, updateDraft } = createSession();
    const saveProject = vi.fn<ScreenHostAdapterV2['saveProject']>(({ projectId, draft }) =>
      Promise.resolve({
        ...createV2Envelope(projectId, { revision: 'revision-saved' }),
        ...draft,
      }),
    );
    const loadProject = vi.fn<ScreenHostAdapterV2['loadProject']>(({ projectId }) =>
      Promise.resolve(createV2Envelope(projectId, { revision: 'revision-reloaded' })),
    );
    const controller = new ScreenHostControllerV2({ registry: createRegistry(), session });
    await loadController(controller, createAdapter({ loadProject, saveProject }));

    updateDraft((draft) => {
      draft.document.components[0].props.value = 99;
    });
    controller.notifyChange('component');

    const saved = await controller.save();
    expect(saved.document.schemaVersion).toBe(2);
    expect(saveProject).toHaveBeenCalledOnce();
    expect(saveProject.mock.calls[0]?.[0].draft.document.schemaVersion).toBe(2);
    expect(saveProject.mock.calls[0]?.[0].draft.document.components[0]?.props.value).toBe(99);
    expect(commands.at(-1)?.source).toBe('save');

    await controller.reload({ discardChanges: true });
    expect(loadProject).toHaveBeenCalledTimes(2);
    expect(commands.at(-1)?.source).toBe('reload');
    expect(commands.at(-1)?.envelope.document.schemaVersion).toBe(2);
  });

  it('normalizes V1 input, blocks publish until V2 save, then allows publish', async () => {
    const { session } = createSession();
    const publishProject = vi.fn<NonNullable<ScreenHostAdapterV2['publishProject']>>(
      ({ projectId }) => Promise.resolve(createV2Envelope(projectId, { status: 'published' })),
    );
    const controller = new ScreenHostControllerV2({ registry: createRegistry(), session });
    await loadController(
      controller,
      createAdapter({
        loadProject: ({ projectId }) => Promise.resolve(createV1Envelope(projectId)),
        publishProject,
      }),
    );

    await expect(controller.publish()).rejects.toMatchObject({ code: 'DIRTY_STATE' });
    expect(publishProject).not.toHaveBeenCalled();

    await controller.save();
    await controller.publish();
    expect(publishProject).toHaveBeenCalledOnce();
  });

  it('supports V2 import, export and snapshot operations', async () => {
    const { session } = createSession();
    const snapshot = {
      id: 'snapshot-1',
      name: 'Snapshot',
      createdAt: '2026-08-01T00:00:00.000Z',
      componentCount: 1,
      canvasWidth: 1920,
      canvasHeight: 1080,
    };
    const envelope = createV2Envelope();
    const exportResponse: ScreenProjectExportV2 = {
      fileName: 'v2-project.json',
      transfer: {
        format: 'nebula-screen',
        formatVersion: 2,
        name: envelope.name,
        description: envelope.description,
        document: envelope.document,
      },
    };
    const adapter = createAdapter({
      importProject: vi.fn(() => Promise.resolve({ ...envelope, revision: 'revision-imported' })),
      exportProject: vi.fn(() => Promise.resolve(exportResponse)),
      snapshots: {
        list: vi.fn(() => Promise.resolve([snapshot])),
        create: vi.fn(() => Promise.resolve(snapshot)),
        restore: vi.fn(() => Promise.resolve({ ...envelope, revision: 'revision-restored' })),
        remove: vi.fn(() => Promise.resolve()),
        clear: vi.fn(() => Promise.resolve()),
      },
    });
    const controller = new ScreenHostControllerV2({ registry: createRegistry(), session });
    await loadController(controller, adapter);

    expect(controller.getState().capabilities).toMatchObject({
      import: true,
      export: true,
      snapshots: true,
    });

    const file = new File(
      [
        JSON.stringify({
          format: 'nebula-screen',
          formatVersion: 2,
          name: envelope.name,
          description: envelope.description,
          document: envelope.document,
        }),
      ],
      'import.json',
      { type: 'application/json' },
    );
    const prepared = await controller.prepareImport(file);
    expect(prepared.transfer.formatVersion).toBe(2);
    await controller.importProject(prepared);

    const exported = await controller.exportProject();
    expect(exported.fileName).toBe('v2-project.json');
    const exportedPayload: unknown = JSON.parse(await exported.blob.text());
    expect(exportedPayload).toMatchObject({ formatVersion: 2 });

    await expect(controller.listSnapshots()).resolves.toEqual([snapshot]);
    await expect(controller.createSnapshot()).resolves.toEqual(snapshot);
    await expect(controller.restoreSnapshot(snapshot.id)).resolves.toMatchObject({
      revision: 'revision-restored',
    });
    await expect(controller.removeSnapshot(snapshot.id)).resolves.toBeUndefined();
    await expect(controller.clearSnapshots()).resolves.toBeUndefined();
  });

  it('fails closed when a V2 document refers to an unknown registry component', async () => {
    const { session, commands } = createSession();
    const controller = new ScreenHostControllerV2({ registry: createRegistry(), session });
    const adapter = createAdapter({
      loadProject: ({ projectId }) =>
        Promise.resolve({
          ...createV2Envelope(projectId),
          document: {
            ...createV2Envelope(projectId).document,
            components: [
              {
                ...createV2Envelope(projectId).document.components[0],
                type: 'unknown.component/v1',
              },
            ],
          },
        }),
    });

    controller.setBinding('screen-1', adapter);
    await vi.waitFor(() => expect(controller.getState().phase).toBe('unsupported'));

    expect(commands).toHaveLength(0);
  });
});
