/**
 * Phase 2 实验性内部入口（Spec §13.2 step 2, Task 2.1 + Task 2.2）
 *
 * 单独入口避免循环依赖：
 * - `internal.ts` 被 `quick-event-editor.tsx` 等组件模块导入
 * - 若从此处导出 `registry-factory`，会形成循环：
 *   internal → registry-factory → builtin-manifests → text-component → schemas → quick-event-editor → internal
 * - 独立入口确保 `registry-factory` 仅在显式 `@nebula/screen-editor-core/experimental`
 *   被导入时加载，不污染组件模块的初始化图
 *
 * 不从生产 `.` 入口导出；Phase 6 由 @nebula/screen-sdk/components 包装并对外暴露
 * spec §8.2 定义的公共 `ScreenComponentRegistry` 接口。
 *
 * Task 2.3 补充：导出 CustomElementRenderer 与 createHostElementRenderer 供
 * component lab host 验证 preview 模式渲染（ComponentRenderer 当前硬编码
 * mode="design"，Phase 5 接入预览路径时由上层透传）。
 */

export {
  createScreenComponentRegistry,
  isScreenComponentRegistryError,
  ScreenComponentRegistryErrorImpl,
  type CreateScreenComponentRegistryOptions,
  type ScreenComponentRegistryError,
  type ScreenComponentRegistryErrorCode,
} from './registry/registry-factory.js';

export {
  CustomElementRenderer,
  createHostElementRenderer,
  type CustomElementRendererProps,
} from './registry/custom-element-renderer.js';

export {
  RegistryProvider,
  useRegistry,
  useOptionalRegistry,
  DEFAULT_BUILTIN_REGISTRY,
} from './registry/registry-context.js';
export { linkScreenComponentRegistryFacade } from './registry/instance-registry.js';
export type {
  ScreenComponentInstanceRegistry,
  ScreenComponentRegistration,
} from './registry/instance-registry.js';
