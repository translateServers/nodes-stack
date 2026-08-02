/**
 * @nebula-example/indicator-card-vanilla 公共入口
 *
 * Vanilla 指标卡示例组件包：仅依赖 @nebula/screen-component-sdk，
 * 用于 component lab 验证"组件包定义 -> 宿主注册 -> 渲染"闭环（Spec §13.2 Phase 2, Task 2.3）。
 *
 * Phase 2 切片：
 * - 导出 manifest 常量与 plugin 定义
 * - 宿主通过 `plugin.define()` 获取构造器，不直接 import element class（Spec §7.6:
 *   plugin 是组件包对外注册单元的唯一身份）
 * - 不导出 propertyPanel / events（暂未声明）
 */

import type { ScreenComponentPlugin } from '@nebula/screen-component-sdk';
import { defineScreenComponent } from '@nebula/screen-component-sdk';
import { IndicatorCardElement } from './indicator-card-element.js';
import { indicatorCardManifest } from './manifest.js';

export {
  indicatorCardManifest,
  INDICATOR_CARD_TYPE,
  INDICATOR_CARD_TAG_NAME,
  INDICATOR_CARD_IMPLEMENTATION_VERSION,
} from './manifest.js';

/**
 * 指标卡 plugin（Spec §7.6）。
 *
 * - `manifest`：组件契约（identity + props + schema）
 * - `define()`：返回 IndicatorCardElement 构造器，必须幂等
 *
 * define() 幂等性（Spec §7.6 + §8.3）：
 * - 多次调用返回同一构造器引用（class declaration 是 module-level singleton）
 * - registry-factory 在 customElements.define 失败时不会重试
 * - customElements.get(tagName) 已存在且构造器一致时跳过注册
 */
export const indicatorCardPlugin: ScreenComponentPlugin = defineScreenComponent({
  manifest: indicatorCardManifest,
  define: () => IndicatorCardElement,
});
