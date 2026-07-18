/**
 * 统一 finalize/cancel 协议（任务 3.2）
 *
 * 每类瞬时交互明确完成（finalize）、取消（cancel）、清理和 Store 提交责任。
 *
 * 协议覆盖：
 * - 尺寸浮层（DimensionTooltip）：交互结束时隐藏
 * - 辅助线（SmartGuides）：交互结束时清空
 * - pointer capture：交互结束时释放
 * - 临时工具：异常结束时清空临时栈
 * - 状态机恢复：任何结束路径都恢复到 idle
 *
 * Store 提交责任：
 * - finalize：有变化时提交历史（一条），无变化时不提交
 * - cancel：永不提交历史
 *
 * 使用方式：
 * 1. 交互开始时调用 `beginInteraction` 记录初始快照
 * 2. 交互过程中正常更新 UI 状态
 * 3. 正常结束时调用 `finalizeInteraction`，传入是否有变化
 * 4. 异常结束时调用 `cancelInteraction`
 */

import type { InteractionState } from '../hooks/use-interaction-state-machine';

/**
 * 交互类型，对应 InteractionState 中的瞬时交互状态。
 */
export type InteractionKind =
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'panning'
  | 'marquee-selecting'
  | 'creating'
  | 'sampling'
  | 'zooming';

/**
 * 交互开始时的快照，用于判断是否有变化。
 */
export interface InteractionSnapshot {
  /** 交互类型 */
  readonly kind: InteractionKind;
  /** 交互开始时选中组件的 ID 列表（用于判断选择是否变化） */
  readonly selectedIds: readonly string[];
  /** 交互开始时选中组件的位置快照（用于判断位置/尺寸是否变化） */
  readonly components: ReadonlyArray<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotate: number;
  }>;
}

/**
 * finalize 结果：描述最终执行的操作。
 */
export interface FinalizeResult {
  /** 是否有实际变化 */
  readonly hasChanges: boolean;
  /** 是否应该提交历史（hasChanges 为 true 时为 true） */
  readonly shouldCommitHistory: boolean;
  /** 需要执行的清理操作 */
  readonly cleanup: InteractionCleanup;
}

/**
 * cancel 结果：描述取消时执行的操作。
 */
export interface CancelResult {
  /** 是否应该提交历史（永远为 false） */
  readonly shouldCommitHistory: false;
  /** 需要执行的清理操作 */
  readonly cleanup: InteractionCleanup;
}

/**
 * 交互清理操作集合。
 *
 * 调用方按需执行这些操作。协议本身不执行副作用，
 * 只描述应该做什么，由调用方负责执行具体的 store 操作。
 */
export interface InteractionCleanup {
  /** 隐藏尺寸浮层 */
  readonly hideDimensionTooltip: boolean;
  /** 清空 Smart Guides 对齐线 */
  readonly clearAlignmentLines: boolean;
  /** 释放 pointer capture */
  readonly releasePointerCapture: boolean;
  /** 清空临时工具栈（异常恢复时） */
  readonly clearTemporaryTools: boolean;
  /** 恢复交互状态到 idle */
  readonly resetInteractionState: boolean;
}

/**
 * 默认清理操作：所有项都为 true。
 *
 * finalize 和 cancel 都执行完整清理，区别仅在于是否提交历史。
 */
const FULL_CLEANUP: InteractionCleanup = {
  hideDimensionTooltip: true,
  clearAlignmentLines: true,
  releasePointerCapture: true,
  clearTemporaryTools: false,
  resetInteractionState: true,
};

/**
 * 异常恢复时的清理操作：额外清空临时工具栈。
 */
const RECOVERY_CLEANUP: InteractionCleanup = {
  ...FULL_CLEANUP,
  clearTemporaryTools: true,
};

/**
 * 判断拖拽交互是否有实际变化。
 *
 * 比较快照中每个组件的位置，任一不同即为有变化。
 */
export function hasDragChanges(
  snapshot: InteractionSnapshot,
  currentComponents: ReadonlyArray<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotate: number;
  }>,
): boolean {
  if (snapshot.components.length !== currentComponents.length) return true;
  for (let i = 0; i < snapshot.components.length; i++) {
    const snap = snapshot.components[i];
    const curr = currentComponents[i];
    if (snap.id !== curr.id) return true;
    if (snap.x !== curr.x || snap.y !== curr.y) return true;
    if (snap.width !== curr.width || snap.height !== curr.height) return true;
    if (snap.rotate !== curr.rotate) return true;
  }
  return false;
}

/**
 * 判断选择交互是否有实际变化。
 */
export function hasSelectionChanges(
  snapshot: InteractionSnapshot,
  currentSelectedIds: readonly string[],
): boolean {
  if (snapshot.selectedIds.length !== currentSelectedIds.length) return true;
  const snapSet = new Set(snapshot.selectedIds);
  for (const id of currentSelectedIds) {
    if (!snapSet.has(id)) return true;
  }
  return false;
}

/**
 * 创建交互开始快照。
 *
 * 在交互开始时调用，记录初始状态用于后续判断是否有变化。
 */
export function createSnapshot(
  kind: InteractionKind,
  selectedIds: readonly string[],
  components: ReadonlyArray<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotate: number;
  }>,
): InteractionSnapshot {
  return { kind, selectedIds, components };
}

/**
 * finalize 交互：正常结束。
 *
 * - 有变化：提交历史 + 完整清理
 * - 无变化：不提交历史 + 完整清理（避免空历史记录）
 */
export function finalizeInteraction(hasChanges: boolean): FinalizeResult {
  return {
    hasChanges,
    shouldCommitHistory: hasChanges,
    cleanup: FULL_CLEANUP,
  };
}

/**
 * cancel 交互：异常结束或用户取消。
 *
 * - 永不提交历史
 * - 执行完整清理 + 清空临时工具栈
 */
export function cancelInteraction(): CancelResult {
  return {
    shouldCommitHistory: false,
    cleanup: RECOVERY_CLEANUP,
  };
}

/**
 * 判断给定的交互状态是否需要 finalize/cancel 协议。
 *
 * 只有瞬时交互状态需要协议，idle/hovering/text-editing/context-menu-open 不需要。
 */
export function requiresProtocol(state: InteractionState): boolean {
  return (
    state === 'dragging' ||
    state === 'resizing' ||
    state === 'rotating' ||
    state === 'panning' ||
    state === 'marquee-selecting' ||
    state === 'creating' ||
    state === 'sampling' ||
    state === 'zooming'
  );
}
