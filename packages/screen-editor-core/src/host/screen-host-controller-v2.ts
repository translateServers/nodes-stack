import { z } from 'zod';
import {
  normalizeScreenAdapterErrorV2,
  ScreenAdapterErrorCode,
  ScreenExportFileSchema,
  ScreenSnapshotSummaryListSchema,
  ScreenSnapshotSummarySchema,
  toScreenPublicErrorV2,
  type ScreenAdapterErrorV2,
  type ScreenExportFile,
  type ScreenHostAdapterV2,
  type ScreenHostCapabilities,
  type ScreenOperation,
  type ScreenPublicErrorV2,
  type ScreenSnapshotSummary,
} from '../contracts/adapter.js';
import {
  canPublishWithMigration,
  cloneScreenProjectDraftV2,
  cloneScreenProjectTransferV2,
  normalizeV1EnvelopeInputToV2,
  parseScreenProjectExportV2,
  parseScreenProjectEnvelopeInputV2,
  parseScreenProjectTransferV2,
  SCREEN_TRANSFER_MAX_BYTES,
  type ScreenProjectDraftV2,
  type ScreenProjectEnvelopeV2,
  type ScreenProjectTransferV2,
} from '../contracts/document.js';
import type { ScreenSdkDiagnosticV2 } from '../contracts/diagnostics.js';
import type { ScreenChangeReason } from '../events.js';
import type { ScreenComponentInstanceRegistry } from '../registry/instance-registry.js';
import {
  ScreenOperationCoordinator,
  type ScreenMutationOperation,
  type ScreenOperationContext,
} from './operation-coordinator.js';
import type {
  ScreenHostControllerPort,
  ScreenHostControllerPortState,
} from './screen-host-controller-port.js';

export interface ScreenHostSessionSnapshotV2 {
  readonly dirty: boolean;
  readonly draft: ScreenProjectDraftV2;
  readonly projectId: string;
  readonly revision: string;
}

export type ScreenSessionApplyCommandV2 =
  | {
      envelope: ScreenProjectEnvelopeV2;
      source: 'load' | 'reload' | 'import' | 'snapshot-restore';
    }
  | {
      envelope: ScreenProjectEnvelopeV2;
      source: 'save' | 'publish';
      submittedDraft: ScreenProjectDraftV2;
    };

export interface ScreenHostSessionPortV2 {
  applyEnvelope(command: ScreenSessionApplyCommandV2): void;
  clear(): void;
  getSnapshot(): ScreenHostSessionSnapshotV2 | null;
}

export interface PreparedScreenImportV2 {
  readonly kind: 'v2';
  readonly file: File;
  readonly generation: number;
  readonly preview: {
    readonly canvasHeight: number;
    readonly canvasWidth: number;
    readonly componentCount: number;
    readonly name: string;
  };
  readonly projectId: string;
  readonly transfer: ScreenProjectTransferV2;
}

export interface ScreenHostControllerV2State extends ScreenHostControllerPortState {
  readonly error?: ScreenPublicErrorV2;
}

export interface CreateScreenHostControllerV2Options {
  eventTarget?: EventTarget;
  registry: ScreenComponentInstanceRegistry;
  session: ScreenHostSessionPortV2;
}

interface ScreenHostBindingV2 {
  readonly adapter: ScreenHostAdapterV2;
  readonly projectId: string;
}

interface ParsedEnvelopeV2 {
  readonly envelope: ScreenProjectEnvelopeV2;
  readonly migrationPending: boolean;
}

interface ReadyWaiter {
  reject(error: ScreenAdapterErrorV2): void;
  resolve(): void;
}

class ScreenHostWorkflowErrorV2 extends Error implements ScreenAdapterErrorV2 {
  readonly code: ScreenAdapterErrorV2['code'];
  readonly diagnostics?: readonly ScreenSdkDiagnosticV2[];
  readonly recoverable?: boolean;
  readonly serverRevision?: string;

  constructor(
    code: ScreenAdapterErrorV2['code'],
    options: {
      diagnostics?: readonly ScreenSdkDiagnosticV2[];
      recoverable?: boolean;
      serverRevision?: string;
    } = {},
  ) {
    super(code);
    this.name = 'ScreenAdapterErrorV2';
    this.code = code;
    this.diagnostics = options.diagnostics;
    this.recoverable = options.recoverable;
    this.serverRevision = options.serverRevision;
  }
}

function createWorkflowError(
  code: ScreenAdapterErrorV2['code'],
  options?: ConstructorParameters<typeof ScreenHostWorkflowErrorV2>[1],
): ScreenHostWorkflowErrorV2 {
  return new ScreenHostWorkflowErrorV2(code, options);
}

function createAbortError(): ScreenHostWorkflowErrorV2 {
  return createWorkflowError(ScreenAdapterErrorCode.ABORTED, { recoverable: true });
}

function normalizeWorkflowError(error: unknown): ScreenHostWorkflowErrorV2 {
  const normalized = normalizeScreenAdapterErrorV2(error);
  return createWorkflowError(normalized.code, {
    diagnostics: normalized.diagnostics,
    recoverable: normalized.recoverable,
    serverRevision: normalized.serverRevision,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDocumentSchemaVersion(input: unknown): number | undefined {
  if (!isRecord(input) || !isRecord(input.document)) return undefined;
  const schemaVersion = input.document.schemaVersion;
  return typeof schemaVersion === 'number' ? schemaVersion : undefined;
}

const JSON_MIME_PATTERN = /^application\/json(?:\s*;\s*charset=[^;]+)?$/i;
const SNAPSHOT_MUTATIONS: ReadonlySet<ScreenMutationOperation> = new Set([
  'snapshot-create',
  'snapshot-restore',
  'snapshot-remove',
  'snapshot-clear',
]);

function createValidationDiagnostics(error: z.ZodError): ScreenSdkDiagnosticV2[] {
  return error.issues.map((issue) => ({
    code: 'INVALID_DOCUMENT',
    path: issue.path.map((segment) => (typeof segment === 'symbol' ? '<field>' : segment)),
    severity: 'error',
    message: 'Adapter 返回值字段校验失败。',
  }));
}

function parseAdapterResponseV2<Result>(schema: z.ZodType<Result>, input: unknown): Result {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION, {
    diagnostics: createValidationDiagnostics(result.error),
  });
}

function parseTransferV2(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenProjectTransferV2 {
  const result = parseScreenProjectTransferV2(input, registry);
  if (!result.success) {
    throw createWorkflowError(result.code, { diagnostics: result.diagnostics });
  }
  return cloneScreenProjectTransferV2(result.data);
}

function deriveV2Capabilities(adapter: unknown): ScreenHostCapabilities {
  if (
    !isRecord(adapter) ||
    adapter.documentVersion !== 2 ||
    typeof adapter.loadProject !== 'function' ||
    typeof adapter.saveProject !== 'function'
  ) {
    throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION);
  }

  const optionalMethods = ['publishProject', 'importProject', 'exportProject'] as const;
  if (
    optionalMethods.some(
      (method) => adapter[method] !== undefined && typeof adapter[method] !== 'function',
    )
  ) {
    throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION);
  }
  if (adapter.snapshots !== undefined) {
    const snapshotAdapter = adapter.snapshots;
    if (!isRecord(snapshotAdapter)) {
      throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION);
    }
    const snapshotRecord = snapshotAdapter;
    const snapshotMethods = ['list', 'create', 'restore', 'remove', 'clear'] as const;
    if (snapshotMethods.some((method) => typeof snapshotRecord[method] !== 'function')) {
      throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION);
    }
  }

  return {
    load: true,
    save: true,
    publish: typeof adapter.publishProject === 'function',
    import: typeof adapter.importProject === 'function',
    export: typeof adapter.exportProject === 'function',
    snapshots: adapter.snapshots !== undefined,
  };
}

function parseEnvelope(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
  projectId: string,
): ParsedEnvelopeV2 {
  const schemaVersion = getDocumentSchemaVersion(input);
  const normalized =
    schemaVersion === 1 ? normalizeV1EnvelopeInputToV2(input, registry) : undefined;

  if (normalized !== undefined && !normalized.success) {
    throw createWorkflowError(normalized.code, { diagnostics: normalized.diagnostics });
  }

  const envelopeInput = normalized?.envelope ?? input;
  const result = parseScreenProjectEnvelopeInputV2(envelopeInput, registry, projectId);
  if (!result.success) {
    throw createWorkflowError(result.code, { diagnostics: result.diagnostics });
  }

  return {
    envelope: structuredClone(result.data),
    migrationPending: normalized?.migrationPending ?? false,
  };
}

/**
 * V2 host workflow for registry-aware persistence and transfer operations.
 *
 * V1 remains on `ScreenHostController`; this controller only owns V2 parsing,
 * migration state, lifecycle mutations, transfer validation, export serialization,
 * and snapshot operations.
 */
export class ScreenHostControllerV2 implements ScreenHostControllerPort {
  private readonly coordinator = new ScreenOperationCoordinator();
  private readonly listeners = new Set<() => void>();
  private readonly readyWaiters = new Set<ReadyWaiter>();
  private readonly registry: ScreenComponentInstanceRegistry;
  private readonly session: ScreenHostSessionPortV2;
  private binding: ScreenHostBindingV2 | null = null;
  private currentEnvelope: ScreenProjectEnvelopeV2 | null = null;
  private eventTarget?: EventTarget;
  private lastDirty: boolean | undefined;
  private migrationPending = false;
  private readonlyMode = false;
  private savePromise: Promise<ScreenProjectEnvelopeV2> | null = null;
  private state: ScreenHostControllerV2State = {
    generation: 0,
    pendingMutations: [],
    phase: 'waiting',
    retainedProject: false,
  };

  constructor(options: CreateScreenHostControllerV2Options) {
    this.eventTarget = options.eventTarget;
    this.registry = options.registry;
    this.session = options.session;
  }

  getState(): ScreenHostControllerV2State {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setBinding(projectId: string | undefined, adapter: ScreenHostAdapterV2 | undefined): void {
    this.assertNotDisposed();
    this.flushBinding(projectId, adapter);
  }

  setEventTarget(eventTarget: EventTarget | undefined): void {
    this.eventTarget = eventTarget;
  }

  setReadonly(readonly: boolean): void {
    this.readonlyMode = readonly;
  }

  whenReady(): Promise<void> {
    if (this.state.phase === 'ready') return Promise.resolve();
    if (this.state.phase === 'error' || this.state.phase === 'unsupported') {
      return Promise.reject(
        this.state.error === undefined
          ? createWorkflowError(ScreenAdapterErrorCode.UNKNOWN)
          : createWorkflowError(this.state.error.code, {
              diagnostics: this.state.error.diagnostics,
              recoverable: this.state.error.recoverable,
              serverRevision: this.state.error.serverRevision,
            }),
      );
    }
    if (this.state.phase === 'disposed') return Promise.reject(createAbortError());
    return new Promise<void>((resolve, reject) => {
      this.readyWaiters.add({ resolve, reject });
    });
  }

  markRendered(): void {
    if (this.state.phase !== 'awaiting-render' || this.currentEnvelope === null) return;
    this.setState({
      error: undefined,
      loadMode: undefined,
      phase: 'ready',
      retainedProject: false,
    });
    for (const waiter of this.readyWaiters) waiter.resolve();
    this.readyWaiters.clear();
    this.dispatch('nebula-ready', {
      projectId: this.currentEnvelope.id,
      envelope: this.currentEnvelope,
    });
  }

  retry(): Promise<void> {
    return this.performLoad('retry', this.state.retainedProject);
  }

  reload(options: { discardChanges?: boolean } = {}): Promise<void> {
    const snapshot = this.session.getSnapshot();
    if (snapshot?.dirty === true && options.discardChanges !== true) {
      return this.rejectOperation(
        'reload',
        createWorkflowError(ScreenAdapterErrorCode.DIRTY_STATE, { recoverable: true }),
      );
    }
    return this.performLoad('reload', true);
  }

  save(): Promise<ScreenProjectEnvelopeV2> {
    if (this.savePromise !== null) return this.savePromise;
    const promise = this.performSave();
    this.savePromise = promise;
    void promise.then(
      () => {
        if (this.savePromise === promise) this.savePromise = null;
      },
      () => {
        if (this.savePromise === promise) this.savePromise = null;
      },
    );
    return promise;
  }

  publish(): Promise<ScreenProjectEnvelopeV2> {
    try {
      this.assertWritable();
      const binding = this.requireBinding();
      if (!canPublishWithMigration({ migrationPending: this.migrationPending })) {
        throw createWorkflowError(ScreenAdapterErrorCode.DIRTY_STATE);
      }
      if (binding.adapter.publishProject === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      if (this.requireSession(binding.projectId).dirty) {
        throw createWorkflowError(ScreenAdapterErrorCode.DIRTY_STATE);
      }
    } catch (error) {
      return this.rejectOperation('publish', error);
    }

    return this.runObservedMutation('publish', async (context, binding) => {
      this.assertWritable();
      if (!canPublishWithMigration({ migrationPending: this.migrationPending })) {
        throw createWorkflowError(ScreenAdapterErrorCode.DIRTY_STATE);
      }
      const publishProject = binding.adapter.publishProject;
      if (publishProject === undefined)
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      const snapshot = this.requireSession(binding.projectId);
      if (snapshot.dirty) throw createWorkflowError(ScreenAdapterErrorCode.DIRTY_STATE);
      const response = await publishProject.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.session.applyEnvelope({
        source: 'publish',
        envelope: parsed.envelope,
        submittedDraft: cloneScreenProjectDraftV2(snapshot.draft),
      });
      this.currentEnvelope = structuredClone(parsed.envelope);
      this.migrationPending = false;
      this.emitDirtyIfChanged();
      this.dispatch('nebula-publish-success', {
        projectId: binding.projectId,
        envelope: parsed.envelope,
      });
      return structuredClone(parsed.envelope);
    });
  }

  async prepareImport(file: File): Promise<PreparedScreenImportV2> {
    const binding = this.requireBinding();
    if (binding.adapter.importProject === undefined) {
      return this.rejectOperation(
        'import',
        createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE),
      );
    }
    if (!file.name.toLowerCase().endsWith('.json') && !JSON_MIME_PATTERN.test(file.type)) {
      return this.rejectOperation('import', createWorkflowError(ScreenAdapterErrorCode.VALIDATION));
    }
    if (file.size > SCREEN_TRANSFER_MAX_BYTES) {
      return this.rejectOperation('import', createWorkflowError(ScreenAdapterErrorCode.VALIDATION));
    }

    try {
      const transfer = parseTransferV2(JSON.parse(await file.text()) as unknown, this.registry);
      return {
        kind: 'v2',
        file,
        generation: this.coordinator.generation,
        preview: {
          name: transfer.name,
          componentCount: transfer.document.components.length,
          canvasWidth: transfer.document.canvas.width,
          canvasHeight: transfer.document.canvas.height,
        },
        projectId: binding.projectId,
        transfer,
      };
    } catch (error) {
      return this.rejectOperation(
        'import',
        error instanceof SyntaxError
          ? createWorkflowError(ScreenAdapterErrorCode.VALIDATION)
          : error,
      );
    }
  }

  importProject(prepared: PreparedScreenImportV2): Promise<ScreenProjectEnvelopeV2> {
    return this.runObservedMutation('import', async (context, binding) => {
      this.assertWritable();
      const importProject = binding.adapter.importProject;
      if (importProject === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      if (prepared.generation !== context.generation || prepared.projectId !== binding.projectId) {
        throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION);
      }
      const snapshot = this.requireSession(binding.projectId);
      const transfer = parseTransferV2(prepared.transfer, this.registry);
      const response = await importProject.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        file: prepared.file,
        transfer: cloneScreenProjectTransferV2(transfer),
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.session.applyEnvelope({ source: 'import', envelope: parsed.envelope });
      this.currentEnvelope = structuredClone(parsed.envelope);
      this.migrationPending = false;
      this.emitDirtyIfChanged();
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'import',
        envelope: parsed.envelope,
      });
      return structuredClone(parsed.envelope);
    });
  }

  exportProject(): Promise<ScreenExportFile> {
    return this.runObservedRead('export', async (context, binding) => {
      const exportProject = binding.adapter.exportProject;
      if (exportProject === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const snapshot = this.requireSession(binding.projectId);
      const response = await exportProject.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseScreenProjectExportV2(response, this.registry);
      if (!parsed.success) {
        throw createWorkflowError(parsed.code, { diagnostics: parsed.diagnostics });
      }
      const file = parseAdapterResponseV2(ScreenExportFileSchema, {
        fileName: parsed.data.fileName,
        blob: new Blob([JSON.stringify(parsed.data.transfer)], {
          type: 'application/json',
        }),
      });
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'export',
        fileName: file.fileName,
      });
      return file;
    });
  }

  listSnapshots(): Promise<ScreenSnapshotSummary[]> {
    return this.runObservedRead(
      'snapshot-list',
      async (context, binding) => {
        const snapshots = binding.adapter.snapshots;
        if (snapshots === undefined) {
          throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
        }
        const response = await snapshots.list({
          projectId: binding.projectId,
          signal: context.signal,
        });
        context.assertCurrent();
        return structuredClone(parseAdapterResponseV2(ScreenSnapshotSummaryListSchema, response));
      },
      true,
    );
  }

  cancelSnapshotList(): void {
    this.coordinator.cancelRead('snapshot-list');
  }

  cancelSnapshotMutations(): void {
    this.coordinator.cancelMutations(SNAPSHOT_MUTATIONS);
  }

  createSnapshot(): Promise<ScreenSnapshotSummary> {
    return this.runObservedMutation('snapshot-create', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const current = this.requireSession(binding.projectId);
      const response = await snapshots.create({
        projectId: binding.projectId,
        revision: current.revision,
        draft: cloneScreenProjectDraftV2(current.draft),
        signal: context.signal,
      });
      context.assertCurrent();
      const snapshot = structuredClone(
        parseAdapterResponseV2(ScreenSnapshotSummarySchema, response),
      );
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'snapshot-create',
        snapshot,
      });
      return snapshot;
    });
  }

  restoreSnapshot(snapshotId: string): Promise<ScreenProjectEnvelopeV2> {
    return this.runObservedMutation('snapshot-restore', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const current = this.requireSession(binding.projectId);
      const response = await snapshots.restore({
        projectId: binding.projectId,
        snapshotId,
        revision: current.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.session.applyEnvelope({ source: 'snapshot-restore', envelope: parsed.envelope });
      this.currentEnvelope = structuredClone(parsed.envelope);
      this.migrationPending = false;
      this.emitDirtyIfChanged();
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'snapshot-restore',
        envelope: parsed.envelope,
      });
      return structuredClone(parsed.envelope);
    });
  }

  removeSnapshot(snapshotId: string): Promise<void> {
    return this.runObservedMutation('snapshot-remove', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const response = await snapshots.remove({
        projectId: binding.projectId,
        snapshotId,
        signal: context.signal,
      });
      context.assertCurrent();
      parseAdapterResponseV2(z.undefined(), response);
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'snapshot-remove',
        snapshotId,
      });
    });
  }

  clearSnapshots(): Promise<void> {
    return this.runObservedMutation('snapshot-clear', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const response = await snapshots.clear({
        projectId: binding.projectId,
        signal: context.signal,
      });
      context.assertCurrent();
      parseAdapterResponseV2(z.undefined(), response);
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'snapshot-clear',
      });
    });
  }

  notifyChange(reason: ScreenChangeReason): void {
    const snapshot = this.session.getSnapshot();
    if (snapshot === null) return;
    this.dispatch('nebula-change', {
      projectId: snapshot.projectId,
      draft: cloneScreenProjectDraftV2(snapshot.draft),
      reason,
    });
    this.emitDirtyIfChanged();
  }

  notifySelection(componentIds: readonly string[]): void {
    const snapshot = this.session.getSnapshot();
    if (snapshot === null) return;
    this.dispatch('nebula-selection-change', {
      projectId: snapshot.projectId,
      componentIds: [...componentIds],
    });
  }

  dispose(): void {
    if (this.state.phase === 'disposed') return;
    this.coordinator.dispose();
    this.rejectReadyWaiters(createAbortError());
    this.listeners.clear();
    this.binding = null;
    this.currentEnvelope = null;
    this.state = {
      generation: this.coordinator.generation,
      pendingMutations: [],
      phase: 'disposed',
      retainedProject: false,
    };
  }

  private flushBinding(
    projectId: string | undefined,
    adapter: ScreenHostAdapterV2 | undefined,
  ): void {
    if (this.state.phase === 'disposed') return;
    if (projectId === undefined || projectId.trim() === '' || adapter === undefined) {
      if (this.binding !== null) {
        this.coordinator.advanceGeneration();
        this.savePromise = null;
        this.rejectReadyWaiters(createAbortError());
        this.binding = null;
        this.currentEnvelope = null;
        this.migrationPending = false;
        this.session.clear();
      }
      this.setState({
        capabilities: undefined,
        error: undefined,
        generation: this.coordinator.generation,
        loadMode: undefined,
        pendingMutations: [],
        phase: 'waiting',
        projectId: undefined,
        retainedProject: false,
      });
      return;
    }
    if (this.binding?.projectId === projectId && this.binding.adapter === adapter) return;

    let capabilities: ScreenHostCapabilities;
    try {
      capabilities = deriveV2Capabilities(adapter);
    } catch (error) {
      this.coordinator.advanceGeneration();
      this.savePromise = null;
      this.rejectReadyWaiters(createAbortError());
      this.binding = null;
      this.currentEnvelope = null;
      this.migrationPending = false;
      this.session.clear();
      const normalized = normalizeWorkflowError(error);
      this.setState({
        capabilities: undefined,
        error: toScreenPublicErrorV2(normalized),
        generation: this.coordinator.generation,
        pendingMutations: [],
        phase: 'error',
        projectId,
        retainedProject: false,
      });
      this.dispatchError('project-change', normalized, projectId);
      return;
    }

    if (this.binding !== null) this.rejectReadyWaiters(createAbortError());
    this.binding = { projectId, adapter };
    this.currentEnvelope = null;
    this.lastDirty = undefined;
    this.migrationPending = false;
    this.session.clear();
    this.setState({ capabilities, projectId });
    void this.performLoad('initial', false).catch(() => undefined);
  }

  private performLoad(
    mode: 'initial' | 'reload' | 'retry',
    retainedProject: boolean,
  ): Promise<void> {
    let binding: ScreenHostBindingV2;
    try {
      binding = this.requireBinding();
    } catch (error) {
      return this.rejectOperation(mode === 'reload' ? 'reload' : 'load', error);
    }
    const generation = this.coordinator.advanceGeneration();
    this.savePromise = null;
    if (!retainedProject) {
      this.session.clear();
      this.currentEnvelope = null;
    }
    this.setState({
      error: undefined,
      generation,
      loadMode: mode,
      pendingMutations: [],
      phase: 'loading',
      retainedProject,
    });
    const operation: ScreenOperation = mode === 'reload' ? 'reload' : 'load';

    return this.coordinator
      .runRead(
        operation,
        async (context) => {
          const response = await binding.adapter.loadProject({
            projectId: binding.projectId,
            signal: context.signal,
          });
          context.assertCurrent();
          const parsed = parseEnvelope(response, this.registry, binding.projectId);
          this.session.applyEnvelope({
            source: mode === 'reload' ? 'reload' : 'load',
            envelope: parsed.envelope,
          });
          this.currentEnvelope = structuredClone(parsed.envelope);
          this.migrationPending = parsed.migrationPending;
          this.lastDirty = false;
          this.setState({
            error: undefined,
            phase: 'awaiting-render',
            retainedProject: false,
          });
        },
        { latestOnly: true },
      )
      .catch((error: unknown) => {
        const normalized = normalizeWorkflowError(error);
        if (normalized.code === ScreenAdapterErrorCode.ABORTED) throw normalized;
        const publicError = toScreenPublicErrorV2(normalized);
        this.rejectReadyWaiters(normalized);
        this.setState({
          error: publicError,
          phase:
            normalized.code === ScreenAdapterErrorCode.UNSUPPORTED_DOCUMENT_FEATURE
              ? 'unsupported'
              : 'error',
          retainedProject,
        });
        this.dispatchError(operation, normalized, binding.projectId);
        throw normalized;
      });
  }

  private performSave(): Promise<ScreenProjectEnvelopeV2> {
    return this.runObservedMutation('save', async (context, binding) => {
      this.assertWritable();
      const snapshot = this.requireSession(binding.projectId);
      const submittedDraft = cloneScreenProjectDraftV2(snapshot.draft);
      const response = await binding.adapter.saveProject({
        projectId: binding.projectId,
        revision: snapshot.revision,
        draft: cloneScreenProjectDraftV2(submittedDraft),
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.session.applyEnvelope({
        source: 'save',
        envelope: parsed.envelope,
        submittedDraft,
      });
      this.currentEnvelope = structuredClone(parsed.envelope);
      this.migrationPending = false;
      this.emitDirtyIfChanged();
      this.dispatch('nebula-save-success', {
        projectId: binding.projectId,
        envelope: parsed.envelope,
      });
      return structuredClone(parsed.envelope);
    });
  }

  private runObservedMutation<Result>(
    operation: ScreenMutationOperation,
    task: (context: ScreenOperationContext, binding: ScreenHostBindingV2) => Promise<Result>,
  ): Promise<Result> {
    if (this.state.phase !== 'ready') {
      return this.rejectOperation(
        operation,
        createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE),
      );
    }
    let binding: ScreenHostBindingV2;
    try {
      binding = this.requireBinding();
    } catch (error) {
      return this.rejectOperation(operation, error);
    }
    this.setState({ pendingMutations: [...this.state.pendingMutations, operation] });
    return this.coordinator
      .runMutation(operation, (context) => task(context, binding))
      .catch((error: unknown) => {
        const normalized = normalizeWorkflowError(error);
        if (normalized.code !== ScreenAdapterErrorCode.ABORTED) {
          this.dispatchError(operation, normalized, binding.projectId);
        }
        throw normalized;
      })
      .finally(() => {
        const index = this.state.pendingMutations.indexOf(operation);
        if (index < 0) return;
        const pendingMutations = [...this.state.pendingMutations];
        pendingMutations.splice(index, 1);
        this.setState({ pendingMutations });
      });
  }

  private runObservedRead<Result>(
    operation: 'export' | 'snapshot-list',
    task: (context: ScreenOperationContext, binding: ScreenHostBindingV2) => Promise<Result>,
    latestOnly = false,
  ): Promise<Result> {
    let binding: ScreenHostBindingV2;
    try {
      binding = this.requireBinding();
    } catch (error) {
      return this.rejectOperation(operation, error);
    }
    return this.coordinator
      .runRead(operation, (context) => task(context, binding), { latestOnly })
      .catch((error: unknown) => {
        const normalized = normalizeWorkflowError(error);
        if (normalized.code !== ScreenAdapterErrorCode.ABORTED) {
          this.dispatchError(operation, normalized, binding.projectId);
        }
        throw normalized;
      });
  }

  private rejectOperation<Result>(operation: ScreenOperation, error: unknown): Promise<Result> {
    const normalized = normalizeWorkflowError(error);
    if (normalized.code !== ScreenAdapterErrorCode.ABORTED) {
      this.dispatchError(operation, normalized, this.binding?.projectId);
    }
    return Promise.reject(normalized);
  }

  private requireBinding(): ScreenHostBindingV2 {
    if (this.state.phase === 'disposed') throw createAbortError();
    if (this.binding === null) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
    return this.binding;
  }

  private requireSession(projectId: string): ScreenHostSessionSnapshotV2 {
    const snapshot = this.session.getSnapshot();
    if (snapshot === null || snapshot.projectId !== projectId) {
      throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
    }
    return snapshot;
  }

  private assertNotDisposed(): void {
    if (this.state.phase === 'disposed') throw createAbortError();
  }

  private assertWritable(): void {
    if (this.readonlyMode) throw createWorkflowError(ScreenAdapterErrorCode.FORBIDDEN);
  }

  private emitDirtyIfChanged(): void {
    const snapshot = this.session.getSnapshot();
    if (snapshot === null || snapshot.dirty === this.lastDirty) return;
    this.lastDirty = snapshot.dirty;
    this.dispatch('nebula-dirty-change', {
      projectId: snapshot.projectId,
      dirty: snapshot.dirty,
    });
  }

  private dispatch(eventName: string, detail: object): void {
    this.eventTarget?.dispatchEvent(
      new CustomEvent(eventName, {
        bubbles: true,
        composed: true,
        detail: structuredClone(detail),
      }),
    );
  }

  private dispatchError(operation: ScreenOperation, error: unknown, projectId?: string): void {
    this.dispatch('nebula-error', {
      ...(projectId === undefined ? {} : { projectId }),
      operation,
      error: toScreenPublicErrorV2(error),
    });
  }

  private rejectReadyWaiters(error: ScreenAdapterErrorV2): void {
    for (const waiter of this.readyWaiters) waiter.reject(error);
    this.readyWaiters.clear();
  }

  private setState(updates: Partial<ScreenHostControllerV2State>): void {
    this.state = { ...this.state, ...updates };
    for (const listener of this.listeners) listener();
  }
}
