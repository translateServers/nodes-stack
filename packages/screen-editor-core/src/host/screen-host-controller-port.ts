import type {
  ScreenExportFile,
  ScreenHostCapabilities,
  ScreenPublicError,
  ScreenSnapshotSummary,
} from '../contracts/adapter.js';
import type { ScreenProjectDraft, ScreenProjectEnvelope } from '../contracts/document.js';
import type { ScreenChangeReason } from '../events.js';

export interface ScreenHostControllerPortState {
  readonly capabilities?: ScreenHostCapabilities;
  readonly error?: ScreenPublicError;
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

export interface ScreenHostControllerPort {
  readonly cancelSnapshotList: () => void;
  readonly cancelSnapshotMutations: () => void;
  readonly clearSnapshots: () => Promise<void>;
  readonly createSnapshot: () => Promise<ScreenSnapshotSummary>;
  readonly dispose: () => void;
  readonly exportProject: () => Promise<ScreenExportFile>;
  readonly getState: () => ScreenHostControllerPortState;
  readonly listSnapshots: () => Promise<ScreenSnapshotSummary[]>;
  readonly markRendered: () => void;
  readonly notifyChange: (reason: ScreenChangeReason) => void;
  readonly notifySelection: (componentIds: readonly string[]) => void;
  readonly publish: () => Promise<ScreenProjectEnvelope>;
  readonly reload: (options?: { readonly discardChanges?: boolean }) => Promise<void>;
  readonly removeSnapshot: (snapshotId: string) => Promise<void>;
  readonly restoreSnapshot: (snapshotId: string) => Promise<ScreenProjectEnvelope>;
  readonly retry: () => Promise<void>;
  readonly save: () => Promise<ScreenProjectEnvelope>;
  readonly setEventTarget: (eventTarget: EventTarget | undefined) => void;
  readonly setReadonly: (isReadonly: boolean) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly whenReady: () => Promise<void>;
}

export type ScreenHostControllerPortDraft = ScreenProjectDraft;
export type ScreenHostControllerPortEnvelope = ScreenProjectEnvelope;
