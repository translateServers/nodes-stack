import type {
  ScreenExportFile,
  ScreenHostCapabilities,
  ScreenPublicError,
  ScreenPublicErrorV2,
  ScreenSnapshotSummary,
} from '../contracts/adapter.js';
import type {
  ScreenProjectDraft,
  ScreenProjectDraftV2,
  ScreenProjectEnvelope,
  ScreenProjectEnvelopeV2,
} from '../contracts/document.js';
import type { ScreenChangeReason } from '../events.js';

/** Shared Workbench-facing state for V1 and V2 host controllers. */
export interface ScreenHostControllerPortState {
  readonly capabilities?: ScreenHostCapabilities;
  readonly error?: ScreenPublicError | ScreenPublicErrorV2;
  readonly generation: number;
  readonly loadMode?: 'initial' | 'reload' | 'retry';
  readonly pendingMutations: readonly (
    | 'save'
    | 'publish'
    | 'import'
    | 'snapshot-create'
    | 'snapshot-restore'
    | 'snapshot-remove'
    | 'snapshot-clear'
  )[];
  readonly phase:
    | 'waiting'
    | 'loading'
    | 'awaiting-render'
    | 'ready'
    | 'error'
    | 'unsupported'
    | 'disposed';
  readonly projectId?: string;
  readonly retainedProject: boolean;
}

/**
 * Narrow controller contract consumed by shared Workbench UI.
 *
 * V1 keeps its existing concrete controller; V2 implements the same UI surface
 * without forcing the mature V1 workflow into a generic abstraction.
 */
export interface ScreenHostControllerPort {
  cancelSnapshotList(): void;
  cancelSnapshotMutations(): void;
  clearSnapshots(): Promise<void>;
  createSnapshot(): Promise<ScreenSnapshotSummary>;
  dispose(): void;
  exportProject(): Promise<ScreenExportFile>;
  getState(): ScreenHostControllerPortState;
  listSnapshots(): Promise<ScreenSnapshotSummary[]>;
  markRendered(): void;
  notifyChange(reason: ScreenChangeReason): void;
  notifySelection(componentIds: readonly string[]): void;
  publish(): Promise<ScreenProjectEnvelope | ScreenProjectEnvelopeV2>;
  reload(options?: { discardChanges?: boolean }): Promise<void>;
  removeSnapshot(snapshotId: string): Promise<void>;
  restoreSnapshot(snapshotId: string): Promise<ScreenProjectEnvelope | ScreenProjectEnvelopeV2>;
  retry(): Promise<void>;
  save(): Promise<ScreenProjectEnvelope | ScreenProjectEnvelopeV2>;
  setEventTarget(eventTarget: EventTarget | undefined): void;
  setReadonly(readonly: boolean): void;
  subscribe(listener: () => void): () => void;
  whenReady(): Promise<void>;
}

export type ScreenHostControllerPortDraft = ScreenProjectDraft | ScreenProjectDraftV2;
export type ScreenHostControllerPortEnvelope = ScreenProjectEnvelope | ScreenProjectEnvelopeV2;
