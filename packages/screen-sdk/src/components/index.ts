/**
 * `@nebula/screen-sdk/components` — 显式 opt-in 入口（Spec §14.1, Task 6.3）
 *
 * 0.2 SDK 通过此入口显式启用外部组件持久化。默认 `@nebula/screen-sdk` 主入口
 * 不导入此模块时，SDK 使用内置组件注册表。
 *
 * 导出内容：
 * - `createScreenComponentRegistry()`：registry 工厂，返回公共 `ScreenComponentRegistry`
 * - `BUILTIN_SCREEN_COMPONENT_TYPES`：宿主可选择加载的内置组件 type
 * - 正式 Adapter / Document / Transfer / Snapshot / Error / Diagnostic 公共类型
 * - 正式事件 map（来自 `contracts.ts`）
 * - 组件插件协议类型（re-export from `@nebula/screen-component-sdk`）
 * - Registry 错误类型与守卫
 *
 * 安全边界（Spec §3.3 + §12.3）：
 * - 注册表在加载前冻结，避免运行时替换组件定义
 * - 不导出内部 `ScreenComponentInstanceRegistry`（含 legacy 兼容字段）
 *
 * Zod / JSON Schema 请从 `@nebula/screen-sdk/contracts` 导入。
 */

// ===== Registry 工厂（包装内部工厂，返回公共类型） =====

import {
  createScreenComponentRegistry as createInternalRegistry,
  isScreenComponentRegistryError,
  linkScreenComponentRegistryFacade,
  ScreenComponentRegistryErrorImpl,
  type CreateScreenComponentRegistryOptions,
  type ScreenComponentInstanceRegistry,
  type ScreenComponentRegistryError,
  type ScreenComponentRegistryErrorCode,
  type ScreenComponentRegistration as InternalScreenComponentRegistration,
} from '@nebula/screen-editor-core/experimental';

import type { ScreenComponentRegistration, ScreenComponentRegistry } from '../element/contracts.js';

function toPublicRegistration(
  registration: InternalScreenComponentRegistration,
): ScreenComponentRegistration {
  if (registration.source === 'host') {
    return Object.freeze({
      source: 'host',
      manifest: registration.manifest,
      elementConstructor: registration.elementConstructor,
    });
  }
  return Object.freeze({
    source: 'built-in',
    manifest: registration.manifest,
    ...(registration.elementConstructor === undefined
      ? {}
      : { elementConstructor: registration.elementConstructor }),
  });
}

function createPublicRegistry(
  internalRegistry: ScreenComponentInstanceRegistry,
): ScreenComponentRegistry {
  const registrations = Object.freeze(internalRegistry.list().map(toPublicRegistration));
  const registrationsByType = new Map(
    registrations.map((registration) => [registration.manifest.type, registration]),
  );
  const registry: ScreenComponentRegistry = {
    get size() {
      return registrations.length;
    },
    get: (type) => registrationsByType.get(type),
    has: (type) => registrationsByType.has(type),
    list: () => registrations,
  };

  const facade = Object.freeze(registry);
  linkScreenComponentRegistryFacade(facade, internalRegistry);
  return facade;
}

/**
 * 异步创建组件注册表（Spec §8.1 + §8.2）。
 *
 * 默认包含 SDK 内置 6 组件（text / bar-chart / rect / ellipse / image / button）。宿主可通过
 * `builtInComponents` 传入白名单，或传入空数组禁用全部内置组件；`components` 用于额外组件
 * plugin。返回不可变 `ScreenComponentRegistry` 公共接口，不暴露内部 legacy 兼容字段。
 *
 * 失败行为（Spec §3.4 Fail Closed）：任一 plugin 校验或 define 失败时 Promise reject，
 * 不返回部分注册表。使用 `isScreenComponentRegistryError()` 安全收窄错误类型。
 *
 * @param options 宿主 plugin 列表
 * @returns 不可变公共注册表（内置组件 + 宿主组件）
 */
export async function createScreenComponentRegistry(
  options?: CreateScreenComponentRegistryOptions,
): Promise<ScreenComponentRegistry> {
  const internalRegistry = await createInternalRegistry(options);
  return createPublicRegistry(internalRegistry);
}

export {
  isScreenComponentRegistryError,
  ScreenComponentRegistryErrorImpl,
  type CreateScreenComponentRegistryOptions,
  type ScreenComponentRegistryError,
  type ScreenComponentRegistryErrorCode,
};

// ===== 公共组件注册表类型（Spec §8.2） =====

export type {
  ScreenComponentRegistration,
  ScreenComponentRegistrationBase,
  ScreenComponentRegistry,
} from '../element/contracts.js';

export type {
  ScreenEditorAdapter,
  ScreenSdkEventMap,
  ScreenSdkProjectDraft,
  ScreenSdkProjectEnvelope,
} from '../element/contracts.js';

export type {
  ScreenAdapterError,
  ScreenDocument,
  ScreenDocumentInput,
  ScreenHostAdapter,
  ScreenProjectDraft,
  ScreenProjectEnvelope,
  ScreenProjectEnvelopeInput,
  ScreenProjectExport,
  ScreenProjectTransfer,
  ScreenPublicError,
  ScreenSdkDiagnostic,
  ScreenSdkDocument,
} from '@nebula/screen-editor-core';

export {
  SCREEN_DOCUMENT_VERSION,
  SCREEN_TRANSFER_FORMAT_VERSION,
} from '@nebula/screen-editor-core';

// ===== 组件插件协议（re-export from @nebula/screen-component-sdk） =====

export {
  BUILTIN_SCREEN_COMPONENT_TYPES,
  validateManifest,
} from '@nebula/screen-component-sdk';

export type {
  BuiltinScreenComponentType,
  ScreenComponentPlugin,
  ScreenComponentManifest,
  ScreenComponentValidationDiagnostic,
  ScreenComponentValidationResult,
} from '@nebula/screen-component-sdk';
