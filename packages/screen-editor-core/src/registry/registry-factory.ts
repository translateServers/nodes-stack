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
  type ScreenComponentPlugin,
  type ScreenComponentValidationDiagnostic,
} from '@nebula/screen-component-sdk';
import type { ScreenSdkDiagnostic } from '../contracts/diagnostics.js';
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
  readonly components?: readonly ScreenComponentPlugin[];
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

// customElements 是 Document 级全局注册表。将“检查已有构造器 + 定义新 tagName”放入
// 同一个串行任务，避免并发 registry factory 在异步 define() 恢复后观察到过期状态。
let customElementCommitQueue: Promise<void> = Promise.resolve();

function toRegistryDiagnostics(
  code: ScreenComponentRegistryErrorCode,
  diagnostics: readonly ScreenComponentValidationDiagnostic[],
): ScreenSdkDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code,
    path: [...diagnostic.path],
    severity: 'error',
    message: REGISTRY_DIAGNOSTIC_MESSAGES[code],
  }));
}

/**
 * 解析单个已预检 host plugin 的 element constructor。
 *
 * 预检已由调用方完成；本函数只调用 plugin.define() 并验证其返回构造器。所有
 * Custom Element 的全局检查和注册由后续串行 commit 阶段统一处理。
 *
 * @returns host ScreenComponentRegistration（manifest 为 detached clone）
 * @throws ScreenComponentRegistryErrorImpl 任一步骤失败时
 */
async function resolveHostPlugin(
  plugin: ScreenComponentPlugin,
): Promise<Extract<ScreenComponentRegistration, { source: 'host' }>> {
  const { manifest } = plugin;

  // define() 只解析构造器；全局 Custom Element 注册在全部插件解析成功后统一提交。
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

  // 构建 host registration（manifest 深拷贝，Spec §8.2: 外部修改不得影响快照）
  return {
    source: 'host',
    manifest: structuredClone(manifest),
    elementConstructor: constructor,
  };
}

function validateHostManifests(hostPlugins: readonly ScreenComponentPlugin[]): void {
  for (const plugin of hostPlugins) {
    const validationResult = validateManifest(plugin.manifest);
    if (!validationResult.ok) {
      const code = mapValidationDiagnosticsToErrorCode(validationResult.diagnostics);
      throw new ScreenComponentRegistryErrorImpl(
        code,
        `[registry-factory] host plugin manifest 校验失败 (type=${plugin.manifest.type})`,
        toRegistryDiagnostics(code, validationResult.diagnostics),
      );
    }
  }
}

function assertUniqueManifestIdentities(hostPlugins: readonly ScreenComponentPlugin[]): void {
  const seenTypes = new Set(BUILTIN_COMPONENT_REGISTRATIONS.map((reg) => reg.manifest.type));
  const seenTagNames = new Set(BUILTIN_COMPONENT_REGISTRATIONS.map((reg) => reg.manifest.tagName));

  for (const plugin of hostPlugins) {
    const { type, tagName } = plugin.manifest;
    if (seenTypes.has(type)) {
      throw new ScreenComponentRegistryErrorImpl(
        'DUPLICATE_COMPONENT_TYPE',
        `[registry-factory] 重复注册组件 type: "${type}"`,
      );
    }
    if (seenTagNames.has(tagName)) {
      throw new ScreenComponentRegistryErrorImpl(
        'DUPLICATE_COMPONENT_TAG_NAME',
        `[registry-factory] 重复注册组件 tagName: "${tagName}"`,
      );
    }
    seenTypes.add(type);
    seenTagNames.add(tagName);
  }
}

function commitCustomElementDefinitions(
  registrations: readonly Extract<ScreenComponentRegistration, { source: 'host' }>[],
): void {
  for (const registration of registrations) {
    const existing = customElements.get(registration.manifest.tagName);
    if (existing !== undefined && existing !== registration.elementConstructor) {
      throw new ScreenComponentRegistryErrorImpl(
        'DUPLICATE_COMPONENT_TAG_NAME',
        `[registry-factory] tagName "${registration.manifest.tagName}" 已由不同构造器定义 (type=${registration.manifest.type})`,
      );
    }
  }

  for (const registration of registrations) {
    if (customElements.get(registration.manifest.tagName) !== undefined) continue;
    try {
      customElements.define(registration.manifest.tagName, registration.elementConstructor);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ScreenComponentRegistryErrorImpl(
        'COMPONENT_DEFINE_FAILED',
        `[registry-factory] customElements.define("${registration.manifest.tagName}") 失败 (type=${registration.manifest.type}): ${reason}`,
      );
    }
  }
}

function enqueueCustomElementCommit(
  registrations: readonly Extract<ScreenComponentRegistration, { source: 'host' }>[],
): Promise<void> {
  const commit = customElementCommitQueue.then(() => commitCustomElementDefinitions(registrations));
  // 后续 registry 构建不能被前一次失败的 commit 永久阻塞。
  customElementCommitQueue = commit.catch(() => undefined);
  return commit;
}

/**
 * 异步构建实例注册表（Spec §8.1 + §8.2）。
 *
 * 流程：
 * 1. 预检全部 host manifest 与 type/tagName 重复项
 * 2. 解析全部 plugin constructor，不触碰 customElements
 * 3. 串行检查并提交全局 Custom Element 定义
 * 4. 与 BUILTIN_COMPONENT_REGISTRATIONS 合并并构建不可变 snapshot
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
  // 1. 在任何 define()/customElements 副作用前完成 manifest 和重复项预检。
  validateHostManifests(hostPlugins);
  assertUniqueManifestIdentities(hostPlugins);

  const hostRegistrations: Extract<ScreenComponentRegistration, { source: 'host' }>[] = [];
  // 2. 解析全部构造器，任一失败时 factory 自身尚未注册任何 Custom Element。
  for (const plugin of hostPlugins) {
    const registration = await resolveHostPlugin(plugin);
    hostRegistrations.push(registration);
  }

  // 3. 所有可失败校验通过后才接触 browser-global customElements registry。
  await enqueueCustomElementCommit(hostRegistrations);

  // 4. 合并内置 + 宿主 registrations
  const allRegistrations: readonly ScreenComponentRegistration[] = [
    ...BUILTIN_COMPONENT_REGISTRATIONS,
    ...hostRegistrations,
  ];

  // 5. 构建不可变 snapshot（保留 buildInstanceRegistry 的最终防御性重复检测）
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
