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

export const mountNebulaScreenEditorRuntime: MountScreenEditorRuntime = (options) => {
  let configuration: ScreenEditorRuntimeConfiguration = options;
  let disposed = false;
  let handle: ScreenHostAdapterWorkbenchHandle | null = null;
  let resolveInitialHandle: ((value: ScreenHostAdapterWorkbenchHandle) => void) | undefined;
  const initialHandle = new Promise<ScreenHostAdapterWorkbenchHandle>((resolve) => {
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

  const setHandle = (nextHandle: ScreenHostAdapterWorkbenchHandle | null): void => {
    if (nextHandle === null) return;
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
    return handle ?? initialHandle;
  };

  render();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
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
      render();
    },
    validate: () => handle?.validate() ?? [],
    whenReady: async () => (await awaitHandle()).controller.whenReady(),
  };
};
