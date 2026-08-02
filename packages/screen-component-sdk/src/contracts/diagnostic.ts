/**
 * 组件协议校验诊断（Spec §12.4）
 *
 * 纯校验阶段产出的诊断，不包含完整 props、event payload、构造函数源码。
 */

export type ScreenComponentValidationCode =
  | 'INVALID_COMPONENT_MANIFEST'
  | 'UNSUPPORTED_COMPONENT_API_VERSION'
  | 'INVALID_COMPONENT_TYPE'
  | 'INVALID_COMPONENT_TAG_NAME'
  | 'INVALID_IMPLEMENTATION_VERSION'
  | 'INVALID_DEFAULT_SIZE'
  | 'INVALID_DEFAULT_PROPS'
  | 'INVALID_PROPS_SCHEMA'
  | 'INVALID_PROPERTY_PANEL'
  | 'INVALID_EVENT_DEFINITION'
  | 'INVALID_JSON_VALUE'
  | 'DUPLICATE_COMPONENT_TYPE'
  | 'DUPLICATE_COMPONENT_TAG_NAME'
  | 'COMPONENT_DEFINE_FAILED';

export interface ScreenComponentValidationDiagnostic {
  readonly code: ScreenComponentValidationCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

export interface ScreenComponentValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly ScreenComponentValidationDiagnostic[];
}

export function createValidationDiagnostic(
  code: ScreenComponentValidationCode,
  path: ReadonlyArray<string | number>,
  message: string,
): ScreenComponentValidationDiagnostic {
  return { code, path: [...path], message };
}

export function okResult(): ScreenComponentValidationResult {
  return { ok: true, diagnostics: [] };
}

export function errorResult(
  diagnostics: readonly ScreenComponentValidationDiagnostic[],
): ScreenComponentValidationResult {
  return { ok: diagnostics.length === 0, diagnostics };
}
