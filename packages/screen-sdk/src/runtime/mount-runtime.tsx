import {
  ScreenAdapterErrorCode,
  DEFAULT_BUILTIN_REGISTRY,
  ScreenHostAdapterWorkbench,
  createScreenEditorStore,
  ScreenEditorStoreProvider,
  type ScreenAdapterError,
  type ScreenHostAdapterWorkbenchHandle,
} from '@nebula/screen-editor-core';
import type { createRoot as createReactRoot } from 'react-dom/client';

import type {
  MountScreenEditorRuntime,
  ScreenEditorRuntimeConfiguration,
} from '../element/runtime.js';

type CreateReactRoot = typeof createReactRoot;

class RuntimeCommandError extends Error implements ScreenAdapterError {
  readonly code: ScreenAdapterError['code'];

  constructor(code: ScreenAdapterError['code']) {
    super(code);
    this.name = 'ScreenAdapterError';
    this.code = code;
  }
}

const disposedHandle = Symbol('disposed-handle');

export function createMountScreenEditorRuntime(
  createRoot: CreateReactRoot,
): MountScreenEditorRuntime {
  return (options) => {
    let configuration: ScreenEditorRuntimeConfiguration = options;
    let disposed = false;
    let handle: ScreenHostAdapterWorkbenchHandle | null = null;
    let resolveInitialHandle:
      | ((value: ScreenHostAdapterWorkbenchHandle | typeof disposedHandle) => void)
      | undefined;
    const initialHandle = new Promise<ScreenHostAdapterWorkbenchHandle | typeof disposedHandle>(
      (resolve) => {
        resolveInitialHandle = resolve;
      },
    );
    const readonlyRef = { current: options.readonly };
    const store = createScreenEditorStore({
      instanceId: options.identifierPrefix,
      isReadonly: () => readonlyRef.current,
      persistPreferences: options.options.persistPreferences,
      preferenceNamespace: options.options.preferenceNamespace,
    });
    const root = createRoot(options.mountRoot, { identifierPrefix: options.identifierPrefix });

    const setHandle = (nextHandle: ScreenHostAdapterWorkbenchHandle | null): void => {
      if (nextHandle === null) return;
      if (disposed) {
        nextHandle.dispose();
        return;
      }
      handle = nextHandle;
      resolveInitialHandle?.(nextHandle);
      resolveInitialHandle = undefined;
    };

    const render = (): void => {
      if (disposed) return;
      const adapterProps =
        configuration.adapter === undefined ? {} : { adapter: configuration.adapter };
      root.render(
        <ScreenEditorStoreProvider
          store={store}
          debug={configuration.options.debug}
          instanceId={options.identifierPrefix}
          preferenceNamespace={configuration.options.preferenceNamespace}
        >
          <ScreenHostAdapterWorkbench
            ref={setHandle}
            {...adapterProps}
            componentRegistry={configuration.componentRegistry ?? DEFAULT_BUILTIN_REGISTRY}
            isActive={options.isActive}
            portalRoot={options.portalRoot}
            projectId={configuration.projectId}
            readonly={configuration.readonly}
            setTheme={options.onThemeChange}
            theme={configuration.theme}
          />
        </ScreenEditorStoreProvider>,
      );
    };

    const requireHandle = (): ScreenHostAdapterWorkbenchHandle => {
      if (disposed || handle === null) {
        throw new RuntimeCommandError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      return handle;
    };
    const awaitHandle = async (): Promise<ScreenHostAdapterWorkbenchHandle> => {
      if (disposed) throw new RuntimeCommandError(ScreenAdapterErrorCode.ABORTED);
      const resolved = handle ?? (await initialHandle);
      if (resolved === disposedHandle)
        throw new RuntimeCommandError(ScreenAdapterErrorCode.ABORTED);
      return resolved;
    };

    render();
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        resolveInitialHandle?.(disposedHandle);
        resolveInitialHandle = undefined;
        handle?.dispose();
        handle = null;
        root.unmount();
      },
      fitToScreen: () => requireHandle().fitToScreen(),
      focusComponent: (componentId) => requireHandle().focusComponent(componentId),
      getDocument: () => handle?.getDocument() ?? null,
      getDraft: () => handle?.getDraft() ?? null,
      publish: async () => (await awaitHandle()).controller.publish(),
      redo: () => requireHandle().redo(),
      reload: async (reloadOptions) => (await awaitHandle()).controller.reload(reloadOptions),
      resize: () => undefined,
      save: async () => (await awaitHandle()).controller.save(),
      undo: () => requireHandle().undo(),
      update: (nextConfiguration) => {
        if (disposed) return;
        configuration = nextConfiguration;
        readonlyRef.current = nextConfiguration.readonly;
        handle?.controller.setReadonly(nextConfiguration.readonly);
        render();
      },
      validate: () => handle?.validate() ?? [],
      whenReady: async () => (await awaitHandle()).controller.whenReady(),
    };
  };
}
