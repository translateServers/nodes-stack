/**
 * @nebula/screen-component-sdk 公共入口
 *
 * 无框架依赖的组件作者 SDK：组件包协议、manifest 校验与测试辅助。
 * 不依赖 React、ReactDOM、Router、Query、Axios 或 editor-core。
 */

// 公共契约类型与常量
export * from './contracts/index.js';

// defineScreenComponent identity helper
export { defineScreenComponent } from './define.js';

// manifest 纯校验（供 registry 和测试使用）
export { validateManifest } from './validation/manifest-validator.js';
export {
  extractTypeMajorVersion,
  extractTagNameMajorVersion,
} from './validation/identity.js';
export { validateValueAgainstSchema } from './validation/props-schema.js';
export { checkJsonProps, checkJsonValue } from './validation/json-boundary.js';

// JSON Pointer props 工具（Task 3.1：属性面板 read/update/reset）
export {
  getPropByPointer,
  parseJsonPointer,
  resetPropByPointer,
  updatePropByPointer,
} from './props/json-pointer.js';

// 组件事件桥接（Spec §9.2 / Phase 4 Task 4.1）
export {
  validateComponentEvent,
  type ComponentEventBridgeCode,
  type ComponentEventBridgeFailure,
  type ComponentEventBridgeManifestLike,
  type ComponentEventBridgeResult,
  type ComponentEventBridgeSuccess,
} from './events/event-bridge.js';
