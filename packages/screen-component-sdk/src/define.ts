/**
 * defineScreenComponent - 组件包注册单元的 identity helper（Spec §7.6）
 *
 * 在组件包初始化时执行纯契约校验，不注册编辑器、不扫描 DOM、不发请求。
 * plugin.define() 必须幂等，返回 manifest.tagName 对应的构造器。
 */

import type { ScreenComponentPlugin } from './contracts/plugin.js';
import { validateManifest } from './validation/manifest-validator.js';

/**
 * 定义一个屏幕组件插件。
 *
 * - 执行 manifest 纯校验；校验失败时抛出 Error（包含 diagnostics 摘要）
 * - 不定义 Custom Element，不注册编辑器
 * - 返回原 plugin 对象（identity helper，不改变结构）
 *
 * @param plugin 组件插件 `{ manifest, define }`
 * @throws Error 当 manifest 校验失败时
 */
export function defineScreenComponent(plugin: ScreenComponentPlugin): ScreenComponentPlugin {
  const result = validateManifest(plugin.manifest);
  if (!result.ok) {
    const summary = result.diagnostics
      .map((d) => `  [${d.code}] ${d.path.join('.')}: ${d.message}`)
      .join('\n');
    throw new Error(
      `[screen-component-sdk] 组件 manifest 校验失败 (type=${plugin.manifest.type}):\n${summary}`,
    );
  }
  return plugin;
}
