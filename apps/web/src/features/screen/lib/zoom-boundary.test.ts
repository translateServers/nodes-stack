import { describe, it, expect } from 'vitest';
import {
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_TOOL_IN_FACTOR,
  ZOOM_TOOL_OUT_FACTOR,
  WHEEL_ZOOM_FACTOR,
  clampScale,
  computeClampedFactor,
  zoomWithBoundary,
  zoomToolClick,
} from './zoom-boundary';

/**
 * 任务 8.1 验证：统一缩放边界和锚点更新函数
 *
 * 测试覆盖：
 * - clampScale：上下限边界
 * - computeClampedFactor：边界约束下的因子计算
 * - zoomWithBoundary：边界 + 锚点不变性
 * - zoomToolClick：任务 8.2/8.3 缩放工具点击放大/缩小
 */
describe('任务 8.1：缩放边界常量', () => {
  it('MIN_SCALE = 0.1（10%）', () => {
    expect(MIN_SCALE).toBe(0.1);
  });

  it('MAX_SCALE = 5（500%）', () => {
    expect(MAX_SCALE).toBe(5);
  });

  it('ZOOM_TOOL_IN_FACTOR = 1.5（每次点击放大 1.5 倍）', () => {
    expect(ZOOM_TOOL_IN_FACTOR).toBe(1.5);
  });

  it('ZOOM_TOOL_OUT_FACTOR = 1/1.5（与放大因子互为倒数）', () => {
    expect(ZOOM_TOOL_OUT_FACTOR).toBeCloseTo(1 / 1.5, 10);
    expect(ZOOM_TOOL_IN_FACTOR * ZOOM_TOOL_OUT_FACTOR).toBeCloseTo(1, 10);
  });

  it('WHEEL_ZOOM_FACTOR = 1.1（滚轮缩放步长）', () => {
    expect(WHEEL_ZOOM_FACTOR).toBe(1.1);
  });
});

describe('任务 8.1：clampScale', () => {
  it('区间内的值不变', () => {
    expect(clampScale(1)).toBe(1);
    expect(clampScale(0.5)).toBe(0.5);
    expect(clampScale(2.5)).toBe(2.5);
  });

  it('低于下限裁剪到 MIN_SCALE', () => {
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(0.05)).toBe(MIN_SCALE);
    expect(clampScale(-1)).toBe(MIN_SCALE);
  });

  it('高于上限裁剪到 MAX_SCALE', () => {
    expect(clampScale(6)).toBe(MAX_SCALE);
    expect(clampScale(10)).toBe(MAX_SCALE);
    expect(clampScale(100)).toBe(MAX_SCALE);
  });

  it('边界值精确等于 MIN_SCALE / MAX_SCALE', () => {
    expect(clampScale(MIN_SCALE)).toBe(MIN_SCALE);
    expect(clampScale(MAX_SCALE)).toBe(MAX_SCALE);
  });
});

describe('任务 8.1：computeClampedFactor', () => {
  it('区间内的缩放返回原因子', () => {
    // scale=1, factor=1.5 → newScale=1.5（在区间内）
    expect(computeClampedFactor(1, 1.5)).toBeCloseTo(1.5, 10);
    // scale=2, factor=0.5 → newScale=1（在区间内）
    expect(computeClampedFactor(2, 0.5)).toBeCloseTo(0.5, 10);
  });

  it('放大到上限：实际因子被裁剪', () => {
    // scale=4, factor=1.5 → newScale=6（超出上限 5），实际因子 = 5/4 = 1.25
    expect(computeClampedFactor(4, 1.5)).toBeCloseTo(1.25, 10);
  });

  it('缩小到下限：实际因子被裁剪', () => {
    // scale=0.15, factor=0.5 → newScale=0.075（低于下限 0.1），实际因子 = 0.1/0.15 ≈ 0.667
    expect(computeClampedFactor(0.15, 0.5)).toBeCloseTo(0.1 / 0.15, 10);
  });

  it('已在上限继续放大：返回 1（无变化）', () => {
    expect(computeClampedFactor(MAX_SCALE, 1.5)).toBe(1);
    expect(computeClampedFactor(MAX_SCALE, 2)).toBe(1);
  });

  it('已在下限继续缩小：返回 1（无变化）', () => {
    expect(computeClampedFactor(MIN_SCALE, 0.5)).toBe(1);
    expect(computeClampedFactor(MIN_SCALE, 0.1)).toBe(1);
  });

  it('currentScale=0 时返回 1（防御除零）', () => {
    expect(computeClampedFactor(0, 1.5)).toBe(1);
    expect(computeClampedFactor(0, 0.5)).toBe(1);
  });
});

describe('任务 8.1：zoomWithBoundary', () => {
  it('放大：scale 和 offset 按锚点不变性更新', () => {
    const result = zoomWithBoundary({
      currentScale: 1,
      currentOffset: { x: 0, y: 0 },
      cursorX: 100,
      cursorY: 100,
      factor: 1.5,
    });
    expect(result.scale).toBe(1.5);
    // 锚点不变性：(cursor - offset) / scale 应保持
    const canvasBefore = { x: (100 - 0) / 1, y: (100 - 0) / 1 };
    const canvasAfter = {
      x: (100 - result.offset.x) / result.scale,
      y: (100 - result.offset.y) / result.scale,
    };
    expect(canvasAfter.x).toBeCloseTo(canvasBefore.x, 10);
    expect(canvasAfter.y).toBeCloseTo(canvasBefore.y, 10);
  });

  it('缩小：scale 和 offset 按锚点不变性更新', () => {
    const result = zoomWithBoundary({
      currentScale: 2,
      currentOffset: { x: 50, y: 50 },
      cursorX: 200,
      cursorY: 200,
      factor: 0.5,
    });
    expect(result.scale).toBe(1);
    const canvasBefore = { x: (200 - 50) / 2, y: (200 - 50) / 2 };
    const canvasAfter = {
      x: (200 - result.offset.x) / result.scale,
      y: (200 - result.offset.y) / result.scale,
    };
    expect(canvasAfter.x).toBeCloseTo(canvasBefore.x, 10);
    expect(canvasAfter.y).toBeCloseTo(canvasBefore.y, 10);
  });

  it('已在上限继续放大：返回原值无变化', () => {
    const result = zoomWithBoundary({
      currentScale: MAX_SCALE,
      currentOffset: { x: 100, y: 200 },
      cursorX: 300,
      cursorY: 400,
      factor: 1.5,
    });
    expect(result.scale).toBe(MAX_SCALE);
    expect(result.offset.x).toBe(100);
    expect(result.offset.y).toBe(200);
  });

  it('已在下限继续缩小：返回原值无变化', () => {
    const result = zoomWithBoundary({
      currentScale: MIN_SCALE,
      currentOffset: { x: 100, y: 200 },
      cursorX: 300,
      cursorY: 400,
      factor: 0.5,
    });
    expect(result.scale).toBe(MIN_SCALE);
    expect(result.offset.x).toBe(100);
    expect(result.offset.y).toBe(200);
  });

  it('接近上限放大：实际 scale 落在边界上', () => {
    // scale=4, factor=1.5 → 期望 newScale=6，实际裁剪到 5
    const result = zoomWithBoundary({
      currentScale: 4,
      currentOffset: { x: 0, y: 0 },
      cursorX: 100,
      cursorY: 100,
      factor: 1.5,
    });
    expect(result.scale).toBe(MAX_SCALE);
  });

  it('接近下限缩小：实际 scale 落在边界上', () => {
    // scale=0.15, factor=0.5 → 期望 newScale=0.075，实际裁剪到 0.1
    const result = zoomWithBoundary({
      currentScale: 0.15,
      currentOffset: { x: 0, y: 0 },
      cursorX: 100,
      cursorY: 100,
      factor: 0.5,
    });
    expect(result.scale).toBe(MIN_SCALE);
  });

  it('factor=1 → 无变化', () => {
    const result = zoomWithBoundary({
      currentScale: 1.5,
      currentOffset: { x: 30, y: 70 },
      cursorX: 500,
      cursorY: 300,
      factor: 1,
    });
    expect(result.scale).toBe(1.5);
    expect(result.offset.x).toBe(30);
    expect(result.offset.y).toBe(70);
  });

  it('验证锚点不变性（任意参数）', () => {
    const params = {
      currentScale: 1.5,
      currentOffset: { x: 100, y: 200 },
      cursorX: 400,
      cursorY: 600,
      factor: 1.3,
    };
    const result = zoomWithBoundary(params);
    const canvasBefore = {
      x: (params.cursorX - params.currentOffset.x) / params.currentScale,
      y: (params.cursorY - params.currentOffset.y) / params.currentScale,
    };
    const canvasAfter = {
      x: (params.cursorX - result.offset.x) / result.scale,
      y: (params.cursorY - result.offset.y) / result.scale,
    };
    expect(canvasAfter.x).toBeCloseTo(canvasBefore.x, 10);
    expect(canvasAfter.y).toBeCloseTo(canvasBefore.y, 10);
  });
});

describe('任务 8.2/8.3：zoomToolClick', () => {
  it('任务 8.2：点击放大（zoomOut=false）使用 ZOOM_TOOL_IN_FACTOR', () => {
    const result = zoomToolClick({
      currentScale: 1,
      currentOffset: { x: 0, y: 0 },
      cursorX: 100,
      cursorY: 100,
      zoomOut: false,
    });
    expect(result.scale).toBe(ZOOM_TOOL_IN_FACTOR);
  });

  it('任务 8.3：反向缩小（zoomOut=true）使用 ZOOM_TOOL_OUT_FACTOR', () => {
    const result = zoomToolClick({
      currentScale: 1.5,
      currentOffset: { x: 0, y: 0 },
      cursorX: 100,
      cursorY: 100,
      zoomOut: true,
    });
    expect(result.scale).toBeCloseTo(1.5 * ZOOM_TOOL_OUT_FACTOR, 10);
    // 1.5 * (1/1.5) = 1
    expect(result.scale).toBeCloseTo(1, 10);
  });

  it('任务 8.2/8.3：反复点击放大与缩小能回到原始 scale', () => {
    let scale = 1;
    const offset = { x: 0, y: 0 };
    // 放大
    let result = zoomToolClick({
      currentScale: scale,
      currentOffset: offset,
      cursorX: 100,
      cursorY: 100,
      zoomOut: false,
    });
    scale = result.scale;
    // 反向缩小
    result = zoomToolClick({
      currentScale: scale,
      currentOffset: result.offset,
      cursorX: 100,
      cursorY: 100,
      zoomOut: true,
    });
    // 应回到原始 scale=1（因子互为倒数）
    expect(result.scale).toBeCloseTo(1, 10);
  });

  it('任务 8.2：放大时锚点不变性保持', () => {
    const result = zoomToolClick({
      currentScale: 1,
      currentOffset: { x: 50, y: 80 },
      cursorX: 300,
      cursorY: 400,
      zoomOut: false,
    });
    const canvasBefore = { x: (300 - 50) / 1, y: (400 - 80) / 1 };
    const canvasAfter = {
      x: (300 - result.offset.x) / result.scale,
      y: (400 - result.offset.y) / result.scale,
    };
    expect(canvasAfter.x).toBeCloseTo(canvasBefore.x, 10);
    expect(canvasAfter.y).toBeCloseTo(canvasBefore.y, 10);
  });

  it('任务 8.3：缩小时锚点不变性保持', () => {
    const result = zoomToolClick({
      currentScale: 2,
      currentOffset: { x: 50, y: 80 },
      cursorX: 300,
      cursorY: 400,
      zoomOut: true,
    });
    const canvasBefore = { x: (300 - 50) / 2, y: (400 - 80) / 2 };
    const canvasAfter = {
      x: (300 - result.offset.x) / result.scale,
      y: (400 - result.offset.y) / result.scale,
    };
    expect(canvasAfter.x).toBeCloseTo(canvasBefore.x, 10);
    expect(canvasAfter.y).toBeCloseTo(canvasBefore.y, 10);
  });

  it('任务 8.2：在上限点击放大返回原值无变化', () => {
    const result = zoomToolClick({
      currentScale: MAX_SCALE,
      currentOffset: { x: 100, y: 200 },
      cursorX: 300,
      cursorY: 400,
      zoomOut: false,
    });
    expect(result.scale).toBe(MAX_SCALE);
    expect(result.offset.x).toBe(100);
    expect(result.offset.y).toBe(200);
  });

  it('任务 8.3：在下限反向缩小返回原值无变化', () => {
    const result = zoomToolClick({
      currentScale: MIN_SCALE,
      currentOffset: { x: 100, y: 200 },
      cursorX: 300,
      cursorY: 400,
      zoomOut: true,
    });
    expect(result.scale).toBe(MIN_SCALE);
    expect(result.offset.x).toBe(100);
    expect(result.offset.y).toBe(200);
  });
});
