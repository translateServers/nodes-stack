import {
  ScreenAdapterErrorCode,
  type ScreenAdapterError,
  ScreenHostAdapterWorkbench,
  ScreenHostAdapterWorkbenchV2,
  createScreenEditorStore,
  ScreenEditorStoreProvider,
  type ScreenHostAdapterWorkbenchHandle,
  type ScreenHostAdapterWorkbenchV2Handle,
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
type RuntimeWorkbenchHandle = ScreenHostAdapterWorkbenchHandle | ScreenHostAdapterWorkbenchV2Handle;

export const mountNebulaScreenEditorRuntime: MountScreenEditorRuntime = (options) => {
  let configuration: ScreenEditorRuntimeConfiguration = options;
  let disposed = false;
  let handle: RuntimeWorkbenchHandle | null = null;
  let resolveInitialHandle:
    | ((value: RuntimeWorkbenchHandle | typeof DISPOSED_HANDLE) => void)
    | undefined;
  const initialHandle = new Promise<RuntimeWorkbenchHandle | typeof DISPOSED_HANDLE>((resolve) => {
    resolveInitialHandle = resolve;
  });
  const readonlyRef = { current: options.readonly };
  const store = createScreenEditorStore({
    instanceId: options.identifierPrefix,
    isReadonly: () => readonlyRef.current,
    persistPreferences: options.options.persistPreferences,
    preferenceNamespace: options.options.preferenceNamespace,
  });
  const root = createRoot(options.mountRoot, { identifierPrefix: options.identifierPrefix });

  const setHandle = (nextHandle: RuntimeWorkbenchHandle | null): void => {
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
    if (
      configuration.documentMode === 'v2' &&
      configuration.adapterV2 !== undefined &&
      configuration.componentRegistry !== undefined
    ) {
      root.render(
        <ScreenEditorStoreProvider
          store={store}
          debug={configuration.options.debug}
          instanceId={options.identifierPrefix}
          preferenceNamespace={configuration.options.preferenceNamespace}
        >
          <ScreenHostAdapterWorkbenchV2
            ref={setHandle}
            adapter={configuration.adapterV2}
            componentRegistry={configuration.componentRegistry}
            isActive={options.isActive}
            portalRoot={options.portalRoot}
            projectId={configuration.projectId}
            readonly={configuration.readonly}
            setTheme={options.onThemeChange}
            theme={configuration.theme}
          />
        </ScreenEditorStoreProvider>,
      );
      return;
    }
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
          componentRegistry={configuration.componentRegistry}
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

  const requireHandle = (): RuntimeWorkbenchHandle => {
    if (disposed || handle === null) {
      throw new RuntimeCommandError(ScreenAdapterErrorCode.UNAVAILABLE);
    }
    return handle;
  };

  const awaitHandle = async (): Promise<RuntimeWorkbenchHandle> => {
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
      render();
    },
    validate: () => handle?.validate() ?? [],
    whenReady: async () => (await awaitHandle()).controller.whenReady(),
  };
};
