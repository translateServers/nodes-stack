import { act } from 'react';

vi.unmock('../src/runtime/static-runtime.tsx');

import { mountNebulaScreenEditorRuntime } from '../src/runtime/static-runtime.js';
import type { ScreenEditorRuntime } from '../src/element/runtime.js';

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
});
