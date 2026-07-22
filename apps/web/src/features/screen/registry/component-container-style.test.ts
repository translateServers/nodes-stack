import type { ScreenComponent } from '@nebula/shared';
import { describe, expect, it } from 'vitest';

import { resolveComponentContainerStyle } from './component-container-style';

/**
 * 构造一个可被单测覆盖各字段的 ScreenComponent 入参。
 * 默认值刻意保持最小化，便于各用例按需覆写。
 */
function createComponent(overrides: Partial<ScreenComponent> = {}): ScreenComponent {
  return {
    id: 'comp-1',
    type: 'text',
    name: '文本',
    position: {
      x: 100,
      y: 200,
      width: 300,
      height: 120,
    },
    style: {},
    props: {},
    status: { locked: false, hidden: false },
    zIndex: 5,
    parentId: null,
    ...overrides,
  };
}

describe('resolveComponentContainerStyle', () => {
  describe('默认值', () => {
    it('当 opacity 与 overflow 缺失时，opacity=1 且 overflow="hidden"', () => {
      const component = createComponent();
      const style = resolveComponentContainerStyle(component);

      expect(style.opacity).toBe(1);
      expect(style.overflow).toBe('hidden');
    });

    it('当 rotation 缺失时，transform 为 undefined', () => {
      const component = createComponent();
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBeUndefined();
    });

    it('当 rotation=0 时，transform 仍为 undefined', () => {
      const component = createComponent({
        position: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBeUndefined();
    });

    it('position 始终为 absolute', () => {
      const component = createComponent();
      const style = resolveComponentContainerStyle(component);

      expect(style.position).toBe('absolute');
    });
  });

  describe('旋转', () => {
    it('非零旋转生成 rotate(<angle>deg) 的 transform', () => {
      const component = createComponent({
        position: { x: 0, y: 0, width: 100, height: 100, rotation: 45 },
      });
      const style = resolveComponentContainerStyle(component);

      // 关键样式字段，删除旋转逻辑会导致此断言失败
      expect(style.transform).toBe('rotate(45deg)');
    });

    it('负角度旋转同样生成 rotate(<angle>deg)', () => {
      const component = createComponent({
        position: { x: 0, y: 0, width: 100, height: 100, rotation: -90 },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBe('rotate(-90deg)');
    });
  });

  describe('Phase 2 Slice D · 翻转（flipX / flipY）', () => {
    it('flipX=true 生成 scaleX(-1) transform', () => {
      const component = createComponent({
        style: { flipX: true },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBe('scaleX(-1)');
    });

    it('flipY=true 生成 scaleY(-1) transform', () => {
      const component = createComponent({
        style: { flipY: true },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBe('scaleY(-1)');
    });

    it('flipX + flipY 同时为 true 时 transform 包含 scaleX 与 scaleY', () => {
      const component = createComponent({
        style: { flipX: true, flipY: true },
      });
      const style = resolveComponentContainerStyle(component);

      // CSS transform 链从右到左应用：rotate -> scaleX -> scaleY
      expect(style.transform).toBe('scaleX(-1) scaleY(-1)');
    });

    it('旋转 + 翻转组合：rotate -> scaleX -> scaleY 顺序（视觉上先翻转再旋转）', () => {
      const component = createComponent({
        position: { x: 0, y: 0, width: 100, height: 100, rotation: 90 },
        style: { flipX: true, flipY: true },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBe('rotate(90deg) scaleX(-1) scaleY(-1)');
    });

    it('flipX/flipY 显式为 false 时不生成 transform', () => {
      const component = createComponent({
        style: { flipX: false, flipY: false },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBeUndefined();
    });

    it('flipX/flipY 缺失时 transform 为 undefined', () => {
      const component = createComponent();
      const style = resolveComponentContainerStyle(component);

      expect(style.transform).toBeUndefined();
    });
  });

  describe('边框', () => {
    it('完整边框字段透传到容器样式', () => {
      const component = createComponent({
        style: {
          borderWidth: 2,
          borderColor: '#ff0000',
          borderStyle: 'dashed',
          borderRadius: 8,
        },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.borderWidth).toBe(2);
      expect(style.borderColor).toBe('#ff0000');
      expect(style.borderStyle).toBe('dashed');
      expect(style.borderRadius).toBe(8);
    });

    it('边框字段缺失时为 undefined（不产生默认边框）', () => {
      const component = createComponent();
      const style = resolveComponentContainerStyle(component);

      expect(style.borderWidth).toBeUndefined();
      expect(style.borderColor).toBeUndefined();
      expect(style.borderStyle).toBeUndefined();
      expect(style.borderRadius).toBeUndefined();
    });
  });

  describe('透明度', () => {
    it('opacity 来自 component.style.opacity', () => {
      const component = createComponent({
        style: { opacity: 0.5 },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.opacity).toBe(0.5);
    });

    it('opacity=0 不被默认值 1 覆盖', () => {
      const component = createComponent({
        style: { opacity: 0 },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.opacity).toBe(0);
    });
  });

  describe('溢出', () => {
    it('overflow 来自 component.style.overflow', () => {
      const component = createComponent({
        style: { overflow: 'visible' },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.overflow).toBe('visible');
    });

    it('overflow="auto" 透传', () => {
      const component = createComponent({
        style: { overflow: 'auto' },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.overflow).toBe('auto');
    });
  });

  describe('位置与尺寸', () => {
    it('left/top/width/height/zIndex 来自 component.position 与 zIndex', () => {
      const component = createComponent({
        position: { x: 12, y: 34, width: 560, height: 780 },
        zIndex: 42,
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.left).toBe(12);
      expect(style.top).toBe(34);
      expect(style.width).toBe(560);
      expect(style.height).toBe(780);
      expect(style.zIndex).toBe(42);
    });
  });

  describe('背景', () => {
    it('backgroundColor 来自 component.style.backgroundColor', () => {
      const component = createComponent({
        style: { backgroundColor: '#102030' },
      });
      const style = resolveComponentContainerStyle(component);

      expect(style.backgroundColor).toBe('#102030');
    });

    it('backgroundColor 缺失时为 undefined', () => {
      const component = createComponent();
      const style = resolveComponentContainerStyle(component);

      expect(style.backgroundColor).toBeUndefined();
    });
  });

  describe('组合场景', () => {
    it('旋转、边框、透明度、背景、位置同时设置时全部透传', () => {
      const component = createComponent({
        position: { x: 10, y: 20, width: 100, height: 50, rotation: 30 },
        style: {
          opacity: 0.8,
          borderWidth: 1,
          borderColor: '#000000',
          borderStyle: 'solid',
          borderRadius: 4,
          backgroundColor: '#abcdef',
          overflow: 'visible',
        },
        zIndex: 9,
      });
      const style = resolveComponentContainerStyle(component);

      // 关键字段一次性验证，确保多字段映射不互相干扰
      expect(style.position).toBe('absolute');
      expect(style.left).toBe(10);
      expect(style.top).toBe(20);
      expect(style.width).toBe(100);
      expect(style.height).toBe(50);
      expect(style.zIndex).toBe(9);
      expect(style.opacity).toBe(0.8);
      expect(style.borderWidth).toBe(1);
      expect(style.borderColor).toBe('#000000');
      expect(style.borderStyle).toBe('solid');
      expect(style.borderRadius).toBe(4);
      expect(style.backgroundColor).toBe('#abcdef');
      expect(style.overflow).toBe('visible');
      // 旋转为强制断言，删除旋转逻辑会让此用例失败
      expect(style.transform).toBe('rotate(30deg)');
    });
  });
});
