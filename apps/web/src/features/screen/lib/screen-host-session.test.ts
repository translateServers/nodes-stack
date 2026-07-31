import type { ScreenHostAdapter, ScreenProjectEnvelopeInput } from '@nebula/screen-sdk';
import { ScreenHostController } from '@nebula/screen-sdk';
import type { ScreenProject } from '@nebula/shared';
import { describe, expect, it, vi } from 'vitest';
import { createScreenEditorStore } from '../stores/editor-store';
import { createScreenHostSessionPort } from './screen-host-session';

function createProject(): ScreenProject {
  return {
    id: 'screen-1',
    name: 'Screen',
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
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: 'revision-1',
  };
}

function createEnvelope(revision: string): ScreenProjectEnvelopeInput {
  const project = createProject();
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    revision,
    document: {
      schemaVersion: 1,
      canvas: project.canvas,
      components: [],
      globalVariables: [],
    },
  };
}

describe('createScreenHostSessionPort', () => {
  it('connects the Host controller to the instance Store without losing save history', async () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const adapter: ScreenHostAdapter = {
      loadProject: () => Promise.resolve(createEnvelope('revision-1')),
      saveProject: ({ draft }) =>
        Promise.resolve({ ...createEnvelope('revision-2'), ...structuredClone(draft) }),
    };
    const controller = new ScreenHostController({ session: createScreenHostSessionPort(store) });

    controller.setBinding('screen-1', adapter);
    await vi.waitFor(() => expect(controller.getState().phase).toBe('awaiting-render'));
    controller.markRendered();
    store.getState().updateCanvas({ width: 1280 });
    expect(store.getState().history.past).toHaveLength(1);

    await controller.save();

    expect(store.getState().project?.updatedAt).toBe('revision-2');
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().isDirty).toBe(false);
  });

  it('returns no SDK session for a dynamic project rejected by the static contract', () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    store.getState().loadProject({
      ...createProject(),
      components: [
        {
          id: 'custom-1',
          type: 'custom-component',
          name: 'Custom',
          position: { x: 0, y: 0, width: 100, height: 100 },
          props: {},
          style: {},
          status: { locked: false, hidden: false },
          zIndex: 0,
        },
      ],
    });

    expect(createScreenHostSessionPort(store).getSnapshot()).toBeNull();
  });
});
