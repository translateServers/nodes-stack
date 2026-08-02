/**
 * Component Lab Registry（Spec §13.2 Phase 2, Task 2.3）
 *
 * 使用 createScreenComponentRegistry 构建"内置 6 组件 + 指标卡"的实例注册表。
 *
 * 这是 component lab host 的核心配置：宿主通过显式传入 indicatorCardPlugin，
 * 让指标卡出现在组件库并可在画布渲染。移除 plugin 后，registry 仅包含内置 6 组件，
 * 行为与生产默认 registry 一致（Spec §13.2 Checkpoint 2: 移除指标卡 plugin 后
 * 默认六组件行为不变）。
 *
 * 异步构建：plugin.define() 可能是异步的（Spec §7.6），createScreenComponentRegistry
 * 返回 Promise。宿主应在 React mount 前完成构建，避免渲染期间 registry 为 null。
 */

import {
  createScreenComponentRegistry,
  type ScreenComponentInstanceRegistry,
} from '@nebula/screen-editor-core/experimental';
import { indicatorCardPlugin } from '@nebula-example/indicator-card-vanilla';

/**
 * 构建 component lab 用的实例注册表。
 *
 * 内置 6 组件由 createScreenComponentRegistry 自动注入（BUILTIN_COMPONENT_REGISTRATIONS），
 * 指标卡通过 components 选项显式注册。
 *
 * @returns 不可变实例注册表（内置 6 + 指标卡）
 * @throws ScreenComponentRegistryError 当 manifest 校验失败、define() 抛错或 tagName 冲突时
 */
export async function buildLabRegistry(): Promise<ScreenComponentInstanceRegistry> {
  return createScreenComponentRegistry({
    components: [indicatorCardPlugin],
  });
}

export {
  indicatorCardPlugin,
  INDICATOR_CARD_TYPE,
  INDICATOR_CARD_TAG_NAME,
} from '@nebula-example/indicator-card-vanilla';
