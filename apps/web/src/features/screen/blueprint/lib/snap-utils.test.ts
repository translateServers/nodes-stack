import { describe, expect, it } from 'vitest';

import {
  applyAlignmentSnap,
  DEFAULT_ALIGNMENT_THRESHOLD,
  DEFAULT_GRID_SIZE,
  getAlignmentGuides,
  snapPositionToGrid,
  snapToGrid,
} from './snap-utils';
import type { NodeBounds } from './snap-utils';

describe('snap-utils', () => {
  describe('snapToGrid', () => {
    it('将 0 吸附到 0', () => {
      expect(snapToGrid(0)).toBe(0);
    });

    it('将 4 吸附到 8（默认 8px 网格，JS Math.round(0.5) = 1）', () => {
      expect(snapToGrid(4)).toBe(8);
    });

    it('将 3 吸附到 0', () => {
      expect(snapToGrid(3)).toBe(0);
    });

    it('将 8 吸附到 8', () => {
      expect(snapToGrid(8)).toBe(8);
    });

    it('将 12 吸附到 16（默认 8px，Math.round(1.5) = 2）', () => {
      expect(snapToGrid(12)).toBe(16);
    });

    it('支持自定义网格大小', () => {
      expect(snapToGrid(7, 10)).toBe(10);
      expect(snapToGrid(4, 10)).toBe(0);
      expect(snapToGrid(15, 10)).toBe(20);
    });

    it('负数也能吸附', () => {
      expect(snapToGrid(-3)).toBe(0);
      expect(snapToGrid(-5)).toBe(-8);
      expect(snapToGrid(-12, 10)).toBe(-10);
    });
  });

  describe('snapPositionToGrid', () => {
    it('同时吸附 x 和 y', () => {
      expect(snapPositionToGrid({ x: 3, y: 5 })).toEqual({ x: 0, y: 8 });
    });

    it('支持自定义网格', () => {
      expect(snapPositionToGrid({ x: 7, y: 13 }, 10)).toEqual({ x: 10, y: 10 });
    });

    it('已对齐的位置不变', () => {
      expect(snapPositionToGrid({ x: 16, y: 24 })).toEqual({ x: 16, y: 24 });
    });
  });

  describe('getAlignmentGuides', () => {
    const dragged: NodeBounds = { id: 'n1', x: 0, y: 0, width: 100, height: 50 };

    it('无其他节点时返回空数组', () => {
      const guides = getAlignmentGuides(dragged, []);
      expect(guides.vertical).toEqual([]);
      expect(guides.horizontal).toEqual([]);
    });

    it('忽略与拖拽节点相同 id 的其他节点', () => {
      const same: NodeBounds = { ...dragged };
      const guides = getAlignmentGuides(dragged, [same]);
      expect(guides.vertical).toEqual([]);
      expect(guides.horizontal).toEqual([]);
    });

    it('左边对齐时产生垂直吸附线', () => {
      // other.x = 0 与 dragged.x = 0 完全对齐
      const other: NodeBounds = { id: 'n2', x: 0, y: 200, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other]);
      expect(guides.vertical).toContain(0);
    });

    it('右边对齐时产生垂直吸附线', () => {
      // dragged 右边 = 100，other 右边 = 100
      const other: NodeBounds = { id: 'n2', x: 20, y: 200, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other]);
      expect(guides.vertical).toContain(100);
    });

    it('中心对齐时产生垂直吸附线', () => {
      // dragged 中心 = 50，other 中心 = 50
      const other: NodeBounds = { id: 'n2', x: 10, y: 200, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other]);
      expect(guides.vertical).toContain(50);
    });

    it('顶边对齐时产生水平吸附线', () => {
      const other: NodeBounds = { id: 'n2', x: 200, y: 0, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other]);
      expect(guides.horizontal).toContain(0);
    });

    it('中心对齐时产生水平吸附线', () => {
      // dragged 中心 y = 25，other 中心 y = 25
      const other: NodeBounds = { id: 'n2', x: 200, y: 5, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other]);
      expect(guides.horizontal).toContain(25);
    });

    it('底边对齐时产生水平吸附线', () => {
      const other: NodeBounds = { id: 'n2', x: 200, y: 10, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other]);
      expect(guides.horizontal).toContain(50); // dragged.height = 50
    });

    it('距离超过阈值时不产生吸附线', () => {
      // dragged 右边 = 100，让 other 左边 = 110（距离 10 > 阈值 4）
      // dragged 中心 x = 50，other 中心 = 150，距离 100
      const other: NodeBounds = { id: 'n2', x: 110, y: 100, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other], DEFAULT_ALIGNMENT_THRESHOLD);
      expect(guides.vertical).toEqual([]);
      expect(guides.horizontal).toEqual([]);
    });

    it('支持自定义阈值（更宽松）', () => {
      // 默认阈值 4 时不会命中（距离 6），自定义阈值 10 时命中
      const other: NodeBounds = { id: 'n2', x: 6, y: 200, width: 80, height: 40 };
      const guides = getAlignmentGuides(dragged, [other], 10);
      expect(guides.vertical).toContain(6);
    });

    it('吸附线结果已排序', () => {
      const others: NodeBounds[] = [
        { id: 'n2', x: 50, y: 200, width: 80, height: 40 }, // 中心对齐 50
        { id: 'n3', x: 0, y: 300, width: 80, height: 40 }, // 左边对齐 0
        { id: 'n4', x: 100, y: 400, width: 80, height: 40 }, // 右边对齐 100（dragged 右边 100）
      ];
      const guides = getAlignmentGuides(dragged, others);
      expect(guides.vertical).toEqual([0, 50, 100]);
    });

    it('去重相同的吸附线', () => {
      const others: NodeBounds[] = [
        { id: 'n2', x: 0, y: 200, width: 80, height: 40 },
        { id: 'n3', x: 0, y: 300, width: 80, height: 40 },
      ];
      const guides = getAlignmentGuides(dragged, others);
      expect(guides.vertical).toEqual([0]);
    });
  });

  describe('applyAlignmentSnap', () => {
    const baseNode: NodeBounds = { id: 'n1', x: 0, y: 0, width: 100, height: 50 };

    it('无对齐命中时返回原位置', () => {
      const others: NodeBounds[] = [{ id: 'n2', x: 200, y: 200, width: 80, height: 40 }];
      const result = applyAlignmentSnap(baseNode, others);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.guides.vertical).toEqual([]);
      expect(result.guides.horizontal).toEqual([]);
    });

    it('左边对齐时修正 X 坐标', () => {
      // dragged.x = 2，other.x = 0 → 命中阈值 4，吸附到 0
      const dragged: NodeBounds = { ...baseNode, x: 2, y: 0 };
      const others: NodeBounds[] = [{ id: 'n2', x: 0, y: 200, width: 80, height: 40 }];
      const result = applyAlignmentSnap(dragged, others);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('中心对齐时修正 X 坐标', () => {
      // dragged 中心 = 50 + 3 = 53，other 中心 = 50 → 命中阈值 4
      // dragged.x = 3, dragged.width = 100 → 中心 = 53
      // guideX = 50, centerDelta = |53 - 50| = 3 <= 4 → 命中
      // x = guideX - width/2 = 50 - 50 = 0
      const dragged: NodeBounds = { ...baseNode, x: 3, y: 0 };
      const others: NodeBounds[] = [
        { id: 'n2', x: 10, y: 200, width: 80, height: 40 }, // other 中心 = 50
      ];
      const result = applyAlignmentSnap(dragged, others);
      expect(result.x).toBe(0);
    });

    it('右边对齐时修正 X 坐标', () => {
      // dragged 右边 = 100 + 3 = 103，other 右边 = 100 → 命中阈值 4
      // x = guideX - width = 100 - 100 = 0
      const dragged: NodeBounds = { ...baseNode, x: 3, y: 0 };
      const others: NodeBounds[] = [
        { id: 'n2', x: 20, y: 200, width: 80, height: 40 }, // other 右边 = 100
      ];
      const result = applyAlignmentSnap(dragged, others);
      expect(result.x).toBe(0);
    });

    it('顶边对齐时修正 Y 坐标', () => {
      const dragged: NodeBounds = { ...baseNode, x: 0, y: 2 };
      const others: NodeBounds[] = [{ id: 'n2', x: 200, y: 0, width: 80, height: 40 }];
      const result = applyAlignmentSnap(dragged, others);
      expect(result.y).toBe(0);
    });

    it('中心对齐时修正 Y 坐标', () => {
      // dragged.y = 3, dragged.height = 50 → 中心 = 28
      // other.y = 23, other.height = 4 → 顶边 23（距离 |3-23|=20，不命中）
      //   中心 25（距离 |28-25|=3，命中），底边 27（距离 |53-27|=26，不命中）
      // 唯一命中的 guideY = 25 → y = 25 - 25 = 0
      const dragged: NodeBounds = { ...baseNode, x: 0, y: 3 };
      const others: NodeBounds[] = [{ id: 'n2', x: 200, y: 23, width: 80, height: 4 }];
      const result = applyAlignmentSnap(dragged, others);
      expect(result.y).toBe(0);
    });

    it('底边对齐时修正 Y 坐标', () => {
      // dragged.y = 3, dragged.height = 50 → 底边 = 53
      // other.y = 46, other.height = 4 → 顶边 46（距离 |3-46|=43，不命中）
      //   中心 48（距离 |28-48|=20，不命中），底边 50（距离 |53-50|=3，命中）
      // 唯一命中的 guideY = 50 → y = 50 - 50 = 0
      const dragged: NodeBounds = { ...baseNode, x: 0, y: 3 };
      const others: NodeBounds[] = [{ id: 'n2', x: 200, y: 46, width: 80, height: 4 }];
      const result = applyAlignmentSnap(dragged, others);
      expect(result.y).toBe(0);
    });

    it('同时命中水平与垂直吸附线时同时修正', () => {
      const dragged: NodeBounds = { ...baseNode, x: 2, y: 2 };
      const others: NodeBounds[] = [{ id: 'n2', x: 0, y: 0, width: 80, height: 40 }];
      const result = applyAlignmentSnap(dragged, others);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('返回包含吸附线信息', () => {
      const others: NodeBounds[] = [{ id: 'n2', x: 0, y: 0, width: 80, height: 40 }];
      const result = applyAlignmentSnap(baseNode, others);
      expect(result.guides.vertical).toContain(0);
      expect(result.guides.horizontal).toContain(0);
    });

    it('支持自定义阈值', () => {
      // 默认阈值 4 时不会命中（距离 6），自定义阈值 10 时命中
      const dragged: NodeBounds = { ...baseNode, x: 6, y: 6 };
      const others: NodeBounds[] = [{ id: 'n2', x: 0, y: 0, width: 80, height: 40 }];
      const result = applyAlignmentSnap(dragged, others, 10);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('忽略拖拽节点自身', () => {
      // others 中包含与 dragged 相同 id 的节点
      const others: NodeBounds[] = [{ ...baseNode }];
      const result = applyAlignmentSnap(baseNode, others);
      expect(result.guides.vertical).toEqual([]);
      expect(result.guides.horizontal).toEqual([]);
    });
  });

  describe('常量', () => {
    it('DEFAULT_GRID_SIZE 为 8', () => {
      expect(DEFAULT_GRID_SIZE).toBe(8);
    });

    it('DEFAULT_ALIGNMENT_THRESHOLD 为 4', () => {
      expect(DEFAULT_ALIGNMENT_THRESHOLD).toBe(4);
    });
  });
});
