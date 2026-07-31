/**
 * 对齐与分布纯函数（任务 9.4）
 *
 * 提供多选节点的对齐与等距分布计算：
 * - alignNodes：6 种对齐方式（left/center-h/right/top/middle-v/bottom）
 * - distributeNodes：水平/垂直等距分布
 *
 * 设计为纯函数：
 * - 输入：节点数组（id + position + width + height）+ 对齐/分布模式
 * - 输出：仅含 id + 新 position 的结果数组（顺序与输入一致）
 * - 不修改输入数组；不产生副作用；不依赖 DOM
 *
 * 边界规则：
 * - 节点数 < 2：对齐无意义，返回原位置数组（无变更标记）
 * - 节点数 < 3：分布无意义（无法等距），返回原位置数组
 * - 节点 width/height 缺失（=0）：仍可计算对齐（按 0 宽高的退化情形处理）
 */

/** 参与对齐/分布的节点最小数据集 */
export interface AlignNode {
  /** 节点 ID */
  id: string;
  /** 节点位置（左上角坐标） */
  position: { x: number; y: number };
  /** 节点宽度 */
  width: number;
  /** 节点高度 */
  height: number;
}

/** 对齐/分布计算结果项 */
export interface AlignResultItem {
  /** 节点 ID（与输入对应） */
  id: string;
  /** 计算后的新位置 */
  position: { x: number; y: number };
}

/** 对齐模式：left/center-h/right 为水平对齐，top/middle-v/bottom 为垂直对齐 */
export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom';

/** 分布模式：horizontal=水平等距分布，vertical=垂直等距分布 */
export type DistributeMode = 'horizontal' | 'vertical';

/** 对齐计算结果 */
export interface AlignResult {
  /** 与输入同序的结果数组 */
  items: AlignResultItem[];
  /** 是否产生了位置变更（false 表示无需写回，避免空历史） */
  hasChange: boolean;
}

/** 分布计算结果（复用 AlignResult 结构） */
export type DistributeResult = AlignResult;

/**
 * 计算选中节点集合的边界框。
 *
 * @param nodes 参与计算的节点（应已过滤为选中节点）
 * @returns 边界框 { minX, minY, maxX, maxY }，maxX/maxY 已包含 width/height
 */
function getBoundingBox(nodes: readonly AlignNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    const left = node.position.x;
    const right = node.position.x + node.width;
    const top = node.position.y;
    const bottom = node.position.y + node.height;
    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 计算对齐后的位置数组。
 *
 * 对齐参考：选中节点的整体边界框。
 * - left：所有节点左边缘对齐到 minX
 * - center-h：所有节点水平中心对齐到 (minX + maxX) / 2
 * - right：所有节点右边缘对齐到 maxX
 * - top：所有节点顶边缘对齐到 minY
 * - middle-v：所有节点垂直中心对齐到 (minY + maxY) / 2
 * - bottom：所有节点底边缘对齐到 maxY
 *
 * @param nodes 参与对齐的节点（应 >= 2 才有意义）
 * @param mode 对齐模式
 * @returns 对齐结果（含 hasChange 标记）
 */
export function alignNodes(nodes: readonly AlignNode[], mode: AlignMode): AlignResult {
  // 节点数 < 2：对齐无意义，原样返回
  if (nodes.length < 2) {
    return {
      items: nodes.map((n) => ({ id: n.id, position: { ...n.position } })),
      hasChange: false,
    };
  }

  const box = getBoundingBox(nodes);
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;

  let hasChange = false;
  const items: AlignResultItem[] = nodes.map((node) => {
    let newX = node.position.x;
    let newY = node.position.y;

    switch (mode) {
      case 'left':
        newX = box.minX;
        break;
      case 'center-h':
        newX = centerX - node.width / 2;
        break;
      case 'right':
        newX = box.maxX - node.width;
        break;
      case 'top':
        newY = box.minY;
        break;
      case 'middle-v':
        newY = centerY - node.height / 2;
        break;
      case 'bottom':
        newY = box.maxY - node.height;
        break;
      default: {
        // 穷举守卫：新增 mode 时编译期即可发现遗漏
        const exhaustive: never = mode;
        throw new Error(`Unknown align mode: ${String(exhaustive)}`);
      }
    }

    if (newX !== node.position.x || newY !== node.position.y) {
      hasChange = true;
    }

    return {
      id: node.id,
      position: { x: newX, y: newY },
    };
  });

  return { items, hasChange };
}

/**
 * 计算等距分布后的位置数组。
 *
 * 分布规则：
 * - 节点数 < 3：无法等距分布，原样返回（hasChange=false）
 * - 水平分布：按中心 X 升序排序，第一个节点中心位置保持，最后一个节点中心位置保持，
 *   中间节点中心在 [firstCenter, lastCenter] 区间内均匀分布
 * - 垂直分布：同上，按中心 Y 排序
 *
 * 注：均匀分布基于节点中心，节点宽度/高度差异不影响间隔步长。
 *
 * @param nodes 参与分布的节点（应 >= 3 才有意义）
 * @param mode 分布模式
 * @returns 分布结果（含 hasChange 标记）
 */
export function distributeNodes(
  nodes: readonly AlignNode[],
  mode: DistributeMode,
): DistributeResult {
  // 节点数 < 3：分布无意义
  if (nodes.length < 3) {
    return {
      items: nodes.map((n) => ({ id: n.id, position: { ...n.position } })),
      hasChange: false,
    };
  }

  // 按中心坐标排序，得到分布顺序
  const sorted = [...nodes].sort((a, b) => {
    const centerA =
      mode === 'horizontal' ? a.position.x + a.width / 2 : a.position.y + a.height / 2;
    const centerB =
      mode === 'horizontal' ? b.position.x + b.width / 2 : b.position.y + b.height / 2;
    return centerA - centerB;
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) {
    return {
      items: nodes.map((n) => ({ id: n.id, position: { ...n.position } })),
      hasChange: false,
    };
  }

  const firstCenter =
    mode === 'horizontal'
      ? first.position.x + first.width / 2
      : first.position.y + first.height / 2;
  const lastCenter =
    mode === 'horizontal' ? last.position.x + last.width / 2 : last.position.y + last.height / 2;

  // 步长 = 总跨度 / (节点数 - 1)
  const step = (lastCenter - firstCenter) / (sorted.length - 1);

  // 计算每个节点的新位置（按排序顺序），再还原回输入顺序
  const positionById = new Map<string, { x: number; y: number }>();
  let hasChange = false;

  sorted.forEach((node, index) => {
    const targetCenter = firstCenter + step * index;
    let newX = node.position.x;
    let newY = node.position.y;
    if (mode === 'horizontal') {
      newX = targetCenter - node.width / 2;
    } else {
      newY = targetCenter - node.height / 2;
    }
    if (newX !== node.position.x || newY !== node.position.y) {
      hasChange = true;
    }
    positionById.set(node.id, { x: newX, y: newY });
  });

  // 还原回输入顺序
  const items: AlignResultItem[] = nodes.map((node) => {
    const next = positionById.get(node.id);
    if (!next) {
      return { id: node.id, position: { ...node.position } };
    }
    return { id: node.id, position: next };
  });

  return { items, hasChange };
}

/**
 * 将 AlignResult.items 应用到一组带位置的对象上（按 id 匹配）。
 *
 * 用于将纯函数结果应用到 ReactFlow Node 数组：
 * ```ts
 * const nextNodes = applyAlignResultToNodes(rfNodes, result.items);
 * ```
 *
 * @template T 节点类型（需含 id 与 position 字段）
 * @param nodes 原始节点数组
 * @param items 对齐/分布结果项
 * @returns 新节点数组（仅匹配的节点 position 被替换；未匹配的保持原样）
 */
export function applyAlignResultToNodes<
  T extends { id: string; position: { x: number; y: number } },
>(nodes: readonly T[], items: readonly AlignResultItem[]): T[] {
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const item of items) {
    positionMap.set(item.id, item.position);
  }
  return nodes.map((node) => {
    const next = positionMap.get(node.id);
    if (!next) return node;
    return { ...node, position: { x: next.x, y: next.y } };
  });
}
