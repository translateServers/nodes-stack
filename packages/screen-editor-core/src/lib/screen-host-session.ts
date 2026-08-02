import type { ScreenProject } from '@nebula/shared';

import { parseScreenDocument, type ScreenProjectDraft } from '../contracts/document.js';
import type {
  ScreenHostSessionPort,
  ScreenSessionApplyCommand,
} from '../host/screen-host-controller.js';
import type { ScreenComponentInstanceRegistry } from '../registry/instance-registry.js';
import type { ScreenEditorStore } from '../stores/editor-store.js';

function toProject(
  envelope: ScreenSessionApplyCommand['envelope'],
  currentProject: ScreenProject | null,
): ScreenProject {
  const metadata = currentProject?.id === envelope.id ? currentProject : null;
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
    createdAt: metadata?.createdAt ?? '',
    updatedAt: envelope.revision,
    thumbnail: metadata?.thumbnail ?? null,
  };
}

function getDraft(
  store: ScreenEditorStore,
  registry: ScreenComponentInstanceRegistry,
): ScreenProjectDraft | null {
  const project = store.getState().project;
  if (project === null) {
    return null;
  }
  const document = parseScreenDocument(
    {
      schemaVersion: 2,
      canvas: project.canvas,
      components: project.components,
      ...(project.blueprint === undefined ? {} : { blueprint: project.blueprint }),
      globalVariables: project.globalVariables ?? [],
    },
    registry,
  );
  if (!document.success) {
    return null;
  }
  return {
    name: project.name,
    description: project.description ?? null,
    document: document.data,
  };
}

export function createScreenHostSessionPort(
  store: ScreenEditorStore,
  registry: ScreenComponentInstanceRegistry,
): ScreenHostSessionPort {
  return {
    applyEnvelope: (command) => {
      store.getState().loadProject(toProject(command.envelope, store.getState().project));
    },
    clear: () => store.getState().clearProject(),
    getSnapshot: () => {
      const project = store.getState().project;
      const draft = getDraft(store, registry);
      if (project === null || draft === null) {
        return null;
      }
      return {
        projectId: project.id,
        revision: project.updatedAt,
        draft: structuredClone(draft),
        dirty: store.getState().isDirty,
      };
    },
  };
}
