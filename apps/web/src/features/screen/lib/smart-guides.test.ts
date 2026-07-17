import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SMART_GUIDES_THRESHOLD,
  SMART_GUIDES_SNAP_THRESHOLD,
  filterSnappableLines,
  findAlignmentLines,
  snapPosition,
  type AlignmentRect,
} from './smart-guides';

/** 构造一个矩形（便于测试时少写参数） */
function rect(x: number, y: number, width: number, height: number, id?: string): AlignmentRect {
  return { x, y, width, height, id };
}

describe('findAlignmentLines', () => {
  describe('基本场景', () => {
    it('当 otherRects 为空时返回空数组', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      expect(findAlignmentLines(moved, [])).toEqual([]);
    });

    it('当所有距离都超过阈值时返回空数组', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(1000, 1000, 100, 100, 'other');
      expect(findAlignmentLines(moved, [other], 5)).toEqual([]);
    });

    it('阈值参数生效：距离 4px 在默认阈值 5 下显示，在阈值 3 下不显示', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(96, 0, 100, 100, 'other');
      // moved.right=100, other.left=96, distance=4
      const withDefault = findAlignmentLines(moved, [other]);
      expect(withDefault.length).toBeGreaterThan(0);
      const withStrict = findAlignmentLines(moved, [other], 3);
      // 距离 4 > 3，但 y 完全重合（top/center/bottom 3 条水平线 distance=0）
      // 所以 withStrict 仍有水平线，但不应有距离为 4 的垂直线
      const verticalLines = withStrict.filter((l) => l.axis === 'vertical');
      const distance4Line = verticalLines.find((l) => l.distance === 4);
      expect(distance4Line).toBeUndefined();
    });
  });

  describe('水平对齐（y 坐标）', () => {
    it('moved.top 与 other.top 对齐（完全重合）', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(200, 0, 80, 80, 'other');
      const lines = findAlignmentLines(moved, [other]);
      const topTopLine = lines.find(
        (l) => l.axis === 'horizontal' && l.movedEdge === 'top' && l.otherEdge === 'top',
      );
      expect(topTopLine).toBeDefined();
      expect(topTopLine?.position).toBe(0);
      expect(topTopLine?.distance).toBe(0);
      expect(topTopLine?.otherId).toBe('other');
    });

    it('moved.center 与 other.center（水平中线）对齐', () => {
      // moved: y=0..100, middle=50；other: y=0..100, middle=50
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(200, 0, 100, 100, 'other');
      const lines = findAlignmentLines(moved, [other]);
      const centerMiddleLine = lines.find(
        (l) => l.axis === 'horizontal' && l.movedEdge === 'center' && l.otherEdge === 'center',
      );
      expect(centerMiddleLine).toBeDefined();
      expect(centerMiddleLine?.position).toBe(50);
      expect(centerMiddleLine?.distance).toBe(0);
    });

    it('moved.bottom 与 other.bottom 对齐', () => {
      // moved: y=0..100, bottom=100；other: y=20..120, bottom=120
      // 距离 20 > 5，不显示。改成完全重合
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(200, 0, 80, 100, 'other'); // other.bottom=100
      const lines = findAlignmentLines(moved, [other]);
      const bottomBottomLine = lines.find(
        (l) => l.axis === 'horizontal' && l.movedEdge === 'bottom' && l.otherEdge === 'bottom',
      );
      expect(bottomBottomLine).toBeDefined();
      expect(bottomBottomLine?.position).toBe(100);
    });

    it('moved.top 与 other.bottom 对齐（moved 在 other 下方）', () => {
      // moved: y=100..200, top=100；other: y=0..100, bottom=100
      const moved = rect(0, 100, 100, 100, 'moved');
      const other = rect(200, 0, 80, 100, 'other');
      const lines = findAlignmentLines(moved, [other]);
      const topBottomLine = lines.find(
        (l) => l.axis === 'horizontal' && l.movedEdge === 'top' && l.otherEdge === 'bottom',
      );
      expect(topBottomLine).toBeDefined();
      expect(topBottomLine?.position).toBe(100);
      expect(topBottomLine?.distance).toBe(0);
    });
  });

  describe('垂直对齐（x 坐标）', () => {
    it('moved.left 与 other.left 对齐', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(0, 200, 80, 80, 'other');
      const lines = findAlignmentLines(moved, [other]);
      const leftLeftLine = lines.find(
        (l) => l.axis === 'vertical' && l.movedEdge === 'left' && l.otherEdge === 'left',
      );
      expect(leftLeftLine).toBeDefined();
      expect(leftLeftLine?.position).toBe(0);
    });

    it('moved.center 与 other.center 对齐', () => {
      // moved: x=0..100, center=50；other: x=0..100, center=50
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(0, 200, 100, 80, 'other');
      const lines = findAlignmentLines(moved, [other]);
      const centerCenterLine = lines.find(
        (l) => l.axis === 'vertical' && l.movedEdge === 'center' && l.otherEdge === 'center',
      );
      expect(centerCenterLine).toBeDefined();
      expect(centerCenterLine?.position).toBe(50);
    });

    it('moved.right 与 other.right 对齐', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(0, 200, 100, 80, 'other');
      const lines = findAlignmentLines(moved, [other]);
      const rightRightLine = lines.find(
        (l) => l.axis === 'vertical' && l.movedEdge === 'right' && l.otherEdge === 'right',
      );
      expect(rightRightLine).toBeDefined();
      expect(rightRightLine?.position).toBe(100);
    });

    it('moved.left 与 other.right 对齐（moved 在 other 右侧）', () => {
      // moved: x=100..200, left=100；other: x=0..100, right=100
      const moved = rect(100, 0, 100, 100, 'moved');
      const other = rect(0, 200, 100, 80, 'other');
      const lines = findAlignmentLines(moved, [other]);
      const leftRightLine = lines.find(
        (l) => l.axis === 'vertical' && l.movedEdge === 'left' && l.otherEdge === 'right',
      );
      expect(leftRightLine).toBeDefined();
      expect(leftRightLine?.position).toBe(100);
    });
  });

  describe('9 种对齐组合覆盖（3 水平 × 3 垂直，完全重合场景）', () => {
    // moved 与 other 完全重合时：
    // - 水平方向：top-top / middle-middle / bottom-bottom 3 条（distance=0）
    //   （top-middle / top-bottom / middle-top 等交叉对距离为 50px，不显示）
    // - 垂直方向：left-left / center-center / right-right 3 条（distance=0）
    it('完全重合时返回 6 条同边对齐线（3 水平 + 3 垂直，距离全为 0）', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(0, 0, 100, 100, 'other');
      const lines = findAlignmentLines(moved, [other]);

      const horizontalLines = lines.filter((l) => l.axis === 'horizontal');
      const verticalLines = lines.filter((l) => l.axis === 'vertical');
      expect(horizontalLines.length).toBe(3);
      expect(verticalLines.length).toBe(3);
      // 所有距离都应为 0
      expect(lines.every((l) => l.distance === 0)).toBe(true);
      // 水平方向覆盖 top/center/bottom 三种同边对齐
      expect(horizontalLines.map((l) => l.movedEdge).sort()).toEqual(['bottom', 'center', 'top']);
      // 垂直方向覆盖 left/center/right 三种同边对齐
      expect(verticalLines.map((l) => l.movedEdge).sort()).toEqual(['center', 'left', 'right']);
    });

    it('覆盖所有 9 种水平对齐组合（通过偏移使每种都出现）', () => {
      // 为每种 (movedEdge, otherEdge) 组合设计一个最小测试用例：
      // 每个用例 moved 与 other 在 y 方向上只有一个组合距离 ≤ 5。
      const cases: Array<{
        name: string;
        movedY: number;
        otherY: number;
        movedEdge: 'top' | 'center' | 'bottom';
        otherEdge: 'top' | 'center' | 'bottom';
      }> = [
        { name: 'top-top', movedY: 0, otherY: 0, movedEdge: 'top', otherEdge: 'top' },
        { name: 'top-center', movedY: 0, otherY: -50, movedEdge: 'top', otherEdge: 'center' },
        { name: 'top-bottom', movedY: 0, otherY: -100, movedEdge: 'top', otherEdge: 'bottom' },
        { name: 'center-top', movedY: 0, otherY: 50, movedEdge: 'center', otherEdge: 'top' },
        { name: 'center-center', movedY: 0, otherY: 0, movedEdge: 'center', otherEdge: 'center' },
        { name: 'center-bottom', movedY: 0, otherY: -50, movedEdge: 'center', otherEdge: 'bottom' },
        { name: 'bottom-top', movedY: 0, otherY: 100, movedEdge: 'bottom', otherEdge: 'top' },
        { name: 'bottom-center', movedY: 0, otherY: 50, movedEdge: 'bottom', otherEdge: 'center' },
        { name: 'bottom-bottom', movedY: 0, otherY: 0, movedEdge: 'bottom', otherEdge: 'bottom' },
      ];

      for (const c of cases) {
        const moved = rect(-1000, c.movedY, 100, 100, 'moved'); // x 偏移避免触发垂直对齐
        const other = rect(1000, c.otherY, 100, 100, 'other');
        const lines = findAlignmentLines(moved, [other], 5);
        const target = lines.find(
          (l) =>
            l.axis === 'horizontal' && l.movedEdge === c.movedEdge && l.otherEdge === c.otherEdge,
        );
        expect(target, `case ${c.name} should produce a horizontal line`).toBeDefined();
        expect(target?.distance).toBeLessThanOrEqual(5);
      }
    });

    it('覆盖所有 9 种垂直对齐组合', () => {
      const cases: Array<{
        name: string;
        movedX: number;
        otherX: number;
        movedEdge: 'left' | 'center' | 'right';
        otherEdge: 'left' | 'center' | 'right';
      }> = [
        { name: 'left-left', movedX: 0, otherX: 0, movedEdge: 'left', otherEdge: 'left' },
        { name: 'left-center', movedX: 0, otherX: -50, movedEdge: 'left', otherEdge: 'center' },
        { name: 'left-right', movedX: 0, otherX: -100, movedEdge: 'left', otherEdge: 'right' },
        { name: 'center-left', movedX: 0, otherX: 50, movedEdge: 'center', otherEdge: 'left' },
        { name: 'center-center', movedX: 0, otherX: 0, movedEdge: 'center', otherEdge: 'center' },
        { name: 'center-right', movedX: 0, otherX: -50, movedEdge: 'center', otherEdge: 'right' },
        { name: 'right-left', movedX: 0, otherX: 100, movedEdge: 'right', otherEdge: 'left' },
        { name: 'right-center', movedX: 0, otherX: 50, movedEdge: 'right', otherEdge: 'center' },
        { name: 'right-right', movedX: 0, otherX: 0, movedEdge: 'right', otherEdge: 'right' },
      ];

      for (const c of cases) {
        const moved = rect(c.movedX, -1000, 100, 100, 'moved'); // y 偏移避免触发水平对齐
        const other = rect(c.otherX, 1000, 100, 100, 'other');
        const lines = findAlignmentLines(moved, [other], 5);
        const target = lines.find(
          (l) =>
            l.axis === 'vertical' && l.movedEdge === c.movedEdge && l.otherEdge === c.otherEdge,
        );
        expect(target, `case ${c.name} should produce a vertical line`).toBeDefined();
        expect(target?.distance).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('多参考组件', () => {
    it('与多个参考组件都对齐时全部返回', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other1 = rect(0, 200, 100, 80, 'other1'); // left 对齐
      const other2 = rect(200, 0, 80, 100, 'other2'); // top 对齐
      const lines = findAlignmentLines(moved, [other1, other2]);

      // 应包含来自 other1 的垂直对齐线和来自 other2 的水平对齐线
      const fromOther1 = lines.filter((l) => l.otherId === 'other1');
      const fromOther2 = lines.filter((l) => l.otherId === 'other2');
      expect(fromOther1.length).toBeGreaterThan(0);
      expect(fromOther2.length).toBeGreaterThan(0);
    });

    it('otherId 可选：当参考矩形未传 id 时 otherId 为 undefined', () => {
      const moved = rect(0, 0, 100, 100);
      const other = rect(0, 200, 100, 80);
      const lines = findAlignmentLines(moved, [other]);
      expect(lines.every((l) => l.otherId === undefined)).toBe(true);
    });
  });

  describe('阈值边界', () => {
    it('距离恰好等于阈值时包含（≤ 判定）', () => {
      // moved.top=0, other.top=5, distance=5
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(0, 5, 100, 80, 'other');
      const lines = findAlignmentLines(moved, [other], 5);
      const topTopLine = lines.find(
        (l) =>
          l.axis === 'horizontal' &&
          l.movedEdge === 'top' &&
          l.otherEdge === 'top' &&
          l.distance === 5,
      );
      expect(topTopLine).toBeDefined();
    });

    it('距离恰好超过阈值时不包含', () => {
      // moved.top=0, other.top=6, distance=6 > 5
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(0, 6, 100, 80, 'other');
      const lines = findAlignmentLines(moved, [other], 5);
      const topTopLine = lines.find(
        (l) =>
          l.axis === 'horizontal' &&
          l.movedEdge === 'top' &&
          l.otherEdge === 'top' &&
          l.distance === 6,
      );
      expect(topTopLine).toBeUndefined();
    });

    it('使用默认阈值 DEFAULT_SMART_GUIDES_THRESHOLD（5）', () => {
      const moved = rect(0, 0, 100, 100, 'moved');
      const other = rect(0, 5, 100, 80, 'other');
      // 不传 threshold 参数
      const lines = findAlignmentLines(moved, [other]);
      expect(DEFAULT_SMART_GUIDES_THRESHOLD).toBe(5);
      expect(lines.some((l) => l.distance === 5)).toBe(true);
    });
  });
});

describe('filterSnappableLines', () => {
  it('仅返回 distance < SMART_GUIDES_SNAP_THRESHOLD (3) 的对齐线', () => {
    const moved = rect(0, 0, 100, 100, 'moved');
    // other1: y=2，distance=2 < 3（可吸附）
    const other1 = rect(0, 2, 100, 80, 'other1');
    // other2: y=4，distance=4 ≥ 3（仅显示，不吸附）
    const other2 = rect(200, 4, 100, 80, 'other2');
    const lines = findAlignmentLines(moved, [other1, other2], 5);
    const snappable = filterSnappableLines(lines);

    expect(SMART_GUIDES_SNAP_THRESHOLD).toBe(3);
    expect(snappable.every((l) => l.distance < 3)).toBe(true);
    expect(snappable.some((l) => l.otherId === 'other1')).toBe(true);
    expect(snappable.some((l) => l.otherId === 'other2')).toBe(false);
  });

  it('无对齐线时返回空数组', () => {
    expect(filterSnappableLines([])).toEqual([]);
  });
});

describe('snapPosition', () => {
  it('无对齐线时原值返回', () => {
    const result = snapPosition(100, 200, 80, 60, []);
    expect(result).toEqual({ left: 100, top: 200 });
  });

  it('所有对齐线距离 ≥ 3 时不吸附（原值返回）', () => {
    // moved.top=0, other.top=4, distance=4 ≥ 3
    const moved = rect(0, 0, 100, 100, 'moved');
    const other = rect(0, 4, 100, 80, 'other');
    const lines = findAlignmentLines(moved, [other], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    expect(result.left).toBe(0);
    expect(result.top).toBe(0);
  });

  it('水平对齐 top-top（distance=2 < 3）：top 吸附到 other.top 位置', () => {
    // moved: top=0；other: top=2，distance=2
    // 吸附后 moved.top = other.top = 2
    const moved = rect(0, 0, 100, 100, 'moved');
    const other = rect(0, 2, 100, 80, 'other');
    const lines = findAlignmentLines(moved, [other], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    expect(result.top).toBe(2);
  });

  it('水平对齐 center-center（distance=1 < 3）：top 吸附使 moved 中线对齐 other 中线', () => {
    // moved: y=0, height=100, center=50
    // other: y=-49, height=100, center=1
    // distance=49 > 5，不显示。重新设计
    // moved: y=0, height=100, center=50；other: y=1, height=100, center=51
    // distance=1 < 3，吸附后 top = 51 - 100/2 = 1
    const moved = rect(0, 0, 100, 100, 'moved');
    const other = rect(200, 1, 100, 100, 'other');
    const lines = findAlignmentLines(moved, [other], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    // moved.center (50) 对齐 other.center (51)，吸附后 top = 51 - 50 = 1
    expect(result.top).toBe(1);
  });

  it('水平对齐 bottom-bottom（distance=2 < 3）：top 吸附使 moved 底边对齐 other 底边', () => {
    // moved: y=0, height=100, top=0, center=50, bottom=100
    // other: y=4, height=98, top=4, center=53, bottom=102
    // top-top: distance=4 ≥ 3（不吸附）；center-center: distance=3 ≥ 3（不吸附）
    // bottom-bottom: distance=2 < 3（吸附），snappedTop = 102 - 100 = 2
    const moved = rect(0, 0, 100, 100, 'moved');
    const other = rect(200, 4, 100, 98, 'other');
    const lines = findAlignmentLines(moved, [other], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    expect(result.top).toBe(2);
  });

  it('垂直对齐 left-left（distance=1 < 3）：left 吸附到 other.left', () => {
    // moved: x=0；other: x=1，distance=1
    // 吸附后 left = 1
    const moved = rect(0, 0, 100, 100, 'moved');
    const other = rect(1, 200, 100, 80, 'other');
    const lines = findAlignmentLines(moved, [other], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    expect(result.left).toBe(1);
  });

  it('垂直对齐 right-right（distance=2 < 3）：left 吸附使 moved 右边对齐 other 右边', () => {
    // moved: x=0, width=100, left=0, center=50, right=100
    // other: x=4, width=98, left=4, center=53, right=102
    // left-left: distance=4 ≥ 3（不吸附）；center-center: distance=3 ≥ 3（不吸附）
    // right-right: distance=2 < 3（吸附），snappedLeft = 102 - 100 = 2
    const moved = rect(0, 0, 100, 100, 'moved');
    const other = rect(4, 200, 98, 80, 'other');
    const lines = findAlignmentLines(moved, [other], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    expect(result.left).toBe(2);
  });

  it('同时有水平和垂直对齐线：两个轴各自独立吸附', () => {
    // moved: (0, 0, 100, 100)
    // other: (1, 2, 100, 100) — left distance=1, top distance=2
    const moved = rect(0, 0, 100, 100, 'moved');
    const other = rect(1, 2, 100, 100, 'other');
    const lines = findAlignmentLines(moved, [other], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    expect(result.left).toBe(1);
    expect(result.top).toBe(2);
  });

  it('多条同轴对齐线：选择距离最小的吸附', () => {
    // moved: (0, 0, 100, 100)
    // other1: top=2 (distance=2)
    // other2: top=1 (distance=1)
    // 应吸附到 other2.top=1
    const moved = rect(0, 0, 100, 100, 'moved');
    const other1 = rect(0, 2, 100, 80, 'other1');
    const other2 = rect(200, 1, 100, 80, 'other2');
    const lines = findAlignmentLines(moved, [other1, other2], 5);
    const result = snapPosition(0, 0, 100, 100, lines);
    expect(result.top).toBe(1);
  });
});
