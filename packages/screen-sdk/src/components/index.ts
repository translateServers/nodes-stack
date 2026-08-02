/**
 * `@nebula/screen-sdk/components` — 显式 opt-in 入口（Spec §14.1, Task 6.3）
 *
 * 0.2 SDK 通过此入口显式启用外部组件持久化。默认 `@nebula/screen-sdk` 主入口
 * 不导入此模块，V1 Adapter 路径保持不变（Spec §3.2 Compatibility Before Replacement）。
 *
 * 导出内容：
 * - `createScreenComponentRegistry()`：registry 工厂，返回公共 `ScreenComponentRegistry`
 * - V2 Adapter / Document / Transfer / Snapshot / Error / Diagnostic 公共类型
 * - V1/V2 闭合联合类型与 V2 事件 map（来自 `v2-contracts.ts`）
 * - 组件插件协议类型（re-export from `@nebula/screen-component-sdk`）
 * - Registry 错误类型与守卫
 *
 * 安全边界（Spec §3.3 + §12.3）：
 * - 默认 V1 Adapter + 默认 registry 不自动升级文档
 * - 外部 registry 必须搭配 `ScreenHostAdapterV2`，否则 SDK 在 load 前拒绝
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

import type {
  ScreenComponentRegistration,
  ScreenComponentRegistry,
} from '../element/v2-contracts.js';

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
 * 自动包含 SDK 内置 6 组件（text / bar-chart / rect / ellipse / image / button），
 * 宿主只需传入额外组件 plugin。返回不可变 `ScreenComponentRegistry` 公共接口，
 * 不暴露内部 legacy 兼容字段。
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
} from '../element/v2-contracts.js';

// ===== V1/V2 闭合联合类型与 V2 事件 map（Spec §14.1） =====

export type {
  NebulaScreenEditorEventMapV2,
  ScreenEditorAdapterV2,
  ScreenOperationSuccessDetailV2,
  ScreenSdkProjectDraft,
  ScreenSdkProjectEnvelope,
} from '../element/v2-contracts.js';

// ===== V2 Adapter / Document / Error / Diagnostic 类型 =====

export type {
  ScreenAdapterErrorV2,
  ScreenHostAdapterV2,
  ScreenPublicErrorV2,
  ScreenSnapshotAdapterV2,
  ScreenDocumentV2,
  ScreenDocumentV2Input,
  ScreenProjectDraftV2,
  ScreenProjectEnvelopeInputV2,
  ScreenProjectEnvelopeV2,
  ScreenProjectExportV2,
  ScreenProjectTransferV2,
  ScreenSdkDiagnosticV2,
  ScreenSdkDocument,
  ScreenSdkV2ComponentWire,
} from '@nebula/screen-editor-core';

// V2 版本常量（供宿主做版本判断）
export {
  SCREEN_DOCUMENT_V2_VERSION,
  SCREEN_TRANSFER_FORMAT_VERSION_V2,
} from '@nebula/screen-editor-core';

// ===== 组件插件协议（re-export from @nebula/screen-component-sdk） =====

export type { ScreenComponentPluginV1 } from '@nebula/screen-component-sdk';

export type {
  ScreenComponentManifestV1,
  ScreenComponentValidationDiagnostic,
  ScreenComponentValidationResult,
} from '@nebula/screen-component-sdk';

// manifest 纯校验（供宿主在注册前预检）
export { validateManifest } from '@nebula/screen-component-sdk';
