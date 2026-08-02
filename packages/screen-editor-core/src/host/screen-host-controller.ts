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
  type ScreenAdapterErrorCode as ScreenAdapterErrorCodeValue,
  type ScreenExportFile,
  type ScreenHostAdapter,
  type ScreenHostCapabilities,
  type ScreenOperation,
  type ScreenPublicError,
  type ScreenSnapshotSummary,
} from '../contracts/adapter.js';
import {
  canPublishWithMigration,
  cloneScreenProjectDraft,
  cloneScreenProjectTransfer,
  migrateLegacyScreenProjectEnvelopeInput,
  parseScreenProjectEnvelopeInput,
  parseScreenProjectExport,
  parseScreenProjectTransfer,
  SCREEN_TRANSFER_MAX_BYTES,
  type ScreenProjectDraft,
  type ScreenProjectEnvelope,
  type ScreenProjectTransfer,
} from '../contracts/document.js';
import { createDiagnostic, type ScreenSdkDiagnostic } from '../contracts/diagnostics.js';
import { dispatchScreenEditorEvent, type ScreenChangeReason } from '../events.js';
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

export interface ScreenHostSessionSnapshot {
  readonly dirty: boolean;
  readonly draft: ScreenProjectDraft;
  readonly projectId: string;
  readonly revision: string;
}

export type ScreenSessionApplyCommand =
  | {
      readonly envelope: ScreenProjectEnvelope;
      readonly source: 'load' | 'reload' | 'import' | 'snapshot-restore';
    }
  | {
      readonly envelope: ScreenProjectEnvelope;
      readonly source: 'save' | 'publish';
      readonly submittedDraft: ScreenProjectDraft;
    };

export interface ScreenHostSessionPort {
  readonly applyEnvelope: (command: ScreenSessionApplyCommand) => void;
  readonly clear: () => void;
  readonly getSnapshot: () => ScreenHostSessionSnapshot | null;
}

export interface PreparedScreenImport {
  readonly kind: 'screen-project';
  readonly file: File;
  readonly generation: number;
  readonly preview: {
    readonly canvasHeight: number;
    readonly canvasWidth: number;
    readonly componentCount: number;
    readonly name: string;
  };
  readonly projectId: string;
  readonly transfer: ScreenProjectTransfer;
}

export interface ScreenHostControllerState extends ScreenHostControllerPortState {
  readonly error?: ScreenPublicError;
}

export interface CreateScreenHostControllerOptions {
  readonly eventTarget?: EventTarget;
  readonly registry: ScreenComponentInstanceRegistry;
  readonly session: ScreenHostSessionPort;
}

interface ScreenHostBinding {
  readonly adapter: ScreenHostAdapter;
  readonly projectId: string;
}

interface ParsedEnvelope {
  readonly envelope: ScreenProjectEnvelope;
  readonly migrationPending: boolean;
}

interface ReadyWaiter {
  readonly reject: (error: ScreenAdapterError) => void;
  readonly resolve: () => void;
}

const jsonMimePattern = /^application\/json(?:\s*;\s*charset=[^;]+)?$/i;
const snapshotMutations: ReadonlySet<ScreenMutationOperation> = new Set([
  'snapshot-create',
  'snapshot-restore',
  'snapshot-remove',
  'snapshot-clear',
]);

class ScreenHostWorkflowError extends Error implements ScreenAdapterError {
  readonly code: ScreenAdapterErrorCodeValue;
  readonly diagnostics?: readonly ScreenSdkDiagnostic[];
  readonly recoverable?: boolean;
  readonly serverRevision?: string;

  constructor(
    code: ScreenAdapterErrorCodeValue,
    options: {
      readonly diagnostics?: readonly ScreenSdkDiagnostic[];
      readonly recoverable?: boolean;
      readonly serverRevision?: string;
    } = {},
  ) {
    super(code);
    this.name = 'ScreenHostWorkflowError';
    this.code = code;
    this.diagnostics = options.diagnostics;
    this.recoverable = options.recoverable;
    this.serverRevision = options.serverRevision;
  }
}

function createWorkflowError(
  code: ScreenAdapterErrorCodeValue,
  options?: ConstructorParameters<typeof ScreenHostWorkflowError>[1],
): ScreenHostWorkflowError {
  return new ScreenHostWorkflowError(code, options);
}

function createAbortError(): ScreenHostWorkflowError {
  return createWorkflowError(ScreenAdapterErrorCode.ABORTED, { recoverable: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDocumentSchemaVersion(value: unknown): number | undefined {
  if (!isRecord(value) || !isRecord(value.document)) {
    return undefined;
  }
  return typeof value.document.schemaVersion === 'number'
    ? value.document.schemaVersion
    : undefined;
}

function createValidationDiagnostics(error: z.ZodError): ScreenSdkDiagnostic[] {
  return error.issues.map((issue) =>
    createDiagnostic(
      'INVALID_DOCUMENT',
      issue.path.map((segment) => (typeof segment === 'symbol' ? '<field>' : segment)),
      'Adapter response field validation failed.',
    ),
  );
}

function parseAdapterResponse<Result>(schema: z.ZodType<Result>, input: unknown): Result {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  throw createWorkflowError(ScreenAdapterErrorCode.VALIDATION, {
    diagnostics: createValidationDiagnostics(parsed.error),
  });
}

function parseTransfer(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
): ScreenProjectTransfer {
  const parsed = parseScreenProjectTransfer(input, registry);
  if (!parsed.success) {
    throw createWorkflowError(parsed.code, { diagnostics: parsed.diagnostics });
  }
  return cloneScreenProjectTransfer(parsed.data);
}

function parseEnvelope(
  input: unknown,
  registry: ScreenComponentInstanceRegistry,
  projectId: string,
): ParsedEnvelope {
  const migrated =
    getDocumentSchemaVersion(input) === 1
      ? migrateLegacyScreenProjectEnvelopeInput(input, registry)
      : undefined;
  if (migrated !== undefined && !migrated.success) {
    throw createWorkflowError(migrated.code, { diagnostics: migrated.diagnostics });
  }

  const parsed = parseScreenProjectEnvelopeInput(migrated?.envelope ?? input, registry, projectId);
  if (!parsed.success) {
    throw createWorkflowError(parsed.code, { diagnostics: parsed.diagnostics });
  }

  return {
    envelope: structuredClone(parsed.data),
    migrationPending: migrated?.migrationPending ?? false,
  };
}

export class ScreenHostController implements ScreenHostControllerPort {
  private readonly coordinator = new ScreenOperationCoordinator();
  private readonly listeners = new Set<() => void>();
  private readonly readyWaiters = new Set<ReadyWaiter>();
  private readonly registry: ScreenComponentInstanceRegistry;
  private readonly session: ScreenHostSessionPort;
  private binding: ScreenHostBinding | null = null;
  private currentEnvelope: ScreenProjectEnvelope | null = null;
  private eventTarget?: EventTarget;
  private lastDirty: boolean | undefined;
  private migrationPending = false;
  private readonlyMode = false;
  private savePromise: Promise<ScreenProjectEnvelope> | null = null;
  private state: ScreenHostControllerState = {
    generation: 0,
    pendingMutations: [],
    phase: 'waiting',
    retainedProject: false,
  };

  constructor(options: CreateScreenHostControllerOptions) {
    this.eventTarget = options.eventTarget;
    this.registry = options.registry;
    this.session = options.session;
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

  setReadonly(isReadonly: boolean): void {
    this.readonlyMode = isReadonly;
  }

  whenReady(): Promise<void> {
    if (this.state.phase === 'ready') {
      return Promise.resolve();
    }
    if (this.state.phase === 'error' || this.state.phase === 'unsupported') {
      const error = this.state.error;
      return Promise.reject(
        error === undefined
          ? createWorkflowError(ScreenAdapterErrorCode.UNKNOWN)
          : createWorkflowError(error.code, {
              diagnostics: error.diagnostics,
              recoverable: error.recoverable,
              serverRevision: error.serverRevision,
            }),
      );
    }
    if (this.state.phase === 'disposed') {
      return Promise.reject(createAbortError());
    }
    return new Promise((resolve, reject) => this.readyWaiters.add({ resolve, reject }));
  }

  markRendered(): void {
    if (this.state.phase !== 'awaiting-render' || this.currentEnvelope === null) {
      return;
    }
    this.setState({
      error: undefined,
      loadMode: undefined,
      phase: 'ready',
      retainedProject: false,
    });
    for (const waiter of this.readyWaiters) {
      waiter.resolve();
    }
    this.readyWaiters.clear();
    this.dispatch('nebula-ready', {
      projectId: this.currentEnvelope.id,
      envelope: this.currentEnvelope,
    });
  }

  retry(): Promise<void> {
    return this.performLoad('retry', this.state.retainedProject);
  }

  reload(options: { readonly discardChanges?: boolean } = {}): Promise<void> {
    if (this.session.getSnapshot()?.dirty === true && options.discardChanges !== true) {
      return this.rejectOperation(
        'reload',
        createWorkflowError(ScreenAdapterErrorCode.DIRTY_STATE, { recoverable: true }),
      );
    }
    return this.performLoad('reload', true);
  }

  save(): Promise<ScreenProjectEnvelope> {
    if (this.savePromise !== null) {
      return this.savePromise;
    }
    const promise = this.performSave();
    this.savePromise = promise;
    void promise.finally(() => {
      if (this.savePromise === promise) {
        this.savePromise = null;
      }
    });
    return promise;
  }

  publish(): Promise<ScreenProjectEnvelope> {
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
      const publishProject = binding.adapter.publishProject;
      if (publishProject === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const snapshot = this.requireSession(binding.projectId);
      const response = await publishProject.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.applyEnvelope({
        source: 'publish',
        envelope: parsed.envelope,
        submittedDraft: cloneScreenProjectDraft(snapshot.draft),
      });
      this.migrationPending = false;
      this.dispatch('nebula-publish-success', {
        projectId: binding.projectId,
        envelope: parsed.envelope,
      });
      return structuredClone(parsed.envelope);
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
    if (!file.name.toLowerCase().endsWith('.json') && !jsonMimePattern.test(file.type)) {
      return this.rejectOperation('import', createWorkflowError(ScreenAdapterErrorCode.VALIDATION));
    }
    if (file.size > SCREEN_TRANSFER_MAX_BYTES) {
      return this.rejectOperation('import', createWorkflowError(ScreenAdapterErrorCode.VALIDATION));
    }

    try {
      const transfer = parseTransfer(JSON.parse(await file.text()) as unknown, this.registry);
      return {
        kind: 'screen-project',
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

  importProject(prepared: PreparedScreenImport): Promise<ScreenProjectEnvelope> {
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
      const response = await importProject.call(binding.adapter, {
        projectId: binding.projectId,
        revision: snapshot.revision,
        file: prepared.file,
        transfer: parseTransfer(prepared.transfer, this.registry),
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.applyEnvelope({ source: 'import', envelope: parsed.envelope });
      this.migrationPending = false;
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
      const exportResult = parseScreenProjectExport(response, this.registry);
      if (!exportResult.success) {
        throw createWorkflowError(exportResult.code, { diagnostics: exportResult.diagnostics });
      }
      const file = parseAdapterResponse(ScreenExportFileSchema, {
        fileName: exportResult.data.fileName,
        blob: new Blob([JSON.stringify(exportResult.data.transfer)], { type: 'application/json' }),
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
        return structuredClone(parseAdapterResponse(ScreenSnapshotSummaryListSchema, response));
      },
      true,
    );
  }

  cancelSnapshotList(): void {
    this.coordinator.cancelRead('snapshot-list');
  }

  cancelSnapshotMutations(): void {
    this.coordinator.cancelMutations(snapshotMutations);
  }

  createSnapshot(): Promise<ScreenSnapshotSummary> {
    return this.runObservedMutation('snapshot-create', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const snapshot = this.requireSession(binding.projectId);
      const response = await snapshots.create({
        projectId: binding.projectId,
        revision: snapshot.revision,
        draft: cloneScreenProjectDraft(snapshot.draft),
        signal: context.signal,
      });
      context.assertCurrent();
      const created = structuredClone(parseAdapterResponse(ScreenSnapshotSummarySchema, response));
      this.dispatch('nebula-operation-success', {
        projectId: binding.projectId,
        operation: 'snapshot-create',
        snapshot: created,
      });
      return created;
    });
  }

  restoreSnapshot(snapshotId: string): Promise<ScreenProjectEnvelope> {
    return this.runObservedMutation('snapshot-restore', async (context, binding) => {
      this.assertWritable();
      const snapshots = binding.adapter.snapshots;
      if (snapshots === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
      const snapshot = this.requireSession(binding.projectId);
      const response = await snapshots.restore({
        projectId: binding.projectId,
        snapshotId,
        revision: snapshot.revision,
        signal: context.signal,
      });
      context.assertCurrent();
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.applyEnvelope({ source: 'snapshot-restore', envelope: parsed.envelope });
      this.migrationPending = false;
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
      if (snapshots === undefined) {
        throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
      }
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
    if (snapshot === null) {
      return;
    }
    this.dispatch('nebula-change', {
      projectId: snapshot.projectId,
      draft: cloneScreenProjectDraft(snapshot.draft),
      reason,
    });
    this.emitDirtyIfChanged();
  }

  notifySelection(componentIds: readonly string[]): void {
    const snapshot = this.session.getSnapshot();
    if (snapshot !== null) {
      this.dispatch('nebula-selection-change', {
        projectId: snapshot.projectId,
        componentIds: [...componentIds],
      });
    }
  }

  dispose(): void {
    if (this.state.phase === 'disposed') {
      return;
    }
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
    if (this.state.phase === 'disposed') {
      return;
    }
    if (projectId === undefined || projectId.trim() === '' || adapter === undefined) {
      this.clearBinding();
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
    if (this.binding?.projectId === projectId && this.binding.adapter === adapter) {
      return;
    }

    let capabilities: ScreenHostCapabilities;
    try {
      capabilities = deriveScreenHostCapabilities(adapter);
    } catch (error) {
      this.clearBinding();
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

    if (this.binding !== null) {
      this.rejectReadyWaiters(createAbortError());
    }
    this.binding = { projectId, adapter };
    this.currentEnvelope = null;
    this.lastDirty = undefined;
    this.migrationPending = false;
    this.session.clear();
    this.setState({ capabilities, projectId });
    void this.performLoad('initial', false).catch(() => undefined);
  }

  private clearBinding(): void {
    if (this.binding === null) {
      return;
    }
    this.coordinator.advanceGeneration();
    this.savePromise = null;
    this.rejectReadyWaiters(createAbortError());
    this.binding = null;
    this.currentEnvelope = null;
    this.migrationPending = false;
    this.session.clear();
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
          const parsed = parseEnvelope(response, this.registry, binding.projectId);
          this.applyEnvelope({
            source: mode === 'reload' ? 'reload' : 'load',
            envelope: parsed.envelope,
          });
          this.migrationPending = parsed.migrationPending;
          this.lastDirty = false;
          this.setState({ error: undefined, phase: 'awaiting-render', retainedProject: false });
        },
        { latestOnly: true },
      )
      .catch((error: unknown) => {
        const normalized = normalizeScreenAdapterError(error);
        if (normalized.code === ScreenAdapterErrorCode.ABORTED) {
          throw normalized;
        }
        this.rejectReadyWaiters(normalized);
        this.setState({
          error: toScreenPublicError(normalized),
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
      const parsed = parseEnvelope(response, this.registry, binding.projectId);
      this.applyEnvelope({ source: 'save', envelope: parsed.envelope, submittedDraft });
      this.migrationPending = false;
      this.dispatch('nebula-save-success', {
        projectId: binding.projectId,
        envelope: parsed.envelope,
      });
      return structuredClone(parsed.envelope);
    });
  }

  private applyEnvelope(command: ScreenSessionApplyCommand): void {
    this.session.applyEnvelope(command);
    this.currentEnvelope = structuredClone(command.envelope);
    this.emitDirtyIfChanged();
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
      .finally(() => this.clearPendingMutation(operation));
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

  private clearPendingMutation(operation: ScreenMutationOperation): void {
    const index = this.state.pendingMutations.indexOf(operation);
    if (index < 0) {
      return;
    }
    const pendingMutations = [...this.state.pendingMutations];
    pendingMutations.splice(index, 1);
    this.setState({ pendingMutations });
  }

  private rejectOperation<Result>(operation: ScreenOperation, error: unknown): Promise<Result> {
    const normalized = normalizeScreenAdapterError(error);
    if (normalized.code !== ScreenAdapterErrorCode.ABORTED) {
      this.dispatchError(operation, normalized, this.binding?.projectId);
    }
    return Promise.reject(normalized);
  }

  private requireBinding(): ScreenHostBinding {
    if (this.state.phase === 'disposed') {
      throw createAbortError();
    }
    if (this.binding === null) {
      throw createWorkflowError(ScreenAdapterErrorCode.UNAVAILABLE);
    }
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
    if (this.state.phase === 'disposed') {
      throw createAbortError();
    }
  }

  private assertWritable(): void {
    if (this.readonlyMode) {
      throw createWorkflowError(ScreenAdapterErrorCode.FORBIDDEN);
    }
  }

  private emitDirtyIfChanged(): void {
    const snapshot = this.session.getSnapshot();
    if (snapshot === null || snapshot.dirty === this.lastDirty) {
      return;
    }
    this.lastDirty = snapshot.dirty;
    this.dispatch('nebula-dirty-change', { projectId: snapshot.projectId, dirty: snapshot.dirty });
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
    for (const waiter of this.readyWaiters) {
      waiter.reject(error);
    }
    this.readyWaiters.clear();
  }

  private setState(updates: Partial<ScreenHostControllerState>): void {
    this.state = { ...this.state, ...updates };
    for (const listener of this.listeners) {
      listener();
    }
  }
}
