import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateDatasetSchema as _CreateDatasetSchema,
  UpdateDatasetSchema as _UpdateDatasetSchema,
  ExecuteDatasetParamsSchema as _ExecuteDatasetParamsSchema,
  BatchExecuteDatasetParamsSchema as _BatchExecuteDatasetParamsSchema,
  DatasetSchema as _DatasetSchema,
  DatasetExecuteResultSchema as _DatasetExecuteResultSchema,
  TestDatasetResultSchema as _TestDatasetResultSchema,
  DatasetReferenceCountSchema as _DatasetReferenceCountSchema,
  DatasetTypeSchema,
  DatasetStatusSchema,
} from '@nebula/shared/schemas';

/**
 * 数据集模块 DTO
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §2
 *
 * 关键约定：
 * - `projectId` 不在 shared Schema 中（由 API 层注入），Create 与 List DTO 在此扩展
 * - 响应 Schema 直接复用 shared `DatasetSchema`，时间戳在 service 层格式化为字符串
 *   （shared `DateTimeStringSchema` 为字符串正则，后端 service 用 dayjs 格式化 Date → 字符串）
 * - DTO 类通过 `createZodDto` 包装，既用于运行时校验（ZodValidationPipe）也用于 OpenAPI 文档
 */

// ===== 创建 =====

/**
 * 创建数据集 Schema
 *
 * shared `CreateDatasetSchema` 是按 type 分发的判别联合（不含 projectId），
 * 此处通过 `.and()` 追加 `projectId` 字段（API 层从 body 注入）。
 *
 * projectId 改为可选：前端 UI 暂无项目上下文，未传时由 service 层回退到默认项目
 * （取数据库第一个项目）。保留可选字段以兼容未来引入项目选择器后的强约束。
 */
export const CreateDatasetSchema = _CreateDatasetSchema.and(
  z.object({
    projectId: z.string().min(1).optional().describe('所属项目 ID（可选，未传时使用默认项目）'),
  }),
);

/**
 * 注意：`CreateDatasetSchema` 是判别联合 + 交集，
 * `extends createZodDto(...)` 会触发 TS2509（构造函数返回联合类型时无法 extends）。
 * 改为以 const 导出类（保留 nestjs-zod 校验与 OpenAPI 元数据），
 * 并以 type alias 导出推断类型，二者同名合并使用。
 */
export const CreateDatasetDto = createZodDto(CreateDatasetSchema);
export type CreateDatasetDto = z.infer<typeof CreateDatasetSchema>;

// ===== 更新 =====

export const UpdateDatasetSchema = _UpdateDatasetSchema;

export class UpdateDatasetDto extends createZodDto(UpdateDatasetSchema) {}

// ===== 执行 =====

export const ExecuteDatasetSchema = _ExecuteDatasetParamsSchema;

export class ExecuteDatasetDto extends createZodDto(ExecuteDatasetSchema) {}

// ===== 批量执行（第三阶段，先定义契约） =====

export const BatchExecuteDatasetSchema = _BatchExecuteDatasetParamsSchema;

export class BatchExecuteDatasetDto extends createZodDto(BatchExecuteDatasetSchema) {}

// ===== 列表查询 =====

export const ListDatasetQuerySchema = z.object({
  projectId: z.string().min(1).optional().describe('项目 ID（可选，未传时返回所有项目的数据集）'),
  status: DatasetStatusSchema.optional().describe('按状态过滤'),
  type: DatasetTypeSchema.optional().describe('按类型过滤'),
});

export class ListDatasetQueryDto extends createZodDto(ListDatasetQuerySchema) {}

// ===== 响应 =====

/**
 * 数据集响应 Schema
 *
 * shared `DatasetSchema` 是判别联合（不含 projectId，projectId 属于 API 层作用域字段），
 * 此处通过 `.and()` 追加 `projectId`，使 API 响应包含项目归属信息。
 *
 * projectId 设为可选：前端 shared `DatasetSchema` 不含此字段，
 * Zod 默认 strip 模式会忽略额外字段，但显式声明 optional 可避免 OpenAPI 文档
 * 将 projectId 标为必填，让前后端契约在文档层对齐。
 * service 层在 `toResponse` 中将 Date 时间戳格式化为 "YYYY-MM-DD HH:mm:ss" 字符串，
 * 以匹配 shared `DateTimeStringSchema` 的正则约束。
 */
export const DatasetResponseSchema = z
  .object({
    projectId: z.string().optional().describe('所属项目 ID（可选）'),
  })
  .and(_DatasetSchema);

/**
 * 同 `CreateDatasetDto`：`_DatasetSchema` 是判别联合，无法 `extends createZodDto(...)`，
 * 改为 const + type 同名导出。
 */
export const DatasetResponseDto = createZodDto(DatasetResponseSchema);
export type DatasetResponse = z.infer<typeof DatasetResponseSchema>;

// ===== 执行结果响应 =====

export const DatasetExecuteResultResponseSchema = _DatasetExecuteResultSchema;

export class DatasetExecuteResultDto extends createZodDto(DatasetExecuteResultResponseSchema) {}

export type DatasetExecuteResultResponse = z.infer<typeof DatasetExecuteResultResponseSchema>;

// ===== 测试执行结果响应 =====

export const TestDatasetResultResponseSchema = _TestDatasetResultSchema;

export class TestDatasetResultDto extends createZodDto(TestDatasetResultResponseSchema) {}

export type TestDatasetResultResponse = z.infer<typeof TestDatasetResultResponseSchema>;

// ===== 批量执行结果响应 =====

export const BatchDatasetExecuteItemResponseSchema = z.object({
  datasetId: z.string(),
  result: _DatasetExecuteResultSchema,
});

export const BatchExecuteDatasetResultResponseSchema = z.array(
  BatchDatasetExecuteItemResponseSchema,
);

export class BatchExecuteDatasetResultDto extends createZodDto(
  BatchExecuteDatasetResultResponseSchema,
) {}

export type BatchDatasetExecuteItemResponse = z.infer<typeof BatchDatasetExecuteItemResponseSchema>;
export type BatchExecuteDatasetResultResponse = z.infer<
  typeof BatchExecuteDatasetResultResponseSchema
>;

// ===== 引用数响应 =====

export const DatasetReferenceCountResponseSchema = _DatasetReferenceCountSchema;

export class DatasetReferenceCountDto extends createZodDto(DatasetReferenceCountResponseSchema) {}

export type DatasetReferenceCountResponse = z.infer<typeof DatasetReferenceCountResponseSchema>;
