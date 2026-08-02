import { describe, expect, it, vi } from 'vitest';
import type { MountScreenEditorRuntime } from './runtime.js';
import { createRuntimeMountLoader } from './runtime-loader.js';

describe('runtime mount loader', () => {
  it('clears a rejected import so the next request can retry', async () => {
    const mount = vi.fn<MountScreenEditorRuntime>();
    const importRuntime = vi
      .fn<() => Promise<{ mountNebulaScreenEditorRuntime: MountScreenEditorRuntime }>>()
      .mockRejectedValueOnce(new Error('runtime chunk failed'))
      .mockResolvedValue({ mountNebulaScreenEditorRuntime: mount });
    const loadRuntimeMount = createRuntimeMountLoader(importRuntime);

    await expect(loadRuntimeMount()).rejects.toThrow('runtime chunk failed');
    await expect(loadRuntimeMount()).resolves.toBe(mount);
    expect(importRuntime).toHaveBeenCalledTimes(2);
  });
});
