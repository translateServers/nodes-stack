/**
 * Registry 错误类型与类型守卫（Spec §8.2 ScreenComponentRegistryError）
 *
 * 本模块从 `registry-factory.ts` 抽离，避免 `contracts/adapter.ts` 在错误类型
 * pipeline 中 import registry-factory 时引入循环依赖：
 *
 *   adapter.ts → registry-factory.ts → builtin-manifests.ts → text-component.tsx
 *     → schemas.tsx → quick-event-editor.tsx → internal.ts → contracts/index.ts
 *     → adapter.ts
 *
 * `registry-error.ts` 不依赖 `builtin-manifests.ts`，可被 `contracts/adapter.ts`
 * 安全 import 而不形成循环。`registry-factory.ts` 继续 re-export 本模块内容以
 * 保持向后兼容。
 */

import type { ScreenSdkDiagnostic } from '../contracts/diagnostics.js';

/**
 * Registry 工厂错误码（Spec §8.2 ScreenComponentRegistryErrorCode）。
 *
 * Phase 2 使用 screen-component-sdk 的 ScreenComponentValidationCode 子集，
 * 诊断类型遵循 spec §8.2 的完整 code 联合。
 */
export type ScreenComponentRegistryErrorCode =
  | 'INVALID_COMPONENT_MANIFEST'
  | 'INVALID_BUILTIN_COMPONENT_TYPE'
  | 'UNSUPPORTED_COMPONENT_API_VERSION'
  | 'DUPLICATE_COMPONENT_TYPE'
  | 'DUPLICATE_COMPONENT_TAG_NAME'
  | 'COMPONENT_DEFINE_FAILED';

/**
 * Registry 工厂错误（Spec §8.2 ScreenComponentRegistryError）。
 *
 * - `code`：稳定错误码，宿主可据此处理失败
 * - `diagnostics`：已映射为稳定 code/path/severity/message 的安全诊断
 *
 * diagnostics 不包含 manifest 原始对象、构造器源码或完整 props（Spec §8.2 安全约束）。
 */
export interface ScreenComponentRegistryError extends Error {
  readonly code: ScreenComponentRegistryErrorCode;
  readonly diagnostics: readonly ScreenSdkDiagnostic[];
}

/**
 * ScreenComponentRegistryError 实现类。
 *
 * 使用独立 class 以支持 `instanceof` 检查；接口形式无法被 `isScreenComponentRegistryError`
 * 安全收窄。
 */
export class ScreenComponentRegistryErrorImpl
  extends Error
  implements ScreenComponentRegistryError
{
  readonly code: ScreenComponentRegistryErrorCode;
  readonly diagnostics: readonly ScreenSdkDiagnostic[];

  constructor(
    code: ScreenComponentRegistryErrorCode,
    message: string,
    diagnostics: readonly ScreenSdkDiagnostic[] = [],
  ) {
    super(message);
    this.name = 'ScreenComponentRegistryError';
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

/**
 * 类型守卫：安全收窄 unknown 为 ScreenComponentRegistryError（Spec §8.2）。
 *
 * 宿主处理 factory reject 时不需要不安全类型断言。
 */
export function isScreenComponentRegistryError(
  error: unknown,
): error is ScreenComponentRegistryError {
  return error instanceof ScreenComponentRegistryErrorImpl;
}
