import { act } from 'react';
import type { ScreenHostAdapter, ScreenProjectEnvelopeInput } from '@nebula/screen-editor-core';

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
});
