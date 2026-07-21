/**
 * 蓝图编译器模块入口
 *
 * 公开 API：
 * - `compileBlueprint`：编译蓝图 → 规则集 + 诊断
 * - 类型：Diagnostic / CompiledRule / CompiledAction / CompileResult 等
 */

export { compileBlueprint } from './compile.js';
export { buildIndexes } from './indexes.js';
export { detectCycles } from './cycle.js';
export { diagnoseNode } from './validate.js';

export type {
  BlueprintIndexes,
  CompileContext,
  CompileInput,
  CompileResult,
  CompiledAction,
  CompiledRule,
  Diagnostic,
  DiagnosticCode,
  DiagnosticLevel,
  EdgeIndex,
  NodeIndex,
} from './types.js';
