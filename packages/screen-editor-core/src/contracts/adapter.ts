import {
  checkJsonValue,
  type ScreenComponentJsonValue,
  type ScreenComponentValidationDiagnostic,
} from '@nebula/screen-component-sdk';
import { z } from 'zod';

import {
  ScreenProjectDraftSchema,
  ScreenProjectEnvelopeInputSchema,
  ScreenProjectExportSchema,
  ScreenProjectTransferSchema,
  type ScreenProjectDraft,
  type ScreenProjectEnvelopeInput,
  type ScreenProjectExport,
  type ScreenProjectTransfer,
} from './document.js';
import {
  ScreenSdkDiagnosticCode,
  ScreenSdkDiagnosticSchema,
  type ScreenSdkDiagnostic,
  type ScreenSdkDiagnosticCode as ScreenSdkDiagnosticCodeValue,
} from './diagnostics.js';
import {
  isScreenComponentRegistryError,
  type ScreenComponentRegistryError,
} from '../registry/registry-error.js';

export interface LoadProjectInput {
  readonly projectId: string;
  readonly signal: AbortSignal;
}

export interface SaveProjectInput extends LoadProjectInput {
  readonly revision: string;
  readonly draft: ScreenProjectDraft;
}

export interface PublishProjectInput extends LoadProjectInput {
  readonly revision: string;
}

export interface ImportProjectInput extends PublishProjectInput {
  readonly file: File;
  readonly transfer: ScreenProjectTransfer;
}

export type ExportProjectInput = PublishProjectInput;
export type SnapshotListInput = LoadProjectInput;

export interface SnapshotCreateInput extends SnapshotListInput {
  readonly revision: string;
  readonly draft: ScreenProjectDraft;
}

export interface SnapshotRestoreInput extends SnapshotListInput {
  readonly snapshotId: string;
  readonly revision: string;
}

export interface SnapshotRemoveInput extends SnapshotListInput {
  readonly snapshotId: string;
}

export type SnapshotClearInput = SnapshotListInput;

export const ScreenSnapshotSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.iso.datetime({ offset: true }),
    componentCount: z.number().int().nonnegative(),
    canvasWidth: z.number().int().positive(),
    canvasHeight: z.number().int().positive(),
  })
  .strict();

export type ScreenSnapshotSummary = z.infer<typeof ScreenSnapshotSummarySchema>;
export const ScreenSnapshotSummaryListSchema = z.array(ScreenSnapshotSummarySchema);

const safeJsonFileNamePattern = /^[^/\\]{1,255}\.json$/i;
const jsonMimePattern = /^application\/json(?:\s*;\s*charset=[^;]+)?$/i;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

export const ScreenExportFileSchema = z
  .object({
    fileName: z
      .string()
      .max(255)
      .regex(safeJsonFileNamePattern, 'Export file name must be a safe .json basename.')
      .refine((value) => !value.includes('..'), 'Export file name cannot contain path segments.')
      .refine(
        (value) => !containsControlCharacter(value),
        'Export file name cannot contain controls.',
      ),
    blob: z
      .instanceof(Blob)
      .refine(
        (value) => jsonMimePattern.test(value.type),
        'Export blob must use a JSON MIME type.',
      ),
  })
  .strict();

export type ScreenExportFile = z.infer<typeof ScreenExportFileSchema>;

export interface ScreenSnapshotAdapter {
  readonly list: (input: SnapshotListInput) => Promise<ScreenSnapshotSummary[]>;
  readonly create: (input: SnapshotCreateInput) => Promise<ScreenSnapshotSummary>;
  readonly restore: (input: SnapshotRestoreInput) => Promise<ScreenProjectEnvelopeInput>;
  readonly remove: (input: SnapshotRemoveInput) => Promise<void>;
  readonly clear: (input: SnapshotClearInput) => Promise<void>;
}

export const SCREEN_HOST_RESOURCE_MAX_RESPONSE_BYTES = 1_048_576;

export interface ScreenHostResourceIntent {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly params?: Readonly<Record<string, ScreenComponentJsonValue>>;
  readonly binding?: Readonly<Record<string, ScreenComponentJsonValue>>;
}

export interface ScreenHostResourceSummary {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly name: string;
  readonly metadata?: Readonly<Record<string, ScreenComponentJsonValue>>;
}

export type ScreenDataContextSource = 'design' | 'preview' | 'viewer';

export interface ScreenDataExecutionContext {
  readonly contextId: string;
  readonly projectId: string;
  readonly source: ScreenDataContextSource;
}

export interface ScreenHostDataAdapter {
  readonly listResources: (input: {
    readonly resourceType: string;
    readonly signal?: AbortSignal;
  }) => Promise<readonly ScreenHostResourceSummary[]>;
  readonly openContext: (context: ScreenDataExecutionContext) => Promise<void>;
  readonly syncContext: (context: ScreenDataExecutionContext) => Promise<void>;
  readonly closeContext: (contextId: string) => Promise<void>;
  readonly execute: (
    request: {
      readonly contextId: string;
      readonly componentId: string;
      readonly intent: ScreenHostResourceIntent;
    },
    signal: AbortSignal,
  ) => Promise<{ readonly data: ScreenComponentJsonValue }>;
}

export interface ScreenHostResourceExecuteRequest {
  readonly contextId: string;
  readonly componentId: string;
  readonly intent: ScreenHostResourceIntent;
}

export interface ScreenHostResourceExecuteResult {
  readonly data: ScreenComponentJsonValue;
}

export interface ScreenHostAdapter {
  readonly loadProject: (input: LoadProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  readonly saveProject: (input: SaveProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  readonly publishProject?: (input: PublishProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  readonly importProject?: (input: ImportProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  readonly exportProject?: (input: ExportProjectInput) => Promise<ScreenProjectExport>;
  readonly snapshots?: ScreenSnapshotAdapter;
  readonly data?: ScreenHostDataAdapter;
}

export interface ScreenHostCapabilities {
  readonly load: true;
  readonly save: true;
  readonly publish: boolean;
  readonly import: boolean;
  readonly export: boolean;
  readonly snapshots: boolean;
  readonly data: boolean;
}

export const ScreenAdapterErrorCode = {
  CONFLICT: 'CONFLICT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION: 'VALIDATION',
  UNSUPPORTED_DOCUMENT_FEATURE: 'UNSUPPORTED_DOCUMENT_FEATURE',
  UNAVAILABLE: 'UNAVAILABLE',
  DIRTY_STATE: 'DIRTY_STATE',
  ABORTED: 'ABORTED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ScreenAdapterErrorCode =
  (typeof ScreenAdapterErrorCode)[keyof typeof ScreenAdapterErrorCode];
export const ScreenAdapterErrorCodeSchema = z.enum(ScreenAdapterErrorCode);

export interface ScreenAdapterError extends Error {
  readonly code: ScreenAdapterErrorCode;
  readonly recoverable?: boolean;
  readonly serverRevision?: string;
  readonly diagnostics?: readonly ScreenSdkDiagnostic[];
}

export interface ScreenPublicError {
  readonly code: ScreenAdapterErrorCode;
  readonly message: string;
  readonly recoverable?: boolean;
  readonly serverRevision?: string;
  readonly diagnostics?: readonly ScreenSdkDiagnostic[];
}

export const ScreenOperation = {
  LOAD: 'load',
  RELOAD: 'reload',
  SAVE: 'save',
  PUBLISH: 'publish',
  IMPORT: 'import',
  EXPORT: 'export',
  SNAPSHOT_LIST: 'snapshot-list',
  SNAPSHOT_CREATE: 'snapshot-create',
  SNAPSHOT_RESTORE: 'snapshot-restore',
  SNAPSHOT_REMOVE: 'snapshot-remove',
  SNAPSHOT_CLEAR: 'snapshot-clear',
  PROJECT_CHANGE: 'project-change',
  VALIDATE: 'validate',
} as const;

export type ScreenOperation = (typeof ScreenOperation)[keyof typeof ScreenOperation];
export const ScreenOperationSchema = z.enum(ScreenOperation);

const safeDiagnosticPathSegments: ReadonlySet<string> = new Set([
  'id',
  'name',
  'description',
  'status',
  'revision',
  'document',
  'schemaVersion',
  'canvas',
  'components',
  'type',
  'props',
  'dataSource',
  'globalVariables',
  'blueprint',
  'nodes',
  'edges',
  'kind',
  'globalType',
  'config',
  'source',
  'sourceHandle',
  'target',
  'targetHandle',
  'componentId',
  'targetComponentId',
  'expression',
  'apiVersion',
  'implementationVersion',
  'tagName',
  'category',
  'icon',
  'defaultSize',
  'order',
  'keywords',
  'manifest',
  'events',
  'propsSchema',
  'properties',
  'items',
  'required',
  'additionalProperties',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'enum',
  'const',
  'propertyPanel',
  'sections',
  'fields',
  'pointer',
  'control',
  'label',
]);

const safeDiagnosticMessages: Record<ScreenSdkDiagnosticCodeValue, string> = {
  INVALID_DOCUMENT: 'Document field validation failed.',
  UNSUPPORTED_SCHEMA_VERSION: 'Document version is not supported.',
  UNKNOWN_COMPONENT_TYPE: 'Component type is not supported.',
  INVALID_COMPONENT_PROPS: 'Component properties do not meet the contract.',
  UNSUPPORTED_DATA_SOURCE: 'Data source type is not supported.',
  UNSUPPORTED_GLOBAL_VARIABLE_TYPE: 'Global variable type is not supported.',
  UNSUPPORTED_BLUEPRINT_NODE: 'Blueprint node is not supported.',
  UNSUPPORTED_BLUEPRINT_EVENT: 'Blueprint event is not supported.',
  UNSUPPORTED_BLUEPRINT_ACTION: 'Blueprint action is not supported.',
  DANGLING_COMPONENT_REFERENCE: 'Document contains a dangling component reference.',
  INVALID_COMPONENT_MANIFEST: 'Component manifest validation failed.',
  INVALID_BUILTIN_COMPONENT_TYPE: 'Built-in component type is not supported.',
  UNSUPPORTED_COMPONENT_API_VERSION: 'Component API version is not supported.',
  DUPLICATE_COMPONENT_TYPE: 'Component type is already registered.',
  DUPLICATE_COMPONENT_TAG_NAME: 'Component tag name is already registered.',
  COMPONENT_DEFINE_FAILED: 'Component definition failed.',
  MISSING_COMPONENT_DEFINITION: 'Component type is not defined in the registry.',
  UNSUPPORTED_COMPONENT_CAPABILITY: 'The component does not support this configuration.',
  INVALID_COMPONENT_EVENT: 'Blueprint event is not declared by the component.',
};

const publicErrorMessages: Record<ScreenAdapterErrorCode, string> = {
  CONFLICT: 'The project was updated elsewhere. Reload and try again.',
  NOT_FOUND: 'The project or resource was not found.',
  UNAUTHORIZED: 'The current identity is invalid.',
  FORBIDDEN: 'You do not have permission for this operation.',
  VALIDATION: 'Data validation failed.',
  UNSUPPORTED_DOCUMENT_FEATURE: 'The document contains unsupported features.',
  UNAVAILABLE: 'The host did not provide this capability.',
  DIRTY_STATE: 'There are unsaved changes.',
  ABORTED: 'The operation was cancelled.',
  UNKNOWN: 'The operation failed. Try again later.',
};

class NormalizedScreenAdapterError extends Error implements ScreenAdapterError {
  readonly code: ScreenAdapterErrorCode;
  readonly recoverable?: boolean;
  readonly serverRevision?: string;
  readonly diagnostics?: readonly ScreenSdkDiagnostic[];

  constructor(
    message: string,
    options: {
      readonly code: ScreenAdapterErrorCode;
      readonly recoverable?: boolean;
      readonly serverRevision?: string;
      readonly diagnostics?: readonly ScreenSdkDiagnostic[];
    },
  ) {
    super(message);
    this.name = 'ScreenAdapterError';
    this.code = options.code;
    this.recoverable = options.recoverable;
    this.serverRevision = options.serverRevision;
    this.diagnostics = options.diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

function cloneVerifiedJsonValue(value: unknown): ScreenComponentJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneVerifiedJsonValue(item));
  }

  if (isRecord(value)) {
    const clone: Record<string, ScreenComponentJsonValue> = {};
    for (const key of Object.keys(value)) {
      clone[key] = cloneVerifiedJsonValue(value[key]);
    }
    return clone;
  }

  throw new TypeError('Value is outside the JSON boundary.');
}

export function cloneScreenComponentJsonValue(
  value: unknown,
): ScreenComponentJsonValue | undefined {
  const diagnostics: ScreenComponentValidationDiagnostic[] = [];
  try {
    if (!checkJsonValue(value, [], diagnostics)) {
      return undefined;
    }
    return cloneVerifiedJsonValue(value);
  } catch {
    return undefined;
  }
}

function cloneDetachedJsonRecord(
  value: unknown,
): Readonly<Record<string, ScreenComponentJsonValue>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const diagnostics: ScreenComponentValidationDiagnostic[] = [];
  try {
    if (!checkJsonValue(value, [], diagnostics)) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  const record: Record<string, ScreenComponentJsonValue> = {};
  for (const key of Object.keys(value)) {
    record[key] = cloneVerifiedJsonValue(value[key]);
  }
  return record;
}

function getUtf8JsonByteLength(value: ScreenComponentJsonValue): number | undefined {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return undefined;
  }
}

function cloneScreenHostResourceIntent(value: unknown): ScreenHostResourceIntent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const allowedKeys = new Set(['resourceType', 'resourceId', 'params', 'binding']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return undefined;
  }

  const resourceType = value.resourceType;
  const resourceId = value.resourceId;
  if (typeof resourceType !== 'string' || typeof resourceId !== 'string') {
    return undefined;
  }

  const params = value.params;
  const binding = value.binding;
  const clonedParams = params === undefined ? undefined : cloneDetachedJsonRecord(params);
  const clonedBinding = binding === undefined ? undefined : cloneDetachedJsonRecord(binding);
  if (
    (params !== undefined && clonedParams === undefined) ||
    (binding !== undefined && clonedBinding === undefined)
  ) {
    return undefined;
  }

  return {
    resourceType,
    resourceId,
    ...(clonedParams === undefined ? {} : { params: clonedParams }),
    ...(clonedBinding === undefined ? {} : { binding: clonedBinding }),
  };
}

function cloneScreenHostResourceSummary(value: unknown): ScreenHostResourceSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const allowedKeys = new Set(['resourceType', 'resourceId', 'name', 'metadata']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return undefined;
  }

  const resourceType = value.resourceType;
  const resourceId = value.resourceId;
  const name = value.name;
  const metadata = value.metadata;
  if (
    typeof resourceType !== 'string' ||
    typeof resourceId !== 'string' ||
    typeof name !== 'string'
  ) {
    return undefined;
  }

  const clonedMetadata = metadata === undefined ? undefined : cloneDetachedJsonRecord(metadata);
  if (metadata !== undefined && clonedMetadata === undefined) {
    return undefined;
  }

  return {
    resourceType,
    resourceId,
    name,
    ...(clonedMetadata === undefined ? {} : { metadata: clonedMetadata }),
  };
}

export function cloneScreenHostResourceData(value: unknown): ScreenComponentJsonValue | undefined {
  const data = cloneScreenComponentJsonValue(value);
  if (data === undefined) {
    return undefined;
  }

  const byteLength = getUtf8JsonByteLength(data);
  if (byteLength === undefined || byteLength > SCREEN_HOST_RESOURCE_MAX_RESPONSE_BYTES) {
    return undefined;
  }

  return data;
}

export function prepareScreenHostResourceExecuteRequest(
  value: unknown,
): ScreenHostResourceExecuteRequest | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const allowedKeys = new Set(['contextId', 'componentId', 'intent']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return undefined;
  }

  const contextId = value.contextId;
  const componentId = value.componentId;
  const intent = cloneScreenHostResourceIntent(value.intent);
  if (typeof contextId !== 'string' || typeof componentId !== 'string' || intent === undefined) {
    return undefined;
  }

  return { contextId, componentId, intent };
}

export function validateScreenHostResourceExecuteResult(
  value: unknown,
): ScreenHostResourceExecuteResult | undefined {
  if (!isRecord(value) || !Object.hasOwn(value, 'data')) {
    return undefined;
  }

  const data = cloneScreenHostResourceData(value.data);
  return data === undefined ? undefined : { data };
}

export async function executeScreenHostResource(
  adapter: ScreenHostDataAdapter,
  request: ScreenHostResourceExecuteRequest,
  signal: AbortSignal,
): Promise<ScreenHostResourceExecuteResult | undefined> {
  const preparedRequest = prepareScreenHostResourceExecuteRequest(request);
  if (preparedRequest === undefined) {
    return undefined;
  }

  const result = await adapter.execute(preparedRequest, signal);
  return validateScreenHostResourceExecuteResult(result);
}

export async function listScreenHostResources(
  adapter: ScreenHostDataAdapter,
  input: { readonly resourceType: string; readonly signal?: AbortSignal },
): Promise<readonly ScreenHostResourceSummary[] | undefined> {
  if (typeof input.resourceType !== 'string') {
    return undefined;
  }

  const resources = await adapter.listResources({
    resourceType: input.resourceType,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  const summaries: ScreenHostResourceSummary[] = [];
  for (const resource of resources) {
    const summary = cloneScreenHostResourceSummary(resource);
    if (summary === undefined) {
      return undefined;
    }
    summaries.push(summary);
  }
  return summaries;
}

function isScreenSdkDiagnosticCode(value: string): value is ScreenSdkDiagnosticCodeValue {
  return new Set<string>(Object.values(ScreenSdkDiagnosticCode)).has(value);
}

function sanitizeDiagnostic(diagnostic: ScreenSdkDiagnostic): ScreenSdkDiagnostic {
  return {
    code: diagnostic.code,
    path: diagnostic.path.map((segment) =>
      typeof segment === 'number' || safeDiagnosticPathSegments.has(segment) ? segment : '<field>',
    ),
    severity: diagnostic.severity,
    message: safeDiagnosticMessages[diagnostic.code],
  };
}

function parseDiagnostics(value: unknown): readonly ScreenSdkDiagnostic[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const diagnostics = value.flatMap((item): ScreenSdkDiagnostic[] => {
    const parsed = ScreenSdkDiagnosticSchema.safeParse(item);
    if (!parsed.success || !isScreenSdkDiagnosticCode(parsed.data.code)) {
      return [];
    }

    return [sanitizeDiagnostic({ ...parsed.data, code: parsed.data.code })];
  });

  return diagnostics.length > 0 ? diagnostics : undefined;
}

function registryErrorToDiagnostics(
  error: ScreenComponentRegistryError,
): readonly ScreenSdkDiagnostic[] {
  return error.diagnostics.map((diagnostic) =>
    sanitizeDiagnostic({
      code: error.code,
      path: diagnostic.path,
      severity: 'error',
      message: diagnostic.message,
    }),
  );
}

export function assertScreenHostAdapter(adapter: unknown): asserts adapter is ScreenHostAdapter {
  if (!isRecord(adapter) || !isFunction(adapter.loadProject) || !isFunction(adapter.saveProject)) {
    throw new NormalizedScreenAdapterError('Adapter is missing required methods.', {
      code: ScreenAdapterErrorCode.VALIDATION,
    });
  }

  const optionalMethods = ['publishProject', 'importProject', 'exportProject'] as const;
  if (
    optionalMethods.some((method) => adapter[method] !== undefined && !isFunction(adapter[method]))
  ) {
    throw new NormalizedScreenAdapterError('Adapter optional capability has an invalid type.', {
      code: ScreenAdapterErrorCode.VALIDATION,
    });
  }

  const data = adapter.data;
  if (data !== undefined) {
    if (!isRecord(data)) {
      throw new NormalizedScreenAdapterError('Data adapter must be an object.', {
        code: ScreenAdapterErrorCode.VALIDATION,
      });
    }

    const dataMethods = [
      'listResources',
      'openContext',
      'syncContext',
      'closeContext',
      'execute',
    ] as const;
    if (dataMethods.some((method) => !isFunction(data[method]))) {
      throw new NormalizedScreenAdapterError('Data adapter capability group is incomplete.', {
        code: ScreenAdapterErrorCode.VALIDATION,
      });
    }
  }

  const snapshots = adapter.snapshots;
  if (snapshots === undefined) {
    return;
  }

  if (!isRecord(snapshots)) {
    throw new NormalizedScreenAdapterError('Snapshot adapter must be an object.', {
      code: ScreenAdapterErrorCode.VALIDATION,
    });
  }

  const snapshotMethods = ['list', 'create', 'restore', 'remove', 'clear'] as const;
  if (snapshotMethods.some((method) => !isFunction(snapshots[method]))) {
    throw new NormalizedScreenAdapterError('Snapshot adapter capability group is incomplete.', {
      code: ScreenAdapterErrorCode.VALIDATION,
    });
  }
}

export function deriveScreenHostCapabilities(adapter: unknown): ScreenHostCapabilities {
  assertScreenHostAdapter(adapter);
  return {
    load: true,
    save: true,
    publish: isFunction(adapter.publishProject),
    import: isFunction(adapter.importProject),
    export: isFunction(adapter.exportProject),
    snapshots: adapter.snapshots !== undefined,
    data: adapter.data !== undefined,
  };
}

export function requireScreenHostDataAdapter(adapter: ScreenHostAdapter): ScreenHostDataAdapter {
  if (adapter.data === undefined) {
    throw new NormalizedScreenAdapterError('Host resource data capability is unavailable.', {
      code: ScreenAdapterErrorCode.UNAVAILABLE,
    });
  }
  return adapter.data;
}

export function isScreenAdapterError(value: unknown): value is ScreenAdapterError {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    ScreenAdapterErrorCodeSchema.safeParse(value.code).success
  );
}

export function normalizeScreenAdapterError(
  error: unknown,
  signal?: AbortSignal,
): ScreenAdapterError {
  if (signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')) {
    return new NormalizedScreenAdapterError('Operation aborted.', {
      code: ScreenAdapterErrorCode.ABORTED,
      recoverable: true,
    });
  }

  if (isScreenComponentRegistryError(error)) {
    const diagnostics = registryErrorToDiagnostics(error);
    return new NormalizedScreenAdapterError(error.message, {
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
    });
  }

  if (isScreenAdapterError(error)) {
    return new NormalizedScreenAdapterError(error.message, {
      code: error.code,
      recoverable: typeof error.recoverable === 'boolean' ? error.recoverable : undefined,
      serverRevision: typeof error.serverRevision === 'string' ? error.serverRevision : undefined,
      diagnostics: parseDiagnostics(error.diagnostics),
    });
  }

  return new NormalizedScreenAdapterError('Unknown adapter error.', {
    code: ScreenAdapterErrorCode.UNKNOWN,
  });
}

export function toScreenPublicError(error: unknown, signal?: AbortSignal): ScreenPublicError {
  const normalized = normalizeScreenAdapterError(error, signal);
  return {
    code: normalized.code,
    message: publicErrorMessages[normalized.code],
    ...(normalized.recoverable === undefined ? {} : { recoverable: normalized.recoverable }),
    ...(normalized.serverRevision === undefined
      ? {}
      : { serverRevision: normalized.serverRevision }),
    ...(normalized.diagnostics === undefined
      ? {}
      : {
          diagnostics: normalized.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            path: [...diagnostic.path],
          })),
        }),
  };
}

export function throwIfAborted(signal: AbortSignal): void {
  signal.throwIfAborted();
}

export const AdapterResponseSchemas = {
  projectEnvelopeInput: ScreenProjectEnvelopeInputSchema,
  projectDraft: ScreenProjectDraftSchema,
  projectTransfer: ScreenProjectTransferSchema,
  projectExport: ScreenProjectExportSchema,
  snapshotSummary: ScreenSnapshotSummarySchema,
  snapshotList: ScreenSnapshotSummaryListSchema,
  exportFile: ScreenExportFileSchema,
} as const;
