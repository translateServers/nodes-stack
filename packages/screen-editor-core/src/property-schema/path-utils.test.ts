import { describe, expect, it } from 'vitest';
import { buildNestedUpdate, getByPath } from './path-utils';

describe('property-schema · path-utils', () => {
  describe('getByPath', () => {
    it('读取单层路径', () => {
      const obj = { width: 1920, height: 1080 };
      expect(getByPath(obj, 'width')).toBe(1920);
      expect(getByPath(obj, 'height')).toBe(1080);
    });

    it('读取多层路径', () => {
      const component = {
        position: { x: 10, y: 20, width: 100, height: 50 },
        style: { fontSize: 14, color: '#ffffff' },
      };
      expect(getByPath(component, 'position.x')).toBe(10);
      expect(getByPath(component, 'position.width')).toBe(100);
      expect(getByPath(component, 'style.fontSize')).toBe(14);
      expect(getByPath(component, 'style.color')).toBe('#ffffff');
    });

    it('读取不存在的路径返回 undefined', () => {
      const obj = { position: { x: 10 } };
      expect(getByPath(obj, 'position.y')).toBeUndefined();
      expect(getByPath(obj, 'style.fontSize')).toBeUndefined();
      expect(getByPath(obj, 'a.b.c.d')).toBeUndefined();
    });

    it('source 为 null/undefined 时返回 undefined', () => {
      expect(getByPath(null, 'position.x')).toBeUndefined();
      expect(getByPath(undefined, 'position.x')).toBeUndefined();
    });

    it('路径中间为 null 时返回 undefined', () => {
      const obj = { position: null };
      expect(getByPath(obj, 'position.x')).toBeUndefined();
    });
  });

  describe('buildNestedUpdate', () => {
    it('单层路径产生顶层 partial', () => {
      const canvas = { width: 1920, height: 1080, backgroundColor: '#000' };
      const update = buildNestedUpdate(canvas, 'width', 1280);
      expect(update).toEqual({ width: 1280 });
      // 原对象不变（不可变）
      expect(canvas.width).toBe(1920);
    });

    it('两层路径保留兄弟字段', () => {
      const component = {
        position: { x: 10, y: 20, width: 100, height: 50 },
      };
      const update = buildNestedUpdate(component, 'position.x', 99);
      expect(update).toEqual({ position: { x: 99, y: 20, width: 100, height: 50 } });
    });

    it('两层路径不改变原对象（不可变）', () => {
      const component = {
        position: { x: 10, y: 20 },
      };
      buildNestedUpdate(component, 'position.x', 99);
      expect(component.position.x).toBe(10);
    });

    it('style 路径更新', () => {
      const component = {
        style: { fontSize: 14, color: '#fff', backgroundColor: '#000' },
      };
      const update = buildNestedUpdate(component, 'style.fontSize', 18);
      expect(update).toEqual({
        style: { fontSize: 18, color: '#fff', backgroundColor: '#000' },
      });
    });

    it('路径中间为 undefined 时自动初始化', () => {
      const component = { position: { x: 10 } };
      // position.rotation 不存在，buildNestedUpdate 应构造 { rotation: 45 }
      const update = buildNestedUpdate(component, 'position.rotation', 45);
      expect(update).toEqual({ position: { x: 10, rotation: 45 } });
    });

    it('props 路径更新保留兄弟字段', () => {
      const component = {
        props: { title: '销售', content: 'hello' },
      };
      const update = buildNestedUpdate(component, 'props.title', '新版销售');
      expect(update).toEqual({ props: { title: '新版销售', content: 'hello' } });
    });

    it('三层路径', () => {
      const obj = { a: { b: { c: 1, d: 2 } } };
      const update = buildNestedUpdate(obj, 'a.b.c', 99);
      expect(update).toEqual({ a: { b: { c: 99, d: 2 } } });
    });

    it('update 结果可 shallow merge 到原对象得到正确最终值', () => {
      const component = {
        position: { x: 10, y: 20, width: 100 },
        style: { fontSize: 14 },
      };
      const update = buildNestedUpdate(component, 'position.x', 50);
      const merged = { ...component, ...update };
      expect(merged.position).toEqual({ x: 50, y: 20, width: 100 });
      expect(merged.style).toEqual({ fontSize: 14 });
    });
  });
});
