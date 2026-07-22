/**
 * 属性 Schema 注册表（Phase 2 Slice B）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §4.3
 *
 * 每类组件一份 Schema；未注册的组件类型回退到 DEFAULT_SCHEMA（位置尺寸 + 样式）。
 *
 * 迁移策略（混合模式）：
 * - 简单字段（位置/样式/文本属性）走声明式 DeclarativeField
 * - bar-chart 的数据/逻辑/视觉/交互四层作为 customRender 逃生舱原样挂载
 * - 不做大爆炸重写，面板壳与分区编排先 Schema 化，字段逐个收敛
 */

import { BarChartConfigSections } from '../components/bar-chart-config-sections';
import type { PropertySchema } from './types';

/** 位置与尺寸分区字段（多组件类型复用） */
const POSITION_SECTION: PropertySchema[number] = {
  id: 'position',
  title: '位置与尺寸',
  tab: 'appearance',
  collapsible: true,
  defaultOpen: true,
  fields: [
    { kind: 'field', control: 'number', label: 'X', path: 'position.x' },
    { kind: 'field', control: 'number', label: 'Y', path: 'position.y' },
    {
      kind: 'field',
      control: 'number',
      label: '宽',
      path: 'position.width',
      controlProps: { min: 1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '高',
      path: 'position.height',
      controlProps: { min: 1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '旋转',
      path: 'position.rotation',
      visibleWhen: (c) => c.position.rotation != null && c.position.rotation !== 0,
    },
  ],
};

/** 样式分区字段（多组件类型复用） */
const STYLE_SECTION: PropertySchema[number] = {
  id: 'style',
  title: '样式',
  tab: 'appearance',
  collapsible: true,
  fields: [
    {
      kind: 'field',
      control: 'color',
      label: '背景',
      path: 'style.backgroundColor',
      defaultValue: '#ffffff',
    },
    {
      kind: 'field',
      control: 'number',
      label: '透明度',
      path: 'style.opacity',
      defaultValue: 1,
      controlProps: { step: 0.1, shiftStep: 0.5, min: 0, max: 1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '边框',
      path: 'style.borderWidth',
      defaultValue: 0,
      controlProps: { min: 0 },
    },
    {
      kind: 'field',
      control: 'color',
      label: '边框色',
      path: 'style.borderColor',
      defaultValue: '#000000',
    },
    {
      kind: 'field',
      control: 'number',
      label: '圆角',
      path: 'style.borderRadius',
      defaultValue: 0,
      controlProps: { min: 0 },
    },
  ],
};

/**
 * 字重选项（CSS font-weight 字符串值）。
 *
 * 字符串而非数字的原因：Radix Select 仅接受 string value，
 * 且 CSS font-weight 同时接受 'bold'/'700'（字符串）与 700（数字），
 * 用字符串简化字段控件契约。
 */
const FONT_WEIGHT_OPTIONS = [
  { value: 'normal', label: '常规' },
  { value: '300', label: '300 细' },
  { value: '400', label: '400' },
  { value: '500', label: '500 中等' },
  { value: '600', label: '600 半粗' },
  { value: 'bold', label: '加粗' },
  { value: '800', label: '800 特粗' },
  { value: '900', label: '900 黑' },
];

const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
];

/** 文本属性分区字段（text 组件专用） */
const TEXT_PROPS_SECTION: PropertySchema[number] = {
  id: 'text-props',
  title: '文本属性',
  tab: 'appearance',
  collapsible: true,
  fields: [
    {
      kind: 'field',
      control: 'textarea',
      label: '内容',
      path: 'props.content',
    },
    {
      kind: 'field',
      control: 'number',
      label: '字号',
      path: 'style.fontSize',
      defaultValue: 14,
      controlProps: { min: 1 },
    },
    {
      kind: 'field',
      control: 'color',
      label: '字色',
      path: 'style.color',
      defaultValue: '#ffffff',
    },
    // Phase 2 Slice D：文本增强（字重 / 行高 / 对齐）
    {
      kind: 'field',
      control: 'select',
      label: '字重',
      path: 'style.fontWeight',
      defaultValue: 'normal',
      controlProps: { options: FONT_WEIGHT_OPTIONS },
    },
    {
      kind: 'field',
      control: 'number',
      label: '行高',
      path: 'style.lineHeight',
      defaultValue: 1.5,
      controlProps: { step: 0.1, min: 0.1 },
    },
    {
      kind: 'field',
      control: 'select',
      label: '对齐',
      path: 'style.textAlign',
      defaultValue: 'left',
      controlProps: { options: TEXT_ALIGN_OPTIONS },
    },
  ],
};

/**
 * 变换分区字段（Phase 2 Slice D 第一批：水平/垂直翻转）。
 *
 * 旋转字段保留在 POSITION_SECTION 中（已有），此处仅承载翻转。
 * 后续批次可扩展缩放锚点 / 倾斜等。
 */
const TRANSFORM_SECTION: PropertySchema[number] = {
  id: 'transform',
  title: '变换',
  tab: 'appearance',
  collapsible: true,
  fields: [
    {
      kind: 'field',
      control: 'switch',
      label: '水平翻转',
      path: 'style.flipX',
      defaultValue: false,
    },
    {
      kind: 'field',
      control: 'switch',
      label: '垂直翻转',
      path: 'style.flipY',
      defaultValue: false,
    },
  ],
};

/**
 * 通用 Schema：位置尺寸 + 样式 + 变换（所有未注册组件类型回退到此）。
 * 覆盖 shape / rect / image / frame / table / box 等基础组件。
 */
const DEFAULT_SCHEMA: PropertySchema = [POSITION_SECTION, STYLE_SECTION, TRANSFORM_SECTION];

/** text 组件 Schema：位置尺寸 + 样式 + 文本属性 + 变换 */
const TEXT_SCHEMA: PropertySchema = [
  POSITION_SECTION,
  STYLE_SECTION,
  TEXT_PROPS_SECTION,
  TRANSFORM_SECTION,
];

/**
 * bar-chart Schema：位置尺寸 + 图表配置（customRender 逃生舱）。
 *
 * bar-chart 的数据/逻辑/视觉/交互四层配置由 BarChartConfigSections 原样挂载，
 * 内部自行渲染 4 个 PanelSection（datasource/logic/visual/interaction）。
 * customRender 返回内容直接插入 tab，不额外套 PanelSection。
 */
const BAR_CHART_SCHEMA: PropertySchema = [
  POSITION_SECTION,
  {
    id: 'bar-chart-config',
    title: '',
    tab: 'data',
    customRender: (ctx) => (
      <BarChartConfigSections
        key={ctx.component.id}
        component={ctx.component}
        onUpdate={ctx.onUpdate}
      />
    ),
  },
];

/**
 * 全局 Schema 注册表：按组件 type 查找。
 * 未注册的类型回退到 DEFAULT_SCHEMA。
 */
export const PROPERTY_SCHEMAS: Record<string, PropertySchema> = {
  text: TEXT_SCHEMA,
  'bar-chart': BAR_CHART_SCHEMA,
};

/**
 * 按组件类型查找 Schema。
 * 未注册的类型回退到 DEFAULT_SCHEMA（位置尺寸 + 样式）。
 */
export function getSchemaForComponentType(type: string): PropertySchema {
  return PROPERTY_SCHEMAS[type] ?? DEFAULT_SCHEMA;
}

/** 导出 Schema 与通用分区供外部引用 */
export {
  BAR_CHART_SCHEMA,
  DEFAULT_SCHEMA,
  POSITION_SECTION,
  STYLE_SECTION,
  TEXT_PROPS_SECTION,
  TEXT_SCHEMA,
  TRANSFORM_SECTION,
};
