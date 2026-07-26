import { describe, expect, it } from 'vitest';
// 触发 registered-components 副作用：注册全部组件后调用 buildPropertySchemas()
// 填充 PROPERTY_SCHEMAS（schemas.tsx 不直接 import registered-components 以避免循环依赖）。
import '../registry';
import {
  BAR_CHART_SCHEMA,
  DEFAULT_SCHEMA,
  FILTER_SECTION,
  getSchemaForComponentType,
  LAYER_STATUS_SECTION,
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
    it('Task 5/6：包含位置尺寸 + 样式 + 变换 + 层级状态 + 滤镜 + 数据占位 + 交互占位 + 事件八个分区', () => {
      expect(DEFAULT_SCHEMA).toHaveLength(8);
      expect(DEFAULT_SCHEMA.map((s) => s.id)).toEqual([
        'position',
        'style',
        'transform',
        'layer-status',
        'filter',
        'default-data-empty',
        'default-interaction-empty',
        'quick-events',
      ]);
    });

    it('Task 5：分区按 tab 分布到 appearance / data / interaction / events 四个 tab', () => {
      const tabs = new Set(DEFAULT_SCHEMA.map((s) => s.tab));
      expect(tabs).toEqual(new Set(['appearance', 'data', 'interaction', 'events']));
    });

    it('Task 6：appearance tab 包含位置尺寸 + 样式 + 变换 + 层级状态 + 滤镜五个分区', () => {
      const appearanceSections = DEFAULT_SCHEMA.filter((s) => s.tab === 'appearance');
      expect(appearanceSections.map((s) => s.id)).toEqual([
        'position',
        'style',
        'transform',
        'layer-status',
        'filter',
      ]);
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
    it('Task 5/6：包含位置尺寸 + 样式 + 文本属性 + 变换 + 层级状态 + 滤镜 + 数据占位 + 事件八个分区', () => {
      const schema = PROPERTY_SCHEMAS.text;
      expect(schema).toHaveLength(8);
      expect(schema[2]?.id).toBe('text-props');
      expect(schema[3]?.id).toBe('transform');
      expect(schema[4]?.id).toBe('layer-status');
      expect(schema[5]?.id).toBe('filter');
      expect(schema[6]?.id).toBe('text-data-empty');
      expect(schema[7]?.id).toBe('quick-events');
    });

    it('Task 5：分区按 tab 分布到 appearance / data / events 三个 tab', () => {
      const tabs = new Set(PROPERTY_SCHEMAS.text.map((s) => s.tab));
      expect(tabs).toEqual(new Set(['appearance', 'data', 'events']));
    });

    it('Task 7：文本属性分区包含内容/字号/字色 + 字重/行高/对齐 + 字间距/描边宽度/描边颜色 9 个字段', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      expect(fields).toHaveLength(9);
      expect(fields.map((f) => (f.kind === 'field' ? f.label : null))).toEqual([
        '内容',
        '字号',
        '字色',
        '字重',
        '行高',
        '对齐',
        '字间距',
        '描边宽度',
        '描边颜色',
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

    it('Task 7：字间距字段使用 number 控件，路径 style.letterSpacing，controlProps step=0.1', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const letterSpacing = fields[6];
      expect(letterSpacing?.kind).toBe('field');
      if (letterSpacing?.kind === 'field') {
        expect(letterSpacing.control).toBe('number');
        expect(letterSpacing.path).toBe('style.letterSpacing');
        expect(letterSpacing.controlProps).toEqual({ step: 0.1 });
      }
    });

    it('Task 7：描边宽度字段使用 number 控件，路径 style.textStrokeWidth，controlProps min=0 step=0.5', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const textStrokeWidth = fields[7];
      expect(textStrokeWidth?.kind).toBe('field');
      if (textStrokeWidth?.kind === 'field') {
        expect(textStrokeWidth.control).toBe('number');
        expect(textStrokeWidth.path).toBe('style.textStrokeWidth');
        expect(textStrokeWidth.controlProps).toEqual({ min: 0, step: 0.5 });
      }
    });

    it('Task 7：描边颜色字段使用 color 控件，路径 style.textStrokeColor', () => {
      const fields = TEXT_PROPS_SECTION.fields ?? [];
      const textStrokeColor = fields[8];
      expect(textStrokeColor?.kind).toBe('field');
      if (textStrokeColor?.kind === 'field') {
        expect(textStrokeColor.control).toBe('color');
        expect(textStrokeColor.path).toBe('style.textStrokeColor');
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

  describe('Task 3 · LAYER_STATUS_SECTION 结构', () => {
    it('分区元信息：id/title/tab/collapsible/defaultOpen/testId', () => {
      expect(LAYER_STATUS_SECTION.id).toBe('layer-status');
      expect(LAYER_STATUS_SECTION.title).toBe('层级状态');
      expect(LAYER_STATUS_SECTION.tab).toBe('appearance');
      expect(LAYER_STATUS_SECTION.collapsible).toBe(true);
      expect(LAYER_STATUS_SECTION.defaultOpen).toBe(false);
      expect(LAYER_STATUS_SECTION.testId).toBe('layer-status-section');
    });

    it('包含名称/层级/锁定/隐藏 4 个字段', () => {
      const fields = LAYER_STATUS_SECTION.fields ?? [];
      expect(fields).toHaveLength(4);
      expect(fields.map((f) => (f.kind === 'field' ? f.label : null))).toEqual([
        '名称',
        '层级',
        '锁定',
        '隐藏',
      ]);
    });

    it('名称字段使用 text 控件，路径 name（与 renameComponent 对齐）', () => {
      const fields = LAYER_STATUS_SECTION.fields ?? [];
      const name = fields[0];
      expect(name?.kind).toBe('field');
      if (name?.kind === 'field') {
        expect(name.control).toBe('text');
        expect(name.path).toBe('name');
      }
    });

    it('层级字段使用 number 控件，路径 zIndex，controlProps min=0 step=1（与 reorderComponent 对齐）', () => {
      const fields = LAYER_STATUS_SECTION.fields ?? [];
      const zIndex = fields[1];
      expect(zIndex?.kind).toBe('field');
      if (zIndex?.kind === 'field') {
        expect(zIndex.control).toBe('number');
        expect(zIndex.path).toBe('zIndex');
        expect(zIndex.controlProps?.min).toBe(0);
        expect(zIndex.controlProps?.step).toBe(1);
      }
    });

    it('锁定字段使用 switch 控件，路径 status.locked（与 setLocked 写入路径对齐）', () => {
      const fields = LAYER_STATUS_SECTION.fields ?? [];
      const locked = fields[2];
      expect(locked?.kind).toBe('field');
      if (locked?.kind === 'field') {
        expect(locked.control).toBe('switch');
        expect(locked.path).toBe('status.locked');
      }
    });

    it('隐藏字段使用 switch 控件，路径 status.hidden（与 setHidden 写入路径对齐）', () => {
      const fields = LAYER_STATUS_SECTION.fields ?? [];
      const hidden = fields[3];
      expect(hidden?.kind).toBe('field');
      if (hidden?.kind === 'field') {
        expect(hidden.control).toBe('switch');
        expect(hidden.path).toBe('status.hidden');
      }
    });
  });

  describe('BAR_CHART_SCHEMA 结构（Task 2 tab 分布）', () => {
    it('Task 3/6：包含 8 个分区：position/视觉/transform/layer-status/filter/data/interaction/events', () => {
      expect(BAR_CHART_SCHEMA).toHaveLength(8);
      expect(BAR_CHART_SCHEMA.map((s) => s.id)).toEqual([
        'position',
        'bar-chart-visual',
        'transform',
        'layer-status',
        'filter',
        'bar-chart-data',
        'bar-chart-interaction',
        'quick-events',
      ]);
    });

    it('图表配置分区均使用 customRender 逃生舱（无 fields）', () => {
      const customSections = BAR_CHART_SCHEMA.filter((s) => s.customRender !== undefined);
      expect(customSections.map((s) => s.id)).toEqual([
        'bar-chart-visual',
        'bar-chart-data',
        'bar-chart-interaction',
        'quick-events',
      ]);
      for (const section of customSections) {
        expect(section.fields).toBeUndefined();
      }
    });

    it('分区按 tab 分布：appearance/data/interaction/events', () => {
      const tabs = new Set(BAR_CHART_SCHEMA.map((s) => s.tab));
      expect(tabs).toEqual(new Set(['appearance', 'data', 'interaction', 'events']));
    });

    it('Task 6：appearance tab 包含 position + 视觉 + transform + layer-status + filter 五个分区（默认激活）', () => {
      const appearanceSections = BAR_CHART_SCHEMA.filter((s) => s.tab === 'appearance');
      expect(appearanceSections.map((s) => s.id)).toEqual([
        'position',
        'bar-chart-visual',
        'transform',
        'layer-status',
        'filter',
      ]);
    });

    it('data tab 包含数据源与逻辑层 customRender 分区', () => {
      const dataSections = BAR_CHART_SCHEMA.filter((s) => s.tab === 'data');
      expect(dataSections.map((s) => s.id)).toEqual(['bar-chart-data']);
      expect(dataSections[0]?.customRender).toBeDefined();
    });

    it('interaction tab 包含交互层 customRender 分区', () => {
      const interactionSections = BAR_CHART_SCHEMA.filter((s) => s.tab === 'interaction');
      expect(interactionSections.map((s) => s.id)).toEqual(['bar-chart-interaction']);
      expect(interactionSections[0]?.customRender).toBeDefined();
    });

    it('events tab 包含 QuickEventEditor customRender 分区（Task 4 接入，复用 EVENTS_SECTION）', () => {
      const eventsSections = BAR_CHART_SCHEMA.filter((s) => s.tab === 'events');
      expect(eventsSections.map((s) => s.id)).toEqual(['quick-events']);
      expect(eventsSections[0]?.customRender).toBeDefined();
    });
  });

  describe('Task 5 · 空 tab 占位分区', () => {
    it('DEFAULT_SCHEMA 的 data tab 包含空状态占位分区', () => {
      const dataSections = DEFAULT_SCHEMA.filter((s) => s.tab === 'data');
      expect(dataSections).toHaveLength(1);
      expect(dataSections[0]?.id).toBe('default-data-empty');
      expect(dataSections[0]?.customRender).toBeDefined();
    });

    it('DEFAULT_SCHEMA 的 interaction tab 包含空状态占位分区', () => {
      const interactionSections = DEFAULT_SCHEMA.filter((s) => s.tab === 'interaction');
      expect(interactionSections).toHaveLength(1);
      expect(interactionSections[0]?.id).toBe('default-interaction-empty');
      expect(interactionSections[0]?.customRender).toBeDefined();
    });

    it('TEXT_SCHEMA 的 data tab 包含空状态占位分区', () => {
      const dataSections = PROPERTY_SCHEMAS.text.filter((s) => s.tab === 'data');
      expect(dataSections).toHaveLength(1);
      expect(dataSections[0]?.id).toBe('text-data-empty');
      expect(dataSections[0]?.customRender).toBeDefined();
    });

    it('TEXT_SCHEMA 包含 events tab（复用 EVENTS_SECTION，QuickEventEditor 自处理空状态）', () => {
      const eventsSections = PROPERTY_SCHEMAS.text.filter((s) => s.tab === 'events');
      expect(eventsSections).toHaveLength(1);
      expect(eventsSections[0]?.id).toBe('quick-events');
    });

    it('空占位分区不声明 fields（与 customRender 互斥）', () => {
      const placeholders = [
        ...DEFAULT_SCHEMA.filter((s) => s.id.endsWith('-empty')),
        ...PROPERTY_SCHEMAS.text.filter((s) => s.id.endsWith('-empty')),
      ];
      for (const section of placeholders) {
        expect(section.fields).toBeUndefined();
        expect(section.customRender).toBeDefined();
      }
    });
  });

  describe('Task 6 · FILTER_SECTION 结构', () => {
    it('分区元信息：id/title/tab/collapsible/defaultOpen/testId', () => {
      expect(FILTER_SECTION.id).toBe('filter');
      expect(FILTER_SECTION.title).toBe('滤镜');
      expect(FILTER_SECTION.tab).toBe('appearance');
      expect(FILTER_SECTION.collapsible).toBe(true);
      expect(FILTER_SECTION.defaultOpen).toBe(false);
      expect(FILTER_SECTION.testId).toBe('filter-section');
    });

    it('包含色相/饱和度/亮度/对比度/模糊/灰度 6 个 number 字段', () => {
      const fields = FILTER_SECTION.fields ?? [];
      expect(fields).toHaveLength(6);
      expect(fields.map((f) => (f.kind === 'field' ? f.label : null))).toEqual([
        '色相',
        '饱和度',
        '亮度',
        '对比度',
        '模糊',
        '灰度',
      ]);
      for (const f of fields) {
        expect(f.kind).toBe('field');
        if (f.kind === 'field') {
          expect(f.control).toBe('number');
        }
      }
    });

    it('色相字段路径 style.filter.hueRotate，默认值 0，controlProps min=0/max=360/step=1', () => {
      const fields = FILTER_SECTION.fields ?? [];
      const hueRotate = fields[0];
      expect(hueRotate?.kind).toBe('field');
      if (hueRotate?.kind === 'field') {
        expect(hueRotate.path).toBe('style.filter.hueRotate');
        expect(hueRotate.defaultValue).toBe(0);
        expect(hueRotate.controlProps).toEqual({ min: 0, max: 360, step: 1 });
      }
    });

    it('饱和度字段路径 style.filter.saturate，默认值 100，controlProps min=0/max=200/step=1', () => {
      const fields = FILTER_SECTION.fields ?? [];
      const saturate = fields[1];
      expect(saturate?.kind).toBe('field');
      if (saturate?.kind === 'field') {
        expect(saturate.path).toBe('style.filter.saturate');
        expect(saturate.defaultValue).toBe(100);
        expect(saturate.controlProps).toEqual({ min: 0, max: 200, step: 1 });
      }
    });

    it('亮度字段路径 style.filter.brightness，默认值 100，controlProps min=0/max=200/step=1', () => {
      const fields = FILTER_SECTION.fields ?? [];
      const brightness = fields[2];
      expect(brightness?.kind).toBe('field');
      if (brightness?.kind === 'field') {
        expect(brightness.path).toBe('style.filter.brightness');
        expect(brightness.defaultValue).toBe(100);
        expect(brightness.controlProps).toEqual({ min: 0, max: 200, step: 1 });
      }
    });

    it('对比度字段路径 style.filter.contrast，默认值 100，controlProps min=0/max=200/step=1', () => {
      const fields = FILTER_SECTION.fields ?? [];
      const contrast = fields[3];
      expect(contrast?.kind).toBe('field');
      if (contrast?.kind === 'field') {
        expect(contrast.path).toBe('style.filter.contrast');
        expect(contrast.defaultValue).toBe(100);
        expect(contrast.controlProps).toEqual({ min: 0, max: 200, step: 1 });
      }
    });

    it('模糊字段路径 style.filter.blur，默认值 0，controlProps min=0/max=20/step=0.1', () => {
      const fields = FILTER_SECTION.fields ?? [];
      const blur = fields[4];
      expect(blur?.kind).toBe('field');
      if (blur?.kind === 'field') {
        expect(blur.path).toBe('style.filter.blur');
        expect(blur.defaultValue).toBe(0);
        expect(blur.controlProps).toEqual({ min: 0, max: 20, step: 0.1 });
      }
    });

    it('灰度字段路径 style.filter.grayscale，默认值 0，controlProps min=0/max=100/step=1', () => {
      const fields = FILTER_SECTION.fields ?? [];
      const grayscale = fields[5];
      expect(grayscale?.kind).toBe('field');
      if (grayscale?.kind === 'field') {
        expect(grayscale.path).toBe('style.filter.grayscale');
        expect(grayscale.defaultValue).toBe(0);
        expect(grayscale.controlProps).toEqual({ min: 0, max: 100, step: 1 });
      }
    });

    it('字段 controlProps 的 min/max 与 ComponentStyleSchema.filter 的范围约束一致', () => {
      // 与 packages/shared 的 ComponentStyleSchema.filter 范围对齐：
      // hueRotate 0-360, saturate 0-200, brightness 0-200, contrast 0-200, blur 0-20, grayscale 0-100
      const fields = FILTER_SECTION.fields ?? [];
      const expected = [
        { min: 0, max: 360 },
        { min: 0, max: 200 },
        { min: 0, max: 200 },
        { min: 0, max: 200 },
        { min: 0, max: 20 },
        { min: 0, max: 100 },
      ];
      fields.forEach((f, i) => {
        expect(f.kind).toBe('field');
        if (f.kind === 'field') {
          expect(f.controlProps?.min, `字段 ${i} min`).toBe(expected[i]?.min);
          expect(f.controlProps?.max, `字段 ${i} max`).toBe(expected[i]?.max);
        }
      });
    });
  });

  describe('注册表完整性', () => {
    it('PROPERTY_SCHEMAS 包含 text、bar-chart 和 button', () => {
      expect(PROPERTY_SCHEMAS.text).toBeDefined();
      expect(PROPERTY_SCHEMAS['bar-chart']).toBeDefined();
      expect(PROPERTY_SCHEMAS.button).toBeDefined();
    });

    it('getSchemaForComponentType 对 button 返回 BUTTON_SCHEMA', () => {
      const schema = getSchemaForComponentType('button');
      expect(schema).toBe(PROPERTY_SCHEMAS.button);
    });

    it('所有 schema 的分区 id 唯一', () => {
      for (const [, schema] of Object.entries(PROPERTY_SCHEMAS)) {
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
