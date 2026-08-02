import { createRoot } from 'react-dom/client';
import {
  parseScreenDocument,
  DEFAULT_BUILTIN_REGISTRY,
  ScreenHostController,
  validateScreenSdkCapabilities,
  type ScreenProjectEnvelope,
} from '@nebula/screen-editor-core';
import type {
  MountScreenEditorRuntime,
  ScreenEditorRuntimeConfiguration,
} from '../src/element/runtime.js';

export const mountNebulaScreenEditorRuntime: MountScreenEditorRuntime = (options) => {
  let configuration: ScreenEditorRuntimeConfiguration = options;
  let envelope: ScreenProjectEnvelope | null = null;
  let disposed = false;
  const root = createRoot(options.mountRoot, { identifierPrefix: options.identifierPrefix });
  const controller = new ScreenHostController({
    eventTarget: options.eventTarget,
    registry: options.componentRegistry ?? DEFAULT_BUILTIN_REGISTRY,
    session: {
      applyEnvelope: (command) => {
        envelope = structuredClone(command.envelope);
      },
      clear: () => {
        envelope = null;
      },
      getSnapshot: () =>
        envelope === null
          ? null
          : {
              dirty: false,
              draft: {
                name: envelope.name,
                description: envelope.description,
                document: structuredClone(envelope.document),
              },
              projectId: envelope.id,
              revision: envelope.revision,
            },
    },
  });
  const unsubscribe = controller.subscribe(() => {
    if (controller.getState().phase === 'awaiting-render') {
      queueMicrotask(() => controller.markRendered());
    }
  });

  const update = (nextConfiguration: ScreenEditorRuntimeConfiguration): void => {
    configuration = nextConfiguration;
    controller.setReadonly(configuration.readonly);
    controller.setBinding(configuration.projectId, configuration.adapter);
    const registry = configuration.componentRegistry;
    root.render(
      <div
        data-testid="screen-editor-runtime"
        data-project-id={configuration.projectId}
        data-readonly={configuration.readonly ? '' : undefined}
        data-theme={configuration.theme}
        data-component-registry-size={registry === undefined ? 'none' : String(registry.size)}
      />,
    );
  };

  update(configuration);

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      controller.dispose();
      root.unmount();
    },
    fitToScreen: () => {
      options.mountRoot.dataset['fitToScreen'] = '';
    },
    focusComponent: (componentId) =>
      envelope?.document.components.some((component) => component.id === componentId) ?? false,
    getDocument: () => (envelope === null ? null : structuredClone(envelope.document)),
    getDraft: () =>
      envelope === null
        ? null
        : structuredClone({
            name: envelope.name,
            description: envelope.description,
            document: envelope.document,
          }),
    publish: () => controller.publish(),
    redo: () => undefined,
    reload: (reloadOptions) => controller.reload(reloadOptions),
    resize: (width, height) => {
      options.mountRoot.dataset['size'] = `${width}x${height}`;
    },
    save: () => controller.save(),
    undo: () => undefined,
    update,
    validate: () => {
      if (envelope === null) return [];
      const parsed = parseScreenDocument(
        envelope.document,
        configuration.componentRegistry ?? DEFAULT_BUILTIN_REGISTRY,
      );
      return parsed.success ? validateScreenSdkCapabilities(parsed.data) : parsed.diagnostics;
    },
    whenReady: () => controller.whenReady(),
  };
};
