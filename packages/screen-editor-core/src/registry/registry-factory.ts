/**
 * 实例注册表工厂（Spec §8.1 + §8.2 + §13.2 Phase 2, Task 2.1）
 *
 * 实验性内部入口：异步构建 `ScreenComponentInstanceRegistry`，自动组合内置 legacy
 * registrations 与宿主 plugins。
 *
 * Phase 2 现状（Spec §13.2 step 2）：
 * - 内置 6 组件通过 BUILTIN_COMPONENT_REGISTRATIONS 注入（source='built-in'）
 * - 宿主 plugin 通过 options.components 传入（source='host'）
 * - 每个 host plugin 必须通过 manifest 校验 + 幂等 define() + tagName 一致性校验
 * - 任一失败时 Promise reject，不返回部分注册表（Spec §3.4 Fail Closed）
 *
 * 实验入口说明：
 * - 本模块从 `@nebula/screen-editor-core/internal` 导出，不从生产 `.` 入口导出
 * - 生产入口 `@nebula/screen-sdk/components` 在 Phase 6 接入时包装此工厂并对外暴露
 *   spec §8.2 定义的公共 `ScreenComponentRegistry` 接口（不带 legacy 字段）
 *
 * Spec §8.4 全局 customElements 边界：
 * - registry 实例隔离 type 集合，但 customElements.define 是 Document 全局能力
 * - 失败时已定义的 customElements 无法撤销；重试时幂等校验保证一致性
 */

import {
  validateManifest,
  type ScreenComponentPluginV1,
  type ScreenComponentValidationDiagnostic,
} from '@nebula/screen-component-sdk';
import type { ScreenSdkDiagnosticV2 } from '../contracts/diagnostics.js';
import { BUILTIN_COMPONENT_REGISTRATIONS } from './builtin-manifests';
import {
  buildInstanceRegistry,
  InstanceRegistryBuildError,
  type ScreenComponentInstanceRegistry,
  type ScreenComponentRegistration,
} from './instance-registry';
import {
  ScreenComponentRegistryErrorImpl,
  type ScreenComponentRegistryErrorCode,
} from './registry-error.js';

// re-export registry error 类型与守卫（Spec §8.2）
// 详见 registry-error.ts：本模块曾直接定义这些类型，Phase 5 Task 5.3 抽离到独立
// 模块以打破 contracts/adapter.ts → registry-factory.ts → builtin-manifests.ts
// → ... → contracts/index.ts 的循环依赖。
export type {
  ScreenComponentRegistryErrorCode,
  ScreenComponentRegistryError,
} from './registry-error.js';
export {
  ScreenComponentRegistryErrorImpl,
  isScreenComponentRegistryError,
} from './registry-error.js';

/**
 * Registry 工厂选项（Spec §8.2 CreateScreenComponentRegistryOptions）。
 *
 * `components` 是宿主额外注册的组件 plugin；内置 6 组件由工厂自动注入。
 */
export interface CreateScreenComponentRegistryOptions {
  /** 宿主额外注册的组件 plugin 列表 */
  readonly components?: readonly ScreenComponentPluginV1[];
}

/**
 * 将 manifest 校验诊断映射为稳定的 registry 错误码。
 *
 * - apiVersion 不匹配 → UNSUPPORTED_COMPONENT_API_VERSION
 * - 其他字段非法 → INVALID_COMPONENT_MANIFEST
 */
function mapValidationDiagnosticsToErrorCode(
  diagnostics: readonly ScreenComponentValidationDiagnostic[],
): ScreenComponentRegistryErrorCode {
  if (diagnostics.some((d) => d.code === 'UNSUPPORTED_COMPONENT_API_VERSION')) {
    return 'UNSUPPORTED_COMPONENT_API_VERSION';
  }
  return 'INVALID_COMPONENT_MANIFEST';
}

const REGISTRY_DIAGNOSTIC_MESSAGES: Record<ScreenComponentRegistryErrorCode, string> = {
  INVALID_COMPONENT_MANIFEST: '组件 manifest 校验失败。',
  UNSUPPORTED_COMPONENT_API_VERSION: '组件 API 版本不受支持。',
  DUPLICATE_COMPONENT_TYPE: '组件 type 已被注册。',
  DUPLICATE_COMPONENT_TAG_NAME: '组件 tagName 已被注册。',
  COMPONENT_DEFINE_FAILED: '组件定义失败。',
};

function toRegistryDiagnostics(
  code: ScreenComponentRegistryErrorCode,
  diagnostics: readonly ScreenComponentValidationDiagnostic[],
): ScreenSdkDiagnosticV2[] {
  return diagnostics.map((diagnostic) => ({
    code,
    path: [...diagnostic.path],
    severity: 'error',
    message: REGISTRY_DIAGNOSTIC_MESSAGES[code],
  }));
}

/**
 * 处理单个 host plugin：校验 manifest → 调用 define() → 验证构造器一致性。
 *
 * 步骤（Spec §7.6 + §8.3）：
 * 1. validateManifest 纯校验；失败时直接 reject
 * 2. 调用 plugin.define()（必须幂等，返回 manifest.tagName 对应构造器）
 * 3. 检查 customElements.get(tagName)：
 *    - 未定义 → customElements.define(tagName, constructor)
 *    - 已定义且构造器一致 → 幂等，跳过
 *    - 已定义但构造器不一致 → DUPLICATE_COMPONENT_TAG_NAME
 *
 * @returns host ScreenComponentRegistration（manifest 为 detached clone）
 * @throws ScreenComponentRegistryErrorImpl 任一步骤失败时
 */
async function processHostPlugin(
  plugin: ScreenComponentPluginV1,
): Promise<ScreenComponentRegistration> {
  const { manifest } = plugin;

  // 1. manifest 纯校验
  const validationResult = validateManifest(manifest);
  if (!validationResult.ok) {
    const code = mapValidationDiagnosticsToErrorCode(validationResult.diagnostics);
    throw new ScreenComponentRegistryErrorImpl(
      code,
      `[registry-factory] host plugin manifest 校验失败 (type=${manifest.type})`,
      toRegistryDiagnostics(code, validationResult.diagnostics),
    );
  }

  // 2. 调用 plugin.define()（必须幂等）
  let constructor: CustomElementConstructor;
  try {
    constructor = await plugin.define();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ScreenComponentRegistryErrorImpl(
      'COMPONENT_DEFINE_FAILED',
      `[registry-factory] plugin.define() 抛出错误 (type=${manifest.type}): ${reason}`,
    );
  }

  // 校验返回值是合法构造器
  if (typeof constructor !== 'function') {
    throw new ScreenComponentRegistryErrorImpl(
      'COMPONENT_DEFINE_FAILED',
      `[registry-factory] plugin.define() 返回值不是构造器 (type=${manifest.type})`,
    );
  }

  // 3. 验证构造器与 customElements 全局注册结果一致（Spec §8.3 + §8.4）
  const tagName = manifest.tagName;
  const existing = customElements.get(tagName);
  if (existing === undefined) {
    // 尚未定义：调用 customElements.define
    try {
      customElements.define(tagName, constructor);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ScreenComponentRegistryErrorImpl(
        'COMPONENT_DEFINE_FAILED',
        `[registry-factory] customElements.define("${tagName}") 失败 (type=${manifest.type}): ${reason}`,
      );
    }
  } else if (existing !== constructor) {
    // 已定义但构造器不一致（Spec §8.3: tagName 已由不同构造器定义）
    throw new ScreenComponentRegistryErrorImpl(
      'DUPLICATE_COMPONENT_TAG_NAME',
      `[registry-factory] tagName "${tagName}" 已由不同构造器定义 (type=${manifest.type})`,
    );
  }
  // else: existing === constructor，幂等成功

  // 4. 构建 host registration（manifest 深拷贝，Spec §8.2: 外部修改不得影响快照）
  return {
    source: 'host',
    manifest: structuredClone(manifest),
    elementConstructor: constructor,
  };
}

/**
 * 异步构建实例注册表（Spec §8.1 + §8.2）。
 *
 * 流程：
 * 1. 逐个处理 host plugin：校验 manifest → 调用 define() → 验证构造器
 * 2. 收集 host registrations（manifest 为 detached clone）
 * 3. 与 BUILTIN_COMPONENT_REGISTRATIONS 合并
 * 4. 调用 buildInstanceRegistry 原子检测重复 type/tagName
 * 5. 返回不可变 ScreenComponentInstanceRegistry
 *
 * 失败行为（Spec §3.4 Fail Closed）：
 * - manifest 校验失败 → INVALID_COMPONENT_MANIFEST / UNSUPPORTED_COMPONENT_API_VERSION
 * - plugin.define() 抛错或返回非构造器 → COMPONENT_DEFINE_FAILED
 * - customElements.define 失败或构造器冲突 → COMPONENT_DEFINE_FAILED / DUPLICATE_COMPONENT_TAG_NAME
 * - 重复 type / tagName → DUPLICATE_COMPONENT_TYPE / DUPLICATE_COMPONENT_TAG_NAME
 * - 任一失败 Promise reject，不返回部分注册表
 *
 * @param options 宿主 plugin 列表
 * @returns 不可变实例注册表（包含内置 6 组件 + 宿主组件）
 */
export async function createScreenComponentRegistry(
  options?: CreateScreenComponentRegistryOptions,
): Promise<ScreenComponentInstanceRegistry> {
  const hostPlugins = options?.components ?? [];
  const hostRegistrations: ScreenComponentRegistration[] = [];

  // 1. 逐个处理 host plugin（任一失败立即 reject）
  for (const plugin of hostPlugins) {
    const registration = await processHostPlugin(plugin);
    hostRegistrations.push(registration);
  }

  // 2. 合并内置 + 宿主 registrations
  const allRegistrations: readonly ScreenComponentRegistration[] = [
    ...BUILTIN_COMPONENT_REGISTRATIONS,
    ...hostRegistrations,
  ];

  // 3. 原子构建（buildInstanceRegistry 检测重复 type/tagName）
  try {
    return buildInstanceRegistry(allRegistrations);
  } catch (err) {
    // 将 InstanceRegistryBuildError 转换为 ScreenComponentRegistryError。
    // buildInstanceRegistry 只抛 DUPLICATE_COMPONENT_TYPE / DUPLICATE_COMPONENT_TAG_NAME，
    // 两者均在 ScreenComponentRegistryErrorCode 联合内，cast 安全。
    if (err instanceof InstanceRegistryBuildError) {
      throw new ScreenComponentRegistryErrorImpl(
        err.code as ScreenComponentRegistryErrorCode,
        err.message,
      );
    }
    // 未知错误（理论上不应到达此分支）
    throw err;
  }
}
