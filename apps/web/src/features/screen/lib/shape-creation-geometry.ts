/**
 * 形状创建几何纯函数（任务 6.1）
 *
 * 职责：在画布上拖拽创建矩形 / 椭圆等形状时，从起点和当前点计算规范化矩形，
 * 支持任意拖拽方向（左上→右下、右下→左上、左下→右上、右上→左下）和
 * 微小拖拽阈值判定。
 *
 * 设计原则：
 * - 纯函数，不产生副作用，不读取 DOM
 * - 输入输出均为画布坐标系（已经过 canvasScale 反向换算）
 * - 与具体组件类型无关，矩形和椭圆共用同一套几何逻辑
 * - 微小拖拽不创建组件（避免误触），由调用方根据 hasValidSize 判定
 *
 * 与状态机联动：
 * - 创建开始：dispatch 'start-create'（idle/hovering → creating）
 * - 创建提交：dispatch 'commit-create'（creating → idle）
 * - 创建取消：dispatch 'cancel'（creating → idle）
 * - pointer cancel：dispatch 'pointer-cancel'（creating → idle）
 */

/**
 * 形状创建的几何结果。
 *
 * - `rect` 始终是规范化矩形（width/height ≥ 0）
 * - `hasValidSize` 为 false 时调用方不应创建组件（视为微小拖拽或取消）
 */
export interface ShapeCreationResult {
  /** 规范化后的矩形（左上角坐标 + 非负宽高） */
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** 是否达到最小尺寸阈值（达到才应创建组件） */
  readonly hasValidSize: boolean;
}

/** 默认最小尺寸阈值：4px（小于该值的拖拽视为误触） */
export const DEFAULT_MIN_SHAPE_SIZE = 4;

/**
 * 将起点和当前点规范化为矩形。
 *
 * 处理四个拖拽方向：
 * - 左上 → 右下：startX < currentX, startY < currentY
 * - 右下 → 左上：startX > currentX, startY > currentY（取 min 作为左上角）
 * - 左下 → 右上：startX < currentX, startY > currentY
 * - 右上 → 左下：startX > currentX, startY < currentY
 *
 * 返回的矩形 x/y 始终是左上角坐标，width/height 始终非负。
 *
 * @param startX 起点 x（画布坐标）
 * @param startY 起点 y（画布坐标）
 * @param currentX 当前点 x（画布坐标）
 * @param currentY 当前点 y（画布坐标）
 * @returns 规范化矩形（width/height 为绝对值，非负）
 */
export function normalizeRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  return { x, y, width, height };
}

/**
 * 判断拖拽尺寸是否达到最小阈值。
 *
 * 任一维度（width 或 height）小于阈值即视为微小拖拽，不应创建组件。
 * 这与 Photoshop 等设计工具的"微小拖拽取消创建"行为一致。
 *
 * @param width 拖拽产生的宽度（画布坐标，非负）
 * @param height 拖拽产生的高度（画布坐标，非负）
 * @param minSize 最小尺寸阈值，默认 4px
 */
export function hasValidSize(
  width: number,
  height: number,
  minSize: number = DEFAULT_MIN_SHAPE_SIZE,
): boolean {
  return width >= minSize && height >= minSize;
}

/**
 * 计算形状创建的完整几何结果。
 *
 * 等价于 `normalizeRect` + `hasValidSize` 的组合，便于调用方一次获取全部信息。
 *
 * @param startX 起点 x（画布坐标）
 * @param startY 起点 y（画布坐标）
 * @param currentX 当前点 x（画布坐标）
 * @param currentY 当前点 y（画布坐标）
 * @param minSize 最小尺寸阈值，默认 4px
 */
export function computeShapeCreation(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  minSize: number = DEFAULT_MIN_SHAPE_SIZE,
): ShapeCreationResult {
  const rect = normalizeRect(startX, startY, currentX, currentY);
  return {
    rect,
    hasValidSize: hasValidSize(rect.width, rect.height, minSize),
  };
}
