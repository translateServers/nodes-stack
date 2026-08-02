/**
 * @nebula/screen-editor-core/dynamic 子入口。
 *
 * screen-dynamic-sdk 专用的动态文档契约、数据执行端口与 React 桥。
 * 静态 SDK（@nebula/screen-sdk）不得导入本入口。
 */

export * from './contracts/dynamic-document.js';
export * from './dynamic/data-adapter-port.js';
export * from './dynamic/data-coordinator.js';
export * from './dynamic/data-runtime.js';
export type { ScreenSdkDiagnostic } from './contracts/diagnostics.js';
export type { ScreenContractParseResult } from './contracts/document.js';
