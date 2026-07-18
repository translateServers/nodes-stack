import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyColorToStyle,
  getColorApplyTarget,
  isTransparent,
  normalizeColor,
  sampleColorFromCanvas,
  sampleColorFromElement,
  UNSAMPLEABLE,
} from './color-sampler';

/**
 * 任务 9.1：颜色采样纯函数测试
 *
 * 覆盖：
 * - normalizeColor：hex（3/6/8 位）、rgb()、rgba()、不支持的格式
 * - isTransparent：transparent、rgba alpha=0、rgb()、空值
 * - sampleColorFromElement：背景/边框/文本优先级、透明跳过
 * - sampleColorFromCanvas：仅背景、透明返回 none
 * - getColorApplyTarget：text/rect/ellipse/image/bar-chart
 * - applyColorToStyle：应用颜色、null target 返回原引用
 */

describe('normalizeColor 任务 9.1', () => {
  it('3 位 hex 规范化为 6 位小写', () => {
    expect(normalizeColor('#fff')).toBe('#ffffff');
    expect(normalizeColor('#F00')).toBe('#ff0000');
    expect(normalizeColor('#aB3')).toBe('#aabb33');
  });

  it('6 位 hex 规范化为小写', () => {
    expect(normalizeColor('#ffffff')).toBe('#ffffff');
    expect(normalizeColor('#FF0000')).toBe('#ff0000');
    expect(normalizeColor('#3B82F6')).toBe('#3b82f6');
  });

  it('8 位 hex（带 alpha）丢弃 alpha', () => {
    expect(normalizeColor('#ffffffff')).toBe('#ffffff');
    expect(normalizeColor('#FF0000FF')).toBe('#ff0000');
    expect(normalizeColor('#3B82F680')).toBe('#3b82f6');
  });

  it('rgb() 规范化为 hex', () => {
    expect(normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(normalizeColor('rgb(0, 128, 255)')).toBe('#0080ff');
    expect(normalizeColor('rgb(59, 130, 246)')).toBe('#3b82f6');
  });

  it('rgba() 丢弃 alpha 规范化为 hex', () => {
    expect(normalizeColor('rgba(255, 0, 0, 1)')).toBe('#ff0000');
    expect(normalizeColor('rgba(0, 128, 255, 0.5)')).toBe('#0080ff');
    expect(normalizeColor('rgba(59, 130, 246, 0.2)')).toBe('#3b82f6');
  });

  it('空字符串与 null/undefined 返回 null', () => {
    expect(normalizeColor('')).toBeNull();
    expect(normalizeColor('   ')).toBeNull();
  });

  it('不支持的格式返回 null', () => {
    expect(normalizeColor('red')).toBeNull();
    expect(normalizeColor('hsl(0, 100%, 50%)')).toBeNull();
    expect(normalizeColor('var(--color)')).toBeNull();
    expect(normalizeColor('#ff')).toBeNull();
    expect(normalizeColor('#fffff')).toBeNull();
    expect(normalizeColor('#ffffffffff')).toBeNull();
  });

  it('带空白的输入被 trim 处理', () => {
    expect(normalizeColor('  #fff  ')).toBe('#ffffff');
    expect(normalizeColor('  rgb(255, 0, 0)  ')).toBe('#ff0000');
  });

  it('rgb() 各分量越界被 clamp 到 0-255', () => {
    expect(normalizeColor('rgb(300, -10, 0)')).toBe('#ff0000');
  });
});

describe('isTransparent 任务 9.1', () => {
  it('transparent 关键字返回 true', () => {
    expect(isTransparent('transparent')).toBe(true);
    expect(isTransparent('TRANSPARENT')).toBe(true);
    expect(isTransparent('  transparent  ')).toBe(true);
  });

  it('none 关键字返回 true', () => {
    expect(isTransparent('none')).toBe(true);
  });

  it('rgba alpha=0 返回 true', () => {
    expect(isTransparent('rgba(255, 0, 0, 0)')).toBe(true);
    expect(isTransparent('rgba(255, 0, 0, 0.0)')).toBe(true);
    expect(isTransparent('rgba(255, 0, 0, 0.00)')).toBe(true);
  });

  it('rgba alpha>0 返回 false', () => {
    expect(isTransparent('rgba(255, 0, 0, 0.1)')).toBe(false);
    expect(isTransparent('rgba(255, 0, 0, 1)')).toBe(false);
    expect(isTransparent('rgba(255, 0, 0, 0.5)')).toBe(false);
  });

  it('rgb() 无 alpha 通道返回 false', () => {
    expect(isTransparent('rgb(255, 0, 0)')).toBe(false);
    expect(isTransparent('rgb(0, 0, 0)')).toBe(false);
  });

  it('hex 颜色返回 false（hex 透明度不在此判定）', () => {
    expect(isTransparent('#ffffff')).toBe(false);
    expect(isTransparent('#000000')).toBe(false);
  });

  it('空字符串返回 true', () => {
    expect(isTransparent('')).toBe(true);
    expect(isTransparent('   ')).toBe(true);
  });
});

describe('sampleColorFromElement 任务 9.2', () => {
  /**
   * jsdom 的 getComputedStyle 对 inline 样式支持有限，
   * 这里通过 mock getComputedStyle 直接控制返回值，
   * 验证采样优先级逻辑（背景 > 边框 > 文本）而非 jsdom 的 CSS 计算。
   */
  function setupComputedStyle(values: {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: string;
    color?: string;
  }): HTMLElement {
    const el = document.createElement('div');
    const mockComputed = {
      backgroundColor: values.backgroundColor ?? '',
      borderColor: values.borderColor ?? '',
      borderWidth: values.borderWidth ?? '0px',
      color: values.color ?? '',
    };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputed as CSSStyleDeclaration);
    return el;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('null 元素返回 UNSAMPLEABLE', () => {
    expect(sampleColorFromElement(null)).toEqual(UNSAMPLEABLE);
  });

  it('优先采样 background-color', () => {
    const el = setupComputedStyle({
      backgroundColor: 'rgb(59, 130, 246)',
      color: 'rgb(255, 0, 0)',
      borderWidth: '2px',
      borderColor: 'rgb(0, 255, 0)',
    });
    const result = sampleColorFromElement(el);
    expect(result.color).toBe('#3b82f6');
    expect(result.target).toBe('component-background');
  });

  it('background 透明时退回 border-color（borderWidth > 0）', () => {
    const el = setupComputedStyle({
      backgroundColor: 'transparent',
      borderWidth: '2px',
      borderColor: 'rgb(30, 64, 175)',
      color: 'rgb(255, 0, 0)',
    });
    const result = sampleColorFromElement(el);
    expect(result.color).toBe('#1e40af');
    expect(result.target).toBe('component-border');
  });

  it('borderWidth=0 时跳过 border-color', () => {
    const el = setupComputedStyle({
      backgroundColor: 'transparent',
      borderWidth: '0px',
      borderColor: 'rgb(30, 64, 175)',
      color: 'rgb(255, 0, 0)',
    });
    const result = sampleColorFromElement(el);
    expect(result.color).toBe('#ff0000');
    expect(result.target).toBe('component-text');
  });

  it('所有颜色透明时返回 UNSAMPLEABLE', () => {
    const el = setupComputedStyle({
      backgroundColor: 'transparent',
      borderWidth: '0px',
      color: 'rgba(0, 0, 0, 0)',
    });
    const result = sampleColorFromElement(el);
    expect(result).toEqual(UNSAMPLEABLE);
  });

  it('hex 格式 backgroundColor 被规范化', () => {
    const el = setupComputedStyle({
      backgroundColor: '#FF0000',
    });
    const result = sampleColorFromElement(el);
    expect(result.color).toBe('#ff0000');
    expect(result.target).toBe('component-background');
  });

  it('3 位 hex 被规范化为 6 位', () => {
    const el = setupComputedStyle({
      backgroundColor: '#fff',
    });
    const result = sampleColorFromElement(el);
    expect(result.color).toBe('#ffffff');
  });

  it('borderWidth 非数字（如 "medium"）时跳过 border-color', () => {
    const el = setupComputedStyle({
      backgroundColor: 'transparent',
      borderWidth: 'medium',
      borderColor: 'rgb(30, 64, 175)',
      color: 'rgb(255, 0, 0)',
    });
    const result = sampleColorFromElement(el);
    expect(result.color).toBe('#ff0000');
    expect(result.target).toBe('component-text');
  });

  it('空 computed backgroundColor 返回 UNSAMPLEABLE（无 color 时）', () => {
    const el = setupComputedStyle({
      backgroundColor: '',
      borderWidth: '0px',
      color: '',
    });
    const result = sampleColorFromElement(el);
    expect(result).toEqual(UNSAMPLEABLE);
  });
});

describe('sampleColorFromCanvas 任务 9.2', () => {
  function setupComputedStyle(backgroundColor: string): HTMLElement {
    const el = document.createElement('div');
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor,
    } as CSSStyleDeclaration);
    return el;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('null 元素返回 UNSAMPLEABLE', () => {
    expect(sampleColorFromCanvas(null)).toEqual(UNSAMPLEABLE);
  });

  it('采样画布 background-color', () => {
    const el = setupComputedStyle('rgb(0, 0, 0)');
    const result = sampleColorFromCanvas(el);
    expect(result.color).toBe('#000000');
    expect(result.target).toBe('canvas-background');
  });

  it('透明 background 返回 UNSAMPLEABLE', () => {
    const el = setupComputedStyle('transparent');
    const result = sampleColorFromCanvas(el);
    expect(result).toEqual(UNSAMPLEABLE);
  });

  it('空字符串 background 返回 UNSAMPLEABLE', () => {
    const el = setupComputedStyle('');
    const result = sampleColorFromCanvas(el);
    expect(result).toEqual(UNSAMPLEABLE);
  });
});

describe('getColorApplyTarget 任务 9.3', () => {
  it('text 组件返回 color', () => {
    expect(getColorApplyTarget({ type: 'text', style: {} })).toBe('color');
  });

  it('rect 组件返回 backgroundColor', () => {
    expect(getColorApplyTarget({ type: 'rect', style: { borderWidth: 0 } })).toBe(
      'backgroundColor',
    );
  });

  it('ellipse 组件返回 backgroundColor', () => {
    expect(getColorApplyTarget({ type: 'ellipse', style: { borderWidth: 2 } })).toBe(
      'backgroundColor',
    );
  });

  it('image 组件不支持颜色返回 null', () => {
    expect(getColorApplyTarget({ type: 'image', style: {} })).toBeNull();
  });

  it('bar-chart 组件不支持颜色返回 null', () => {
    expect(getColorApplyTarget({ type: 'bar-chart', style: {} })).toBeNull();
  });

  it('未知组件类型返回 null', () => {
    expect(getColorApplyTarget({ type: 'custom', style: {} })).toBeNull();
  });
});

describe('applyColorToStyle 任务 9.3', () => {
  it('target=color 时应用 color 字段', () => {
    const style = { color: '#000000', fontSize: 14 };
    const next = applyColorToStyle(style, 'color', '#ff0000');
    expect(next.color).toBe('#ff0000');
    expect(next.fontSize).toBe(14);
    // 原 style 不被修改
    expect(style.color).toBe('#000000');
  });

  it('target=backgroundColor 时应用 backgroundColor 字段', () => {
    const style = { backgroundColor: '#3b82f6', borderWidth: 0 };
    const next = applyColorToStyle(style, 'backgroundColor', '#ff0000');
    expect(next.backgroundColor).toBe('#ff0000');
    expect(next.borderWidth).toBe(0);
  });

  it('target=borderColor 时应用 borderColor 字段', () => {
    const style = { borderColor: '#1e40af', borderWidth: 2 };
    const next = applyColorToStyle(style, 'borderColor', '#ff0000');
    expect(next.borderColor).toBe('#ff0000');
    expect(next.borderWidth).toBe(2);
  });

  it('target=null 时返回原 style 引用（不入历史）', () => {
    const style = { color: '#000000' };
    const next = applyColorToStyle(style, null, '#ff0000');
    expect(next).toBe(style);
  });

  it('应用颜色不改原对象（不可变更新）', () => {
    const style = { color: '#000000', backgroundColor: '#3b82f6' };
    const next = applyColorToStyle(style, 'color', '#ffffff');
    expect(next).not.toBe(style);
    expect(next.color).toBe('#ffffff');
    expect(next.backgroundColor).toBe('#3b82f6');
    // 原 style 完全不变
    expect(style.color).toBe('#000000');
    expect(style.backgroundColor).toBe('#3b82f6');
  });
});
