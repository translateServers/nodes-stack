import { ScreenProjectSchema, type ScreenProject } from '@nebula/shared';
import type {
  ScreenSnapshotHostAdapter,
  ScreenSnapshotSummary,
  SnapshotCreateInput,
  SnapshotProjectInput,
  SnapshotRemoveInput,
  SnapshotRestoreInput,
} from './screen-editor-host-adapter';

const STORAGE_KEY_PREFIX = 'screen-snapshot:';
const MAX_SNAPSHOTS = 20;

interface StoredSnapshot {
  id: string;
  project: ScreenProject;
}

function buildProjectPrefix(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}:`;
}

function buildKey(projectId: string, snapshotId: string): string {
  return `${buildProjectPrefix(projectId)}${snapshotId}`;
}

function parseCreatedAt(snapshotId: string): string | null {
  const timestamp = Number(snapshotId);
  if (!Number.isInteger(timestamp) || timestamp < 0) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readSnapshot(
  storage: Storage,
  projectId: string,
  snapshotId: string,
): StoredSnapshot | null {
  const raw = storage.getItem(buildKey(projectId, snapshotId));
  if (raw === null) return null;

  try {
    const parsed = ScreenProjectSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { id: snapshotId, project: parsed.data } : null;
  } catch {
    return null;
  }
}

function toSummary(snapshot: StoredSnapshot): ScreenSnapshotSummary | null {
  const createdAt = parseCreatedAt(snapshot.id);
  if (createdAt === null) return null;
  return {
    id: snapshot.id,
    name: snapshot.project.name,
    createdAt,
    componentCount: snapshot.project.components.length,
    canvasWidth: snapshot.project.canvas.width,
    canvasHeight: snapshot.project.canvas.height,
  };
}

function listStoredSnapshots(storage: Storage, projectId: string): StoredSnapshot[] {
  const projectPrefix = buildProjectPrefix(projectId);
  const snapshots: StoredSnapshot[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key === null || !key.startsWith(projectPrefix)) continue;
    const snapshot = readSnapshot(storage, projectId, key.slice(projectPrefix.length));
    if (snapshot !== null) snapshots.push(snapshot);
  }

  snapshots.sort((left, right) => Number(right.id) - Number(left.id));
  return snapshots;
}

function createSnapshotId(storage: Storage, projectId: string): string {
  let timestamp = Date.now();
  while (storage.getItem(buildKey(projectId, String(timestamp))) !== null) timestamp += 1;
  return String(timestamp);
}

function evictOldest(storage: Storage, projectId: string): void {
  const snapshots = listStoredSnapshots(storage, projectId);
  const oldest = snapshots.at(-1);
  if (oldest !== undefined) storage.removeItem(buildKey(projectId, oldest.id));
}

function writeSnapshot(storage: Storage, projectId: string, snapshot: StoredSnapshot): void {
  const key = buildKey(projectId, snapshot.id);
  const serialized = JSON.stringify(snapshot.project);

  try {
    storage.setItem(key, serialized);
  } catch {
    evictOldest(storage, projectId);
    storage.setItem(key, serialized);
  }

  const snapshots = listStoredSnapshots(storage, projectId);
  for (const excess of snapshots.slice(MAX_SNAPSHOTS)) {
    storage.removeItem(buildKey(projectId, excess.id));
  }
}

function runStorageOperation<Result>(
  signal: AbortSignal,
  operation: () => Result,
): Promise<Result> {
  return Promise.resolve().then(() => {
    signal.throwIfAborted();
    const result = operation();
    signal.throwIfAborted();
    return result;
  });
}

export function createLocalSnapshotAdapter(storage: Storage): ScreenSnapshotHostAdapter {
  return {
    list: ({ projectId, signal }: SnapshotProjectInput): Promise<ScreenSnapshotSummary[]> =>
      runStorageOperation(signal, () =>
        listStoredSnapshots(storage, projectId).flatMap((snapshot) => {
          const summary = toSummary(snapshot);
          return summary === null ? [] : [summary];
        }),
      ),

    create: ({ projectId, project, signal }: SnapshotCreateInput) =>
      runStorageOperation(signal, () => {
        const snapshot: StoredSnapshot = {
          id: createSnapshotId(storage, projectId),
          project: structuredClone(project),
        };
        writeSnapshot(storage, projectId, snapshot);
        const summary = toSummary(snapshot);
        if (summary === null) throw new Error('快照时间无效');
        return summary;
      }),

    restore: ({ projectId, snapshotId, signal }: SnapshotRestoreInput) =>
      runStorageOperation(signal, () => {
        const snapshot = readSnapshot(storage, projectId, snapshotId);
        if (snapshot === null) throw new Error('快照数据已损坏或被删除');
        return structuredClone(snapshot.project);
      }),

    remove: ({ projectId, snapshotId, signal }: SnapshotRemoveInput): Promise<void> =>
      runStorageOperation(signal, () => storage.removeItem(buildKey(projectId, snapshotId))),

    clear: ({ projectId, signal }: SnapshotProjectInput): Promise<void> =>
      runStorageOperation(signal, () => {
        for (const snapshot of listStoredSnapshots(storage, projectId)) {
          storage.removeItem(buildKey(projectId, snapshot.id));
        }
      }),
  };
}
