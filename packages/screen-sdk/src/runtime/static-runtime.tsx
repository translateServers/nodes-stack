import {
  ScreenAdapterErrorCode,
  type ScreenAdapterError,
  ScreenHostAdapterWorkbench,
  createScreenEditorStore,
  ScreenEditorStoreProvider,
  type ScreenHostAdapterWorkbenchHandle,
} from '@nebula/screen-editor-core';
import { createRoot } from 'react-dom/client';
import {
  type MountScreenEditorRuntime,
  type ScreenEditorRuntimeConfiguration,
} from '../element/runtime.js';

class RuntimeCommandError extends Error implements ScreenAdapterError {
  readonly code;

  constructor(code: ScreenAdapterError['code']) {
    super(code);
    this.name = 'ScreenAdapterError';
    this.code = code;
  }
}

const DISPOSED_HANDLE = Symbol('disposed-handle');

export const mountNebulaScreenEditorRuntime: MountScreenEditorRuntime = (options) => {
  let configuration: ScreenEditorRuntimeConfiguration = options;
  let disposed = false;
  let handle: ScreenHostAdapterWorkbenchHandle | null = null;
  let resolveInitialHandle:
    | ((value: ScreenHostAdapterWorkbenchHandle | typeof DISPOSED_HANDLE) => void)
    | undefined;
  const initialHandle = new Promise<ScreenHostAdapterWorkbenchHandle | typeof DISPOSED_HANDLE>(
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
    const resolvedHandle = handle ?? (await initialHandle);
    if (resolvedHandle === DISPOSED_HANDLE) {
      throw new RuntimeCommandError(ScreenAdapterErrorCode.ABORTED);
    }
    return resolvedHandle;
  };

  render();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      resolveInitialHandle?.(DISPOSED_HANDLE);
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
      handle?.controller.setBinding(nextConfiguration.projectId, nextConfiguration.adapter);
      render();
    },
    validate: () => handle?.validate() ?? [],
    whenReady: async () => (await awaitHandle()).controller.whenReady(),
  };
};
