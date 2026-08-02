import { act } from 'react';
import {
  type ScreenHostAdapter,
  type ScreenHostAdapterV2,
  type ScreenProjectEnvelopeInput,
  type ScreenProjectEnvelopeInputV2,
} from '@nebula/screen-editor-core';
import { createScreenComponentRegistry } from '@nebula/screen-editor-core/experimental';
import type { ScreenComponentManifestV1 } from '@nebula/screen-component-sdk';

vi.mock('@scena/react-ruler', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    default: forwardRef<{ resize: () => void; scroll: () => void }, Record<string, unknown>>(
      function RulerMock(_props, ref) {
        useImperativeHandle(ref, () => ({
          resize: () => undefined,
          scroll: () => undefined,
        }));
        return null;
      },
    ),
  };
});

vi.unmock('../src/runtime/static-runtime.tsx');

import { mountNebulaScreenEditorRuntime } from '../src/runtime/static-runtime.js';
import type { ScreenEditorRuntime } from '../src/element/runtime.js';

function createEnvelope(projectId: string): ScreenProjectEnvelopeInput {
  return {
    id: projectId,
    name: projectId,
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

function createAdapter(projectId: string): ScreenHostAdapter {
  return {
    loadProject: vi.fn(() => Promise.resolve(createEnvelope(projectId))),
    saveProject: vi.fn(() => Promise.resolve(createEnvelope(projectId))),
  };
}

let v2ComponentCounter = 0;

async function createV2Registry() {
  v2ComponentCounter += 1;
  const tagName = `runtime-v2-card-${v2ComponentCounter}-v1`;
  class RuntimeV2Card extends HTMLElement {
    set model(_model: unknown) {}
  }

  const manifest: ScreenComponentManifestV1 = {
    apiVersion: 'nebula.screen-component/v1',
    type: 'test.runtime-card/v1',
    implementationVersion: '1.0.0',
    tagName,
    name: 'Runtime V2 Card',
    category: 'chart',
    defaultSize: { width: 240, height: 120 },
    defaultProps: { value: 0 },
    propsSchema: {
      type: 'object',
      properties: { value: { type: 'number' } },
      additionalProperties: false,
    },
  };
  const registry = await createScreenComponentRegistry({
    components: [
      {
        manifest,
        define: () => RuntimeV2Card,
      },
    ],
  });
  return { registry, tagName };
}

function createV2Envelope(projectId: string): ScreenProjectEnvelopeInputV2 {
  return {
    id: projectId,
    name: projectId,
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
          id: 'runtime-v2-card',
          type: 'test.runtime-card/v1',
          name: 'Runtime V2 Card',
          position: { x: 0, y: 0, width: 240, height: 120 },
          style: {},
          props: { value: 12 },
          status: { locked: false, hidden: false },
          zIndex: 1,
        },
      ],
      globalVariables: [],
    },
  };
}

describe('production static runtime', () => {
  it('mounts the core workbench without an application runtime', async () => {
    const eventTarget = document.createElement('div');
    const mountRoot = document.createElement('div');
    const portalRoot = document.createElement('div');
    document.body.append(eventTarget, mountRoot, portalRoot);
    let runtime: ScreenEditorRuntime | undefined;

    await act(async () => {
      runtime = mountNebulaScreenEditorRuntime({
        eventTarget,
        identifierPrefix: 'static-runtime-test',
        isActive: () => true,
        mountRoot,
        onThemeChange: () => undefined,
        options: { persistPreferences: false },
        portalRoot,
        projectId: 'screen-static-test',
        readonly: false,
        theme: 'light',
      });
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(mountRoot.querySelector('[aria-label="等待项目配置"]')).not.toBeNull(),
    );

    await act(async () => {
      runtime?.dispose();
      await Promise.resolve();
    });
    eventTarget.remove();
    mountRoot.remove();
    portalRoot.remove();
  });

  it('applies readonly updates before an immediate save command', async () => {
    const mountRoot = document.createElement('div');
    const portalRoot = document.createElement('div');
    const eventTarget = document.createElement('div');
    const adapter = createAdapter('screen-a');
    document.body.append(eventTarget, mountRoot, portalRoot);
    const runtime = mountNebulaScreenEditorRuntime({
      adapter,
      eventTarget,
      identifierPrefix: 'static-runtime-readonly',
      isActive: () => true,
      mountRoot,
      onThemeChange: () => undefined,
      options: { persistPreferences: false },
      portalRoot,
      projectId: 'screen-a',
      readonly: false,
      theme: 'light',
    });

    await vi.waitFor(() => expect(runtime.getDraft()?.name).toBe('screen-a'));
    await expect(runtime.whenReady()).resolves.toBeUndefined();
    let saveResult: Promise<unknown> | undefined;
    act(() => {
      runtime.update({
        adapter,
        options: { persistPreferences: false },
        projectId: 'screen-a',
        readonly: true,
        theme: 'light',
      });
      saveResult = runtime.save();
      void saveResult.catch(() => undefined);
    });

    await expect(saveResult).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(adapter.saveProject).not.toHaveBeenCalled();

    await act(async () => {
      runtime.dispose();
      await Promise.resolve();
    });
    eventTarget.remove();
    mountRoot.remove();
    portalRoot.remove();
  });

  it('invalidates the old project binding before an immediate command', async () => {
    const mountRoot = document.createElement('div');
    const portalRoot = document.createElement('div');
    const eventTarget = document.createElement('div');
    const firstAdapter = createAdapter('screen-a');
    const secondAdapter = createAdapter('screen-b');
    document.body.append(eventTarget, mountRoot, portalRoot);
    const runtime = mountNebulaScreenEditorRuntime({
      adapter: firstAdapter,
      eventTarget,
      identifierPrefix: 'static-runtime-binding',
      isActive: () => true,
      mountRoot,
      onThemeChange: () => undefined,
      options: { persistPreferences: false },
      portalRoot,
      projectId: 'screen-a',
      readonly: false,
      theme: 'light',
    });

    await vi.waitFor(() => expect(runtime.getDraft()?.name).toBe('screen-a'));
    await expect(runtime.whenReady()).resolves.toBeUndefined();
    let immediateSave: Promise<unknown> | undefined;
    act(() => {
      runtime.update({
        adapter: secondAdapter,
        options: { persistPreferences: false },
        projectId: 'screen-b',
        readonly: false,
        theme: 'light',
      });
      immediateSave = runtime.save();
      void immediateSave.catch(() => undefined);
    });

    await expect(immediateSave).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(firstAdapter.saveProject).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(runtime.getDraft()?.name).toBe('screen-b'));
    await expect(runtime.whenReady()).resolves.toBeUndefined();
    await expect(runtime.save()).resolves.toMatchObject({ id: 'screen-b' });
    expect(secondAdapter.saveProject).toHaveBeenCalledOnce();

    await act(async () => {
      runtime.dispose();
      await Promise.resolve();
    });
    eventTarget.remove();
    mountRoot.remove();
    portalRoot.remove();
  });

  it('aborts commands waiting for the initial React handle when disposed', async () => {
    const mountRoot = document.createElement('div');
    const portalRoot = document.createElement('div');
    const eventTarget = document.createElement('div');
    document.body.append(eventTarget, mountRoot, portalRoot);

    let runtime: ScreenEditorRuntime | undefined;
    let ready: Promise<void> | undefined;
    act(() => {
      runtime = mountNebulaScreenEditorRuntime({
        eventTarget,
        identifierPrefix: 'static-runtime-dispose',
        isActive: () => true,
        mountRoot,
        onThemeChange: () => undefined,
        options: { persistPreferences: false },
        portalRoot,
        projectId: 'screen-a',
        readonly: false,
        theme: 'light',
      });
      ready = runtime.whenReady();
      runtime.dispose();
    });

    await expect(ready).rejects.toMatchObject({ code: 'ABORTED' });
    eventTarget.remove();
    mountRoot.remove();
    portalRoot.remove();
  });

  it('mounts a registry-aware V2 document and preserves it through save and reload', async () => {
    const eventTarget = document.createElement('div');
    const mountRoot = document.createElement('div');
    const portalRoot = document.createElement('div');
    eventTarget.append(mountRoot, portalRoot);
    document.body.append(eventTarget);
    const { registry, tagName } = await createV2Registry();
    const loadProject = vi.fn<ScreenHostAdapterV2['loadProject']>(({ projectId }) =>
      Promise.resolve(createV2Envelope(projectId)),
    );
    const saveProject = vi.fn<ScreenHostAdapterV2['saveProject']>(({ projectId, draft }) =>
      Promise.resolve({
        ...createV2Envelope(projectId),
        revision: 'revision-v2-saved',
        ...draft,
      }),
    );
    const adapter: ScreenHostAdapterV2 = {
      documentVersion: 2,
      loadProject,
      saveProject,
    };
    const readyEvents = vi.fn<(event: Event) => void>();
    eventTarget.addEventListener('nebula-ready', readyEvents);

    const runtime = mountNebulaScreenEditorRuntime({
      adapterV2: adapter,
      componentRegistry: registry,
      documentMode: 'v2',
      eventTarget,
      identifierPrefix: 'static-runtime-v2',
      isActive: () => true,
      mountRoot,
      onThemeChange: () => undefined,
      options: { persistPreferences: false },
      portalRoot,
      projectId: 'screen-v2',
      readonly: false,
      theme: 'light',
    });

    await vi.waitFor(() => expect(runtime.getDocument()?.schemaVersion).toBe(2));
    await expect(runtime.whenReady()).resolves.toBeUndefined();
    await vi.waitFor(() => expect(mountRoot.querySelector(tagName)).not.toBeNull());
    expect(readyEvents).toHaveBeenCalledOnce();

    const saved = await runtime.save();
    expect(saved.document.schemaVersion).toBe(2);
    expect(saveProject).toHaveBeenCalledOnce();
    expect(saveProject.mock.calls[0]?.[0].draft.document.schemaVersion).toBe(2);
    expect(saveProject.mock.calls[0]?.[0].draft.document.components[0]?.type).toBe(
      'test.runtime-card/v1',
    );

    await runtime.reload({ discardChanges: true });
    await vi.waitFor(() => expect(loadProject).toHaveBeenCalledTimes(2));
    expect(runtime.getDraft()?.document.schemaVersion).toBe(2);

    await act(async () => {
      runtime.dispose();
      await Promise.resolve();
    });
    eventTarget.remove();
  });
});
