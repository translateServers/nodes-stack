import type { ScreenProject } from '@nebula/shared';

export interface ScreenSnapshotSummary {
  id: string;
  name: string;
  createdAt: string;
  componentCount: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SnapshotProjectInput {
  projectId: string;
  signal: AbortSignal;
}

export interface SnapshotCreateInput extends SnapshotProjectInput {
  revision: string;
  project: ScreenProject;
}

export interface SnapshotRestoreInput extends SnapshotProjectInput {
  snapshotId: string;
  revision: string;
}

export interface SnapshotRemoveInput extends SnapshotProjectInput {
  snapshotId: string;
}

export interface ScreenSnapshotHostAdapter {
  list(input: SnapshotProjectInput): Promise<ScreenSnapshotSummary[]>;
  create(input: SnapshotCreateInput): Promise<ScreenSnapshotSummary>;
  restore(input: SnapshotRestoreInput): Promise<ScreenProject>;
  remove(input: SnapshotRemoveInput): Promise<void>;
  clear(input: SnapshotProjectInput): Promise<void>;
}

export interface ScreenEditorHostAdapter {
  snapshots?: ScreenSnapshotHostAdapter;
}
