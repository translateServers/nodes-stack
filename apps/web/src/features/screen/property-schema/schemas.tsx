/**
 * 属性 Schema 注册表（Phase 2 Slice B + Spec 驱动改造：组件库统一注册接口）
 *
 * 设计依据：`docs/screen-designer-panels-architecture.md` §4.3
 *
 * 每类组件一份 Schema；未注册的组件类型回退到 DEFAULT_SCHEMA（位置尺寸 + 样式）。
 *
 * 迁移策略（混合模式）：
 * - 简单字段（位置/样式/文本属性）走声明式 DeclarativeField
 * - bar-chart 的数据/逻辑/视觉/交互四层作为 customRender 逃生舱原样挂载
 * - 不做大爆炸重写，面板壳与分区编排先 Schema 化，字段逐个收敛
 *
 * Spec 驱动改造后：
 * - 各组件的 Schema 通过 ComponentModule.schema 字段注册到 registry
 * - `PROPERTY_SCHEMAS` 改为派生自注册中心，不再手动维护静态 map
 * - 因 schemas.tsx 被组件模块导入（取 TEXT_SCHEMA 等定义），
 *   若直接 `import '../registry/registered-components'` 会形成循环依赖
 *   （schemas.tsx → registered-components.ts → text-component.tsx → schemas.tsx），
 *   此时 TEXT_SCHEMA 尚未定义，textModule.schema 会是 undefined。
 * - 解决方式：schemas.tsx 仅 `import { getAllModules } from '../registry/registry'`
 *   （registry.ts 无副作用，不会触发循环），由 registered-components.ts 在所有
 *   组件注册完成后调用 `buildPropertySchemas()` 把注册中心的 schema 写入 PROPERTY_SCHEMAS。
 */

import {
  BarChartDataSourceSection,
  BarChartInteractionSection,
  BarChartLogicSection,
  BarChartVisualSection,
} from '../components/bar-chart-config-sections';
import { QuickEventEditor } from '../components/quick-event-editor';
import { getAllModules } from '../registry/registry';
import type { PropertySchema, PropertyTabId } from './types';

/** 位置与尺寸分区字段（多组件类型复用） */
const POSITION_SECTION: PropertySchema[number] = {
  id: 'position',
  title: '位置与尺寸',
  tab: 'appearance',
  collapsible: true,
  defaultOpen: true,
  fields: [
    {
      kind: 'field',
      control: 'number',
      label: 'X',
      path: 'position.x',
      controlProps: { precision: 2 },
    },
    {
      kind: 'field',
      control: 'number',
      label: 'Y',
      path: 'position.y',
      controlProps: { precision: 2 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '宽',
      path: 'position.width',
      controlProps: { min: 1, precision: 2 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '高',
      path: 'position.height',
      controlProps: { min: 1, precision: 2 },
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
    // Task 7：文本细化配置（Light Chaser 特色：字间距 + 文字描边）
    {
      kind: 'field',
      control: 'number',
      label: '字间距',
      path: 'style.letterSpacing',
      controlProps: { step: 0.1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '描边宽度',
      path: 'style.textStrokeWidth',
      controlProps: { min: 0, step: 0.5 },
    },
    {
      kind: 'field',
      control: 'color',
      label: '描边颜色',
      path: 'style.textStrokeColor',
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
 * 层级状态分区字段（Task 3）。
 *
 * 承载组件命名、zIndex 调整、锁定/隐藏切换；默认折叠以减少视觉噪声。
 * 写入路径与 editor-store 现有 API 对齐：
 * - `name` ← renameComponent(id, name) 直接更新 c.name
 * - `zIndex` ← reorderComponent(id, newZIndex) 直接更新 c.zIndex
 * - `status.locked` ← setLocked(ids, locked) 更新 c.status.locked（保留 hidden 兄弟字段）
 * - `status.hidden` ← setHidden(ids, hidden) 更新 c.status.hidden（保留 locked 兄弟字段）
 * 通过 buildNestedUpdate 写入 `status.locked` 会产生 `{ status: { ...c.status, locked } }`，
 * 与 setLocked 手写实现等价，不会丢失 status 内的兄弟字段。
 */
const LAYER_STATUS_SECTION: PropertySchema[number] = {
  id: 'layer-status',
  title: '层级状态',
  tab: 'appearance',
  collapsible: true,
  defaultOpen: false,
  testId: 'layer-status-section',
  fields: [
    {
      kind: 'field',
      control: 'text',
      label: '名称',
      path: 'name',
    },
    {
      kind: 'field',
      control: 'number',
      label: '层级',
      path: 'zIndex',
      controlProps: { min: 0, step: 1 },
    },
    {
      kind: 'field',
      control: 'switch',
      label: '锁定',
      path: 'status.locked',
    },
    {
      kind: 'field',
      control: 'switch',
      label: '隐藏',
      path: 'status.hidden',
    },
  ],
};

/**
 * 事件分区（任务 4.8）：在 events tab 渲染 QuickEventEditor。
 *
 * customRender 模式下 testId 字段不被 section-renderer 使用，
 * QuickEventEditor 内部 PanelSection 已自带 testId，便于 E2E/单测定位。
 */
const EVENTS_SECTION: PropertySchema[number] = {
  id: 'quick-events',
  title: '事件',
  tab: 'events',
  customRender: ({ component }) => <QuickEventEditor componentId={component.id} />,
  testId: 'quick-events-section',
};

/**
 * Task 6：组件滤镜分区（Light Chaser 特色）。
 *
 * 6 个字段对应 ComponentStyleSchema.filter 子对象的 6 个 CSS filter 函数：
 * - hueRotate / saturate / brightness / contrast / blur / grayscale
 * 数值范围与 schema 默认值（hueRotate=0, saturate=100, brightness=100,
 * contrast=100, blur=0, grayscale=0）一致，渲染层 buildFilterString 仅在
 * 字段非默认值时拼接对应 CSS filter 函数。
 */
const FILTER_SECTION: PropertySchema[number] = {
  id: 'filter',
  title: '滤镜',
  tab: 'appearance',
  collapsible: true,
  defaultOpen: false,
  testId: 'filter-section',
  fields: [
    {
      kind: 'field',
      control: 'number',
      label: '色相',
      path: 'style.filter.hueRotate',
      defaultValue: 0,
      controlProps: { min: 0, max: 360, step: 1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '饱和度',
      path: 'style.filter.saturate',
      defaultValue: 100,
      controlProps: { min: 0, max: 200, step: 1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '亮度',
      path: 'style.filter.brightness',
      defaultValue: 100,
      controlProps: { min: 0, max: 200, step: 1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '对比度',
      path: 'style.filter.contrast',
      defaultValue: 100,
      controlProps: { min: 0, max: 200, step: 1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '模糊',
      path: 'style.filter.blur',
      defaultValue: 0,
      controlProps: { min: 0, max: 20, step: 0.1 },
    },
    {
      kind: 'field',
      control: 'number',
      label: '灰度',
      path: 'style.filter.grayscale',
      defaultValue: 0,
      controlProps: { min: 0, max: 100, step: 1 },
    },
  ],
};

/**
 * 空 tab 占位分区（Task 5）。
 *
 * 设计选型：选择方案 A（在 schema 中显式添加 customRender 占位分区）而非方案 B
 * （section-renderer 检测空 tab 自动渲染提示），原因：
 * - 当前架构中 tab 仅在被分区引用时才出现在 tabs 数组中（section-renderer.tsx
 *   第 137-143 行的 tabSet 计算），方案 B 需要额外定义"每类组件应展示哪些 tab"的
 *   声明式配置，架构改动较大；
 * - 方案 A 与 BAR_CHART_SCHEMA 中 bar-chart-data / bar-chart-interaction 等
 *   customRender 分区模式一致，复用现有逃生舱能力，改动最小；
 * - 后续如某组件需要在该 tab 接入实际编辑器，直接用真实分区替换占位即可。
 *
 * customRender 返回内容直接插入 tab，不套 PanelSection（与图表 customRender 一致）。
 */
function createEmptyTabPlaceholder(
  id: string,
  tab: PropertyTabId,
  hint: string,
  testId: string,
): PropertySchema[number] {
  return {
    id,
    title: '',
    tab,
    customRender: () => (
      <div data-testid={testId} className="py-6 text-center text-xs text-muted-foreground">
        {hint}
      </div>
    ),
  };
}

/**
 * 通用 Schema：位置尺寸 + 样式 + 变换 + 层级状态 + 数据占位 + 交互占位 + 事件
 * （所有未注册组件类型回退到此，覆盖 shape / rect / image / frame / table / box 等装饰类组件）。
 *
 * Task 5：装饰类组件不接数据源与交互配置，但仍展示 data / interaction tab 头与空状态提示，
 * 与 appearance / events tab 一起构成完整四 tab 语义边界，方便用户理解组件能力范围。
 */
const DEFAULT_DATA_EMPTY_SECTION = createEmptyTabPlaceholder(
  'default-data-empty',
  'data',
  '该组件无数据源配置',
  'empty-data-tab',
);

const DEFAULT_INTERACTION_EMPTY_SECTION = createEmptyTabPlaceholder(
  'default-interaction-empty',
  'interaction',
  '该组件无交互配置',
  'empty-interaction-tab',
);

const DEFAULT_SCHEMA: PropertySchema = [
  POSITION_SECTION,
  STYLE_SECTION,
  TRANSFORM_SECTION,
  LAYER_STATUS_SECTION,
  FILTER_SECTION,
  DEFAULT_DATA_EMPTY_SECTION,
  DEFAULT_INTERACTION_EMPTY_SECTION,
  EVENTS_SECTION,
];

/**
 * text 组件 Schema：位置尺寸 + 样式 + 文本属性 + 变换 + 层级状态 + 数据占位 + 事件。
 *
 * Task 5：text 不接数据源，但仍展示 data tab 头与空状态提示；events tab 由
 * QuickEventEditor 自身处理空状态（无事件时的引导文案）。
 */
const TEXT_DATA_EMPTY_SECTION = createEmptyTabPlaceholder(
  'text-data-empty',
  'data',
  '该组件无数据源配置',
  'empty-data-tab',
);

const TEXT_SCHEMA: PropertySchema = [
  POSITION_SECTION,
  STYLE_SECTION,
  TEXT_PROPS_SECTION,
  TRANSFORM_SECTION,
  LAYER_STATUS_SECTION,
  FILTER_SECTION,
  TEXT_DATA_EMPTY_SECTION,
  EVENTS_SECTION,
];

/**
 * bar-chart Schema：按 tab 分布（Task 2 重组 + Task 4 接入 QuickEventEditor）。
 *
 * - `appearance` tab（默认激活）：位置尺寸 + 视觉层（标题 + StyleFields）+ 变换 + 层级状态
 * - `data` tab：数据源 + 字段映射（BarChartDataSourceSection）+ 数据转换（BarChartLogicSection）
 * - `interaction` tab：悬停提示（BarChartInteractionSection）
 * - `events` tab：QuickEventEditor（派生自 blueprint 的快速事件配置）
 *
 * 视觉层 StyleFields 已覆盖背景/透明度/边框等样式字段，故不再重复挂载 STYLE_SECTION。
 * customRender 返回内容直接插入 tab，不额外套 PanelSection（由子组件内部自行渲染）。
 */
const BAR_CHART_SCHEMA: PropertySchema = [
  // appearance tab（默认激活）
  POSITION_SECTION,
  {
    id: 'bar-chart-visual',
    title: '',
    tab: 'appearance',
    customRender: (ctx) => (
      <BarChartVisualSection
        key={ctx.component.id}
        component={ctx.component}
        onUpdate={ctx.onUpdate}
      />
    ),
  },
  TRANSFORM_SECTION,
  LAYER_STATUS_SECTION,
  FILTER_SECTION,
  // data tab：数据源 + 字段映射 + 数据转换
  {
    id: 'bar-chart-data',
    title: '',
    tab: 'data',
    customRender: (ctx) => (
      <>
        <BarChartDataSourceSection
          key={`${ctx.component.id}:data`}
          component={ctx.component}
          onUpdate={ctx.onUpdate}
        />
        <BarChartLogicSection
          key={`${ctx.component.id}:logic`}
          component={ctx.component}
          onUpdate={ctx.onUpdate}
        />
      </>
    ),
  },
  // interaction tab：悬停提示
  {
    id: 'bar-chart-interaction',
    title: '',
    tab: 'interaction',
    customRender: (ctx) => (
      <BarChartInteractionSection
        key={ctx.component.id}
        component={ctx.component}
        onUpdate={ctx.onUpdate}
      />
    ),
  },
  // events tab：QuickEventEditor（Task 4）
  EVENTS_SECTION,
];

/**
 * 按钮属性分区（button 组件专用）。
 *
 * 仅承载按钮特有的文字字段；字号 / 字色 / 字重 / 背景色 / 圆角 / 边框等
 * 通用样式字段复用 STYLE_SECTION，避免重复定义。
 */
const BUTTON_PROPS_SECTION: PropertySchema[number] = {
  id: 'button-props',
  title: '按钮属性',
  tab: 'appearance',
  collapsible: true,
  defaultOpen: true,
  fields: [
    {
      kind: 'field',
      control: 'text',
      label: '文字',
      path: 'props.text',
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
    {
      kind: 'field',
      control: 'select',
      label: '字重',
      path: 'style.fontWeight',
      defaultValue: '500',
      controlProps: { options: FONT_WEIGHT_OPTIONS },
    },
  ],
};

/**
 * button 组件 Schema：位置尺寸 + 按钮属性 + 样式 + 变换 + 层级状态 + 数据占位 + 事件。
 *
 * 按钮不接数据源，但仍展示 data tab 头与空状态提示；events tab 由
 * QuickEventEditor 处理。
 */
const BUTTON_DATA_EMPTY_SECTION = createEmptyTabPlaceholder(
  'button-data-empty',
  'data',
  '该组件无数据源配置',
  'empty-data-tab',
);

const BUTTON_SCHEMA: PropertySchema = [
  POSITION_SECTION,
  BUTTON_PROPS_SECTION,
  STYLE_SECTION,
  TRANSFORM_SECTION,
  LAYER_STATUS_SECTION,
  FILTER_SECTION,
  BUTTON_DATA_EMPTY_SECTION,
  EVENTS_SECTION,
];

/**
 * 全局 Schema 注册表：按组件 type 查找。
 * 未注册的类型回退到 DEFAULT_SCHEMA。
 *
 * Spec 驱动改造后：派生自注册中心（ComponentModule.schema 字段）。
 *
 * 此处先声明为空对象，由 `buildPropertySchemas()` 在所有组件注册完成后填充。
 * 调用方约定：访问 `PROPERTY_SCHEMAS` 前，需确保已 `import '../registry'`
 * （registry/index.ts 内部 `import './registered-components'` 触发注册，
 * 并在注册完成后调用 `buildPropertySchemas()` 填充此对象）。
 */
export const PROPERTY_SCHEMAS: Record<string, PropertySchema> = {};

/**
 * 从注册中心派生 PROPERTY_SCHEMAS。
 *
 * 遍历所有已注册的 ComponentModule，将 `module.schema` 写入 `PROPERTY_SCHEMAS[module.definition.type]`。
 * 未注册 schema 的组件类型不写入，`getSchemaForComponentType` 会回退到 DEFAULT_SCHEMA。
 *
 * 由 registered-components.ts 在所有 `registerComponent` 调用完成后调用一次。
 * 重复调用安全：会清空旧值并重新填充（用于测试场景重置注册表后重建）。
 */
export function buildPropertySchemas(): void {
  // 清空旧值（支持重复调用，如测试中重置注册表后重建）
  for (const key of Object.keys(PROPERTY_SCHEMAS)) {
    delete PROPERTY_SCHEMAS[key];
  }
  for (const mod of getAllModules()) {
    if (mod.schema !== undefined) {
      PROPERTY_SCHEMAS[mod.definition.type] = mod.schema;
    }
  }
}

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
  BUTTON_SCHEMA,
  DEFAULT_SCHEMA,
  FILTER_SECTION,
  LAYER_STATUS_SECTION,
  POSITION_SECTION,
  STYLE_SECTION,
  TEXT_PROPS_SECTION,
  TEXT_SCHEMA,
  TRANSFORM_SECTION,
};
