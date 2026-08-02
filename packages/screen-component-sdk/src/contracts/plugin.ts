/**
 * Component Plugin（Spec §7.6）
 *
 * 组件包对外导出的注册单元：`{ manifest, define }`。
 * define() 必须幂等，返回 manifest.tagName 对应的 CustomElementConstructor。
 */

import type { ScreenComponentManifestV1 } from './manifest.js';

export interface ScreenComponentPluginV1 {
  readonly manifest: ScreenComponentManifestV1;
  define(): CustomElementConstructor | Promise<CustomElementConstructor>;
}
