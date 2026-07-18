/**
 * 任务 8.1：统一缩放边界和锚点更新函数
 *
 * 所有缩放入口（工具点击、滚轮、快捷键、状态栏）复用同一缩放上下限和视口更新语义，
 * 避免在多处重复 clamp + zoomAtPoint 调用链。
 *
 * 边界：scale ∈ [MIN_SCALE, MAX_SCALE] = [0.1, 5]
 *
 * 调用方只需提供：
 * - 当前 scale / offset
 * - 光标屏幕坐标（锚点）
 * - 期望的缩放因子（> 1 放大，< 1 缩小）
 *
 * 返回结果保证：
 * - scale 不超出边界
 * - factor 经边界 clamp 后的实际值用于计算 offset
 * - 光标点对应的画布坐标在缩放前后保持不变（锚点不变性）
 */

import { zoomAtPoint, type ZoomAtPointParams, type ZoomAtPointResult } from './canvas-event-router';

/** 最小允许缩放比例（10%） */
export const MIN_SCALE = 0.1;
/** 最大允许缩放比例（500%） */
export const MAX_SCALE = 5;

/**
 * 缩放工具点击放大的固定因子（任务 8.2）。
 * 每次点击放大 1.5 倍。
 */
export const ZOOM_TOOL_IN_FACTOR = 1.5;

/**
 * 缩放工具反向缩小的固定因子（任务 8.3）。
 * 与放大因子互为倒数，保证反复点击能回到原始 scale。
 */
export const ZOOM_TOOL_OUT_FACTOR = 1 / ZOOM_TOOL_IN_FACTOR;

/**
 * 滚轮/快捷键缩放的步长因子。
 * 与 screen-canvas.tsx 原有 wheel handler 保持一致（1.1 / 1/1.1）。
 */
export const WHEEL_ZOOM_FACTOR = 1.1;

/**
 * 将目标 scale 限制在 [MIN_SCALE, MAX_SCALE] 区间内。
 */
export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * 计算受边界约束的实际缩放因子。
 *
 * 当期望因子会导致 newScale 超出边界时，返回经 clamp 后的实际因子，
 * 确保最终 scale 严格落在 [MIN_SCALE, MAX_SCALE] 区间内。
 *
 * @param currentScale - 当前缩放比例
 * @param desiredFactor - 期望的缩放因子（> 1 放大，< 1 缩小）
 * @returns 经边界约束后的实际因子；若当前已在边界且试图越界则返回 1（无变化）
 */
export function computeClampedFactor(currentScale: number, desiredFactor: number): number {
  const rawNewScale = currentScale * desiredFactor;
  const clampedScale = clampScale(rawNewScale);
  // 当前 scale 为 0 时返回 1 避免除零
  if (currentScale === 0) return 1;
  return clampedScale / currentScale;
}

/**
 * 任务 8.1：统一的缩放边界 + 锚点更新函数。
 *
 * 输入参数与 zoomAtPoint 相同，但会先对因子进行边界约束，
 * 确保返回的 scale 落在 [MIN_SCALE, MAX_SCALE] 区间内。
 *
 * 若当前 scale 已在边界且试图越界（如 scale=5 时继续放大），
 * 返回原 scale 与原 offset（无变化）。
 */
export function zoomWithBoundary(params: ZoomAtPointParams): ZoomAtPointResult {
  const { currentScale, currentOffset, cursorX, cursorY, factor } = params;
  const actualFactor = computeClampedFactor(currentScale, factor);
  if (actualFactor === 1) {
    return { scale: currentScale, offset: currentOffset };
  }
  return zoomAtPoint({
    currentScale,
    currentOffset,
    cursorX,
    cursorY,
    factor: actualFactor,
  });
}

/**
 * 任务 8.2/8.3：缩放工具点击缩放参数。
 */
export interface ZoomToolClickParams {
  /** 当前缩放比例 */
  readonly currentScale: number;
  /** 当前画布偏移 */
  readonly currentOffset: { readonly x: number; readonly y: number };
  /** 光标在屏幕坐标系下的 x 坐标 */
  readonly cursorX: number;
  /** 光标在屏幕坐标系下的 y 坐标 */
  readonly cursorY: number;
  /**
   * 是否为反向缩小（任务 8.3）。
   * - false：点击放大（factor = ZOOM_TOOL_IN_FACTOR）
   * - true：反向缩小（factor = ZOOM_TOOL_OUT_FACTOR）
   */
  readonly zoomOut: boolean;
}

/**
 * 任务 8.2/8.3：缩放工具点击缩放。
 *
 * 根据是否为反向缩小选择因子，调用 zoomWithBoundary 计算结果。
 * 调用方根据 altKey 或其他修饰键决定 zoomOut 值。
 */
export function zoomToolClick(params: ZoomToolClickParams): ZoomAtPointResult {
  const factor = params.zoomOut ? ZOOM_TOOL_OUT_FACTOR : ZOOM_TOOL_IN_FACTOR;
  return zoomWithBoundary({
    currentScale: params.currentScale,
    currentOffset: params.currentOffset,
    cursorX: params.cursorX,
    cursorY: params.cursorY,
    factor,
  });
}
