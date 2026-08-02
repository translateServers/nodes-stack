import { z } from 'zod';
import { DateTimeStringSchema } from './datetime.schema.js';
import {
  EventBlueprintSchema,
  type EventBlueprint,
  LegacyEventBlueprintSchema,
  type LegacyEventBlueprint,
} from './blueprint.schema.js';
import { migrateLegacyBlueprint, type BlueprintMigrationWarning } from './blueprint-migration.js';
import { FieldMappingSchema } from './field-mapping.schema.js';
import { RefreshStrategySchema } from './dataset.schema.js';
import { GlobalVariableSchema } from './global-variable.schema.js';

// ===== 枚举 =====

export const ScreenProjectStatusSchema = z.enum(['draft', 'published']);
export type ScreenProjectStatus = z.infer<typeof ScreenProjectStatusSchema>;

export const ScaleModeSchema = z.enum(['fit', 'full', 'width', 'height', 'none']);
export type ScaleMode = z.infer<typeof ScaleModeSchema>;

export const DataSourceTypeSchema = z.enum(['static', 'api', 'dataset']);
export type DataSourceType = z.infer<typeof DataSourceTypeSchema>;

export const ComponentCategorySchema = z.enum([
  'chart',
  'text',
  'media',
  'decoration',
  'table',
  'container',
]);
export type ComponentCategory = z.infer<typeof ComponentCategorySchema>;

// ===== 嵌套结构 =====

export const CanvasConfigSchema = z.object({
  width: z.number().int().positive().default(1920).describe('画布宽度（px）'),
  height: z.number().int().positive().default(1080).describe('画布高度（px）'),
  backgroundColor: z.string().default('#000000').describe('背景颜色'),
  backgroundImage: z.string().optional().describe('背景图片 URL'),
  scaleMode: ScaleModeSchema.default('fit').describe('缩放适配模式'),
});
export type CanvasConfig = z.infer<typeof CanvasConfigSchema>;

export const ComponentPositionSchema = z.object({
  x: z.number().describe('X 坐标（px）'),
  y: z.number().describe('Y 坐标（px）'),
  width: z.number().positive().describe('宽度（px）'),
  height: z.number().positive().describe('高度（px）'),
  rotation: z.number().optional().describe('旋转角度（度）'),
});
export type ComponentPosition = z.infer<typeof ComponentPositionSchema>;

export const ComponentStyleSchema = z.object({
  opacity: z.number().min(0).max(1).optional().describe('透明度'),
  borderWidth: z.number().int().min(0).optional().describe('边框宽度'),
  borderColor: z.string().optional().describe('边框颜色'),
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional().describe('边框样式'),
  borderRadius: z.number().min(0).optional().describe('圆角'),
  backgroundColor: z.string().optional().describe('背景颜色'),
  // Task 6：组件滤镜（Light Chaser 特色），CSS filter 函数族
  filter: z
    .object({
      hueRotate: z.number().min(0).max(360).default(0).describe('色相旋转（度）'),
      saturate: z.number().min(0).max(200).default(100).describe('饱和度（%）'),
      brightness: z.number().min(0).max(200).default(100).describe('亮度（%）'),
      contrast: z.number().min(0).max(200).default(100).describe('对比度（%）'),
      blur: z.number().min(0).max(20).default(0).describe('模糊（px）'),
      grayscale: z.number().min(0).max(100).default(0).describe('灰度（%）'),
    })
    .optional()
    .describe('组件 CSS 滤镜'),
  fontSize: z.number().int().positive().optional().describe('字体大小'),
  color: z.string().optional().describe('字体颜色'),
  textAlign: z.enum(['left', 'center', 'right']).optional().describe('文字对齐'),
  overflow: z.enum(['visible', 'hidden', 'auto']).optional().describe('内容溢出处理'),
  objectFit: z.enum(['fill', 'contain', 'cover']).optional().describe('图片填充模式'),
  // Phase 2 Slice D：文本增强（字重/行高）
  fontWeight: z
    .string()
    .optional()
    .describe('字体粗细（CSS font-weight 字符串，如 "normal"/"bold"/"700"）'),
  lineHeight: z.number().positive().optional().describe('行高倍数（如 1.5 表示 1.5 倍行高）'),
  // Task 7：文本细化配置（Light Chaser 特色：字间距 + 文字描边）
  letterSpacing: z.number().optional().describe('字间距（px）'),
  textStrokeWidth: z.number().min(0).optional().describe('文字描边宽度（px）'),
  textStrokeColor: z.string().optional().describe('文字描边颜色'),
  // Phase 2 Slice D：变换（水平/垂直翻转）
  flipX: z.boolean().optional().describe('水平翻转（CSS scaleX(-1)）'),
  flipY: z.boolean().optional().describe('垂直翻转（CSS scaleY(-1)）'),
});
export type ComponentStyle = z.infer<typeof ComponentStyleSchema>;

export const ComponentStatusSchema = z.object({
  locked: z.boolean().default(false).describe('是否锁定'),
  hidden: z.boolean().default(false).describe('是否隐藏'),
});
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

export const ApiDataSourceConfigSchema = z.object({
  url: z.string().url().describe('请求 URL'),
  method: z.literal('GET').describe('请求方法'),
  headers: z.record(z.string(), z.string()).optional().describe('请求头'),
  params: z.record(z.string(), z.unknown()).optional().describe('请求参数'),
  refreshInterval: z.number().int().min(0).optional().describe('自动刷新间隔（秒）'),
});
export type ApiDataSourceConfig = z.infer<typeof ApiDataSourceConfigSchema>;

/**
 * 字段映射：将数据源字段映射到图表需要的维度和数值。
 * 未配置时按默认推断规则：name → 维度、value → 数值。
 *
 * Schema 定义已抽离到 `field-mapping.schema.ts`（避免与 `dataset.schema.ts` 循环依赖），
 * 由 barrel `schemas/index.ts` 统一 re-export。
 */
// FieldMappingSchema 在本文件内通过顶部 import 引入，供下方 DataSourceCommonSchema 使用。

// ===== 逻辑层 =====

export const SortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

export const LogicConfigSchema = z.object({
  sortField: z.enum(['dimension', 'value']).optional().describe('排序字段（维度/数值）'),
  sortDirection: SortDirectionSchema.optional().describe('排序方向'),
  limit: z.number().int().positive().optional().describe('条数限制（正整数）'),
});
export interface LogicConfig {
  sortField?: 'dimension' | 'value';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

// ===== 组件数据源绑定 → 数据集引用 =====

/**
 * 参数绑定来源（见 data-model §3.2）
 *
 * 用于组件 dataSource.type === 'dataset' 时的 paramBindings：
 * 把组件上下文变量（props / data / url / 静态值 / 蓝图触发器）绑到数据集执行参数。
 */
export const ParamBindingSourceSchema = z.enum([
  'component-prop',
  'component-data',
  'url-param',
  'static',
  'trigger',
]);
export type ParamBindingSource = z.infer<typeof ParamBindingSourceSchema>;

export const ParamBindingSchema = z.object({
  source: ParamBindingSourceSchema.describe('参数来源'),
  path: z.string().min(1).describe('source 路径，如 "props.value" / "url.id"'),
  defaultValue: z.unknown().optional().describe('参数缺失时的默认值'),
});
export type ParamBinding = z.infer<typeof ParamBindingSchema>;

const DataSourceCommonSchema = z.object({
  dataPath: z
    .string()
    .optional()
    .describe('数据路径（点分隔，如 "data.list"），用于从嵌套响应中提取目标数组'),
  fieldMapping: FieldMappingSchema.optional().describe(
    '字段映射，未配置时按 name→维度、value→数值默认推断',
  ),
});

/**
 * 组件数据源配置（判别联合）
 *
 * - `static` / `api`：现有内联数据源，浏览器直连（向后兼容）
 * - `dataset`：引用独立数据集实体，走后端代理（见 dataset-management spec）
 *
 * 切换类型时保留其他分支的配置（staticData / apiConfig），便于回切（见 data-model §3.1）。
 * dataset 分支的 overrideFieldMapping / overrideLogic / overrideRefresh 为空时使用数据集默认配置。
 */
export const DataSourceConfigSchema = z.discriminatedUnion('type', [
  DataSourceCommonSchema.extend({
    type: z.literal('static'),
    staticData: z.unknown().describe('静态数据'),
    apiConfig: ApiDataSourceConfigSchema.optional().describe('切换类型时保留的 API 配置'),
  }),
  DataSourceCommonSchema.extend({
    type: z.literal('api'),
    staticData: z.unknown().optional().describe('切换类型时保留的静态数据'),
    apiConfig: ApiDataSourceConfigSchema.describe('API 数据源配置'),
  }),
  DataSourceCommonSchema.extend({
    type: z.literal('dataset'),
    staticData: z.unknown().optional().describe('切换类型时保留的静态数据'),
    apiConfig: ApiDataSourceConfigSchema.optional().describe('切换类型时保留的 API 配置'),
    datasetId: z.string().min(1).describe('引用的数据集 ID'),
    paramBindings: z
      .record(z.string(), ParamBindingSchema)
      .optional()
      .describe('参数绑定：把组件上下文变量绑到数据集参数'),
    overrideFieldMapping: FieldMappingSchema.optional().describe('覆盖数据集默认字段映射'),
    overrideLogic: LogicConfigSchema.optional().describe('覆盖数据集默认逻辑层'),
    overrideRefresh: RefreshStrategySchema.optional().describe('覆盖数据集默认刷新策略'),
  }),
]);
export type DataSourceConfig = z.infer<typeof DataSourceConfigSchema>;

// ===== 交互层 =====

export const InteractionConfigSchema = z.object({
  tooltipOnHover: z.boolean().default(false).describe('悬停时显示名称与数值提示'),
});
export type InteractionConfig = z.infer<typeof InteractionConfigSchema>;

// ===== bar-chart 视觉 props =====

export const BarChartVisualPropsSchema = z.object({
  title: z.string().optional().describe('图表标题'),
});
export type BarChartVisualProps = z.infer<typeof BarChartVisualPropsSchema>;

// ===== 敏感请求头识别 =====

/** 内置敏感请求头键名（小写），可通过追加扩展 */
export const SENSITIVE_HEADER_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
]);

/**
 * 判断请求头键名是否为敏感键（大小写不敏感）。
 * 前后端共用此规则，避免第二份实现。
 */
export function isSensitiveHeaderKey(key: string): boolean {
  return SENSITIVE_HEADER_KEYS.has(key.toLowerCase());
}

export const ScreenComponentSchema = z
  .object({
    id: z.string().describe('组件实例唯一标识'),
    type: z.string().min(1).describe('组件类型 key'),
    name: z.string().min(1).describe('组件显示名称'),
    position: ComponentPositionSchema.describe('位置与尺寸'),
    style: ComponentStyleSchema.describe('基础样式'),
    props: z.record(z.string(), z.unknown()).describe('组件专属配置'),
    dataSource: DataSourceConfigSchema.optional().describe('数据层：数据源、数据路径与字段映射'),
    logic: LogicConfigSchema.optional().describe('逻辑层：排序与条数限制'),
    interaction: InteractionConfigSchema.optional().describe('交互层：悬停提示等交互行为'),
    status: ComponentStatusSchema.describe('组件状态'),
    zIndex: z.number().int().describe('层级'),
    parentId: z.string().nullable().optional().describe('父组件 ID'),
  })
  .superRefine((component, context) => {
    if (component.type !== 'bar-chart') return;

    const result = BarChartVisualPropsSchema.safeParse(component.props);
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          ...issue,
          path: ['props', ...issue.path],
        });
      }
    }
  });
export type ScreenComponent = z.infer<typeof ScreenComponentSchema>;

export const ComponentDefaultSizeSchema = z.object({
  width: z.number().positive().describe('默认宽度（px）'),
  height: z.number().positive().describe('默认高度（px）'),
});
export type ComponentDefaultSize = z.infer<typeof ComponentDefaultSizeSchema>;

export const ComponentBadgeSchema = z.enum(['new', 'beta']);
export type ComponentBadge = z.infer<typeof ComponentBadgeSchema>;

/** 组件事件定义（蓝图锚点派生源）。 */
export const ComponentEventDefinitionSchema = z.object({
  id: z.string().min(1).describe('事件标识（如 click, hover, dataLoaded）'),
  name: z.string().min(1).describe('事件显示名（如 点击, 悬停, 数据加载完成）'),
});
export type ComponentEventDefinition = z.infer<typeof ComponentEventDefinitionSchema>;

/** 组件动作定义（蓝图锚点派生源）。 */
export const ComponentActionDefinitionSchema = z.object({
  id: z.string().min(1).describe('动作标识（如 show, hide, toggleVisibility, refreshData）'),
  name: z.string().min(1).describe('动作显示名（如 显示, 隐藏, 切换显隐, 刷新数据）'),
});
export type ComponentActionDefinition = z.infer<typeof ComponentActionDefinitionSchema>;

export const ComponentDefinitionSchema = z.object({
  type: z.string().min(1).describe('组件类型 key（唯一）'),
  name: z.string().min(1).describe('组件显示名称'),
  category: ComponentCategorySchema.describe('组件分类'),
  icon: z.string().optional().describe('图标标识（registry/icons.ts 中 ICON_MAP 的 key）'),
  thumbnail: z.string().optional().describe('缩略图 URL'),
  defaultProps: z.record(z.string(), z.unknown()).describe('组件默认 props'),
  defaultSize: ComponentDefaultSizeSchema.describe('组件默认尺寸'),
  defaultStyle: ComponentStyleSchema.partial().optional().describe('组件默认样式'),
  keywords: z
    .array(z.string())
    .optional()
    .describe('搜索别名（组件库搜索同时匹配 name/type/keywords）'),
  description: z.string().optional().describe('hover tooltip 说明'),
  badge: ComponentBadgeSchema.optional().describe('角标（new/beta）'),
  order: z.number().int().optional().describe('分类内排序（升序，缺省按数组顺序）'),
  /** 组件支持的事件列表（蓝图 V2 锚点派生源） */
  events: z.array(ComponentEventDefinitionSchema).optional(),
  /** 组件支持的动作列表（蓝图 V2 锚点派生源） */
  actions: z.array(ComponentActionDefinitionSchema).optional(),
});
export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;

// ===== 顶层项目 =====

/**
 * 蓝图输入联合类型：归档 trigger/action 图或正式组件节点图。
 *
 * - 历史数据只在读取和导入边界接受，随后必须迁移为正式图。
 * - 编辑器内存、服务端响应和保存路径只输出正式图。
 *
 * 使用 discriminatedUnion 以 `version` 作为判别字段，便于 TypeScript 类型收窄与 ESLint 类型感知规则解析。
 * 显式声明 BlueprintField 类型，避免 z.infer 在 ESLint 类型感知规则下退化为 any。
 */
export const BlueprintInputSchema = z.discriminatedUnion('version', [
  LegacyEventBlueprintSchema,
  EventBlueprintSchema,
]);
export type BlueprintInput = LegacyEventBlueprint | EventBlueprint;

export const ScreenDocumentSchema = z.object({
  canvas: CanvasConfigSchema.describe('画布配置'),
  components: z.array(ScreenComponentSchema).describe('组件实例列表'),
  blueprint: EventBlueprintSchema.optional().describe('交互层：项目级事件蓝图'),
  globalVariables: z
    .array(GlobalVariableSchema)
    .default([])
    .describe('项目级全局变量，可在数据源参数与蓝图模板插值中通过 {{globalVars.xxx}} 引用'),
});
export type ScreenDocument = z.infer<typeof ScreenDocumentSchema>;

/**
 * Historical persisted document shape. It is only accepted by storage migration readers;
 * all live API and editor paths use ScreenDocumentSchema.
 */
export const LegacyScreenDocumentSchema = z.object({
  canvas: CanvasConfigSchema,
  components: z.array(ScreenComponentSchema),
  blueprint: LegacyEventBlueprintSchema.optional(),
  globalVariables: z.array(GlobalVariableSchema).default([]),
});
export type LegacyScreenDocument = z.infer<typeof LegacyScreenDocumentSchema>;

export interface LegacyScreenDocumentMigrationResult {
  readonly document: ScreenDocument;
  readonly warnings: readonly BlueprintMigrationWarning[];
}

export function migrateLegacyScreenDocument(
  legacyDocument: LegacyScreenDocument,
): LegacyScreenDocumentMigrationResult {
  if (legacyDocument.blueprint === undefined) {
    return {
      document: ScreenDocumentSchema.parse({
        canvas: legacyDocument.canvas,
        components: legacyDocument.components,
        globalVariables: legacyDocument.globalVariables,
      }),
      warnings: [],
    };
  }

  const migration = migrateLegacyBlueprint(legacyDocument.blueprint);
  return {
    document: ScreenDocumentSchema.parse({
      canvas: legacyDocument.canvas,
      components: legacyDocument.components,
      blueprint: migration.blueprint,
      globalVariables: legacyDocument.globalVariables,
    }),
    warnings: migration.warnings,
  };
}

export const ScreenProjectSchema = ScreenDocumentSchema.extend({
  id: z.string().describe('项目唯一标识'),
  name: z.string().min(1).describe('项目名称'),
  description: z.string().nullable().optional().describe('项目描述'),
  status: ScreenProjectStatusSchema.describe('项目状态'),
  thumbnail: z.string().nullable().optional().describe('缩略图'),
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});
export type ScreenProject = z.infer<typeof ScreenProjectSchema>;

// ===== DTO =====

export const CreateScreenProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').describe('项目名称'),
  description: z.string().optional().describe('项目描述'),
  canvas: CanvasConfigSchema.optional().describe('画布配置（可选，使用默认值）'),
});
export type CreateScreenProjectParams = z.infer<typeof CreateScreenProjectSchema>;

export const UpdateScreenProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').optional().describe('项目名称'),
  description: z.string().optional().describe('项目描述'),
  canvas: CanvasConfigSchema.optional().describe('画布配置'),
  components: z.array(ScreenComponentSchema).optional().describe('组件实例列表'),
  blueprint: BlueprintInputSchema.optional().describe(
    '事件蓝图（归档输入会在服务端迁移；缺省表示不修改）',
  ),
  globalVariables: z
    .array(GlobalVariableSchema)
    .optional()
    .describe('项目级全局变量（可选；缺省表示不修改，与 blueprint 语义一致）'),
  thumbnail: z.string().optional().describe('缩略图'),
  expectedUpdatedAt: DateTimeStringSchema.describe(
    '本次更新基于的保存基线，值来自客户端最后确认的服务端 updatedAt',
  ),
});
export type UpdateScreenProjectParams = z.infer<typeof UpdateScreenProjectSchema>;

export const PublishScreenProjectSchema = z.object({
  expectedUpdatedAt: DateTimeStringSchema.describe(
    '本次发布基于的保存基线，值来自客户端最后确认的服务端 updatedAt',
  ),
});
export type PublishScreenProjectParams = z.infer<typeof PublishScreenProjectSchema>;
