/**
 * 实例组件注册表（Spec §8.2 + §13.2 Phase 1）
 *
 * 区别于模块级 `moduleRegistry`（registry.ts）：实例注册表为每个编辑器实例提供
 * 不可变快照，支持同页两个编辑器使用不同组件集合，是实现 Instance Isolation
 * （Spec §8.4）的基础。
 *
 * Phase 1 现状（Spec §13.2 step 1）：
 * - 6 个内置组件通过 manifest 描述，renderer 暂由 legacy adapter 代理
 * - 外部组件 plugin.define() 路径在 Phase 2 接入
 * - 实例注册表读多写零：构建后只暴露 get/has/list，不导出 mutation API
 *
 * 原子构建（Spec §3.4 Fail Closed）：
 * - 重复 type 或 tagName 立即整体失败
 * - 不返回部分注册表，不静默覆盖
 * - 开发与生产行为一致
 */

import type {
  ComponentActionDefinition,
  ComponentEventDefinition,
  ComponentStyle,
} from '@nebula/shared';
import type {
  ScreenComponentManifestV1,
  ScreenComponentValidationCode,
} from '@nebula/screen-component-sdk';
import type { LucideIcon } from 'lucide-react';
import type { PropertySchema } from '../property-schema/types';

/**
 * renderer 统一入参的最小子集（与 ComponentModule.renderer 声明一致）。
 *
 * Phase 1 legacy adapter 仍接受完整 RendererComponentProps（dataSource / logic /
 * interaction / apiRawDataOverride），但 manifest 不暴露这些字段——这些是内置
 * bar-chart 的兼容通道，外部组件不得使用。
 */
export interface LegacyRendererProps {
  readonly componentId: string;
  readonly props: Record<string, unknown>;
  readonly style: ComponentStyle;
}

/**
 * 注册项的 legacy 兼容字段（Spec §13.2 Phase 1）。
 *
 * 这些字段只在迁移期间存在：当 6 个内置组件全部迁到 Custom Element 后会随
 * legacy adapter 一并删除（Spec §13.2 step 5）。外部组件 (`source: 'host'`)
 * 不使用这些字段——其渲染完全由 elementConstructor + manifest.tagName 负责。
 */
export interface ScreenComponentRegistrationLegacy {
  /** 内部 React renderer 兼容桥（仅尚未迁移到 Custom Element 的 built-in 使用）。 */
  readonly internalRenderer?: React.ComponentType<LegacyRendererProps>;
  /** legacy 属性面板 Schema（仅 built-in 在 Phase 1 使用） */
  readonly legacySchema?: PropertySchema;
  /** legacy lucide 图标组件（仅 built-in 在 Phase 1 使用） */
  readonly legacyIcon?: LucideIcon;
  /**
   * legacy lucide 图标名（如 'Type' / 'BarChart3'）。
   *
   * manifest 的 `icon` 字段是框架无关的 token（'text' / 'chart'），无法直接
   * 用于 `getIconByName` 查找 lucide 组件。此字段保留原始 lucide 名，
   * registry-queries.ts 派生 ComponentDefinition 时使用。
   */
  readonly legacyIconName?: string;
  /**
   * legacy 默认样式（Phase 1 仅 built-in 使用）。
   *
   * manifest 不包含 defaultStyle（样式由编辑器拥有，不属于组件协议）。
   * 但 createComponentInstance 需要组件特定的默认样式（如 text 的 color/fontSize、
   * rect 的 backgroundColor），此字段在 Phase 1 保留以避免行为变化。
   */
  readonly legacyDefaultStyle?: Partial<ComponentStyle>;
  /**
   * legacy 事件定义（Spec §7.5：组件动作不由外部组件注册）。
   *
   * Phase 1 仍由 manifest.events 派生，这里保留作为 legacy 兼容字段以便
   * registry-derive.ts 在 Phase 1.5 复用现有 getComponentEvents 路径。
   */
  readonly legacyEvents?: readonly ComponentEventDefinition[];
  /**
   * legacy 动作定义（Spec §7.5：动作不进入 manifest）。
   *
   * Phase 1 仍由 built-in definition.actions 提供（show/hide/toggleVisibility
   * + bar-chart 的 refreshData），registry-derive.ts 通过此字段派生。
   */
  readonly legacyActions?: readonly ComponentActionDefinition[];
}

/**
 * 组件注册项基类（Spec §8.2 ScreenComponentRegistrationBase 扩展）。
 *
 * 公共字段：`manifest` + 兼容 legacy 字段。
 * 区分 `source` 由 ScreenComponentRegistration discriminated union 完成。
 */
interface ScreenComponentRegistrationBase extends ScreenComponentRegistrationLegacy {
  /** 组件 manifest（Spec §7.2，注册表的权威数据源） */
  readonly manifest: Readonly<ScreenComponentManifestV1>;
}

/**
 * 组件注册项（Spec §8.2 + Phase 1 legacy 兼容字段）。
 *
 * - `source: 'built-in'`：内置组件，elementConstructor 可选（Phase 1 不提供）
 * - `source: 'host'`：宿主注册的外部组件，必须提供 elementConstructor
 */
export type ScreenComponentRegistration =
  | (ScreenComponentRegistrationBase & {
      readonly source: 'built-in';
      readonly elementConstructor?: CustomElementConstructor;
    })
  | (ScreenComponentRegistrationBase & {
      readonly source: 'host';
      readonly elementConstructor: CustomElementConstructor;
    });

/**
 * 不可变实例注册表（Spec §8.2）。
 *
 * 接口只暴露读操作；底层 Map 在构建时冻结，外部代码无法 mutation。
 * 两个编辑器实例可持有不同 registry，实现 Instance Isolation。
 */
export interface ScreenComponentInstanceRegistry {
  /** 注册项数量 */
  readonly size: number;
  /** 按 type 取注册项 */
  get(type: string): ScreenComponentRegistration | undefined;
  /** 判断 type 是否已注册 */
  has(type: string): boolean;
  /** 列出所有注册项（保持构建顺序，供组件库排序使用） */
  list(): readonly ScreenComponentRegistration[];
}

const publicRegistryFacades = new WeakMap<object, ScreenComponentInstanceRegistry>();
const internalRegistrySnapshots = new WeakSet<object>();

/**
 * 将公开 registry facade 关联到 core 所需的内部 registration snapshot。
 *
 * `@nebula/screen-sdk/components` 只向宿主暴露 manifest/source/constructor，避免
 * legacy renderer、schema 和图标字段成为公共 ABI；Workbench 在收到 facade 时通过
 * 此关联恢复内部 snapshot。
 */
export function linkScreenComponentRegistryFacade(
  facade: object,
  registry: ScreenComponentInstanceRegistry,
): void {
  publicRegistryFacades.set(facade, registry);
}

/**
 * 判断 registry 是否由 SDK public factory 创建。
 *
 * 这不是安全边界；它用于保护 factory 已建立的 manifest、constructor 和 snapshot
 * 不变量，避免公开 Custom Element 接受结构化伪造对象。
 */
export function isPublicScreenComponentRegistryFacade(value: unknown): boolean {
  return typeof value === 'object' && value !== null && publicRegistryFacades.has(value);
}

/**
 * 解析 SDK public facade 为 core registry。
 *
 * 只接受已关联的 public facade 或 `buildInstanceRegistry()` 创建的内部快照；未知的
 * 结构化对象不会进入 runtime。公开 Element 仍单独使用 facade 守卫给出稳定错误。
 */
export function resolveScreenComponentRegistryForRuntime(
  registry: ScreenComponentInstanceRegistry | undefined,
): ScreenComponentInstanceRegistry | undefined {
  if (registry === undefined || typeof registry !== 'object' || registry === null) return registry;
  return (
    publicRegistryFacades.get(registry) ??
    (internalRegistrySnapshots.has(registry) ? registry : undefined)
  );
}

/**
 * 注册表构建错误（Spec §8.2 ScreenComponentRegistryError 的 Phase 1 内部版）。
 *
 * Phase 1 暂不含 diagnostics 字段——manifest 校验失败应在 `validateManifest`
 * 阶段已报告；这里只关心构建期重复检测。
 *
 * 复用 SDK 已导出的 `ScreenComponentValidationCode`（包含 DUPLICATE_COMPONENT_TYPE
 * / DUPLICATE_COMPONENT_TAG_NAME 等），未来 Phase 6 SDK 公开 registry factory 时
 * 会升级为 spec §8.2 定义的 `ScreenComponentRegistryErrorCode`。
 */
export class InstanceRegistryBuildError extends Error {
  readonly code: ScreenComponentValidationCode;

  constructor(code: ScreenComponentValidationCode, message: string) {
    super(message);
    this.name = 'InstanceRegistryBuildError';
    this.code = code;
  }
}

/**
 * 不可变 registry 实现：包裹冻结的 Map，仅暴露读 API。
 */
class InstanceRegistryImpl implements ScreenComponentInstanceRegistry {
  private readonly entries: ReadonlyMap<string, ScreenComponentRegistration>;
  private readonly snapshot: readonly ScreenComponentRegistration[];

  constructor(entries: ReadonlyMap<string, ScreenComponentRegistration>) {
    this.entries = entries;
    this.snapshot = Object.freeze(Array.from(entries.values()));
  }

  get size(): number {
    return this.entries.size;
  }

  get(type: string): ScreenComponentRegistration | undefined {
    return this.entries.get(type);
  }

  has(type: string): boolean {
    return this.entries.has(type);
  }

  list(): readonly ScreenComponentRegistration[] {
    return this.snapshot;
  }
}

function cloneAndFreezeManifest(
  manifest: ScreenComponentManifestV1,
): Readonly<ScreenComponentManifestV1> {
  const clone = structuredClone(manifest);
  const seen = new WeakSet<object>();

  const freeze = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    seen.add(value);
    for (const nestedValue of Object.values(value)) freeze(nestedValue);
    Object.freeze(value);
  };

  freeze(clone);
  return clone;
}

function cloneAndFreezeRegistration(
  registration: ScreenComponentRegistration,
): ScreenComponentRegistration {
  const manifest = cloneAndFreezeManifest(registration.manifest);
  if (registration.source === 'host') {
    return Object.freeze({ ...registration, manifest, source: 'host' });
  }
  return Object.freeze({ ...registration, manifest, source: 'built-in' });
}

/**
 * 原子构建实例注册表（Spec §3.4 + §8.2 + §8.3）。
 *
 * 两阶段构建保证 Fail Closed：
 * 1. **校验阶段**：遍历全部 registration，检测重复 type 与重复 tagName
 *    （Spec §8.3: 同一 registry 中 type 重复 / 两个不同 type 使用同一 tagName 均失败）
 * 2. **构建阶段**：通过后才创建底层 Map，避免半成品状态
 *
 * 任意阶段失败立即抛出 `InstanceRegistryBuildError`，不返回部分注册表。
 * 开发与生产行为一致，禁止静默覆盖。
 *
 * @param registrations 待注册的组件列表
 * @throws InstanceRegistryBuildError 当出现重复 type / tagName 时
 */
export function buildInstanceRegistry(
  registrations: readonly ScreenComponentRegistration[],
): ScreenComponentInstanceRegistry {
  // Phase 1 校验阶段：原子检测重复
  const seenTypes = new Set<string>();
  const seenTagNames = new Set<string>();

  for (const reg of registrations) {
    const type = reg.manifest.type;
    const tagName = reg.manifest.tagName;

    if (seenTypes.has(type)) {
      throw new InstanceRegistryBuildError(
        'DUPLICATE_COMPONENT_TYPE',
        `[instance-registry] 重复注册组件 type: "${type}"`,
      );
    }
    if (seenTagNames.has(tagName)) {
      throw new InstanceRegistryBuildError(
        'DUPLICATE_COMPONENT_TAG_NAME',
        `[instance-registry] 重复注册组件 tagName: "${tagName}"`,
      );
    }
    seenTypes.add(type);
    seenTagNames.add(tagName);
  }

  // 构建阶段：全部通过后一次性写入 Map，避免半成品
  const map = new Map<string, ScreenComponentRegistration>();
  for (const reg of registrations) {
    const snapshot = cloneAndFreezeRegistration(reg);
    map.set(snapshot.manifest.type, snapshot);
  }

  const registry = new InstanceRegistryImpl(map);
  internalRegistrySnapshots.add(registry);
  return registry;
}
