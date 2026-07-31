/**
 * 网格吸附与对齐吸附（任务 4.5）
 *
 * 提供 React Flow 节点拖拽时的位置吸附纯函数：
 * - snapToGrid：将坐标吸附到 8px 网格
 * - getAlignmentGuides：计算拖拽节点与其他节点的对齐吸附线（水平/垂直）
 *
 * 设计为纯函数，便于单元测试与 React Flow onNodeDrag 回调复用。
 */

/** 默认网格大小（8px） */
export const DEFAULT_GRID_SIZE = 8;

/** 默认对齐吸附阈值（4px） */
export const DEFAULT_ALIGNMENT_THRESHOLD = 4;

/** 节点位置与尺寸（与 React Flow Node 的 position/measured 子集对齐） */
export interface NodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 对齐吸附线集合 */
export interface AlignmentGuides {
  /** 垂直吸附线（X 坐标） */
  vertical: number[];
  /** 水平吸附线（Y 坐标） */
  horizontal: number[];
}

/** 对齐方式（决定哪些边缘参与对齐） */
export type AlignEdge = 'start' | 'center' | 'end';

/**
 * 将坐标吸附到 grid 网格。
 *
 * @param value 原始坐标
 * @param gridSize 网格大小（默认 8）
 */
export function snapToGrid(value: number, gridSize: number = DEFAULT_GRID_SIZE): number {
  const result = Math.round(value / gridSize) * gridSize;
  // 避免 -0 污染输出（Math.round(-0.375) * 8 === -0）
  return result === 0 ? 0 : result;
}

/**
 * 将节点位置吸附到 grid 网格。
 */
export function snapPositionToGrid(
  position: { x: number; y: number },
  gridSize: number = DEFAULT_GRID_SIZE,
): { x: number; y: number } {
  return {
    x: snapToGrid(position.x, gridSize),
    y: snapToGrid(position.y, gridSize),
  };
}

/**
 * 计算拖拽节点与其他节点的对齐吸附线。
 *
 * 吸附规则：
 * - 拖拽节点的左边/中心/右边 与 其他节点的同侧边缘 距离小于 threshold 时产生垂直吸附线
 * - 拖拽节点的顶边/中心/底边 与 其他节点的同侧边缘 距离小于 threshold 时产生水平吸附线
 *
 * @param dragged 拖拽中的节点位置/尺寸
 * @param others 其他节点（不含拖拽节点自身）
 * @param threshold 吸附阈值（默认 4px）
 */
export function getAlignmentGuides(
  dragged: NodeBounds,
  others: readonly NodeBounds[],
  threshold: number = DEFAULT_ALIGNMENT_THRESHOLD,
): AlignmentGuides {
  const vertical = new Set<number>();
  const horizontal = new Set<number>();

  // 拖拽节点的 3 个垂直边缘 X 坐标
  const draggedVerticals = [
    { type: 'start' as AlignEdge, value: dragged.x },
    { type: 'center' as AlignEdge, value: dragged.x + dragged.width / 2 },
    { type: 'end' as AlignEdge, value: dragged.x + dragged.width },
  ];
  // 拖拽节点的 3 个水平边缘 Y 坐标
  const draggedHorizontals = [
    { type: 'start' as AlignEdge, value: dragged.y },
    { type: 'center' as AlignEdge, value: dragged.y + dragged.height / 2 },
    { type: 'end' as AlignEdge, value: dragged.y + dragged.height },
  ];

  for (const other of others) {
    if (other.id === dragged.id) continue;

    const otherVerticals = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherHorizontals = [other.y, other.y + other.height / 2, other.y + other.height];

    // 垂直吸附线（X 对齐）
    for (const dv of draggedVerticals) {
      for (const ov of otherVerticals) {
        if (Math.abs(dv.value - ov) <= threshold) {
          vertical.add(ov);
        }
      }
    }

    // 水平吸附线（Y 对齐）
    for (const dh of draggedHorizontals) {
      for (const oh of otherHorizontals) {
        if (Math.abs(dh.value - oh) <= threshold) {
          horizontal.add(oh);
        }
      }
    }
  }

  return {
    vertical: [...vertical].sort((a, b) => a - b),
    horizontal: [...horizontal].sort((a, b) => a - b),
  };
}

/**
 * 应用对齐吸附：若拖拽节点命中对齐线，返回修正后的位置。
 *
 * 当拖拽节点任意边缘与某条吸附线距离 <= threshold 时，将节点位置偏移使其精确对齐。
 *
 * @param dragged 拖拽中的节点位置/尺寸
 * @param others 其他节点
 * @param threshold 吸附阈值
 */
export function applyAlignmentSnap(
  dragged: NodeBounds,
  others: readonly NodeBounds[],
  threshold: number = DEFAULT_ALIGNMENT_THRESHOLD,
): { x: number; y: number; guides: AlignmentGuides } {
  const guides = getAlignmentGuides(dragged, others, threshold);
  let { x, y } = dragged;

  // 检查是否命中垂直吸附线，命中则修正 X
  for (const guideX of guides.vertical) {
    const leftDelta = Math.abs(dragged.x - guideX);
    const centerDelta = Math.abs(dragged.x + dragged.width / 2 - guideX);
    const rightDelta = Math.abs(dragged.x + dragged.width - guideX);

    if (leftDelta <= threshold) {
      x = guideX;
      break;
    }
    if (centerDelta <= threshold) {
      x = guideX - dragged.width / 2;
      break;
    }
    if (rightDelta <= threshold) {
      x = guideX - dragged.width;
      break;
    }
  }

  // 检查是否命中水平吸附线
  for (const guideY of guides.horizontal) {
    const topDelta = Math.abs(dragged.y - guideY);
    const centerDelta = Math.abs(dragged.y + dragged.height / 2 - guideY);
    const bottomDelta = Math.abs(dragged.y + dragged.height - guideY);

    if (topDelta <= threshold) {
      y = guideY;
      break;
    }
    if (centerDelta <= threshold) {
      y = guideY - dragged.height / 2;
      break;
    }
    if (bottomDelta <= threshold) {
      y = guideY - dragged.height;
      break;
    }
  }

  return { x, y, guides };
}
