/**
 * viewer runtime 装配：React root + ScreenDynamicViewerWorkbench。
 */

import { createRoot } from 'react-dom/client';
import { ScreenDynamicViewerWorkbench } from '../components/viewer-workbench.js';
import type {
  ScreenDynamicMountOptions,
  ScreenDynamicRuntime,
  ScreenDynamicViewerConfiguration,
} from '../element/contracts.js';

function createEmptyRegistry() {
  return {
    get: () => undefined,
    has: () => false,
    list: () => [],
    size: 0,
  };
}

export function mountViewerRuntime(options: ScreenDynamicMountOptions): ScreenDynamicRuntime {
  const root = createRoot(options.mountRoot, { identifierPrefix: options.identifierPrefix });
  let disposed = false;
  let configuration: ScreenDynamicViewerConfiguration = {
    document: options.document,
    dataAdapter: options.dataAdapter,
    componentRegistry: options.componentRegistry,
    options: options.options,
    theme: options.theme,
  };

  const renderViewer = (): void => {
    if (disposed) return;
    root.render(
      <ScreenDynamicViewerWorkbench
        dataAdapter={configuration.dataAdapter}
        document={configuration.document}
        eventTarget={options.eventTarget}
        projectId={configuration.options.projectId ?? options.identifierPrefix}
        refreshIntervalSeconds={configuration.options.refreshIntervalSeconds ?? 0}
        registry={configuration.componentRegistry ?? createEmptyRegistry()}
        source="published"
      />,
    );
  };

  renderViewer();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      root.unmount();
    },
    getDocument: () => structuredClone(configuration.document),
    reload: () => {
      renderViewer();
    },
    resize: () => undefined,
    save: () => structuredClone(configuration.document),
    publish: () => structuredClone(configuration.document),
    undo: () => undefined,
    redo: () => undefined,
    update: (nextConfiguration) => {
      if (disposed) return;
      configuration = nextConfiguration;
      renderViewer();
    },
    validate: () => [],
    whenReady: () => Promise.resolve(),
  };
}
