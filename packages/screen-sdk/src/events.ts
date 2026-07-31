import type { ScreenProjectDraft } from './contracts/document.js';

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
      detail,
    }),
  );
}
