/**
 * 实例注册表 React Context（Spec §13.2 Phase 1, Task 1.3）
 *
 * 为每个 `ScreenEditorWorkbench` 实例注入 `ScreenComponentInstanceRegistry`，
 * 实现 Instance Isolation（Spec §8.4）：同页两个编辑器可使用不同组件集合，
 * 互不泄漏定义。
 *
 * Phase 1 现状：
 * - 默认注入 `DEFAULT_BUILTIN_REGISTRY`（仅 6 个内置组件）
 * - 外部组件 plugin.define() 路径在 Phase 2 接入
 * - 组件库、画布、蓝图通过 `useRegistry()` 读取当前实例注册表
 *
 * Context 模式与 `screen-editor-environment.tsx` 对齐：
 * - `useRegistry()`：外部使用抛错（Fail Closed）
 * - `useOptionalRegistry()`：返回 null（用于测试或不强依赖场景）
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { BUILTIN_COMPONENT_REGISTRATIONS } from './builtin-manifests';
import {
  buildInstanceRegistry,
  resolveScreenComponentRegistryForRuntime,
  type ScreenComponentInstanceRegistry,
} from './instance-registry';

const RegistryContext = createContext<ScreenComponentInstanceRegistry | null>(null);

/**
 * 默认内置注册表（模块级单例）。
 *
 * 在模块加载时构建一次，所有未显式注入 registry 的 `ScreenEditorWorkbench` 共享此实例。
 * 包含 6 个内置组件（text / bar-chart / rect / ellipse / image / button）。
 *
 * 构建失败（重复 type/tagName）会立即抛出 `InstanceRegistryBuildError`——
 * 这是内置组件配置错误，Fail Closed 比静默降级更安全。
 */
export const DEFAULT_BUILTIN_REGISTRY: ScreenComponentInstanceRegistry = buildInstanceRegistry(
  BUILTIN_COMPONENT_REGISTRATIONS,
);

interface RegistryProviderProps {
  /** 注入的实例注册表；缺省为 DEFAULT_BUILTIN_REGISTRY */
  registry?: ScreenComponentInstanceRegistry;
  children: ReactNode;
}

/**
 * 注入实例注册表 Provider。
 *
 * 与 `ScreenEditorEnvironmentProvider` 并列使用：
 * ```tsx
 * <ScreenEditorEnvironmentProvider ...>
 *   <RegistryProvider registry={customRegistry}>
 *     <ScreenEditorWorkbenchContent />
 *   </RegistryProvider>
 * </ScreenEditorEnvironmentProvider>
 * ```
 */
export function RegistryProvider({ registry, children }: RegistryProviderProps) {
  const value = useMemo(
    () => resolveScreenComponentRegistryForRuntime(registry) ?? DEFAULT_BUILTIN_REGISTRY,
    [registry],
  );
  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

/**
 * 读取当前实例注册表。
 *
 * 必须在 `RegistryProvider` 内部使用，否则抛错（Fail Closed）。
 * 与 `useScreenEditorEnvironment` 模式一致。
 */
export function useRegistry(): ScreenComponentInstanceRegistry {
  const registry = useContext(RegistryContext);
  if (registry === null) {
    throw new Error('useRegistry must be used within RegistryProvider');
  }
  return registry;
}

/**
 * 可选读取当前实例注册表。
 *
 * 在 `RegistryProvider` 外部返回 null，用于测试或不强依赖场景。
 * 与 `useOptionalScreenEditorEnvironment` 模式一致。
 */
export function useOptionalRegistry(): ScreenComponentInstanceRegistry | null {
  return useContext(RegistryContext);
}
