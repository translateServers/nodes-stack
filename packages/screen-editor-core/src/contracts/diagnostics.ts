import { z } from 'zod';

export type ScreenComponentRegistryErrorCode =
  | 'INVALID_COMPONENT_MANIFEST'
  | 'UNSUPPORTED_COMPONENT_API_VERSION'
  | 'DUPLICATE_COMPONENT_TYPE'
  | 'DUPLICATE_COMPONENT_TAG_NAME'
  | 'COMPONENT_DEFINE_FAILED';

export const ScreenSdkDiagnosticCode = {
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

export type ScreenSdkDiagnosticCode =
  (typeof ScreenSdkDiagnosticCode)[keyof typeof ScreenSdkDiagnosticCode];

export const ScreenSdkDiagnosticCodeSchema = z.enum(ScreenSdkDiagnosticCode);

export const ScreenSdkDiagnosticSchema = z
  .object({
    code: ScreenSdkDiagnosticCodeSchema,
    path: z.array(z.union([z.string(), z.number().int()])),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
  })
  .strict();

export type ScreenSdkDiagnostic = z.infer<typeof ScreenSdkDiagnosticSchema>;

/**
 * V2 新增组件诊断 code（Spec §12.4）。
 *
 * 与 V1 `ScreenSdkDiagnosticCode` 互斥：V1 parser 只产生 V1 code；
 * V2 parser 与 registry/Adapter 错误统一升级为 V2 code。
 * `INVALID_COMPONENT_PROPS` 已存在于 V1，此处显式列出仅为对齐 spec 文本，
 * 不引入新语义。
 */
export const SCREEN_SDK_DIAGNOSTIC_V2_EXTRA_CODES = [
  'MISSING_COMPONENT_DEFINITION',
  'UNSUPPORTED_COMPONENT_CAPABILITY',
  'INVALID_COMPONENT_EVENT',
] as const;

export type ScreenSdkDiagnosticCodeV2 =
  | ScreenSdkDiagnosticCode
  | ScreenComponentRegistryErrorCode
  | (typeof SCREEN_SDK_DIAGNOSTIC_V2_EXTRA_CODES)[number];

/**
 * V2 诊断 schema（Spec §12.4）。
 *
 * 形状与 V1 `ScreenSdkDiagnosticSchema` 一致，仅扩展 `code` 联合。
 * 保留 path / severity / message，避免创建平行错误协议。
 */
export const ScreenSdkDiagnosticV2Schema = z
  .object({
    code: z.string().min(1),
    path: z.array(z.union([z.string(), z.number().int()])),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
  })
  .strict();

export interface ScreenSdkDiagnosticV2 extends Omit<ScreenSdkDiagnostic, 'code'> {
  readonly code: ScreenSdkDiagnosticCodeV2;
}

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

export function diagnosticsFromZodError(
  error: z.ZodError,
  pathPrefix: ReadonlyArray<string | number> = [],
): ScreenSdkDiagnostic[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.map((segment) =>
      typeof segment === 'symbol' ? (segment.description ?? 'symbol') : segment,
    );
    return createDiagnostic(
      ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
      [...pathPrefix, ...issuePath],
      issue.message,
    );
  });
}

/**
 * 创建 V2 诊断（Spec §12.4）。
 *
 * 与 V1 `createDiagnostic` 结构一致，仅扩展 code 联合以包含 registry error codes
 * 与 V2 新增的 MISSING_COMPONENT_DEFINITION / UNSUPPORTED_COMPONENT_CAPABILITY /
 * INVALID_COMPONENT_EVENT。
 */
export function createV2Diagnostic(
  code: ScreenSdkDiagnosticCodeV2,
  path: ReadonlyArray<string | number>,
  message: string,
): ScreenSdkDiagnosticV2 {
  return {
    code,
    path: [...path],
    severity: 'error',
    message,
  };
}

/**
 * 将 Zod 错误转换为 V2 诊断（Spec §12.4）。
 *
 * 与 V1 `diagnosticsFromZodError` 逻辑一致，仅返回 V2 诊断类型。
 * V2 parser 的 wire 校验阶段使用此函数。
 */
export function diagnosticsFromZodErrorV2(
  error: z.ZodError,
  pathPrefix: ReadonlyArray<string | number> = [],
): ScreenSdkDiagnosticV2[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.map((segment) =>
      typeof segment === 'symbol' ? (segment.description ?? 'symbol') : segment,
    );
    return createV2Diagnostic(
      ScreenSdkDiagnosticCode.INVALID_DOCUMENT,
      [...pathPrefix, ...issuePath],
      issue.message,
    );
  });
}
