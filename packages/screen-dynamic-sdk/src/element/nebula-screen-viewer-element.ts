/**
 * `<nebula-screen-viewer>`：大屏查看器 Custom Element。
 *
 * 属性（property，非 attribute）：
 * - document：V3 动态文档（published/preview/release-audit 来源由宿主决定）
 * - dataAdapter：宿主数据适配端口（必填，查看器执行数据）
 * - componentRegistry：组件注册表（挂载后冻结）
 * - options.refreshIntervalSeconds：定时刷新（秒，0=不刷新）
 * - theme
 *
 * 方法：whenReady / reload / getDocument
 * 事件：nebula-ready / nebula-error / nebula-data-error
 */

import { mountViewerRuntime } from '../runtime/viewer-runtime.js';
import type { ScreenDynamicMountOptions } from './contracts.js';
import { ScreenDynamicElementBase } from './base-element.js';

export class NebulaScreenViewerElement extends ScreenDynamicElementBase {
  protected mount(options: ScreenDynamicMountOptions) {
    return mountViewerRuntime(options);
  }
}
