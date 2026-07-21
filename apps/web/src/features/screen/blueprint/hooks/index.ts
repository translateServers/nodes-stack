/**
 * 蓝图编辑器 React Hooks 模块入口（任务 4.5 + 4.6）
 *
 * 公开 API：
 * - useBlueprintSelection：多选与框选状态（任务 4.5）
 * - useBlueprintDrag：节点拖拽吸附与位置写回（任务 4.5）
 * - useBlueprintViewport：视口缩放平移控制（任务 4.6）
 *
 * 后续任务将填充：
 * - useBlueprintEditor：编辑器状态管理
 * - useBlueprintNodesEdges：节点与边的 React Flow 状态同步
 * - useBlueprintClipboard：剪贴板复制粘贴
 * - useBlueprintShortcuts：Sheet 快捷键分层
 */

export { DEFAULT_SELECTION_CONFIG, useBlueprintSelection } from './use-blueprint-selection';
export type {
  SelectionModelConfig,
  UseBlueprintSelectionOptions,
} from './use-blueprint-selection';
export { useBlueprintDrag } from './use-blueprint-drag';
export type {
  UseBlueprintDragOptions,
  UseBlueprintDragResult,
} from './use-blueprint-drag';
export {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  useBlueprintViewport,
} from './use-blueprint-viewport';
export type {
  UseBlueprintViewportOptions,
  UseBlueprintViewportResult,
} from './use-blueprint-viewport';
