import { describe, expect, it } from 'vitest';
import { BarChart3, Box, Frame, Image, Table, Type } from 'lucide-react';
import {
  CATEGORY_META,
  categoryIcon,
  categoryLabel,
  categoryOrder,
  type CategoryMeta,
} from './category-meta';

describe('registry · category-meta', () => {
  describe('CATEGORY_META 单一数据源', () => {
    const EXPECTED_CATEGORIES = [
      'chart',
      'text',
      'media',
      'decoration',
      'table',
      'container',
    ] as const;

    it('包含全部 6 个已知 category', () => {
      for (const key of EXPECTED_CATEGORIES) {
        expect(CATEGORY_META[key], `${key} 应存在`).toBeDefined();
      }
      expect(Object.keys(CATEGORY_META).sort()).toEqual([...EXPECTED_CATEGORIES].sort());
    });

    it('每个 category 都有 label / icon / order 三个必填字段', () => {
      for (const [key, meta] of Object.entries(CATEGORY_META)) {
        expect(typeof meta.label, `${key}.label 应为 string`).toBe('string');
        expect(meta.label.length, `${key}.label 不能为空`).toBeGreaterThan(0);
        expect(meta.icon, `${key}.icon 应为 lucide 组件`).toBeDefined();
        expect(typeof meta.order, `${key}.order 应为 number`).toBe('number');
      }
    });

    it('chart / text / media / decoration / table / container 的 label 与原 CATEGORY_LABELS 保持一致', () => {
      expect(CATEGORY_META.chart.label).toBe('图表');
      expect(CATEGORY_META.text.label).toBe('文本');
      expect(CATEGORY_META.media.label).toBe('媒体');
      expect(CATEGORY_META.decoration.label).toBe('装饰');
      expect(CATEGORY_META.table.label).toBe('表格');
      expect(CATEGORY_META.container.label).toBe('容器');
    });

    it('每个 category 的 icon 指向预期的 lucide 组件', () => {
      expect(CATEGORY_META.chart.icon).toBe(BarChart3);
      expect(CATEGORY_META.text.icon).toBe(Type);
      expect(CATEGORY_META.media.icon).toBe(Image);
      expect(CATEGORY_META.decoration.icon).toBe(Frame);
      expect(CATEGORY_META.table.icon).toBe(Table);
      expect(CATEGORY_META.container.icon).toBe(Box);
    });

    it('order 在 1..6 范围内且互不重复', () => {
      const orders = Object.values(CATEGORY_META).map((m: CategoryMeta) => m.order);
      for (const o of orders) {
        expect(o, `order 应在 1..6 范围内`).toBeGreaterThanOrEqual(1);
        expect(o, `order 应在 1..6 范围内`).toBeLessThanOrEqual(6);
      }
      expect(new Set(orders).size, 'order 应互不重复').toBe(orders.length);
    });
  });

  describe('categoryLabel', () => {
    it('已知 category 返回对应中文 label', () => {
      expect(categoryLabel('chart')).toBe('图表');
      expect(categoryLabel('text')).toBe('文本');
      expect(categoryLabel('media')).toBe('媒体');
      expect(categoryLabel('decoration')).toBe('装饰');
      expect(categoryLabel('table')).toBe('表格');
      expect(categoryLabel('container')).toBe('容器');
    });

    it('未知 category 回退为 category 本身', () => {
      expect(categoryLabel('unknown')).toBe('unknown');
      expect(categoryLabel('')).toBe('');
      expect(categoryLabel('custom')).toBe('custom');
    });
  });

  describe('categoryIcon', () => {
    it('已知 category 返回对应 lucide 图标组件', () => {
      expect(categoryIcon('chart')).toBe(BarChart3);
      expect(categoryIcon('text')).toBe(Type);
      expect(categoryIcon('media')).toBe(Image);
      expect(categoryIcon('decoration')).toBe(Frame);
      expect(categoryIcon('table')).toBe(Table);
      expect(categoryIcon('container')).toBe(Box);
    });

    it('未知 category 回退为 Box', () => {
      expect(categoryIcon('unknown')).toBe(Box);
      expect(categoryIcon('')).toBe(Box);
      expect(categoryIcon('custom')).toBe(Box);
    });
  });

  describe('categoryOrder', () => {
    it('已知 category 返回对应 order', () => {
      expect(categoryOrder('chart')).toBe(1);
      expect(categoryOrder('text')).toBe(2);
      expect(categoryOrder('media')).toBe(3);
      expect(categoryOrder('decoration')).toBe(4);
      expect(categoryOrder('table')).toBe(5);
      expect(categoryOrder('container')).toBe(6);
    });

    it('未知 category 回退为 99', () => {
      expect(categoryOrder('unknown')).toBe(99);
      expect(categoryOrder('')).toBe(99);
      expect(categoryOrder('custom')).toBe(99);
    });
  });
});
