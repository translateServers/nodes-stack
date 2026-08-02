import type { ScreenProject } from '@nebula/shared';
import { parseScreenDocumentV2, type ScreenProjectDraftV2 } from '../contracts/document.js';
import type {
  ScreenHostSessionPortV2,
  ScreenSessionApplyCommandV2,
} from '../host/screen-host-controller-v2.js';
import type { ScreenComponentInstanceRegistry } from '../registry/instance-registry.js';
import type { ScreenEditorStore } from '../stores/editor-store.js';

function toProject(
  envelope: ScreenSessionApplyCommandV2['envelope'],
  currentProject: ScreenProject | null,
): ScreenProject {
  const currentMetadata = currentProject?.id === envelope.id ? currentProject : null;
  return {
    id: envelope.id,
    name: envelope.name,
    description: envelope.description ?? null,
    status: envelope.status,
    canvas: envelope.document.canvas,
    components: envelope.document.components,
    ...(envelope.document.blueprint === undefined
      ? {}
      : { blueprint: envelope.document.blueprint }),
    globalVariables: envelope.document.globalVariables,
    createdAt: currentMetadata?.createdAt ?? '',
    updatedAt: envelope.revision,
    thumbnail: currentMetadata?.thumbnail ?? null,
  };
}

function getDraft(
  store: ScreenEditorStore,
  registry: ScreenComponentInstanceRegistry,
): ScreenProjectDraftV2 | null {
  const project = store.getState().project;
  if (project === null) return null;
  const document = parseScreenDocumentV2(
    {
      schemaVersion: 2,
      canvas: project.canvas,
      components: project.components,
      ...(project.blueprint === undefined ? {} : { blueprint: project.blueprint }),
      globalVariables: project.globalVariables ?? [],
    },
    registry,
  );
  if (!document.success) return null;
  return {
    name: project.name,
    description: project.description ?? null,
    document: document.data,
  };
}

/**
 * Projects the existing generic editor store into V2 drafts.
 *
 * `ScreenProject` intentionally permits arbitrary component type strings, so the
 * store can host a registry-validated V2 document without widening shared models.
 */
export function createScreenHostSessionPortV2(
  store: ScreenEditorStore,
  registry: ScreenComponentInstanceRegistry,
): ScreenHostSessionPortV2 {
  return {
    applyEnvelope: (command) => {
      store.getState().loadProject(toProject(command.envelope, store.getState().project));
    },
    clear: () => store.getState().clearProject(),
    getSnapshot: () => {
      const project = store.getState().project;
      const draft = getDraft(store, registry);
      if (project === null || draft === null) return null;
      return {
        projectId: project.id,
        revision: project.updatedAt,
        draft: structuredClone(draft),
        dirty: store.getState().isDirty,
      };
    },
  };
}
