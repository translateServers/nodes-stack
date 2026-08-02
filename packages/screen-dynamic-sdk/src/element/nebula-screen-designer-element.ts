/**
 * `<nebula-screen-designer>`：大屏设计器 Custom Element。
 *
 * 属性（property，非 attribute）：
 * - document：V3 动态文档（读写，深拷贝快照）
 * - dataAdapter：宿主数据适配端口（可选，设计态不强制）
 * - componentRegistry：组件注册表（挂载后冻结）
 * - options / readonly / theme
 *
 * 方法：whenReady / save / publish / getDocument / undo / redo / validate / reload
 * 事件：nebula-ready / nebula-error / nebula-dirty-change / nebula-save-success /
 *       nebula-publish-success
 */

import { mountDesignerRuntime } from '../runtime/designer-runtime.js';
import type { ScreenDynamicMountOptions } from './contracts.js';
import { ScreenDynamicElementBase } from './base-element.js';

export class NebulaScreenDesignerElement extends ScreenDynamicElementBase {
  protected mount(options: ScreenDynamicMountOptions) {
    return mountDesignerRuntime(options);
  }
}
