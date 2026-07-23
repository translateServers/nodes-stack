/**
 * 蓝图编辑器工具函数模块入口（任务 4.3 + 4.5 + 9.4 + 10.4 + 10.5）
 *
 * 公开 API：
 * - 引脚兼容性判定（lib/pin-compatibility.ts，任务 4.3）
 * - 网格吸附与对齐吸附（lib/snap-utils.ts，任务 4.5）
 * - 多选对齐与等距分布（lib/align-distribute.ts，任务 9.4）
 * - requestApi 脱敏工具（lib/request-api-mask.ts，任务 10.4）
 * - 动作参数模板插值（lib/template-interpolation.ts，任务 10.5）
 */

export {
  getCompatibleTargetPins,
  hasDuplicateEdge,
  hasPin,
  isConnectionValid,
  INPUT_PINS,
  OUTPUT_PINS,
} from './pin-compatibility';
export type {
  ConnectionCandidate,
  NodeIndex,
  PinCompatibility,
  PinId,
  PinIncompatibilityReason,
  PinKind,
} from './pin-compatibility';

export {
  applyAlignmentSnap,
  DEFAULT_ALIGNMENT_THRESHOLD,
  DEFAULT_GRID_SIZE,
  getAlignmentGuides,
  snapPositionToGrid,
  snapToGrid,
} from './snap-utils';
export type {
  AlignEdge,
  AlignmentGuides,
  NodeBounds,
} from './snap-utils';

export {
  alignNodes,
  applyAlignResultToNodes,
  distributeNodes,
} from './align-distribute';
export type {
  AlignMode,
  AlignNode,
  AlignResult,
  AlignResultItem,
  DistributeMode,
  DistributeResult,
} from './align-distribute';

export {
  maskHeaders,
  maskJsonBody,
  maskRequestForLog,
  maskUrlQuery,
  SECRET_MASK,
} from './request-api-mask';

export {
  interpolateActionConfig,
  interpolateTemplate,
} from './template-interpolation';
export type { TemplateContext } from './template-interpolation';
