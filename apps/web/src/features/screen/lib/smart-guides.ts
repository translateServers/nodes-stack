/**
 * 智能对齐线（Smart Guides）纯函数模块。
 *
 * 职责：在拖拽 / 缩放组件时，计算被移动组件与其他参考组件之间的对齐关系，
 * 返回需要绘制的对齐辅助线（含距离值）。该模块为纯函数，不产生副作用，
 * 不直接操作 DOM —— 渲染由 SmartGuidesOverlay 组件消费返回值。
 *
 * 对应 spec.md 的"直接操作反馈层"：
 * - 显示阈值：距离 ≤ 5px 时显示辅助线
 * - 吸附阈值：距离 < 3px 时由 Moveable snappable 完成吸附（本模块仅返回数据）
 *
 * 对齐维度：
 * - 水平对齐（y 坐标）：top / center / bottom 三种边
 * - 垂直对齐（x 坐标）：left / center / right 三种边
 * 每对 (movedEdge, otherEdge) 组合都会被检查，共 9 水平 × 9 垂直 = 18 种可能。
 */

/** 矩形数据（画布坐标系，单位 px） */
export interface AlignmentRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 可选的关联 id（参考组件传入，便于 Overlay 高亮来源组件） */
  id?: string;
}

/** 对齐轴：水平线（y 固定）/ 垂直线（x 固定） */
export type AlignmentAxis = 'horizontal' | 'vertical';

/** 矩形上参与对齐的边或中点 */
export type AlignmentEdge = 'top' | 'center' | 'bottom' | 'left' | 'right';

/** 单条对齐辅助线 */
export interface AlignmentLine {
  /** 对齐轴：水平线（沿 x 方向延伸，y 坐标固定）/ 垂直线（沿 y 方向延伸，x 坐标固定） */
  axis: AlignmentAxis;
  /** 对齐的坐标值（水平线为 y，垂直线为 x），即参考组件上对齐边的位置 */
  position: number;
  /** 被移动组件上参与对齐的边 */
  movedEdge: AlignmentEdge;
  /** 参考组件上参与对齐的边 */
  otherEdge: AlignmentEdge;
  /** movedRect 对齐边与参考组件对齐边的距离（绝对值，px），≤ threshold */
  distance: number;
  /** 参考组件的 id（可选，便于 Overlay 高亮来源） */
  otherId?: string;
}

/** 默认显示阈值：5px（与 Photoshop Smart Guides 一致） */
export const DEFAULT_SMART_GUIDES_THRESHOLD = 5;

/** 吸附阈值：3px（< 该值时由调用方触发吸附） */
export const SMART_GUIDES_SNAP_THRESHOLD = 3;

/**
 * 查找被移动矩形与所有参考矩形之间的对齐辅助线。
 *
 * 对每个 (movedRect, otherRect) 组合，检查 9 种水平对齐 + 9 种垂直对齐，
 * 仅返回距离 ≤ threshold 的对齐线。返回顺序：先水平后垂直，每组内按
 * 参考组件在 otherRects 中的顺序。
 *
 * @param movedRect 被拖拽 / 缩放的矩形
 * @param otherRects 参考矩形数组（通常为画布上除被移动组件外的所有组件）
 * @param threshold 显示阈值（px），默认 5
 * @returns 对齐辅助线数组
 */
export function findAlignmentLines(
  movedRect: AlignmentRect,
  otherRects: ReadonlyArray<AlignmentRect>,
  threshold: number = DEFAULT_SMART_GUIDES_THRESHOLD,
): AlignmentLine[] {
  const lines: AlignmentLine[] = [];

  // movedRect 的 6 个边值（避免在循环内重复计算）
  const moved = {
    top: movedRect.y,
    middle: movedRect.y + movedRect.height / 2,
    bottom: movedRect.y + movedRect.height,
    left: movedRect.x,
    center: movedRect.x + movedRect.width / 2,
    right: movedRect.x + movedRect.width,
  };

  for (const other of otherRects) {
    const otherEdges = {
      top: other.y,
      middle: other.y + other.height / 2,
      bottom: other.y + other.height,
      left: other.x,
      center: other.x + other.width / 2,
      right: other.x + other.width,
    };

    // 水平对齐（y 坐标对齐，辅助线为水平线）
    // 注意：AlignmentEdge 类型中 'center' 同时用于水平中线（y 中点）和垂直中线（x 中点），
    // 通过 axis 字段区分语义
    const horizontalPairs: Array<[AlignmentEdge, AlignmentEdge, number, number]> = [
      ['top', 'top', moved.top, otherEdges.top],
      ['top', 'center', moved.top, otherEdges.middle],
      ['top', 'bottom', moved.top, otherEdges.bottom],
      ['center', 'top', moved.middle, otherEdges.top],
      ['center', 'center', moved.middle, otherEdges.middle],
      ['center', 'bottom', moved.middle, otherEdges.bottom],
      ['bottom', 'top', moved.bottom, otherEdges.top],
      ['bottom', 'center', moved.bottom, otherEdges.middle],
      ['bottom', 'bottom', moved.bottom, otherEdges.bottom],
    ];
    for (const [movedEdge, otherEdge, movedPos, otherPos] of horizontalPairs) {
      const distance = Math.abs(movedPos - otherPos);
      if (distance <= threshold) {
        lines.push({
          axis: 'horizontal',
          position: otherPos,
          movedEdge,
          otherEdge,
          distance,
          otherId: other.id,
        });
      }
    }

    // 垂直对齐（x 坐标对齐，辅助线为垂直线）
    const verticalPairs: Array<[AlignmentEdge, AlignmentEdge, number, number]> = [
      ['left', 'left', moved.left, otherEdges.left],
      ['left', 'center', moved.left, otherEdges.center],
      ['left', 'right', moved.left, otherEdges.right],
      ['center', 'left', moved.center, otherEdges.left],
      ['center', 'center', moved.center, otherEdges.center],
      ['center', 'right', moved.center, otherEdges.right],
      ['right', 'left', moved.right, otherEdges.left],
      ['right', 'center', moved.right, otherEdges.center],
      ['right', 'right', moved.right, otherEdges.right],
    ];
    for (const [movedEdge, otherEdge, movedPos, otherPos] of verticalPairs) {
      const distance = Math.abs(movedPos - otherPos);
      if (distance <= threshold) {
        lines.push({
          axis: 'vertical',
          position: otherPos,
          movedEdge,
          otherEdge,
          distance,
          otherId: other.id,
        });
      }
    }
  }

  return lines;
}

/**
 * 从对齐线数组中筛选出距离 < 吸附阈值的"强对齐线"，
 * 调用方可据此调用 Moveable snap 完成吸附。
 *
 * @param lines findAlignmentLines 的返回值
 * @returns 距离 < SMART_GUIDES_SNAP_THRESHOLD 的对齐线
 */
export function filterSnappableLines(lines: ReadonlyArray<AlignmentLine>): AlignmentLine[] {
  return lines.filter((line) => line.distance < SMART_GUIDES_SNAP_THRESHOLD);
}

/**
 * 根据对齐线计算吸附后的左上角坐标。
 *
 * 仅对 distance < SMART_GUIDES_SNAP_THRESHOLD 的对齐线进行吸附。
 * 若同一轴（水平/垂直）有多条线可吸附，选择距离最小的（最近优先）。
 *
 * @param left 当前 left 坐标（画布坐标系）
 * @param top 当前 top 坐标（画布坐标系）
 * @param width 组件宽度
 * @param height 组件高度
 * @param lines findAlignmentLines 返回的对齐线
 * @returns 吸附后的 { left, top }（若无吸附则原值返回）
 */
export function snapPosition(
  left: number,
  top: number,
  width: number,
  height: number,
  lines: ReadonlyArray<AlignmentLine>,
): { left: number; top: number } {
  let snappedLeft = left;
  let snappedTop = top;
  let minHDistance = SMART_GUIDES_SNAP_THRESHOLD;
  let minVDistance = SMART_GUIDES_SNAP_THRESHOLD;

  for (const line of lines) {
    if (line.distance >= SMART_GUIDES_SNAP_THRESHOLD) continue;

    if (line.axis === 'horizontal' && line.distance < minHDistance) {
      // 水平对齐线：调整 top 使 movedEdge 对齐到 line.position
      minHDistance = line.distance;
      switch (line.movedEdge) {
        case 'top':
          snappedTop = line.position;
          break;
        case 'center':
          snappedTop = line.position - height / 2;
          break;
        case 'bottom':
          snappedTop = line.position - height;
          break;
        // left/right 不属于水平对齐，忽略
      }
    } else if (line.axis === 'vertical' && line.distance < minVDistance) {
      // 垂直对齐线：调整 left 使 movedEdge 对齐到 line.position
      minVDistance = line.distance;
      switch (line.movedEdge) {
        case 'left':
          snappedLeft = line.position;
          break;
        case 'center':
          snappedLeft = line.position - width / 2;
          break;
        case 'right':
          snappedLeft = line.position - width;
          break;
        // top/bottom/center 不属于垂直对齐，忽略
      }
    }
  }

  return { left: snappedLeft, top: snappedTop };
}
