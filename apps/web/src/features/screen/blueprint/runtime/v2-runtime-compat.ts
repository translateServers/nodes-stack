/**
 * V2 蓝图运行时兼容入口
 *
 * 将 V2 沙盒运行时、链路高亮、节点定位等运行时能力统一从此处导出，
 * 供 BlueprintSheetV2 引用。V1 运行时仍走 runtime/index.ts，互不干扰。
 */

export { useBlueprintSandboxRuntimeV2 } from './use-blueprint-sandbox-runtime-v2';
export type {
  BlueprintSandboxRuntimeV2,
  V2SandboxSimulationResult,
} from './use-blueprint-sandbox-runtime-v2';

export { useBlueprintSandboxHighlightV2 } from './use-blueprint-sandbox-highlight-v2';
export type {
  BlueprintSandboxHighlightV2,
  V2ExecutionPath,
} from './use-blueprint-sandbox-highlight-v2';

export { getV2NodeLocateComponentId } from './v2-get-node-locate-component';
