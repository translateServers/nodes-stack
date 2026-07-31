import { parseScreenDocument } from '@nebula/screen-sdk/contracts';
import type { ScreenProject } from '@nebula/shared';
import type { ScreenEditorCapabilityProfile } from '../components/screen-editor-environment';

export interface ScreenEditorWorkbenchEnvelope {
  description?: string | null;
  document: Pick<ScreenProject, 'blueprint' | 'canvas' | 'components' | 'globalVariables'> & {
    schemaVersion?: number;
  };
  id: string;
  name: string;
  revision: string;
  status: ScreenProject['status'];
}

export type ScreenEditorWorkbenchProjectResult =
  | { success: true; project: ScreenProject }
  | { success: false };

export function createScreenEditorWorkbenchProject(
  envelope: ScreenEditorWorkbenchEnvelope,
  capabilityProfile: ScreenEditorCapabilityProfile,
): ScreenEditorWorkbenchProjectResult {
  let document: Pick<ScreenProject, 'blueprint' | 'canvas' | 'components' | 'globalVariables'> =
    envelope.document;

  if (capabilityProfile === 'static') {
    const parsed = parseScreenDocument({
      ...envelope.document,
      schemaVersion: envelope.document.schemaVersion ?? 1,
    });
    if (!parsed.success) return { success: false };
    document = parsed.data;
  }

  return {
    success: true,
    project: {
      id: envelope.id,
      name: envelope.name,
      description: envelope.description ?? null,
      status: envelope.status,
      ...document,
      createdAt: '',
      updatedAt: envelope.revision,
      thumbnail: null,
    },
  };
}
