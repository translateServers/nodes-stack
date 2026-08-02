/**
 * Nebula Web 共享组件注册配置（Spec §14.2, Task 6.4）
 *
 * 这是 apps/web 注册外部组件的**单一入口**——编辑路由、编辑器内预览和公开预览
 * 复用此 factory，不在三个入口分别维护组件列表。
 *
 * SDK 内置组件由下方白名单控制。
 * 宿主受信任的外部组件通过 `NEBULA_HOST_COMPONENT_PLUGINS` 声明。
 *
 * 安全边界（Spec §12.2 + §14.2）：
 * - 外部组件不得携带 dataSource / logic / interaction（正式 parser 返回
 *   `UNSUPPORTED_COMPONENT_CAPABILITY`，Spec §12.2）
 * - 组件注册表与数据 runtime 是正交能力：dynamic runtime 继续由
 *   `DYNAMIC_SCREEN_EDITOR_RUNTIME_PROFILE` 管理，不能用组件插件绕过
 *   static / dynamic 数据边界
 * - 注册表可用不改变文档协议或持久化边界
 *
 * Requirement 2（Explicit trusted registration）：
 * - 只有显式传入 `NEBULA_HOST_COMPONENT_PLUGINS` 的 plugin 才会被注册
 * - 文档中引用未注册 type 时返回 `MISSING_COMPONENT_DEFINITION`
 *
 * Requirement 4（Instance isolation）：
 * - factory 返回不可变快照，同页两个编辑器可传入不同 registry
 * - 当前 apps/web 所有入口共享同一 registry 实例（单例缓存）
 *
 * Requirement 8（Registry-aware document validation）：
 * - 文档 parser 使用此 registry 校验组件 type 和 props
 * - 缺少定义时不覆盖当前项目，返回稳定 diagnostics
 */

import {
  createScreenComponentRegistry,
  isScreenComponentRegistryError,
  type BuiltinScreenComponentType,
  type ScreenComponentPlugin,
  type ScreenComponentRegistry,
  type ScreenComponentRegistryError,
} from '@nebula/screen-sdk/components';
import { indicatorCardPlugin } from '@nebula-example/indicator-card-vanilla';

/**
 * 宿主允许加载的内置组件 type。
 *
 * apps/web 当前不加载 ellipse。未加载的 type 不会进入组件库，引用它的文档会在
 * registry-aware 校验阶段被拒绝。
 */
const NEBULA_HOST_BUILT_IN_COMPONENT_TYPES: readonly BuiltinScreenComponentType[] = [
  'text',
  'bar-chart',
  'rect',
  'image',
  'button',
];

/**
 * 宿主受信任的外部组件 plugin 列表。
 *
 * 新增外部组件时在此数组添加 plugin。指标卡作为 apps/web 的首个自定义组件，用于验证
 * 宿主注册、组件库拖入、属性面板和预览的完整链路。
 *
 * 注意：添加外部组件后，宿主适配器必须在保存前使用同一注册表完成文档校验。
 */
const NEBULA_HOST_COMPONENT_PLUGINS: readonly ScreenComponentPlugin[] = [indicatorCardPlugin];

/**
 * 单例 registry promise 缓存。
 *
 * 所有入口点共享同一 registry 实例，避免重复构建和 customElements.define 冲突。
 * Promise reject 时缓存被清除，允许重试。
 */
let registryPromise: Promise<ScreenComponentRegistry> | null = null;

/**
 * 创建 Nebula Web 共享组件注册表（Spec §14.2）。
 *
 * 返回单例 promise——首次调用触发 `createScreenComponentRegistry()`，
 * 后续调用返回同一 promise。registry 内部组合选中的内置组件与
 * `NEBULA_HOST_COMPONENT_PLUGINS`。
 *
 * 失败行为（Spec §3.4 Fail Closed）：
 * - 任一 plugin manifest 校验或 define 失败时 promise reject
 * - 不返回部分注册表
 * - 使用 `isScreenComponentRegistryError()` 安全收窄错误类型
 * - reject 后清除缓存，允许宿主重试或降级
 *
 * @returns 共享组件注册表 promise
 */
export function getNebulaScreenComponentRegistry(): Promise<ScreenComponentRegistry> {
  if (registryPromise === null) {
    registryPromise = createScreenComponentRegistry({
      builtInComponents: NEBULA_HOST_BUILT_IN_COMPONENT_TYPES,
      components: NEBULA_HOST_COMPONENT_PLUGINS,
    });
    // reject 时清除缓存，允许重试
    registryPromise.catch(() => {
      registryPromise = null;
    });
  }
  return registryPromise;
}

export {
  isScreenComponentRegistryError,
  type ScreenComponentRegistry,
  type ScreenComponentRegistryError,
};
