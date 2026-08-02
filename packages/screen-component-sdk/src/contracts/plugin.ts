/**
 * Component Plugin（Spec §7.6）
 *
 * 组件包对外导出的注册单元：`{ manifest, define }`。
 * define() 必须幂等，返回 manifest.tagName 对应的 CustomElementConstructor。
 * Custom Element 的全局注册由宿主 registry factory 在全部插件校验通过后统一提交，
 * 因此 define() 不得自行调用 customElements.define()。
 */

import type { ScreenComponentManifest } from './manifest.js';

export interface ScreenComponentPlugin {
  readonly manifest: ScreenComponentManifest;
  define(): CustomElementConstructor | Promise<CustomElementConstructor>;
}
