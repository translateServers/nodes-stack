import { z } from 'zod';
import {
  deriveScreenHostCapabilities,
  normalizeScreenAdapterError,
  ScreenAdapterErrorCode,
  ScreenExportFileSchema,
  ScreenSnapshotSummaryListSchema,
  ScreenSnapshotSummarySchema,
  toScreenPublicError,
  type ScreenAdapterError,
  type ScreenAdapterErrorCode as ScreenAdapterErrorCodeType,
  type ScreenExportFile,
  type ScreenHostAdapter,
  type ScreenHostCapabilities,
  type ScreenOperation,
  type ScreenPublicError,
  type ScreenSnapshotSummary,
} from '../contracts/adapter.js';
import {
  cloneScreenProjectDraft,
  cloneScreenProjectTransfer,
  parseScreenDocument,
  parseScreenProjectEnvelopeInput,
  SCREEN_TRANSFER_MAX_BYTES,
  ScreenProjectTransferV1Schema,
  type ScreenProjectDraft,
  type ScreenProjectEnvelope,
  type ScreenProjectTransferV1,
} from '../contracts/document.js';
import { ScreenSdkDiagnosticCode, type ScreenSdkDiagnostic } from '../contracts/diagnostics.js';
import { dispatchScreenEditorEvent, type ScreenChangeReason } from '../events.js';
import {
  ScreenOperationCoordinator,
  type ScreenMutationOperation,
  type ScreenOperationContext,
} from './operation-coordinator.js';

export interface ScreenHostSessionSnapshot {
  readonly dirty: boolean;
  readonly draft: ScreenProjectDraft;
  readonly projectId: string;
  readonly revision: string;
}

export type ScreenSessionApplyCommand =
  | {
      envelope: ScreenProjectEnvelope;
      source: 'load' | 'reload' | 'import' | 'snapshot-restore';
    }
  | {
      envelope: ScreenProjectEnvelope;
      source: 'save' | 'publish';
      submittedDraft: ScreenProjectDraft;
    };

export interface ScreenHostSessionPort {
  applyEnvelope(command: ScreenSessionApplyCommand): void;
  clear(): void;
  getSnapshot(): ScreenHostSessionSnapshot | null;
}

export interface PreparedScreenImport {
  readonly kind: 'v1';
  readonly file: File;
  readonly generation: number;
  readonly preview: {
    readonly canvasHeight: number;
    readonly canvasWidth: number;
    readonly componentCount: number;
    readonly name: string;
  };
  readonly projectId: string;
  readonly transfer: ScreenProjectTransferV1;
}

export type ScreenHostControllerPhase =
  | 'waiting'
  | 'loading'
  | 'awaiting-render'
  | 'ready'
  | 'error'
  | 'unsupported'
  | 'disposed';

export interface ScreenHostControllerState {
  readonly capabilities?: ScreenHostCapabilities;
  readonly error?: ScreenPublicError;
  readonly generation: number;
  readonly loadMode?: 'initial' | 'reload' | 'retry';
  readonly pendingMutations: readonly ScreenMutationOperation[];
  readonly phase: ScreenHostControllerPhase;
  readonly projectId?: string;
  readonly retainedProject: boolean;
}

export interface CreateScreenHostControllerOptions {
  eventTarget?: EventTarget;
  session: ScreenHostSessionPort;
}

interface ScreenHostBinding {
  readonly adapter: ScreenHostAdapter;
  readonly projectId: string;
}

class ScreenHostWorkflowError extends Error implements ScreenAdapterError {
  readonly code: ScreenAdapterErrorCodeType;
  readonly diagnostics?: readonly ScreenSdkDiagnostic[];
  readonly recoverable?: boolean;
  readonly serverRevision?: string;

  constructor(
    code: ScreenAdapterErrorCodeType,
    options: {
      diagnostics?: readonly ScreenSdkDiagnostic[];
      recoverable?: boolean;
      serverRevision?: string;
    } = {},
  ) {
    super(code);
    this.name = 'ScreenAdapterError';
    this.code = code;
    this.diagnostics = options.diagnostics;
    this.recoverable = options.recoverable;
    this.serverRevision = options.serverRevision;
  }
}

interface ReadyWaiter {
  reject(error: ScreenAdapterError): void;
  resolve(): void;
}

const JSON_MIME_PATTERN = /^application\/json(?:\s*;\s*charset=[^;]+)?$/i;
const SNAPSHOT_MUTATIONS: ReadonlySet<ScreenMutationOperation> = new Set([
  'snapshot-create',
  'snapshot-restore',
  'snapshot-remove',
  'snapshot-clear',
]);

function createWorkflowError(
  code: ScreenAdapterErrorCodeType,
  options?: ConstructorParameters<typeof ScreenHostWorkflowError>[1],
): ScreenAdapterError {
  return new ScreenHostWorkflowError(code, options);
}

function createValidationDiagnostics(error: z.ZodError): ScreenSdkDiagnostic[] {
  return error.issues.map((issue) => ({
    code: ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
    path: issue.path.map((segment) => (typeof segment === 'symbol' ? '<field>' : segment)),
    severity: 'error',
    message: 'Adapter 返回值字段校验失败。',
  }));
}

function parseAdapterResponse<Result>(schema: z.ZodType<Result>, input: unknown): Result {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION, {
    diagnostics: createValidationDiagnostics(result.error),
  });
}

function parseEnvelope(input: unknown, projectId: string): ScreenProjectEnvelope {
  const result = parseScreenProjectEnvelopeInput(input, projectId);
  if (!result.success) {
    throw createWorkflowError(result.code, { diagnostics: result.diagnostics });
  }
  return structuredClone(result.data);
}

function parseTransfer(input: unknown): ScreenProjectTransferV1 {
  const transfer = parseAdapterResponse(ScreenProjectTransferV1Schema, input);
  const document = parseScreenDocument(transfer.document);
  if (!document.success) {
    throw createWorkflowError(document.code, { diagnostics: document.diagnostics });
  }
  return cloneScreenProjectTransfer({ ...transfer, document: document.data });
}

function createAbortError(): ScreenAdapterError {
  return createWorkflowError(ScreenAdapterErrorCode.ABORTED, { recoverable: true });
}

export class ScreenHostController {
  private readonly coordinator = new ScreenOperationCoordinator();
  private readonly listeners = new Set<() => void>();
  private readonly readyWaiters = new Set<ReadyWaiter>();
  private readonly session: ScreenHostSessionPort;
  private binding: ScreenHostBinding | null = null;
  private currentEnvelope: ScreenProjectEnvelope | null = null;
  private eventTarget?: EventTarget;
  private lastDirty: boolean | undefined;
  private readonlyMode = false;
  private savePromise: Promise<ScreenProjectEnvelope> | null = null;
  private state: ScreenHostControllerState = {
    generation: 0,
    pendingMutations: [],
    phase: 'waiting',
    retainedProject: false,
  };

  constructor(options: CreateScreenHostControllerOptions) {
    this.session = options.session;
    this.eventTarget = options.eventTarget;
  }

  getState(): ScreenHostControllerState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setBinding(projectId: string | undefined, adapter: ScreenHostAdapter | undefined): void {
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
      phase: 'ready',
      loadMode: undefined,
      retainedProject: false,
      error: undefined,
    });
    for (const waiter of this.readyWaiters) waiter.resolve();
    this.readyWaiters.clear();
    this.dispatch('nebula-ready', {
      projectId: this.currentEnvelope.id,
      envelope: this.currentEnvelope,
    });
  }

  retry(): Promise<void> {
    const retained = this.state.retainedProject;
    return this.performLoad('retry', retained);
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

  save(): Promise<ScreenProjectEnvelope> {
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

  publish(): Promise<ScreenProjectEnvelope> {
    try {
      this.assertWritable();
      const binding = this.requireBinding();
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
      const adapter = binding.adapter.publishProject;
      if (adapter === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      const snapshot = this.requireSession(binding.projectId);
      if (snapshot.dirty) throw createWorkflowError(ScreenAdapterErrorCode.DIRTY_STATE);
      const response = await adapter.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const envelope = parseEnvelope(response, binding.projectId);
      this.session.applyEnvelope({
        source: 'publish',
        envelope,
        submittedDraft: cloneScreenProjectDraft(snapshot.draft),
      });
      this.currentEnvelope = structuredClone(envelope);
      this.emitDirtyIfChanged();
      this.dispatch('nebula-publish-success', { projectId: binding.projectId, envelope });
      return structuredClone(envelope);
    });
  }

  async prepareImport(file: File): Promise<PreparedScreenImport> {
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
      const text = await file.text();
      const transfer = parseTransfer(JSON.parse(text) as unknown);
      return {
        kind: 'v1',
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
      const validationError =
        error instanceof SyntaxError
          ? createWorkflowError(ScreenAdapterErrorCode.VALIDATION)
          : error;
      return this.rejectOperation('import', validationError);
    }
  }

  importProject(prepared: PreparedScreenImport): Promise<ScreenProjectEnvelope> {
    return this.runObservedMutation('import', async (context, binding) => {
      this.assertWritable();
      const adapter = binding.adapter.importProject;
      if (adapter === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      if (prepared.generation !== context.generation || prepared.projectId !== binding.projectId) {
        throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION);
      }
      const snapshot = this.requireSession(binding.projectId);
      const transfer = parseTransfer(prepared.transfer);
      const response = await adapter.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        file: prepared.file,
        transfer: cloneScreenProjectTransfer(transfer),
        signal: context.signal,
      });
      context.assertCurrent();
      const envelope = parseEnvelope(response, binding.projectId);
      this.session.applyEnvelope({ source: 'import', envelope });
      this.currentEnvelope = structuredClone(envelope);
      this.emitDirtyIfChanged();
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'import',
        envelope,
      });
      return structuredClone(envelope);
    });
  }

  exportProject(): Promise<ScreenExportFile> {
    return this.runObservedRead('export', async (context, binding) => {
      const adapter = binding.adapter.exportProject;
      if (adapter === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      const snapshot = this.requireSession(binding.projectId);
      const response = await adapter.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const file = parseAdapterResponse(ScreenExportFileSchema, response);
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
        if (snapshots === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
        const response = await snapshots.list({
          projectId: binding.projectId,
          signal: context.signal,
        });
        context.assertCurrent();
        return structuredClone(parseAdapterResponse(ScreenSnapshotSummaryListSchema, response));
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
    const initialSnapshot = this.session.getSnapshot();
    return this.runObservedMutation('snapshot-create', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      const current = this.requireSession(binding.projectId);
      const draft = cloneScreenProjectDraft(initialSnapshot?.draft ?? current.draft);
      const response = await snapshots.create({
        projectId: binding.projectId,
        revision: current.revision,
        draft,
        signal: context.signal,
      });
      context.assertCurrent();
      const snapshot = structuredClone(parseAdapterResponse(ScreenSnapshotSummarySchema, response));
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'snapshot-create',
        snapshot,
      });
      return snapshot;
    });
  }

  restoreSnapshot(snapshotId: string): Promise<ScreenProjectEnvelope> {
    return this.runObservedMutation('snapshot-restore', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      const current = this.requireSession(binding.projectId);
      const response = await snapshots.restore({
        projectId: binding.projectId,
        snapshotId,
        revision: current.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const envelope = parseEnvelope(response, binding.projectId);
      this.session.applyEnvelope({ source: 'snapshot-restore', envelope });
      this.currentEnvelope = structuredClone(envelope);
      this.emitDirtyIfChanged();
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'snapshot-restore',
        envelope,
      });
      return structuredClone(envelope);
    });
  }

  removeSnapshot(snapshotId: string): Promise<void> {
    return this.runObservedMutation('snapshot-remove', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      const response = await snapshots.remove({
        projectId: binding.projectId,
        snapshotId,
        signal: context.signal,
      });
      context.assertCurrent();
      parseAdapterResponse(z.undefined(), response);
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
      if (snapshots === undefined) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      const response = await snapshots.clear({
        projectId: binding.projectId,
        signal: context.signal,
      });
      context.assertCurrent();
      parseAdapterResponse(z.undefined(), response);
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
      draft: cloneScreenProjectDraft(snapshot.draft),
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
    adapter: ScreenHostAdapter | undefined,
  ): void {
    if (this.state.phase === 'disposed') return;
    if (projectId === undefined || projectId.trim() === '' || adapter === undefined) {
      if (this.binding !== null) {
        this.coordinator.advanceGeneration();
        this.savePromise = null;
        this.rejectReadyWaiters(createAbortError());
        this.binding = null;
        this.currentEnvelope = null;
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
      capabilities = deriveScreenHostCapabilities(adapter);
    } catch (error) {
      this.coordinator.advanceGeneration();
      this.savePromise = null;
      this.rejectReadyWaiters(createAbortError());
      this.binding = null;
      this.currentEnvelope = null;
      this.session.clear();
      const normalized = normalizeScreenAdapterError(error);
      this.setState({
        capabilities: undefined,
        error: toScreenPublicError(normalized),
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
    this.session.clear();
    this.setState({ capabilities, projectId });
    void this.performLoad('initial', false).catch(() => undefined);
  }

  private performLoad(
    mode: 'initial' | 'reload' | 'retry',
    retainedProject: boolean,
  ): Promise<void> {
    let binding: ScreenHostBinding;
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
          const envelope = parseEnvelope(response, binding.projectId);
          this.session.applyEnvelope({
            source: mode === 'reload' ? 'reload' : 'load',
            envelope,
          });
          this.currentEnvelope = structuredClone(envelope);
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
        const normalized = normalizeScreenAdapterError(error);
        if (normalized.code === ScreenAdapterErrorCode.ABORTED) throw normalized;
        const publicError = toScreenPublicError(normalized);
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

  private performSave(): Promise<ScreenProjectEnvelope> {
    return this.runObservedMutation('save', async (context, binding) => {
      this.assertWritable();
      const snapshot = this.requireSession(binding.projectId);
      const submittedDraft = cloneScreenProjectDraft(snapshot.draft);
      const response = await binding.adapter.saveProject({
        projectId: binding.projectId,
        revision: snapshot.revision,
        draft: cloneScreenProjectDraft(submittedDraft),
        signal: context.signal,
      });
      context.assertCurrent();
      const envelope = parseEnvelope(response, binding.projectId);
      this.session.applyEnvelope({ source: 'save', envelope, submittedDraft });
      this.currentEnvelope = structuredClone(envelope);
      this.emitDirtyIfChanged();
      this.dispatch('nebula-save-success', { projectId: binding.projectId, envelope });
      return structuredClone(envelope);
    });
  }

  private runObservedMutation<Result>(
    operation: ScreenMutationOperation,
    task: (context: ScreenOperationContext, binding: ScreenHostBinding) => Promise<Result>,
  ): Promise<Result> {
    if (this.state.phase !== 'ready') {
      return this.rejectOperation(
        operation,
        createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE),
      );
    }
    let binding: ScreenHostBinding;
    try {
      binding = this.requireBinding();
    } catch (error) {
      return this.rejectOperation(operation, error);
    }
    this.setState({ pendingMutations: [...this.state.pendingMutations, operation] });
    return this.coordinator
      .runMutation(operation, (context) => task(context, binding))
      .catch((error: unknown) => {
        const normalized = normalizeScreenAdapterError(error);
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
    task: (context: ScreenOperationContext, binding: ScreenHostBinding) => Promise<Result>,
    latestOnly = false,
  ): Promise<Result> {
    let binding: ScreenHostBinding;
    try {
      binding = this.requireBinding();
    } catch (error) {
      return this.rejectOperation(operation, error);
    }
    return this.coordinator
      .runRead(operation, (context) => task(context, binding), { latestOnly })
      .catch((error: unknown) => {
        const normalized = normalizeScreenAdapterError(error);
        if (normalized.code !== ScreenAdapterErrorCode.ABORTED) {
          this.dispatchError(operation, normalized, binding.projectId);
        }
        throw normalized;
      });
  }

  private rejectOperation<Result>(operation: ScreenOperation, error: unknown): Promise<Result> {
    const normalized = normalizeScreenAdapterError(error);
    if (normalized.code !== ScreenAdapterErrorCode.ABORTED) {
      this.dispatchError(operation, normalized, this.binding?.projectId);
    }
    return Promise.reject(normalized);
  }

  private requireBinding(): ScreenHostBinding {
    if (this.state.phase === 'disposed') throw createAbortError();
    if (this.binding === null) throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
    return this.binding;
  }

  private requireSession(projectId: string): ScreenHostSessionSnapshot {
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

  private dispatch<EventName extends Parameters<typeof dispatchScreenEditorEvent>[1]>(
    eventName: EventName,
    detail: Parameters<typeof dispatchScreenEditorEvent<EventName>>[2],
  ): void {
    if (this.eventTarget !== undefined) {
      dispatchScreenEditorEvent(this.eventTarget, eventName, detail);
    }
  }

  private dispatchError(operation: ScreenOperation, error: unknown, projectId?: string): void {
    this.dispatch('nebula-error', {
      ...(projectId === undefined ? {} : { projectId }),
      operation,
      error: toScreenPublicError(error),
    });
  }

  private rejectReadyWaiters(error: ScreenAdapterError): void {
    for (const waiter of this.readyWaiters) waiter.reject(error);
    this.readyWaiters.clear();
  }

  private setState(updates: Partial<ScreenHostControllerState>): void {
    this.state = { ...this.state, ...updates };
    for (const listener of this.listeners) listener();
  }
}
