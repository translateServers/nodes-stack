import { describe, expect, it } from 'vitest';
import {
  COMPONENT_DEFINITIONS,
  getDefinitionByType,
  createComponentInstance,
  getDefinitionsByCategory,
  CATEGORY_LABELS,
} from '../registry';

describe('Component Registry', () => {
  describe('COMPONENT_DEFINITIONS', () => {
    it('should contain text and bar-chart definitions', () => {
      expect(COMPONENT_DEFINITIONS).toHaveLength(2);
      expect(COMPONENT_DEFINITIONS.find((d) => d.type === 'text')).toBeDefined();
      expect(COMPONENT_DEFINITIONS.find((d) => d.type === 'bar-chart')).toBeDefined();
    });
  });

  describe('getDefinitionByType', () => {
    it('should return definition for known type', () => {
      const def = getDefinitionByType('text');
      expect(def).toBeDefined();
      expect(def?.name).toBe('文本');
      expect(def?.category).toBe('text');
    });

    it('should return undefined for unknown type', () => {
      expect(getDefinitionByType('unknown')).toBeUndefined();
    });
  });

  describe('createComponentInstance', () => {
    it('should create a text component instance', () => {
      const instance = createComponentInstance('text', 100, 200, 1, []);
      expect(instance).not.toBeNull();
      expect(instance?.type).toBe('text');
      expect(instance?.name).toBe('文本');
      expect(instance?.position.x).toBe(100);
      expect(instance?.position.y).toBe(200);
      expect(instance?.position.width).toBe(200);
      expect(instance?.position.height).toBe(60);
      expect(instance?.zIndex).toBe(1);
      expect(instance?.status.locked).toBe(false);
      expect(instance?.status.hidden).toBe(false);
      expect(instance?.props.content).toBe('请输入文本');
      expect(instance?.id).toBeDefined();
      expect(instance?.style.opacity).toBe(1);
      expect(instance?.style.color).toBe('#ffffff');
      expect(instance?.style.fontSize).toBe(14);
    });

    it('should create a bar-chart component instance', () => {
      const instance = createComponentInstance('bar-chart', 50, 50, 2, []);
      expect(instance).not.toBeNull();
      expect(instance?.type).toBe('bar-chart');
      expect(instance?.position.width).toBe(400);
      expect(instance?.position.height).toBe(300);
      expect(Array.isArray(instance?.props.data)).toBe(true);
    });

    it('should deep clone defaultProps so instances do not share references', () => {
      const a = createComponentInstance('bar-chart', 0, 0, 1, []);
      const b = createComponentInstance('bar-chart', 0, 0, 2, []);
      expect(a?.props.data).not.toBe(b?.props.data);
    });

    it('should auto-increment name for duplicate types', () => {
      const existing = [createComponentInstance('text', 0, 0, 1, [])!];
      const second = createComponentInstance('text', 0, 0, 2, existing);
      expect(second?.name).toBe('文本 2');
    });

    it('should return null for unknown type', () => {
      expect(createComponentInstance('unknown', 0, 0, 0, [])).toBeNull();
    });
  });

  describe('getDefinitionsByCategory', () => {
    it('should return definitions for a category', () => {
      const charts = getDefinitionsByCategory('chart');
      expect(charts).toHaveLength(1);
      expect(charts[0].type).toBe('bar-chart');
    });

    it('should return empty array for category with no components', () => {
      expect(getDefinitionsByCategory('media')).toHaveLength(0);
    });
  });

  describe('CATEGORY_LABELS', () => {
    it('should have labels for all categories', () => {
      expect(CATEGORY_LABELS.chart).toBe('图表');
      expect(CATEGORY_LABELS.text).toBe('文本');
      expect(CATEGORY_LABELS.media).toBe('媒体');
      expect(CATEGORY_LABELS.decoration).toBe('装饰');
      expect(CATEGORY_LABELS.table).toBe('表格');
      expect(CATEGORY_LABELS.container).toBe('容器');
    });
  });
});
