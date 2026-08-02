import { describe, it, expect } from 'vitest';
import {
  normalizeRect,
  hasValidSize,
  computeShapeCreation,
  DEFAULT_MIN_SHAPE_SIZE,
} from './shape-creation-geometry';

/**
 * 任务 6.1 验证：形状创建几何纯函数
 *
 * 覆盖：
 * - 四个拖拽方向（左上→右下、右下→左上、左下→右上、右上→左下）
 * - 负坐标
 * - 缩放画布坐标（输入已经是画布坐标，函数本身不感知 canvasScale）
 * - 微小拖拽（小于阈值）
 * - 自定义阈值
 */
describe('normalizeRect：四个拖拽方向的规范化', () => {
  it('左上 → 右下（最常见方向）', () => {
    const rect = normalizeRect(100, 100, 300, 200);
    expect(rect).toEqual({ x: 100, y: 100, width: 200, height: 100 });
  });

  it('右下 → 左上（反向拖拽）', () => {
    const rect = normalizeRect(300, 200, 100, 100);
    expect(rect).toEqual({ x: 100, y: 100, width: 200, height: 100 });
  });

  it('左下 → 右上', () => {
    const rect = normalizeRect(100, 200, 300, 100);
    expect(rect).toEqual({ x: 100, y: 100, width: 200, height: 100 });
  });

  it('右上 → 左下', () => {
    const rect = normalizeRect(300, 100, 100, 200);
    expect(rect).toEqual({ x: 100, y: 100, width: 200, height: 100 });
  });

  it('纯水平拖拽（高度为 0）', () => {
    const rect = normalizeRect(100, 100, 300, 100);
    expect(rect).toEqual({ x: 100, y: 100, width: 200, height: 0 });
  });

  it('纯垂直拖拽（宽度为 0）', () => {
    const rect = normalizeRect(100, 100, 100, 300);
    expect(rect).toEqual({ x: 100, y: 100, width: 0, height: 200 });
  });

  it('起点等于终点（width=height=0）', () => {
    const rect = normalizeRect(100, 100, 100, 100);
    expect(rect).toEqual({ x: 100, y: 100, width: 0, height: 0 });
  });
});

describe('normalizeRect：负坐标处理', () => {
  it('起点和终点均为负坐标', () => {
    const rect = normalizeRect(-200, -100, -50, -50);
    expect(rect).toEqual({ x: -200, y: -100, width: 150, height: 50 });
  });

  it('起点为负、终点为正（跨零点）', () => {
    const rect = normalizeRect(-100, -100, 100, 100);
    expect(rect).toEqual({ x: -100, y: -100, width: 200, height: 200 });
  });

  it('起点为正、终点为负（反向跨零点）', () => {
    const rect = normalizeRect(100, 100, -100, -100);
    expect(rect).toEqual({ x: -100, y: -100, width: 200, height: 200 });
  });
});

describe('normalizeRect：缩放画布坐标（函数本身不感知 scale）', () => {
  it('输入已换算为画布坐标，函数直接处理（scale=0.5）', () => {
    // 屏幕拖拽 400px，scale=0.5 → 画布坐标 800px
    const rect = normalizeRect(0, 0, 800, 600);
    expect(rect).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('输入已换算为画布坐标，函数直接处理（scale=2）', () => {
    // 屏幕拖拽 100px，scale=2 → 画布坐标 50px
    const rect = normalizeRect(0, 0, 50, 50);
    expect(rect).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });
});

describe('hasValidSize：微小拖拽阈值判定', () => {
  it('宽高均达到默认阈值（4px）→ true', () => {
    expect(hasValidSize(4, 4)).toBe(true);
    expect(hasValidSize(10, 10)).toBe(true);
  });

  it('宽或高小于默认阈值 → false', () => {
    expect(hasValidSize(3, 10)).toBe(false);
    expect(hasValidSize(10, 3)).toBe(false);
    expect(hasValidSize(3, 3)).toBe(false);
  });

  it('宽或高为 0 → false', () => {
    expect(hasValidSize(0, 10)).toBe(false);
    expect(hasValidSize(10, 0)).toBe(false);
    expect(hasValidSize(0, 0)).toBe(false);
  });

  it('自定义阈值', () => {
    expect(hasValidSize(10, 10, 5)).toBe(true);
    expect(hasValidSize(4, 10, 5)).toBe(false);
    expect(hasValidSize(10, 4, 5)).toBe(false);
  });

  it('默认阈值常量 = 4', () => {
    expect(DEFAULT_MIN_SHAPE_SIZE).toBe(4);
  });
});

describe('computeShapeCreation：组合结果', () => {
  it('有效拖拽 → hasValidSize=true', () => {
    const result = computeShapeCreation(100, 100, 300, 200);
    expect(result.rect).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    expect(result.hasValidSize).toBe(true);
  });

  it('微小拖拽 → hasValidSize=false', () => {
    const result = computeShapeCreation(100, 100, 102, 102);
    expect(result.rect).toEqual({ x: 100, y: 100, width: 2, height: 2 });
    expect(result.hasValidSize).toBe(false);
  });

  it('反向微小拖拽 → hasValidSize=false', () => {
    const result = computeShapeCreation(102, 102, 100, 100);
    expect(result.rect).toEqual({ x: 100, y: 100, width: 2, height: 2 });
    expect(result.hasValidSize).toBe(false);
  });

  it('自定义阈值影响 hasValidSize 判定', () => {
    // 5x5 在默认阈值下有效，但在阈值=10 下无效
    const result1 = computeShapeCreation(0, 0, 5, 5);
    expect(result1.hasValidSize).toBe(true);

    const result2 = computeShapeCreation(0, 0, 5, 5, 10);
    expect(result2.hasValidSize).toBe(false);
  });

  it('负坐标有效拖拽 → hasValidSize=true', () => {
    const result = computeShapeCreation(-200, -100, -50, -50);
    expect(result.rect).toEqual({ x: -200, y: -100, width: 150, height: 50 });
    expect(result.hasValidSize).toBe(true);
  });

  it('结果不可变性：rect 字段 readonly', () => {
    const result = computeShapeCreation(0, 0, 100, 100);
    // 类型层面 readonly，运行时仍可尝试写入但应保持原值（无 Proxy 保护）
    // 这里仅验证字段存在且可读
    expect(result.rect.x).toBe(0);
    expect(result.rect.y).toBe(0);
    expect(result.rect.width).toBe(100);
    expect(result.rect.height).toBe(100);
    expect(result.hasValidSize).toBe(true);
  });
});
