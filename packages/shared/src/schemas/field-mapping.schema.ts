import { z } from 'zod';

/**
 * 字段映射：将数据源字段映射到图表需要的维度和数值。
 * 未配置时按默认推断规则：name → 维度、value → 数值。
 *
 * 抽离到独立文件以打破 `screen.schema.ts` 与 `dataset.schema.ts` 之间的循环依赖：
 * - `screen.schema.ts` 的 `DataSourceConfigSchema` 各分支共用此 schema（`fieldMapping` 公共字段）
 * - `dataset.schema.ts` 的 `DatasetShapeSchema.fieldMapping` 复用此 schema
 * - 组件绑定的 `overrideFieldMapping` 同样复用
 *
 * 见数据集规格 `docs/specs/dataset-management/data-model.md` §6「字段映射复用」。
 */
export const FieldMappingSchema = z.object({
  dimension: z.string().min(1).describe('维度字段名（对应图表 x 轴/名称）'),
  value: z.string().min(1).describe('数值字段名（对应图表 y 轴/值）'),
});
export type FieldMapping = z.infer<typeof FieldMappingSchema>;
