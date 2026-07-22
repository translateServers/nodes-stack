import { describe, expect, it } from 'vitest';
import {
  COMPONENT_DEFINITIONS,
  createComponentInstance,
  CATEGORY_LABELS,
  getDefinitionByType,
  getDefinitionsByCategory,
  searchComponentDefinitions,
} from '../registry';

describe('Component Registry', () => {
  describe('COMPONENT_DEFINITIONS', () => {
    it('should contain text, bar-chart, rect, ellipse, image definitions', () => {
      expect(COMPONENT_DEFINITIONS).toHaveLength(5);
      expect(COMPONENT_DEFINITIONS.find((d) => d.type === 'text')).toBeDefined();
      expect(COMPONENT_DEFINITIONS.find((d) => d.type === 'bar-chart')).toBeDefined();
      expect(COMPONENT_DEFINITIONS.find((d) => d.type === 'rect')).toBeDefined();
      expect(COMPONENT_DEFINITIONS.find((d) => d.type === 'ellipse')).toBeDefined();
      expect(COMPONENT_DEFINITIONS.find((d) => d.type === 'image')).toBeDefined();
    });

    it('Phase 2 Slice C：所有定义带 keywords / description 元数据', () => {
      for (const def of COMPONENT_DEFINITIONS) {
        expect(def.keywords, `${def.type} 应有 keywords`).toBeDefined();
        expect(def.keywords?.length).toBeGreaterThan(0);
        expect(def.description, `${def.type} 应有 description`).toBeDefined();
        expect(def.description?.length).toBeGreaterThan(0);
      }
    });

    it('Phase 2 Slice C：所有定义带 order 排序字段', () => {
      for (const def of COMPONENT_DEFINITIONS) {
        expect(def.order, `${def.type} 应有 order`).toBeDefined();
        expect(typeof def.order).toBe('number');
      }
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

    // 任务 6.2：矩形与椭圆组件创建工厂
    it('任务 6.2：创建矩形组件实例使用默认尺寸与样式', () => {
      const instance = createComponentInstance('rect', 100, 100, 1, []);
      expect(instance).not.toBeNull();
      expect(instance?.type).toBe('rect');
      expect(instance?.name).toBe('矩形');
      expect(instance?.position).toEqual({ x: 100, y: 100, width: 200, height: 120 });
      expect(instance?.style.backgroundColor).toBe('#3b82f6');
      expect(instance?.style.borderColor).toBe('#1e40af');
      expect(instance?.props).toEqual({});
    });

    it('任务 6.2：创建椭圆组件实例使用默认尺寸与样式', () => {
      const instance = createComponentInstance('ellipse', 50, 50, 1, []);
      expect(instance).not.toBeNull();
      expect(instance?.type).toBe('ellipse');
      expect(instance?.name).toBe('椭圆');
      expect(instance?.position).toEqual({ x: 50, y: 50, width: 200, height: 200 });
      expect(instance?.style.backgroundColor).toBe('#10b981');
      expect(instance?.style.borderColor).toBe('#047857');
    });

    it('任务 6.2：矩形和椭圆组件在 decoration 分类下', () => {
      const rectDef = getDefinitionByType('rect');
      const ellipseDef = getDefinitionByType('ellipse');
      expect(rectDef?.category).toBe('decoration');
      expect(ellipseDef?.category).toBe('decoration');
    });

    // 任务 6.3/6.4 预备：customSize 选项支持拖拽创建
    it('任务 6.2：customSize 选项覆盖默认尺寸', () => {
      const instance = createComponentInstance('rect', 0, 0, 1, [], {
        customSize: { width: 350, height: 250 },
      });
      expect(instance?.position.width).toBe(350);
      expect(instance?.position.height).toBe(250);
    });

    it('任务 6.2：未传 customSize 时使用默认尺寸', () => {
      const instance = createComponentInstance('rect', 0, 0, 1, []);
      expect(instance?.position.width).toBe(200);
      expect(instance?.position.height).toBe(120);
    });

    it('任务 6.2：矩形与椭圆组件可序列化（可保存和重新加载）', () => {
      const instance = createComponentInstance('rect', 10, 20, 5, []);
      // 模拟保存：JSON 序列化 → 反序列化应保持等价
      const serialized = JSON.stringify(instance);
      const restored = JSON.parse(serialized) as NonNullable<typeof instance>;
      expect(restored.type).toBe('rect');
      expect(restored.position).toEqual({ x: 10, y: 20, width: 200, height: 120 });
      expect(restored.style.backgroundColor).toBe('#3b82f6');
      expect(restored.zIndex).toBe(5);
    });

    // 任务 7.2：图片组件创建工厂
    it('任务 7.2：创建图片组件实例使用默认尺寸与空 src', () => {
      const instance = createComponentInstance('image', 100, 100, 1, []);
      expect(instance).not.toBeNull();
      expect(instance?.type).toBe('image');
      expect(instance?.name).toBe('图片');
      expect(instance?.position).toEqual({ x: 100, y: 100, width: 320, height: 240 });
      expect(instance?.props).toEqual({ src: '', alt: '' });
    });

    it('任务 7.2：图片组件在 media 分类下', () => {
      const imageDef = getDefinitionByType('image');
      expect(imageDef?.category).toBe('media');
    });

    it('任务 7.2：图片组件可序列化（可保存和重新加载）', () => {
      const instance = createComponentInstance('image', 10, 20, 5, []);
      const serialized = JSON.stringify(instance);
      const restored = JSON.parse(serialized) as NonNullable<typeof instance>;
      expect(restored.type).toBe('image');
      expect(restored.position).toEqual({ x: 10, y: 20, width: 320, height: 240 });
      expect(restored.props.src).toBe('');
      expect(restored.zIndex).toBe(5);
    });

    it('任务 7.2：customSize 选项覆盖图片默认尺寸', () => {
      const instance = createComponentInstance('image', 0, 0, 1, [], {
        customSize: { width: 800, height: 600 },
      });
      expect(instance?.position.width).toBe(800);
      expect(instance?.position.height).toBe(600);
    });
  });

  describe('getDefinitionsByCategory', () => {
    it('should return definitions for a category', () => {
      const charts = getDefinitionsByCategory('chart');
      expect(charts).toHaveLength(1);
      expect(charts[0].type).toBe('bar-chart');
    });

    it('任务 6.2：decoration 分类包含矩形与椭圆', () => {
      const decorations = getDefinitionsByCategory('decoration');
      expect(decorations).toHaveLength(2);
      expect(decorations.map((d) => d.type).sort()).toEqual(['ellipse', 'rect']);
    });

    it('任务 7.2：media 分类包含图片组件', () => {
      const media = getDefinitionsByCategory('media');
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe('image');
    });

    it('should return empty array for category with no components', () => {
      expect(getDefinitionsByCategory('table')).toHaveLength(0);
    });

    it('Phase 2 Slice C：按 order 升序排序（rect order=1 在前，ellipse order=2 在后）', () => {
      const decorations = getDefinitionsByCategory('decoration');
      expect(decorations[0]?.type).toBe('rect');
      expect(decorations[1]?.type).toBe('ellipse');
    });
  });

  describe('Phase 2 Slice C · searchComponentDefinitions', () => {
    it('空关键词返回全部定义', () => {
      expect(searchComponentDefinitions('')).toHaveLength(COMPONENT_DEFINITIONS.length);
      expect(searchComponentDefinitions('   ')).toHaveLength(COMPONENT_DEFINITIONS.length);
    });

    it('按 name 模糊匹配（大小写不敏感）', () => {
      const result = searchComponentDefinitions('文');
      expect(result.map((d) => d.type)).toContain('text');
    });

    it('按 type 模糊匹配', () => {
      const result = searchComponentDefinitions('bar');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('bar-chart');
    });

    it('按 keywords 别名匹配（中文别名）', () => {
      // 'chart' 关键词属于 bar-chart
      const result = searchComponentDefinitions('图表');
      expect(result.map((d) => d.type)).toContain('bar-chart');
    });

    it('按 keywords 别名匹配（英文别名）', () => {
      const result = searchComponentDefinitions('rectangle');
      expect(result.map((d) => d.type)).toContain('rect');
    });

    it('按 keywords 别名匹配（图片 logo 别名）', () => {
      const result = searchComponentDefinitions('logo');
      expect(result.map((d) => d.type)).toContain('image');
    });

    it('无匹配返回空数组', () => {
      expect(searchComponentDefinitions('不存在的组件xxx')).toHaveLength(0);
    });

    it('多个组件同时匹配关键词时返回全部', () => {
      // 'circle' 既在 ellipse.keywords 里，也无其他匹配，应只返回 ellipse
      const result = searchComponentDefinitions('circle');
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe('ellipse');
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
