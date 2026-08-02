import type {
  NebulaScreenEditorEventMap,
  ScreenHostAdapter,
  ScreenProjectDraft,
  ScreenProjectEnvelope,
  ScreenSdkDiagnostic,
  ScreenSdkDocument,
  ScreenSnapshotSummary,
} from '@nebula/screen-editor-core';
import type { ScreenComponentManifest } from '@nebula/screen-component-sdk';

export type ScreenEditorAdapter = ScreenHostAdapter;
export type ScreenSdkProjectDraft = ScreenProjectDraft;
export type ScreenSdkProjectEnvelope = ScreenProjectEnvelope;
export type ScreenSdkEventMap = NebulaScreenEditorEventMap;

export interface ScreenComponentRegistrationBase {
  readonly manifest: Readonly<ScreenComponentManifest>;
}

export type ScreenComponentRegistration =
  | (ScreenComponentRegistrationBase & {
      readonly source: 'built-in';
      readonly elementConstructor?: CustomElementConstructor;
    })
  | (ScreenComponentRegistrationBase & {
      readonly source: 'host';
      readonly elementConstructor: CustomElementConstructor;
    });

export interface ScreenComponentRegistry {
  readonly size: number;
  get(type: string): ScreenComponentRegistration | undefined;
  has(type: string): boolean;
  list(): readonly ScreenComponentRegistration[];
}

export type { ScreenSdkDiagnostic, ScreenSdkDocument, ScreenSnapshotSummary };
