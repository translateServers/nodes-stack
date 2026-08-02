import type { ScreenHostAdapterV2 } from '../contracts/adapter.js';
import type { ScreenProjectEnvelopeInputV2 } from '../contracts/document.js';
import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';
import {
  buildInstanceRegistry,
  type ScreenComponentRegistration,
} from '../registry/instance-registry.js';
import { createScreenEditorStore, ScreenEditorStoreProvider } from '../stores/editor-store.js';
import type { ScreenEditorWorkbenchOperationController } from './screen-editor-workbench.js';

const workbenchCapture = vi.hoisted(
  (): { operations?: ScreenEditorWorkbenchOperationController } => ({}),
);

vi.mock('./screen-editor-workbench', () => ({
  ScreenEditorWorkbench: (props: { operations: ScreenEditorWorkbenchOperationController }) => {
    workbenchCapture.operations = props.operations;
    return null;
  },
}));

import { ScreenHostAdapterWorkbenchV2 } from './screen-host-adapter-workbench-v2.js';

function createRegistry() {
  const manifest: ScreenComponentManifestV1 = {
    apiVersion: 'nebula.screen-component/v1',
    type: 'acme.indicator/v1',
    implementationVersion: '1.0.0',
    tagName: 'acme-indicator-v1',
    name: 'Indicator',
    category: 'chart',
    defaultSize: { width: 240, height: 120 },
    defaultProps: { value: 0 },
    propsSchema: {
      type: 'object',
      properties: { value: { type: 'number' } },
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

function createEnvelope(projectId = 'screen-1'): ScreenProjectEnvelopeInputV2 {
  return {
    id: projectId,
    name: 'V2 Screen',
    description: null,
    status: 'draft',
    revision: 'revision-1',
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
          props: { value: 10 },
          status: { locked: false, hidden: false },
          zIndex: 1,
        },
      ],
      globalVariables: [],
    },
  };
}

describe('ScreenHostAdapterWorkbenchV2', () => {
  it('projects a V2 document into the editor store and saves a V2 draft', async () => {
    const store = createScreenEditorStore({ persistPreferences: false });
    const saveProject = vi.fn<ScreenHostAdapterV2['saveProject']>(({ projectId, draft }) =>
      Promise.resolve({
        ...createEnvelope(projectId),
        revision: 'revision-saved',
        ...draft,
      }),
    );
    const adapter: ScreenHostAdapterV2 = {
      documentVersion: 2,
      loadProject: ({ projectId }) => Promise.resolve(createEnvelope(projectId)),
      saveProject,
    };
    const registry = createRegistry();
    const view = render(
      <StrictMode>
        <ScreenEditorStoreProvider store={store}>
          <ScreenHostAdapterWorkbenchV2
            adapter={adapter}
            componentRegistry={registry}
            projectId="screen-1"
            setTheme={() => undefined}
            theme="light"
          />
        </ScreenEditorStoreProvider>
      </StrictMode>,
    );

    await vi.waitFor(() => expect(store.getState().project?.id).toBe('screen-1'));
    const controller = workbenchCapture.operations?.host?.controller;
    if (controller === undefined) throw new Error('V2 host controller was not passed to Workbench');
    expect(workbenchCapture.operations?.importController?.mode).toBe('v2');
    expect(workbenchCapture.operations?.snapshotController).toBe(controller);
    controller.markRendered();
    await controller.whenReady();

    store.getState().updateComponent('indicator-1', { props: { value: 99 } });
    await controller.save();

    expect(saveProject).toHaveBeenCalledOnce();
    expect(saveProject.mock.calls[0]?.[0].draft.document.schemaVersion).toBe(2);
    expect(saveProject.mock.calls[0]?.[0].draft.document.components[0]?.type).toBe(
      'acme.indicator/v1',
    );
    expect(saveProject.mock.calls[0]?.[0].draft.document.components[0]?.props.value).toBe(99);

    view.unmount();
    await Promise.resolve();
    expect(controller.getState().phase).toBe('disposed');
  });
});
