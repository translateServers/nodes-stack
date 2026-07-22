import { describe, expect, it } from 'vitest';
import {
  BAR_CHART_SCHEMA,
  DEFAULT_SCHEMA,
  getSchemaForComponentType,
  POSITION_SECTION,
  PROPERTY_SCHEMAS,
  STYLE_SECTION,
  TEXT_PROPS_SECTION,
  TRANSFORM_SECTION,
} from './schemas';

describe('property-schema · schemas 注册表', () => {
  describe('getSchemaForComponentType', () => {
    it('已注册的 text 类型返回 TEXT_SCHEMA', () => {
      const schema = getSchemaForComponentType('text');
      expect(schema).toBe(PROPERTY_SCHEMAS.text);
      expect(schema.length).toBeGreaterThanOrEqual(3);
    });

    it('已注册的 bar-chart 类型返回 BAR_CHART_SCHEMA', () => {
      const schema = getSchemaForComponentType('bar-chart');
      expect(schema).toBe(PROPERTY_SCHEMAS['bar-chart']);
    });

    it('未注册的类型回退到 DEFAULT_SCHEMA', () => {
      const schema = getSchemaForComponentType('shape');
      expect(schema).toBe(DEFAULT_SCHEMA);
      expect(getSchemaForComponentType('rect')).toBe(DEFAULT_SCHEMA);
      expect(getSchemaForComponentType('image')).toBe(DEFAULT_SCHEMA);
      expect(getSchemaForComponentType('unknown-type')).toBe(DEFAULT_SCHEMA);
    });
  });

  describe('DEFAULT_SCHEMA 结构', () => {
    it('Phase 2 Slice D：包含位置与尺寸 + 样式 + 变换三个分区', () => {
      expect(DEFAULT_SCHEMA).toHaveLength(3);
      expect(DEFAULT_SCHEMA.map((s) => s.id)).toEqual(['position', 'style', 'transform']);
    });

    it('所有分区都在 appearance tab', () => {
      expect(DEFAULT_SCHEMA.every((s) => s.tab === 'appearance')).toBe(true);
    });

    it('位置分区包含 X/Y/宽/高/旋转 5 个字段', () => {
      const fields = POSITION_SECTION.fields ?? [];
      expect(fields).toHaveLength(5);
      expect(fields.map((f) => (f.kind === 'field' ? f.label : null))).toEqual([
        'X',
        'Y',
        '宽',
        '高',
        '旋转',
      ]);
    });

    it('旋转字段有 visibleWhen 条件', () => {
      const fields = POSITION_SECTION.fields ?? [];
      const rotation = fields[4];
      expect(rotation).toBeDefined();
      expect(rotation?.kind).toBe('field');
      if (rotation?.kind === 'field') {
        expect(rotation.visibleWhen).toBeDefined();
        expect(rotation.visibleWhen?.({ position: { rotation: 0 } } as never)).toBe(false);
        expect(rotation.visibleWhen?.({ position: { rotation: 30 } } as never)).toBe(true);
      }
    });

    it('样式分区包含背景/透明度/边框/边框色/圆角 5 个字段', () => {
      const fields = STYLE_SECTION.fields ?? [];
      expect(fields).toHaveLength(5);
      expect(fields.map((f) => (f.kind === 'field' ? f.label : null))).toEqual([
        '背景',
        '透明度',
        '边框',
        '边框色',
        '圆角',
      ]);
    });

    it('宽/高字段有 min=1 约束', () => {
      const fields = POSITION_SECTION.fields ?? [];
      const width = fields[2];
      const height = fields[3];
      expect(width?.kind).toBe('field');
      expect(height?.kind).toBe('field');
      if (width?.kind === 'field' && height?.kind === 'field') {
        expect(width.controlProps?.min).toBe(1);
        expect(height.controlProps?.min).toBe(1);
      }
    });
  });

  describe('TEXT_SCHEMA 结构', () => {
    it('Phase 2 Slice D：在 DEFAULT_SCHEMA 基础上追加文本属性 + 变换分区', () => {
      const schema = PROPERTY_SCHEMAS.text;
      expect(schema).toHaveLength(4);
      expect(schema[2]?.id).toBe('text-props');
      expect(schema[3]?.id).toBe('transform');
    });

    it('Phase 2 Slice D：文本属性分区包含内容/字号/字色 + 字重/行高/对齐 6 个字段', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      expect(fields).toHaveLength(6);
      expect(fields.map((f) => (f.kind === 'field' ? f.label : null))).toEqual([
        '内容',
        '字号',
        '字色',
        '字重',
        '行高',
        '对齐',
      ]);
    });

    it('内容字段使用 textarea 控件，路径为 props.content', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const content = fields[0];
      expect(content?.kind).toBe('field');
      if (content?.kind === 'field') {
        expect(content.control).toBe('textarea');
        expect(content.path).toBe('props.content');
      }
    });

    it('字号字段路径为 style.fontSize，默认值 14', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const fontSize = fields[1];
      expect(fontSize?.kind).toBe('field');
      if (fontSize?.kind === 'field') {
        expect(fontSize.path).toBe('style.fontSize');
        expect(fontSize.defaultValue).toBe(14);
      }
    });

    it('Phase 2 Slice D：字重字段使用 select 控件，路径 style.fontWeight，默认值 normal', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const fontWeight = fields[3];
      expect(fontWeight?.kind).toBe('field');
      if (fontWeight?.kind === 'field') {
        expect(fontWeight.control).toBe('select');
        expect(fontWeight.path).toBe('style.fontWeight');
        expect(fontWeight.defaultValue).toBe('normal');
      }
    });

    it('Phase 2 Slice D：行高字段路径 style.lineHeight，默认值 1.5', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const lineHeight = fields[4];
      expect(lineHeight?.kind).toBe('field');
      if (lineHeight?.kind === 'field') {
        expect(lineHeight.path).toBe('style.lineHeight');
        expect(lineHeight.defaultValue).toBe(1.5);
      }
    });

    it('Phase 2 Slice D：对齐字段使用 select 控件，路径 style.textAlign，默认值 left', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const textAlign = fields[5];
      expect(textAlign?.kind).toBe('field');
      if (textAlign?.kind === 'field') {
        expect(textAlign.control).toBe('select');
        expect(textAlign.path).toBe('style.textAlign');
        expect(textAlign.defaultValue).toBe('left');
      }
    });
  });

  describe('Phase 2 Slice D · TRANSFORM_SECTION 结构', () => {
    it('包含水平翻转 + 垂直翻转 2 个 switch 字段', () => {
      const fields = TRANSFORM_SECTION.fields ?? [];
      expect(fields).toHaveLength(2);
      expect(fields.map((f) => (f.kind === 'field' ? f.label : null))).toEqual([
        '水平翻转',
        '垂直翻转',
      ]);
    });

    it('水平翻转字段使用 switch 控件，路径 style.flipX，默认值 false', () => {
      const fields = TRANSFORM_SECTION.fields ?? [];
      const flipX = fields[0];
      expect(flipX?.kind).toBe('field');
      if (flipX?.kind === 'field') {
        expect(flipX.control).toBe('switch');
        expect(flipX.path).toBe('style.flipX');
        expect(flipX.defaultValue).toBe(false);
      }
    });

    it('垂直翻转字段使用 switch 控件，路径 style.flipY，默认值 false', () => {
      const fields = TRANSFORM_SECTION.fields ?? [];
      const flipY = fields[1];
      expect(flipY?.kind).toBe('field');
      if (flipY?.kind === 'field') {
        expect(flipY.control).toBe('switch');
        expect(flipY.path).toBe('style.flipY');
        expect(flipY.defaultValue).toBe(false);
      }
    });

    it('变换分区在 appearance tab', () => {
      expect(TRANSFORM_SECTION.tab).toBe('appearance');
    });
  });

  describe('BAR_CHART_SCHEMA 结构', () => {
    it('包含位置与尺寸分区 + 图表配置 customRender 分区', () => {
      expect(BAR_CHART_SCHEMA).toHaveLength(2);
      expect(BAR_CHART_SCHEMA[0]?.id).toBe('position');
      expect(BAR_CHART_SCHEMA[1]?.id).toBe('bar-chart-config');
    });

    it('图表配置分区使用 customRender 逃生舱（无 fields）', () => {
      const chartConfig = BAR_CHART_SCHEMA[1];
      expect(chartConfig?.customRender).toBeDefined();
      expect(chartConfig?.fields).toBeUndefined();
    });

    it('位置分区在 appearance tab，图表配置在 data tab', () => {
      expect(BAR_CHART_SCHEMA[0]?.tab).toBe('appearance');
      expect(BAR_CHART_SCHEMA[1]?.tab).toBe('data');
    });
  });

  describe('注册表完整性', () => {
    it('PROPERTY_SCHEMAS 包含 text 和 bar-chart', () => {
      expect(PROPERTY_SCHEMAS.text).toBeDefined();
      expect(PROPERTY_SCHEMAS['bar-chart']).toBeDefined();
    });

    it('所有 schema 的分区 id 唯一', () => {
      for (const [type, schema] of Object.entries(PROPERTY_SCHEMAS)) {
        const ids = schema.map((s) => s.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      }
    });

    it('所有声明式字段的 control 名在 FIELD_CONTROLS 中有注册', async () => {
      const { FIELD_CONTROLS } = await import('./field-controls');
      for (const schema of Object.values(PROPERTY_SCHEMAS)) {
        for (const section of schema) {
          for (const field of section.fields ?? []) {
            if (field.kind === 'field') {
              expect(FIELD_CONTROLS[field.control]).toBeDefined();
            }
          }
        }
      }
    });
  });
});
