/**
 * 蓝图编辑器工具函数模块入口（任务 4.3 + 4.5）
 *
 * 公开 API：
 * - 引脚兼容性判定（lib/pin-compatibility.ts，任务 4.3）
 * - 网格吸附与对齐吸附（lib/snap-utils.ts，任务 4.5）
 *
 * 后续任务将填充：
 * - 节点类型注册（lib/node-types.ts）
 * - 边类型注册（lib/edge-types.ts）
 * - 剪贴板序列化与反序列化（lib/clipboard.ts）
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
