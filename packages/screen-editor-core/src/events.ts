import type {
  ScreenOperation,
  ScreenPublicError,
  ScreenSnapshotSummary,
} from './contracts/adapter.js';
import type { ScreenProjectDraft, ScreenProjectEnvelope } from './contracts/document.js';

export interface ScreenPreviewRequestDetail {
  draft: ScreenProjectDraft;
  projectId: string;
  revision: string;
}

export interface ScreenNavigateRequestDetail {
  projectId: string;
  target: '_blank' | '_self';
  url: string;
}

export interface ScreenEditorRequestEventDetailMap {
  'nebula-navigate-request': ScreenNavigateRequestDetail;
  'nebula-preview-request': ScreenPreviewRequestDetail;
}

export type ScreenChangeReason =
  | 'project-metadata'
  | 'canvas'
  | 'component'
  | 'blueprint'
  | 'global-variable'
  | 'history';

export type ScreenOperationSuccessDetail =
  | { projectId: string; operation: 'import'; envelope: ScreenProjectEnvelope }
  | { projectId: string; operation: 'export'; fileName: string }
  | {
      projectId: string;
      operation: 'snapshot-create';
      snapshot: ScreenSnapshotSummary;
    }
  | {
      projectId: string;
      operation: 'snapshot-restore';
      envelope: ScreenProjectEnvelope;
    }
  | { projectId: string; operation: 'snapshot-remove'; snapshotId: string }
  | { projectId: string; operation: 'snapshot-clear' };

export interface ScreenEditorEventDetailMap extends ScreenEditorRequestEventDetailMap {
  'nebula-ready': { projectId: string; envelope: ScreenProjectEnvelope };
  'nebula-change': {
    projectId: string;
    draft: ScreenProjectDraft;
    reason: ScreenChangeReason;
  };
  'nebula-dirty-change': { projectId: string; dirty: boolean };
  'nebula-selection-change': { projectId: string; componentIds: string[] };
  'nebula-save-success': { projectId: string; envelope: ScreenProjectEnvelope };
  'nebula-publish-success': { projectId: string; envelope: ScreenProjectEnvelope };
  'nebula-operation-success': ScreenOperationSuccessDetail;
  'nebula-error': {
    projectId?: string;
    operation: ScreenOperation;
    error: ScreenPublicError;
  };
}

export type NebulaScreenEditorEventMap = {
  [EventName in keyof ScreenEditorEventDetailMap]: CustomEvent<
    ScreenEditorEventDetailMap[EventName]
  >;
};

export function dispatchScreenEditorEvent<EventName extends keyof ScreenEditorEventDetailMap>(
  target: EventTarget,
  eventName: EventName,
  detail: ScreenEditorEventDetailMap[EventName],
): boolean {
  return target.dispatchEvent(
    new CustomEvent(eventName, {
      bubbles: true,
      composed: true,
      detail: structuredClone(detail),
    }),
  );
}

export function dispatchScreenEditorRequestEvent<
  EventName extends keyof ScreenEditorRequestEventDetailMap,
>(
  target: EventTarget,
  eventName: EventName,
  detail: ScreenEditorRequestEventDetailMap[EventName],
): boolean {
  return target.dispatchEvent(
    new CustomEvent(eventName, {
      bubbles: true,
      composed: true,
      detail: structuredClone(detail),
    }),
  );
}
