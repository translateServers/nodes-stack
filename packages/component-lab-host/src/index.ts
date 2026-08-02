/**
 * @nebula-example/component-lab-host 公共入口
 *
 * 验证外部组件注册闭环的实验性 host（Spec §13.2 Phase 2, Task 2.3）：
 * - 通过 createScreenComponentRegistry 注册指标卡 plugin
 * - 通过 RegistryProvider + ComponentRenderer 验证 design 模式渲染
 * - 通过 CustomElementRenderer 直连验证 preview 模式渲染
 *
 * 不作为生产入口；Phase 6 接入 @nebula/screen-sdk/components 后由正式 SDK host 替代。
 */

export { ComponentLabHost, type ComponentLabHostProps } from './component-lab.js';
export { buildLabRegistry } from './lab-registry.js';
export { createIndicatorCardComponent } from './mock-component.js';
