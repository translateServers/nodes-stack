/**
 * designer runtime 装配：React root + ScreenDynamicDesigner。
 *
 * runtime 持有文档状态快照：
 * - save/publish 返回当前文档（宿主决定持久化与发布语义）
 * - validate 使用 V3 parser 的 registry-aware 校验
 */

import { createRoot } from 'react-dom/client';
import type {
  DynamicScreenDocumentV3,
  ScreenSdkDiagnostic,
} from '@nebula/screen-editor-core/dynamic';
import { parseDynamicScreenDocumentV3 } from '@nebula/screen-editor-core/dynamic';
import { ScreenDynamicDesigner } from '../components/designer-workbench.js';
import { dispatchScreenDynamicEvent } from '../element/events.js';
import type {
  ScreenDynamicDesignerConfiguration,
  ScreenDynamicMountOptions,
  ScreenDynamicRuntime,
} from '../element/contracts.js';

function createRevision(document: DynamicScreenDocumentV3): string {
  let hash = 5381;
  const json = JSON.stringify(document);
  for (let index = 0; index < json.length; index += 1) {
    hash = (hash * 33) ^ json.charCodeAt(index);
  }
  return `rev-${(hash >>> 0).toString(36)}`;
}

function createEmptyRegistry() {
  return {
    get: () => undefined,
    has: () => false,
    list: () => [],
    size: 0,
  };
}

export function mountDesignerRuntime(options: ScreenDynamicMountOptions): ScreenDynamicRuntime {
  const root = createRoot(options.mountRoot, { identifierPrefix: options.identifierPrefix });
  let disposed = false;
  let configuration: ScreenDynamicDesignerConfiguration = {
    document: options.document,
    dataAdapter: options.dataAdapter,
    componentRegistry: options.componentRegistry,
    options: options.options,
    readonly: options.readonly,
    theme: options.theme,
  };
  let documentRef: DynamicScreenDocumentV3 = structuredClone(configuration.document);
  const readyCallbacks: Array<() => void> = [];
  let readyResolved = false;

  const render = (): void => {
    if (disposed) return;
    root.render(
      <ScreenDynamicDesigner
        document={documentRef}
        onChange={(next) => {
          documentRef = next;
          dispatchScreenDynamicEvent(options.eventTarget, 'nebula-dirty-change', { dirty: true });
        }}
        onReady={() => {
          if (readyResolved) return;
          readyResolved = true;
          const callbacks = readyCallbacks.splice(0);
          for (const callback of callbacks) callback();
          dispatchScreenDynamicEvent(options.eventTarget, 'nebula-ready', {
            projectId: configuration.options.projectId,
          });
        }}
        readonly={configuration.readonly}
        registry={configuration.componentRegistry ?? createEmptyRegistry()}
      />,
    );
  };

  render();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      root.unmount();
    },
    getDocument: () => structuredClone(documentRef),
    reload: () => {
      documentRef = structuredClone(configuration.document);
      render();
    },
    resize: () => undefined,
    save: () => {
      const snapshot = structuredClone(documentRef);
      dispatchScreenDynamicEvent(options.eventTarget, 'nebula-save-success', {
        revision: createRevision(snapshot),
      });
      return snapshot;
    },
    publish: () => {
      const snapshot = structuredClone(documentRef);
      dispatchScreenDynamicEvent(options.eventTarget, 'nebula-publish-success', {
        revision: createRevision(snapshot),
      });
      return snapshot;
    },
    undo: () => undefined,
    redo: () => undefined,
    update: (nextConfiguration) => {
      if (disposed) return;
      configuration = nextConfiguration;
      documentRef = structuredClone(nextConfiguration.document);
      render();
    },
    validate: (): ScreenSdkDiagnostic[] => {
      const result = parseDynamicScreenDocumentV3(
        documentRef,
        configuration.componentRegistry ?? createEmptyRegistry(),
      );
      return result.success ? [] : result.diagnostics;
    },
    whenReady: () =>
      new Promise<void>((resolve) => {
        if (readyResolved) {
          resolve();
          return;
        }
        readyCallbacks.push(resolve);
      }),
  };
}
