import type { MountScreenEditorRuntime } from './runtime.js';

interface RuntimeModule {
  mountNebulaScreenEditorRuntime: MountScreenEditorRuntime;
}

type RuntimeImporter = () => Promise<RuntimeModule>;

/**
 * Lazy loader for the screen editor runtime mount function.
 *
 * Uses a dynamic import to keep the editor implementation in a separate SDK
 * chunk. The runtime is owned by this package and assembles the static profile
 * from `@nebula/screen-editor-core` without importing application source.
 *
 * `mountNebulaScreenEditorRuntime` is only needed when a
 * `<nebula-screen-editor>` element is connected to the DOM, so deferring
 * the import to first mount is safe.
 */

export function createRuntimeMountLoader(
  importRuntime: RuntimeImporter = () => import('../runtime/static-runtime.js'),
): () => Promise<MountScreenEditorRuntime> {
  let cached: MountScreenEditorRuntime | null = null;
  let loadPromise: Promise<MountScreenEditorRuntime> | null = null;

  return () => {
    if (cached !== null) return Promise.resolve(cached);
    if (loadPromise === null) {
      loadPromise = importRuntime()
        .then((module) => {
          cached = module.mountNebulaScreenEditorRuntime;
          return cached;
        })
        .catch((error: unknown) => {
          loadPromise = null;
          throw error;
        });
    }
    return loadPromise;
  };
}

export const loadRuntimeMount = createRuntimeMountLoader();
