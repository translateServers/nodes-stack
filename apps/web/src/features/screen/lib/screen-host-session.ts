import {
  parseScreenDocument,
  SCREEN_DOCUMENT_VERSION,
  type ScreenHostSessionPort,
  type ScreenProjectDraft,
} from '@nebula/screen-sdk';
import type { ApplyProjectEnvelopeInput, ScreenEditorStore } from '../stores/editor-store';

function getDraft(store: ScreenEditorStore): ScreenProjectDraft | null {
  const project = store.getState().project;
  if (project === null) return null;
  const document = parseScreenDocument({
    schemaVersion: SCREEN_DOCUMENT_VERSION,
    canvas: project.canvas,
    components: project.components,
    blueprint: project.blueprint,
    globalVariables: project.globalVariables,
  });
  if (!document.success) return null;
  return {
    name: project.name,
    description: project.description,
    document: document.data,
  };
}

export function createScreenHostSessionPort(store: ScreenEditorStore): ScreenHostSessionPort {
  return {
    applyEnvelope: (command) => {
      const input: ApplyProjectEnvelopeInput =
        command.source === 'save' || command.source === 'publish'
          ? {
              source: command.source,
              envelope: command.envelope,
              submittedDraft: command.submittedDraft,
            }
          : {
              source: command.source === 'snapshot-restore' ? 'restore' : command.source,
              envelope: command.envelope,
            };
      store.getState().applyProjectEnvelope(input);
    },
    clear: () => store.getState().clearProject(),
    getSnapshot: () => {
      const project = store.getState().project;
      const draft = getDraft(store);
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
