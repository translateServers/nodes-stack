import {
  ScreenAdapterErrorCode,
  ScreenDocumentWireSchema,
  type ExportProjectInput,
  type ImportProjectInput,
  type LoadProjectInput,
  type PublishProjectInput,
  type SaveProjectInput,
  type ScreenAdapterError,
  type ScreenAdapterErrorCode as ScreenAdapterErrorCodeValue,
  type ScreenHostAdapter,
  type ScreenProjectDraft,
  type ScreenProjectEnvelopeInput,
  type ScreenProjectTransfer,
  type ScreenSnapshotAdapter,
  type ScreenSnapshotSummary,
  type SnapshotClearInput,
  type SnapshotCreateInput,
  type SnapshotListInput,
  type SnapshotRemoveInput,
  type SnapshotRestoreInput,
} from '@nebula/screen-sdk';

export type InMemoryMutationOperation = 'import' | 'publish' | 'save' | 'snapshot-restore';

export interface InMemoryOperationLogEntry {
  detail?: Readonly<Record<string, boolean | number | string>>;
  operation:
    | 'export'
    | 'import'
    | 'load'
    | 'publish'
    | 'save'
    | 'snapshot-clear'
    | 'snapshot-create'
    | 'snapshot-list'
    | 'snapshot-remove'
    | 'snapshot-restore';
  projectId: string;
  sequence: number;
}

interface StoredSnapshot {
  draft: ScreenProjectDraft;
  summary: ScreenSnapshotSummary;
}

class InMemoryAdapterError extends Error implements ScreenAdapterError {
  readonly code: ScreenAdapterErrorCodeValue;
  readonly recoverable?: boolean;
  readonly serverRevision?: string;

  constructor(
    code: ScreenAdapterErrorCodeValue,
    options: { recoverable?: boolean; serverRevision?: string } = {},
  ) {
    super(code);
    this.name = 'ScreenAdapterError';
    this.code = code;
    this.recoverable = options.recoverable;
    this.serverRevision = options.serverRevision;
  }
}

function cloneEnvelope(envelope: ScreenProjectEnvelopeInput): ScreenProjectEnvelopeInput {
  return structuredClone(envelope);
}

function cloneDraft(draft: ScreenProjectDraft): ScreenProjectDraft {
  return structuredClone(draft);
}

function createSafeFileName(name: string): string {
  const sanitized = Array.from(name, (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) return '-';
    return '<>:"/\\|?*'.includes(character) ? '-' : character;
  }).join('');
  const stem = sanitized
    .replace(/\.{2,}/g, '-')
    .trim()
    .slice(0, 240);
  return `${stem || 'screen-project'}.json`;
}

export class InMemoryScreenHostAdapter implements ScreenHostAdapter {
  readonly snapshots: ScreenSnapshotAdapter;

  readonly #delayMs: number;
  readonly #forcedConflicts = new Set<string>();
  readonly #listeners = new Set<() => void>();
  readonly #operationLog: InMemoryOperationLogEntry[] = [];
  readonly #projects = new Map<string, ScreenProjectEnvelopeInput>();
  readonly #snapshots = new Map<string, Map<string, StoredSnapshot>>();
  #operationSequence = 0;
  #revisionSequence = 0;
  #snapshotSequence = 0;

  constructor(projects: readonly ScreenProjectEnvelopeInput[], options: { delayMs?: number } = {}) {
    this.#delayMs = options.delayMs ?? 20;
    for (const project of projects) this.#projects.set(project.id, cloneEnvelope(project));
    this.snapshots = {
      clear: (input) => this.#clearSnapshots(input),
      create: (input) => this.#createSnapshot(input),
      list: (input) => this.#listSnapshots(input),
      remove: (input) => this.#removeSnapshot(input),
      restore: (input) => this.#restoreSnapshot(input),
    };
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  getOperationLog(): InMemoryOperationLogEntry[] {
    return structuredClone(this.#operationLog);
  }

  getProject(projectId: string): ScreenProjectEnvelopeInput {
    return cloneEnvelope(this.#requireProject(projectId));
  }

  createTransfer(projectId: string): ScreenProjectTransfer {
    const project = this.#requireProject(projectId);
    const document = ScreenDocumentWireSchema.parse(project.document);
    return {
      format: 'nebula-screen',
      formatVersion: 2,
      name: project.name,
      description: project.description,
      document,
    };
  }

  forceConflict(operation: InMemoryMutationOperation, projectId: string): void {
    this.#forcedConflicts.add(`${operation}:${projectId}`);
  }

  async loadProject(input: LoadProjectInput): Promise<ScreenProjectEnvelopeInput> {
    await this.#wait(input.signal);
    const project = this.#requireProject(input.projectId);
    this.#record('load', input.projectId);
    return cloneEnvelope(project);
  }

  async saveProject(input: SaveProjectInput): Promise<ScreenProjectEnvelopeInput> {
    await this.#wait(input.signal);
    const project = this.#requireProject(input.projectId);
    this.#record('save', input.projectId, { revision: input.revision });
    this.#assertRevision('save', project, input.revision);
    const saved = this.#replaceDraft(project, input.draft, 'draft');
    this.#projects.set(input.projectId, saved);
    return cloneEnvelope(saved);
  }

  async publishProject(input: PublishProjectInput): Promise<ScreenProjectEnvelopeInput> {
    await this.#wait(input.signal);
    const project = this.#requireProject(input.projectId);
    this.#record('publish', input.projectId, { revision: input.revision });
    this.#assertRevision('publish', project, input.revision);
    const published = {
      ...cloneEnvelope(project),
      status: 'published' as const,
      revision: this.#nextRevision(),
    };
    this.#projects.set(input.projectId, published);
    return cloneEnvelope(published);
  }

  async importProject(input: ImportProjectInput): Promise<ScreenProjectEnvelopeInput> {
    await this.#wait(input.signal);
    const project = this.#requireProject(input.projectId);
    this.#record('import', input.projectId, {
      fileName: input.file.name,
      revision: input.revision,
    });
    this.#assertRevision('import', project, input.revision);
    const imported = this.#replaceDraft(
      project,
      {
        name: input.transfer.name,
        description: input.transfer.description,
        document: input.transfer.document,
      },
      'draft',
    );
    this.#projects.set(input.projectId, imported);
    return cloneEnvelope(imported);
  }

  async exportProject(input: ExportProjectInput) {
    await this.#wait(input.signal);
    const project = this.#requireProject(input.projectId);
    this.#record('export', input.projectId, { revision: input.revision });
    this.#assertCurrentRevision(project, input.revision);
    const transfer = this.createTransfer(input.projectId);
    return {
      fileName: createSafeFileName(project.name),
      transfer,
    };
  }

  #replaceDraft(
    project: ScreenProjectEnvelopeInput,
    draft: ScreenProjectDraft,
    status: ScreenProjectEnvelopeInput['status'],
  ): ScreenProjectEnvelopeInput {
    return {
      id: project.id,
      name: draft.name,
      description: draft.description,
      status,
      revision: this.#nextRevision(),
      document: structuredClone(draft.document),
    };
  }

  #nextRevision(): string {
    this.#revisionSequence += 1;
    return `memory:${this.#revisionSequence}`;
  }

  #requireProject(projectId: string): ScreenProjectEnvelopeInput {
    const project = this.#projects.get(projectId);
    if (project === undefined) {
      throw new InMemoryAdapterError(ScreenAdapterErrorCode.NOT_FOUND, { recoverable: false });
    }
    return project;
  }

  #assertCurrentRevision(project: ScreenProjectEnvelopeInput, revision: string): void {
    if (project.revision !== revision) {
      throw new InMemoryAdapterError(ScreenAdapterErrorCode.CONFLICT, {
        recoverable: true,
        serverRevision: project.revision,
      });
    }
  }

  #assertRevision(
    operation: InMemoryMutationOperation,
    project: ScreenProjectEnvelopeInput,
    revision: string,
  ): void {
    const conflictKey = `${operation}:${project.id}`;
    if (this.#forcedConflicts.delete(conflictKey)) {
      throw new InMemoryAdapterError(ScreenAdapterErrorCode.CONFLICT, {
        recoverable: true,
        serverRevision: project.revision,
      });
    }
    this.#assertCurrentRevision(project, revision);
  }

  async #wait(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.#delayMs <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', handleAbort);
        resolve();
      }, this.#delayMs);
      const handleAbort = (): void => {
        window.clearTimeout(timer);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('Operation aborted', 'AbortError'),
        );
      };
      signal.addEventListener('abort', handleAbort, { once: true });
    });
    signal.throwIfAborted();
  }

  #record(
    operation: InMemoryOperationLogEntry['operation'],
    projectId: string,
    detail?: Record<string, boolean | number | string>,
  ): void {
    this.#operationSequence += 1;
    this.#operationLog.push({
      operation,
      projectId,
      sequence: this.#operationSequence,
      ...(detail === undefined ? {} : { detail: structuredClone(detail) }),
    });
    for (const listener of this.#listeners) listener();
  }

  #snapshotStore(projectId: string): Map<string, StoredSnapshot> {
    const existing = this.#snapshots.get(projectId);
    if (existing !== undefined) return existing;
    const created = new Map<string, StoredSnapshot>();
    this.#snapshots.set(projectId, created);
    return created;
  }

  async #listSnapshots(input: SnapshotListInput): Promise<ScreenSnapshotSummary[]> {
    await this.#wait(input.signal);
    this.#requireProject(input.projectId);
    this.#record('snapshot-list', input.projectId);
    return Array.from(this.#snapshotStore(input.projectId).values(), ({ summary }) =>
      structuredClone(summary),
    ).reverse();
  }

  async #createSnapshot(input: SnapshotCreateInput): Promise<ScreenSnapshotSummary> {
    await this.#wait(input.signal);
    const project = this.#requireProject(input.projectId);
    this.#record('snapshot-create', input.projectId, { revision: input.revision });
    this.#assertCurrentRevision(project, input.revision);
    this.#snapshotSequence += 1;
    const id = `snapshot:${this.#snapshotSequence}`;
    const summary: ScreenSnapshotSummary = {
      id,
      name: `快照 ${this.#snapshotSequence}`,
      createdAt: new Date(Date.now() + this.#snapshotSequence).toISOString(),
      componentCount: input.draft.document.components.length,
      canvasWidth: input.draft.document.canvas.width,
      canvasHeight: input.draft.document.canvas.height,
    };
    this.#snapshotStore(input.projectId).set(id, {
      draft: cloneDraft(input.draft),
      summary: structuredClone(summary),
    });
    return structuredClone(summary);
  }

  async #restoreSnapshot(input: SnapshotRestoreInput): Promise<ScreenProjectEnvelopeInput> {
    await this.#wait(input.signal);
    const project = this.#requireProject(input.projectId);
    this.#record('snapshot-restore', input.projectId, {
      revision: input.revision,
      snapshotId: input.snapshotId,
    });
    this.#assertRevision('snapshot-restore', project, input.revision);
    const stored = this.#snapshotStore(input.projectId).get(input.snapshotId);
    if (stored === undefined) {
      throw new InMemoryAdapterError(ScreenAdapterErrorCode.NOT_FOUND, { recoverable: false });
    }
    const restored = this.#replaceDraft(project, stored.draft, 'draft');
    this.#projects.set(input.projectId, restored);
    return cloneEnvelope(restored);
  }

  async #removeSnapshot(input: SnapshotRemoveInput): Promise<void> {
    await this.#wait(input.signal);
    this.#requireProject(input.projectId);
    this.#record('snapshot-remove', input.projectId, { snapshotId: input.snapshotId });
    if (!this.#snapshotStore(input.projectId).delete(input.snapshotId)) {
      throw new InMemoryAdapterError(ScreenAdapterErrorCode.NOT_FOUND, { recoverable: false });
    }
  }

  async #clearSnapshots(input: SnapshotClearInput): Promise<void> {
    await this.#wait(input.signal);
    this.#requireProject(input.projectId);
    this.#record('snapshot-clear', input.projectId);
    this.#snapshotStore(input.projectId).clear();
  }
}
