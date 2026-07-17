import { z } from 'zod';
import { DateTimeStringSchema } from './datetime.schema.js';

// ===== 枚举 =====

export const ScreenProjectStatusSchema = z.enum(['draft', 'published']);
export type ScreenProjectStatus = z.infer<typeof ScreenProjectStatusSchema>;

export const ScaleModeSchema = z.enum(['fit', 'full', 'width', 'height', 'none']);
export type ScaleMode = z.infer<typeof ScaleModeSchema>;

export const DataSourceTypeSchema = z.enum(['static', 'api']);
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
  fontSize: z.number().int().positive().optional().describe('字体大小'),
  color: z.string().optional().describe('字体颜色'),
  textAlign: z.enum(['left', 'center', 'right']).optional().describe('文字对齐'),
  overflow: z.enum(['visible', 'hidden', 'auto']).optional().describe('内容溢出处理'),
});
export type ComponentStyle = z.infer<typeof ComponentStyleSchema>;

export const ComponentStatusSchema = z.object({
  locked: z.boolean().default(false).describe('是否锁定'),
  hidden: z.boolean().default(false).describe('是否隐藏'),
});
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

export const ApiDataSourceConfigSchema = z.object({
  url: z.string().url().describe('请求 URL'),
  method: z.enum(['GET', 'POST']).describe('请求方法'),
  headers: z.record(z.string(), z.string()).optional().describe('请求头'),
  params: z.record(z.string(), z.unknown()).optional().describe('请求参数'),
  refreshInterval: z.number().int().min(0).optional().describe('自动刷新间隔（秒）'),
});
export type ApiDataSourceConfig = z.infer<typeof ApiDataSourceConfigSchema>;

export const DataSourceConfigSchema = z.object({
  type: DataSourceTypeSchema.describe('数据源类型'),
  staticData: z.unknown().optional().describe('静态数据'),
  apiConfig: ApiDataSourceConfigSchema.optional().describe('API 数据源配置'),
});
export type DataSourceConfig = z.infer<typeof DataSourceConfigSchema>;

export const ScreenComponentSchema = z.object({
  id: z.string().describe('组件实例唯一标识'),
  type: z.string().min(1).describe('组件类型 key'),
  name: z.string().min(1).describe('组件显示名称'),
  position: ComponentPositionSchema.describe('位置与尺寸'),
  style: ComponentStyleSchema.describe('基础样式'),
  props: z.record(z.string(), z.unknown()).describe('组件专属配置'),
  dataSource: DataSourceConfigSchema.optional().describe('数据源配置'),
  status: ComponentStatusSchema.describe('组件状态'),
  zIndex: z.number().int().describe('层级'),
  parentId: z.string().nullable().optional().describe('父组件 ID'),
});
export type ScreenComponent = z.infer<typeof ScreenComponentSchema>;

export const ComponentDefaultSizeSchema = z.object({
  width: z.number().positive().describe('默认宽度（px）'),
  height: z.number().positive().describe('默认高度（px）'),
});
export type ComponentDefaultSize = z.infer<typeof ComponentDefaultSizeSchema>;

export const ComponentDefinitionSchema = z.object({
  type: z.string().min(1).describe('组件类型 key（唯一）'),
  name: z.string().min(1).describe('组件显示名称'),
  category: ComponentCategorySchema.describe('组件分类'),
  icon: z.string().optional().describe('图标标识'),
  thumbnail: z.string().optional().describe('缩略图 URL'),
  defaultProps: z.record(z.string(), z.unknown()).describe('组件默认 props'),
  defaultSize: ComponentDefaultSizeSchema.describe('组件默认尺寸'),
  defaultStyle: ComponentStyleSchema.partial().optional().describe('组件默认样式'),
});
export type ComponentDefinition = z.infer<typeof ComponentDefinitionSchema>;

// ===== 顶层项目 =====

export const ScreenProjectSchema = z.object({
  id: z.string().describe('项目唯一标识'),
  name: z.string().min(1).describe('项目名称'),
  description: z.string().nullable().optional().describe('项目描述'),
  canvas: CanvasConfigSchema.describe('画布配置'),
  components: z.array(ScreenComponentSchema).describe('组件实例列表'),
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
  thumbnail: z.string().optional().describe('缩略图'),
});
export type UpdateScreenProjectParams = z.infer<typeof UpdateScreenProjectSchema>;
