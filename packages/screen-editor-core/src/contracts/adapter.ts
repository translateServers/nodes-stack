import { z } from 'zod';
import {
  ScreenProjectDraftSchema,
  ScreenProjectDraftV2Schema,
  ScreenProjectEnvelopeInputSchema,
  ScreenProjectEnvelopeInputV2Schema,
  ScreenProjectExportV2Schema,
  ScreenProjectTransferV1Schema,
  ScreenProjectTransferV2Schema,
  type ScreenProjectDraft,
  type ScreenProjectDraftV2,
  type ScreenProjectEnvelopeInput,
  type ScreenProjectEnvelopeInputV2,
  type ScreenProjectExportV2,
  type ScreenProjectTransferV1,
  type ScreenProjectTransferV2,
} from './document.js';
import {
  ScreenSdkDiagnosticSchema,
  ScreenSdkDiagnosticV2Schema,
  type ScreenSdkDiagnostic,
  type ScreenSdkDiagnosticCodeV2,
  type ScreenSdkDiagnosticV2,
} from './diagnostics.js';
import {
  isScreenComponentRegistryError,
  type ScreenComponentRegistryError,
} from '../registry/registry-error.js';

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

// ===== V2 Adapter / Snapshot（Spec §12.3） =====

/**
 * V2 save input（Spec §12.3）。
 *
 * `draft` 必须为 V2 draft；revision 与 V1 语义一致（乐观锁基线）。
 */
export interface SaveProjectInputV2 extends LoadProjectInput {
  revision: string;
  draft: ScreenProjectDraftV2;
}

/**
 * V2 import input（Spec §12.3）。
 *
 * `transfer` 必须为 V2 transfer（formatVersion=2）；SDK 在调用 Adapter 前已完成
 * `ScreenProjectTransferV2Schema` 校验。
 */
export interface ImportProjectInputV2 extends PublishProjectInput {
  file: File;
  transfer: ScreenProjectTransferV2;
}

/**
 * V2 snapshot create input（Spec §12.3）。
 *
 * `draft` 必须为 V2 draft；`ScreenSnapshotAdapterV2.restore()` 返回 V2 envelope。
 */
export interface SnapshotCreateInputV2 extends SnapshotListInput {
  revision: string;
  draft: ScreenProjectDraftV2;
}

/**
 * V2 snapshot adapter（Spec §12.3）。
 *
 * `restore()` 返回 V2 envelope；create draft 使用 V2。list/remove/clear 与 V1
 * 共用 summary 与 input 形状（快照元数据与文档版本无关）。
 */
export interface ScreenSnapshotAdapterV2 {
  list(input: SnapshotListInput): Promise<ScreenSnapshotSummary[]>;
  create(input: SnapshotCreateInputV2): Promise<ScreenSnapshotSummary>;
  restore(input: SnapshotRestoreInput): Promise<ScreenProjectEnvelopeInputV2>;
  remove(input: SnapshotRemoveInput): Promise<void>;
  clear(input: SnapshotClearInput): Promise<void>;
}

/**
 * V2 host adapter（Spec §12.3）。
 *
 * `documentVersion: 2` 是运行时 capability marker：外部 registry 搭配 V1 Adapter
 * 时在 load 前拒绝（Requirement 13）。
 *
 * `loadProject()` 可返回 V1 或 V2 envelope input：V2 Adapter 在显式模式下将
 * V1 输入无损规范化为 V2（Task 5.4）；未规范化的 V1 输入保持 V1 分支。
 *
 * V2 export 返回结构化 `ScreenProjectExportV2`（fileName + transfer），
 * SDK 校验后自行序列化为 Blob，不信任 Adapter 返回的 opaque Blob 内容。
 */
export interface ScreenHostAdapterV2 {
  readonly documentVersion: 2;
  loadProject(
    input: LoadProjectInput,
  ): Promise<ScreenProjectEnvelopeInput | ScreenProjectEnvelopeInputV2>;
  saveProject(input: SaveProjectInputV2): Promise<ScreenProjectEnvelopeInputV2>;
  publishProject?: (input: PublishProjectInput) => Promise<ScreenProjectEnvelopeInputV2>;
  importProject?: (input: ImportProjectInputV2) => Promise<ScreenProjectEnvelopeInputV2>;
  exportProject?: (input: ExportProjectInput) => Promise<ScreenProjectExportV2>;
  snapshots?: ScreenSnapshotAdapterV2;
}

/**
 * V2 adapter error（Spec §12.4）。
 *
 * 与 V1 `ScreenAdapterError` 形状一致，仅将 `diagnostics` 升级为 V2 诊断数组。
 * `nebula-error` 与 `toScreenPublicError()` 的 0.2 分支保留安全 V2 diagnostics，
 * 同时继续剥离 Adapter 原始 message/stack/cause/response。
 */
export interface ScreenAdapterErrorV2 extends Omit<ScreenAdapterError, 'diagnostics'> {
  readonly diagnostics?: readonly ScreenSdkDiagnosticV2[];
}

/**
 * V2 public error（Spec §12.4）。
 *
 * 公共错误形状，diagnostics 使用 V2 code 联合。诊断包含稳定 code/path/severity/message，
 * 不包含完整 props、event payload、构造函数源码或 Adapter 原始错误。
 */
export interface ScreenPublicErrorV2 extends Omit<ScreenPublicError, 'diagnostics'> {
  readonly diagnostics?: readonly ScreenSdkDiagnosticV2[];
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

// ===== V2 Error Pipeline（Spec §12.4 + Requirement 3 + Requirement 7 + Requirement 8） =====

/**
 * V2 诊断允许的 path segment 白名单（Spec §12.4 安全约束）。
 *
 * 在 V1 `SAFE_DIAGNOSTIC_PATH_SEGMENTS` 基础上扩展 manifest 校验路径
 * （registry error 内部诊断会涉及 manifest 字段路径）以及 propsSchema 校验
 * 涉及的 JSON Schema 关键字路径。任何不在白名单中的字符串 segment 在脱敏
 * 阶段被替换为 `'<field>'`，避免泄漏完整 props、event payload 或构造器源码。
 */
const SAFE_DIAGNOSTIC_PATH_SEGMENTS_V2: ReadonlySet<string> = new Set([
  ...SAFE_DIAGNOSTIC_PATH_SEGMENTS,
  // manifest identity 字段（registry error 诊断路径）
  'apiVersion',
  'implementationVersion',
  'tagName',
  'category',
  'icon',
  'defaultSize',
  'order',
  'keywords',
  'manifest',
  // manifest.events 字段
  'events',
  // manifest.propsSchema 字段（JSON Schema 子集）
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
  // manifest.propertyPanel 字段
  'propertyPanel',
  'sections',
  'fields',
  'pointer',
  'control',
  'label',
]);

/**
 * V2 安全 message 表（Spec §12.4 安全约束）。
 *
 * 在 V1 `SAFE_DIAGNOSTIC_MESSAGES` 基础上扩展 V2 新增 code 与 registry error code。
 * 诊断 message 不包含具体字段值、原始 props、event payload 或 Adapter 原始错误信息。
 */
const SAFE_DIAGNOSTIC_MESSAGES_V2: Record<ScreenSdkDiagnosticCodeV2, string> = {
  ...SAFE_DIAGNOSTIC_MESSAGES,
  // V2 新增组件诊断 code（Spec §12.4）
  MISSING_COMPONENT_DEFINITION: '组件类型未在注册表中定义。',
  UNSUPPORTED_COMPONENT_CAPABILITY: '外部组件不支持该能力配置。',
  INVALID_COMPONENT_EVENT: '蓝图事件锚点不在组件 manifest.events 声明列表中。',
  // Registry error code（Spec §12.4 + §8.2 ScreenComponentRegistryErrorCode）
  INVALID_COMPONENT_MANIFEST: '组件 manifest 校验失败。',
  UNSUPPORTED_COMPONENT_API_VERSION: '组件 API 版本不受支持。',
  DUPLICATE_COMPONENT_TYPE: '组件 type 已被注册。',
  DUPLICATE_COMPONENT_TAG_NAME: '组件 tagName 已被注册。',
  COMPONENT_DEFINE_FAILED: '组件定义失败。',
};

/**
 * 解析 V2 诊断输入，应用 path/message 脱敏（Spec §12.4 安全约束）。
 *
 * 与 V1 `parseDiagnostics` 行为一致，仅扩展 code 联合与 path/message 白名单：
 * - 不在 `SAFE_DIAGNOSTIC_PATH_SEGMENTS_V2` 中的字符串 segment 替换为 `'<field>'`
 * - message 替换为 `SAFE_DIAGNOSTIC_MESSAGES_V2[code]` 预定义安全文案
 * - 解析失败的诊断被静默丢弃（不抛错，避免攻击者通过构造畸形诊断导致 SDK 崩溃）
 */
function parseDiagnosticsV2(value: unknown): ScreenSdkDiagnosticV2[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const diagnostics = value.flatMap((item) => {
    const result = ScreenSdkDiagnosticV2Schema.safeParse(item);
    if (!result.success) return [];
    const code = result.data.code as ScreenSdkDiagnosticCodeV2;
    return [
      {
        code,
        path: result.data.path.map((segment) =>
          typeof segment === 'number' || SAFE_DIAGNOSTIC_PATH_SEGMENTS_V2.has(segment)
            ? segment
            : '<field>',
        ),
        severity: result.data.severity,
        message: SAFE_DIAGNOSTIC_MESSAGES_V2[code],
      },
    ];
  });
  return diagnostics.length > 0 ? diagnostics : undefined;
}

/**
 * 重新脱敏 registry factory 已产出的 V2 诊断（Spec §12.4）。
 *
 * - code：固定使用 registry error 顶层 `ScreenComponentRegistryErrorCode`，防止
 *   manifest validator 的内部细分 code 成为公共 ABI。
 * - path：保留 SDK 诊断路径，但应用 `SAFE_DIAGNOSTIC_PATH_SEGMENTS_V2` 脱敏。
 * - message：替换为 `SAFE_DIAGNOSTIC_MESSAGES_V2[code]` 安全文案。
 */
function registryErrorToV2Diagnostics(
  error: ScreenComponentRegistryError,
): ScreenSdkDiagnosticV2[] {
  return error.diagnostics.map((diagnostic) => {
    const code: ScreenSdkDiagnosticCodeV2 = error.code;
    return {
      code,
      path: diagnostic.path.map((segment) =>
        typeof segment === 'number' || SAFE_DIAGNOSTIC_PATH_SEGMENTS_V2.has(segment)
          ? segment
          : '<field>',
      ),
      severity: 'error' as const,
      message: SAFE_DIAGNOSTIC_MESSAGES_V2[code],
    };
  });
}

class NormalizedScreenAdapterErrorV2 extends Error implements ScreenAdapterErrorV2 {
  readonly code: ScreenAdapterErrorCode;
  readonly recoverable?: boolean;
  readonly serverRevision?: string;
  readonly diagnostics?: readonly ScreenSdkDiagnosticV2[];

  constructor(
    message: string,
    options: {
      code: ScreenAdapterErrorCode;
      recoverable?: boolean;
      serverRevision?: string;
      diagnostics?: readonly ScreenSdkDiagnosticV2[];
    },
  ) {
    super(message);
    this.name = 'ScreenAdapterErrorV2';
    this.code = options.code;
    this.recoverable = options.recoverable;
    this.serverRevision = options.serverRevision;
    this.diagnostics = options.diagnostics;
  }
}

/**
 * 将 unknown 错误规范化为 `ScreenAdapterErrorV2`（Spec §12.4）。
 *
 * 与 V1 `normalizeScreenAdapterError` 行为一致，但：
 * - `ScreenComponentRegistryError` 升级为 V2 adapter error（code=VALIDATION），
 *   SDK 内部诊断升级为 V2 diagnostics（code=registry error code）
 * - `ScreenAdapterError` 的 diagnostics 使用 `parseDiagnosticsV2` 解析，支持 V2 code 联合
 * - 任何 abort 信号优先映射为 ABORTED，recoverable=true
 * - 不识别的 error 映射为 UNKNOWN，不带 diagnostics
 *
 * 不抛错、不暴露原始 message/stack/cause/response 字段。
 */
export function normalizeScreenAdapterErrorV2(
  error: unknown,
  signal?: AbortSignal,
): ScreenAdapterErrorV2 {
  if (signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')) {
    return new NormalizedScreenAdapterErrorV2('Operation aborted', {
      code: ScreenAdapterErrorCode.ABORTED,
      recoverable: true,
    });
  }
  if (isScreenComponentRegistryError(error)) {
    const v2Diagnostics = registryErrorToV2Diagnostics(error);
    return new NormalizedScreenAdapterErrorV2(error.message, {
      code: ScreenAdapterErrorCode.VALIDATION,
      diagnostics: v2Diagnostics.length > 0 ? v2Diagnostics : undefined,
    });
  }
  if (isScreenAdapterError(error)) {
    const candidate = asRecord(error);
    return new NormalizedScreenAdapterErrorV2(error.message, {
      code: error.code,
      recoverable: typeof candidate?.recoverable === 'boolean' ? candidate.recoverable : undefined,
      serverRevision:
        typeof candidate?.serverRevision === 'string' ? candidate.serverRevision : undefined,
      diagnostics: parseDiagnosticsV2(candidate?.diagnostics),
    });
  }
  return new NormalizedScreenAdapterErrorV2('Unknown adapter error', {
    code: ScreenAdapterErrorCode.UNKNOWN,
  });
}

/**
 * 将 unknown 错误转换为 V2 公共错误（Spec §12.4）。
 *
 * 与 V1 `toScreenPublicError` 行为一致，但：
 * - 保留 V2 diagnostics（包含 registry error code 与 V2 新增 code）
 * - 剥离 Adapter 原始 message/stack/cause/response 字段
 * - 公共 message 来自 `PUBLIC_ERROR_MESSAGES[code]`，不包含具体业务信息
 *
 * 诊断包含稳定 code/path/severity/message，不包含完整 props、event payload、
 * 构造函数源码或 Adapter 原始错误。
 */
export function toScreenPublicErrorV2(error: unknown, signal?: AbortSignal): ScreenPublicErrorV2 {
  const normalized = normalizeScreenAdapterErrorV2(error, signal);
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

export const AdapterResponseSchemas = {
  projectEnvelopeInput: ScreenProjectEnvelopeInputSchema,
  projectDraft: ScreenProjectDraftSchema,
  projectTransfer: ScreenProjectTransferV1Schema,
  snapshotSummary: ScreenSnapshotSummarySchema,
  snapshotList: ScreenSnapshotSummaryListSchema,
  exportFile: ScreenExportFileSchema,
  // V2 schemas（Spec §12.3）
  projectEnvelopeInputV2: ScreenProjectEnvelopeInputV2Schema,
  projectDraftV2: ScreenProjectDraftV2Schema,
  projectTransferV2: ScreenProjectTransferV2Schema,
  projectExportV2: ScreenProjectExportV2Schema,
} as const;
