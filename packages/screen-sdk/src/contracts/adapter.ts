import { z } from 'zod';
import {
  ScreenProjectDraftSchema,
  ScreenProjectEnvelopeInputSchema,
  ScreenProjectTransferV1Schema,
  type ScreenProjectDraft,
  type ScreenProjectEnvelopeInput,
  type ScreenProjectTransferV1,
} from './document.js';
import { ScreenSdkDiagnosticSchema, type ScreenSdkDiagnostic } from './diagnostics.js';

export interface LoadProjectInput {
  projectId: string;
  signal: AbortSignal;
}

export interface SaveProjectInput extends LoadProjectInput {
  revision: string;
  draft: ScreenProjectDraft;
}

export interface PublishProjectInput extends LoadProjectInput {
  revision: string;
}

export interface ImportProjectInput extends PublishProjectInput {
  file: File;
  transfer: ScreenProjectTransferV1;
}

export type ExportProjectInput = PublishProjectInput;

export type SnapshotListInput = LoadProjectInput;

export interface SnapshotCreateInput extends SnapshotListInput {
  revision: string;
  draft: ScreenProjectDraft;
}

export interface SnapshotRestoreInput extends SnapshotListInput {
  snapshotId: string;
  revision: string;
}

export interface SnapshotRemoveInput extends SnapshotListInput {
  snapshotId: string;
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

const SAFE_JSON_FILE_NAME_PATTERN = /^[^/\\]{1,255}\.json$/i;
const JSON_MIME_PATTERN = /^application\/json(?:\s*;\s*charset=[^;]+)?$/i;

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
      .regex(SAFE_JSON_FILE_NAME_PATTERN, '导出文件名必须是安全的 .json basename')
      .refine((value) => !value.includes('..'), '导出文件名不能包含 .. 路径段')
      .refine((value) => !containsControlCharacter(value), '导出文件名不能包含控制字符'),
    blob: z
      .instanceof(Blob)
      .refine((value) => JSON_MIME_PATTERN.test(value.type), '导出 Blob 必须使用 JSON MIME'),
  })
  .strict();

export type ScreenExportFile = z.infer<typeof ScreenExportFileSchema>;

export interface ScreenSnapshotAdapter {
  list(input: SnapshotListInput): Promise<ScreenSnapshotSummary[]>;
  create(input: SnapshotCreateInput): Promise<ScreenSnapshotSummary>;
  restore(input: SnapshotRestoreInput): Promise<ScreenProjectEnvelopeInput>;
  remove(input: SnapshotRemoveInput): Promise<void>;
  clear(input: SnapshotClearInput): Promise<void>;
}

export interface ScreenHostAdapter {
  loadProject(input: LoadProjectInput): Promise<ScreenProjectEnvelopeInput>;
  saveProject(input: SaveProjectInput): Promise<ScreenProjectEnvelopeInput>;
  publishProject?: (input: PublishProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  importProject?: (input: ImportProjectInput) => Promise<ScreenProjectEnvelopeInput>;
  exportProject?: (input: ExportProjectInput) => Promise<ScreenExportFile>;
  snapshots?: ScreenSnapshotAdapter;
}

export interface ScreenHostCapabilities {
  load: true;
  save: true;
  publish: boolean;
  import: boolean;
  export: boolean;
  snapshots: boolean;
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
  code: ScreenAdapterErrorCode;
  recoverable?: boolean;
  serverRevision?: string;
  diagnostics?: readonly ScreenSdkDiagnostic[];
}

export interface ScreenPublicError {
  code: ScreenAdapterErrorCode;
  message: string;
  recoverable?: boolean;
  serverRevision?: string;
  diagnostics?: readonly ScreenSdkDiagnostic[];
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

class NormalizedScreenAdapterError extends Error implements ScreenAdapterError {
  readonly code: ScreenAdapterErrorCode;
  readonly recoverable?: boolean;
  readonly serverRevision?: string;
  readonly diagnostics?: readonly ScreenSdkDiagnostic[];

  constructor(
    message: string,
    options: {
      code: ScreenAdapterErrorCode;
      recoverable?: boolean;
      serverRevision?: string;
      diagnostics?: readonly ScreenSdkDiagnostic[];
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

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : undefined;
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

export function assertScreenHostAdapter(adapter: unknown): asserts adapter is ScreenHostAdapter {
  const candidate = asRecord(adapter);
  if (!isFunction(candidate?.loadProject) || !isFunction(candidate?.saveProject)) {
    throw new NormalizedScreenAdapterError('Adapter 缺少必需方法', {
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: [],
    });
  }
  const optionalMethods = ['publishProject', 'importProject', 'exportProject'] as const;
  if (
    optionalMethods.some(
      (method) => candidate[method] !== undefined && !isFunction(candidate[method]),
    )
  ) {
    throw new NormalizedScreenAdapterError('Adapter 可选能力类型无效', {
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: [],
    });
  }
  if (candidate.snapshots !== undefined) {
    const snapshots = asRecord(candidate.snapshots);
    const snapshotMethods = ['list', 'create', 'restore', 'remove', 'clear'] as const;
    if (
      snapshots === undefined ||
      snapshotMethods.some((method) => !isFunction(snapshots[method]))
    ) {
      throw new NormalizedScreenAdapterError('Snapshot Adapter 能力组不完整', {
        code: ScreenAdapterErrorCode.VALIDATION,
        diagnostics: [],
      });
    }
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
  };
}

export function isScreenAdapterError(value: unknown): value is ScreenAdapterError {
  const candidate = asRecord(value);
  return (
    candidate !== undefined &&
    typeof candidate.message === 'string' &&
    ScreenAdapterErrorCodeSchema.safeParse(candidate.code).success
  );
}

function parseDiagnostics(value: unknown): ScreenSdkDiagnostic[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const diagnostics = value.flatMap((item) => {
    const result = ScreenSdkDiagnosticSchema.safeParse(item);
    if (!result.success) return [];
    return [
      {
        ...result.data,
        path: result.data.path.map((segment) =>
          typeof segment === 'number' || SAFE_DIAGNOSTIC_PATH_SEGMENTS.has(segment)
            ? segment
            : '<field>',
        ),
        message: SAFE_DIAGNOSTIC_MESSAGES[result.data.code],
      },
    ];
  });
  return diagnostics.length > 0 ? diagnostics : undefined;
}

const SAFE_DIAGNOSTIC_PATH_SEGMENTS: ReadonlySet<string> = new Set([
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
]);

const SAFE_DIAGNOSTIC_MESSAGES: Record<ScreenSdkDiagnostic['code'], string> = {
  INVALID_DOCUMENT: '文档字段校验失败。',
  UNSUPPORTED_SCHEMA_VERSION: '文档版本不受当前 SDK 支持。',
  UNKNOWN_COMPONENT_TYPE: '组件类型不受当前 SDK 支持。',
  INVALID_COMPONENT_PROPS: '组件属性不符合 SDK 契约。',
  UNSUPPORTED_DATA_SOURCE: '数据源类型不受当前 SDK 支持。',
  UNSUPPORTED_GLOBAL_VARIABLE_TYPE: '全局变量类型不受当前 SDK 支持。',
  UNSUPPORTED_BLUEPRINT_NODE: '蓝图节点不受当前 SDK 支持。',
  UNSUPPORTED_BLUEPRINT_EVENT: '蓝图事件不受当前 SDK 支持。',
  UNSUPPORTED_BLUEPRINT_ACTION: '蓝图动作不受当前 SDK 支持。',
  DANGLING_COMPONENT_REFERENCE: '文档包含悬空组件引用。',
};

export function normalizeScreenAdapterError(
  error: unknown,
  signal?: AbortSignal,
): ScreenAdapterError {
  if (signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')) {
    return new NormalizedScreenAdapterError('Operation aborted', {
      code: ScreenAdapterErrorCode.ABORTED,
      recoverable: true,
    });
  }
  if (!isScreenAdapterError(error)) {
    return new NormalizedScreenAdapterError('Unknown adapter error', {
      code: ScreenAdapterErrorCode.UNKNOWN,
    });
  }
  const candidate = asRecord(error);
  return new NormalizedScreenAdapterError(error.message, {
    code: error.code,
    recoverable: typeof candidate?.recoverable === 'boolean' ? candidate.recoverable : undefined,
    serverRevision:
      typeof candidate?.serverRevision === 'string' ? candidate.serverRevision : undefined,
    diagnostics: parseDiagnostics(candidate?.diagnostics),
  });
}

const PUBLIC_ERROR_MESSAGES: Record<ScreenAdapterErrorCode, string> = {
  CONFLICT: '项目已被其他操作更新，请重新加载后重试。',
  NOT_FOUND: '项目或资源不存在。',
  UNAUTHORIZED: '当前身份无效，请由宿主重新认证。',
  FORBIDDEN: '当前操作没有权限。',
  VALIDATION: '数据校验失败。',
  UNSUPPORTED_DOCUMENT_FEATURE: '文档包含当前 SDK 不支持的功能。',
  UNAVAILABLE: '宿主未提供此项能力。',
  DIRTY_STATE: '存在未保存的更改。',
  ABORTED: '操作已取消。',
  UNKNOWN: '操作失败，请稍后重试。',
};

export function toScreenPublicError(error: unknown, signal?: AbortSignal): ScreenPublicError {
  const normalized = normalizeScreenAdapterError(error, signal);
  return {
    code: normalized.code,
    message: PUBLIC_ERROR_MESSAGES[normalized.code],
    recoverable: normalized.recoverable,
    serverRevision: normalized.serverRevision,
    diagnostics: normalized.diagnostics?.map((diagnostic) => ({
      ...diagnostic,
      path: [...diagnostic.path],
    })),
  };
}

export function throwIfAborted(signal: AbortSignal): void {
  signal.throwIfAborted();
}

export const AdapterResponseSchemas = {
  projectEnvelopeInput: ScreenProjectEnvelopeInputSchema,
  projectDraft: ScreenProjectDraftSchema,
  projectTransfer: ScreenProjectTransferV1Schema,
  snapshotSummary: ScreenSnapshotSummarySchema,
  snapshotList: ScreenSnapshotSummaryListSchema,
  exportFile: ScreenExportFileSchema,
} as const;
