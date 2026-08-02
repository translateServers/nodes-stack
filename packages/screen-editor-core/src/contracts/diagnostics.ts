import { z } from 'zod';

export type ScreenComponentRegistryErrorCode =
  | 'INVALID_COMPONENT_MANIFEST'
  | 'UNSUPPORTED_COMPONENT_API_VERSION'
  | 'DUPLICATE_COMPONENT_TYPE'
  | 'DUPLICATE_COMPONENT_TAG_NAME'
  | 'COMPONENT_DEFINE_FAILED';

export const LegacyScreenSdkDiagnosticCode = {
  INVALID_DOCUMENT: 'INVALID_DOCUMENT',
  UNSUPPORTED_SCHEMA_VERSION: 'UNSUPPORTED_SCHEMA_VERSION',
  UNKNOWN_COMPONENT_TYPE: 'UNKNOWN_COMPONENT_TYPE',
  INVALID_COMPONENT_PROPS: 'INVALID_COMPONENT_PROPS',
  UNSUPPORTED_DATA_SOURCE: 'UNSUPPORTED_DATA_SOURCE',
  UNSUPPORTED_GLOBAL_VARIABLE_TYPE: 'UNSUPPORTED_GLOBAL_VARIABLE_TYPE',
  UNSUPPORTED_BLUEPRINT_NODE: 'UNSUPPORTED_BLUEPRINT_NODE',
  UNSUPPORTED_BLUEPRINT_EVENT: 'UNSUPPORTED_BLUEPRINT_EVENT',
  UNSUPPORTED_BLUEPRINT_ACTION: 'UNSUPPORTED_BLUEPRINT_ACTION',
  DANGLING_COMPONENT_REFERENCE: 'DANGLING_COMPONENT_REFERENCE',
} as const;

export type LegacyScreenSdkDiagnosticCode =
  (typeof LegacyScreenSdkDiagnosticCode)[keyof typeof LegacyScreenSdkDiagnosticCode];

export const LegacyScreenSdkDiagnosticCodeSchema = z.enum(LegacyScreenSdkDiagnosticCode);

export const LegacyScreenSdkDiagnosticSchema = z
  .object({
    code: LegacyScreenSdkDiagnosticCodeSchema,
    path: z.array(z.union([z.string(), z.number().int()])),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
  })
  .strict();

export type LegacyScreenSdkDiagnostic = z.infer<typeof LegacyScreenSdkDiagnosticSchema>;

/**
 * 正式组件文档新增的诊断 code。
 *
 * 与归档解析器的 code 联合兼容。正式 parser 与 registry/Adapter 错误使用这套
 * 诊断协议。`INVALID_COMPONENT_PROPS` 已存在于归档协议，此处显式列出仅为对齐 spec 文本，
 * 不引入新语义。
 */
export const SCREEN_SDK_DIAGNOSTIC_EXTRA_CODES = [
  'MISSING_COMPONENT_DEFINITION',
  'UNSUPPORTED_COMPONENT_CAPABILITY',
  'INVALID_COMPONENT_EVENT',
] as const;

export const ScreenSdkDiagnosticCode = {
  ...LegacyScreenSdkDiagnosticCode,
  INVALID_COMPONENT_MANIFEST: 'INVALID_COMPONENT_MANIFEST',
  UNSUPPORTED_COMPONENT_API_VERSION: 'UNSUPPORTED_COMPONENT_API_VERSION',
  DUPLICATE_COMPONENT_TYPE: 'DUPLICATE_COMPONENT_TYPE',
  DUPLICATE_COMPONENT_TAG_NAME: 'DUPLICATE_COMPONENT_TAG_NAME',
  COMPONENT_DEFINE_FAILED: 'COMPONENT_DEFINE_FAILED',
  MISSING_COMPONENT_DEFINITION: 'MISSING_COMPONENT_DEFINITION',
  UNSUPPORTED_COMPONENT_CAPABILITY: 'UNSUPPORTED_COMPONENT_CAPABILITY',
  INVALID_COMPONENT_EVENT: 'INVALID_COMPONENT_EVENT',
} as const satisfies Record<
  ScreenComponentRegistryErrorCode | (typeof SCREEN_SDK_DIAGNOSTIC_EXTRA_CODES)[number],
  string
> &
  typeof LegacyScreenSdkDiagnosticCode;

export type ScreenSdkDiagnosticCode =
  (typeof ScreenSdkDiagnosticCode)[keyof typeof ScreenSdkDiagnosticCode];

/**
 * 正式诊断 schema。
 *
 * 形状与归档诊断一致，仅扩展 `code` 联合。
 * 保留 path / severity / message，避免创建平行错误协议。
 */
export const ScreenSdkDiagnosticSchema = z
  .object({
    code: z.string().min(1),
    path: z.array(z.union([z.string(), z.number().int()])),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
  })
  .strict();

export interface ScreenSdkDiagnostic extends Omit<LegacyScreenSdkDiagnostic, 'code'> {
  readonly code: ScreenSdkDiagnosticCode;
}

export function createLegacyDiagnostic(
  code: LegacyScreenSdkDiagnosticCode,
  path: ReadonlyArray<string | number>,
  message: string,
): LegacyScreenSdkDiagnostic {
  return {
    code,
    path: [...path],
    severity: 'error',
    message,
  };
}

export function legacyDiagnosticsFromZodError(
  error: z.ZodError,
  pathPrefix: ReadonlyArray<string | number> = [],
): LegacyScreenSdkDiagnostic[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.map((segment) =>
      typeof segment === 'symbol' ? (segment.description ?? 'symbol') : segment,
    );
    return createLegacyDiagnostic(
      LegacyScreenSdkDiagnosticCode.INVALID_DOCUMENT,
      [...pathPrefix, ...issuePath],
      issue.message,
    );
  });
}

/**
 * 创建正式诊断。
 *
 * 与归档 `createLegacyDiagnostic` 结构一致，仅扩展 code 联合以包含 registry error codes
 * 与新增的 MISSING_COMPONENT_DEFINITION / UNSUPPORTED_COMPONENT_CAPABILITY /
 * INVALID_COMPONENT_EVENT。
 */
export function createDiagnostic(
  code: ScreenSdkDiagnosticCode,
  path: ReadonlyArray<string | number>,
  message: string,
): ScreenSdkDiagnostic {
  return {
    code,
    path: [...path],
    severity: 'error',
    message,
  };
}

/**
 * 将 Zod 错误转换为正式诊断。
 *
 * 与归档 `legacyDiagnosticsFromZodError` 逻辑一致，仅返回正式诊断类型。
 */
export function diagnosticsFromZodError(
  error: z.ZodError,
  pathPrefix: ReadonlyArray<string | number> = [],
): ScreenSdkDiagnostic[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.map((segment) =>
      typeof segment === 'symbol' ? (segment.description ?? 'symbol') : segment,
    );
    return createDiagnostic(
      LegacyScreenSdkDiagnosticCode.INVALID_DOCUMENT,
      [...pathPrefix, ...issuePath],
      issue.message,
    );
  });
}
