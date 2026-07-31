import type {
  ScreenEditorEventDetailMap,
  ScreenHostAdapter,
  ScreenProjectEnvelopeInput,
} from '@nebula/screen-sdk';
import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createScreenEditorStore, ScreenEditorStoreProvider } from '../stores/editor-store';
import type { ScreenEditorWorkbenchOperationController } from './screen-editor-workbench';

const workbenchCapture = vi.hoisted(
  (): { operations?: ScreenEditorWorkbenchOperationController } => ({}),
);

vi.mock('./screen-editor-workbench', () => ({
  ScreenEditorWorkbench: (props: { operations: ScreenEditorWorkbenchOperationController }) => {
    workbenchCapture.operations = props.operations;
    return null;
  },
}));

import { ScreenHostAdapterWorkbench } from './screen-host-adapter-workbench';

function createEnvelope(): ScreenProjectEnvelopeInput {
  return {
    id: 'screen-1',
    name: 'Screen',
    description: null,
    status: 'draft',
    revision: 'revision-1',
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

describe('ScreenHostAdapterWorkbench', () => {
  it('survives StrictMode effect replay and emits one change event per Store commit', async () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const loadProject = vi.fn(() => Promise.resolve(createEnvelope()));
    const adapter: ScreenHostAdapter = {
      loadProject,
      saveProject: () => Promise.resolve(createEnvelope()),
    };
    const view = render(
      <StrictMode>
        <ScreenEditorStoreProvider store={store}>
          <ScreenHostAdapterWorkbench
            adapter={adapter}
            projectId="screen-1"
            setTheme={() => undefined}
            theme="light"
          />
        </ScreenEditorStoreProvider>
      </StrictMode>,
    );

    await vi.waitFor(() => expect(store.getState().project?.id).toBe('screen-1'));
    expect(loadProject).toHaveBeenCalledOnce();
    const controller = workbenchCapture.operations?.host?.controller;
    if (controller === undefined) throw new Error('Host controller was not passed to Workbench');
    const target = document.createElement('div');
    const changes = vi.fn<(event: Event) => void>();
    target.addEventListener('nebula-change', changes);
    controller.setEventTarget(target);

    store.getState().updateCanvas({ width: 1280 });

    expect(changes).toHaveBeenCalledOnce();
    const event = changes.mock.calls[0]?.[0] as CustomEvent<
      ScreenEditorEventDetailMap['nebula-change']
    >;
    expect(event.detail.reason).toBe('canvas');
    expect(event.detail.draft.document.canvas.width).toBe(1280);

    view.unmount();
    await Promise.resolve();
    expect(controller.getState().phase).toBe('disposed');
  });
});
