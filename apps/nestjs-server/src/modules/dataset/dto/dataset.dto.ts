import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import {
  CreateDatasetRequestSchema as _CreateDatasetRequestSchema,
  UpdateDatasetSchema as _UpdateDatasetSchema,
  ExecuteDatasetParamsSchema as _ExecuteDatasetParamsSchema,
  BatchExecuteDatasetParamsSchema as _BatchExecuteDatasetParamsSchema,
  BatchDatasetExecuteItemSchema as _BatchDatasetExecuteItemSchema,
  BatchExecuteDatasetResultSchema as _BatchExecuteDatasetResultSchema,
  ListDatasetQuerySchema as _ListDatasetQuerySchema,
  DatasetResponseSchema as _DatasetResponseSchema,
  DatasetExecuteResultSchema as _DatasetExecuteResultSchema,
  TestDatasetResultSchema as _TestDatasetResultSchema,
  DatasetReferenceCountSchema as _DatasetReferenceCountSchema,
} from '@nebula/shared/schemas';

/**
 * 数据集模块 DTO
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §2
 *
 * 关键约定：
 * - 所有 DTO 直接包装 shared request/response schema，不在 API 层扩展契约字段
 * - 响应 Schema 直接复用 shared `DatasetResponseSchema`，时间戳在 service 层格式化为字符串
 *   （shared `DateTimeStringSchema` 为字符串正则，后端 service 用 dayjs 格式化 Date → 字符串）
 * - DTO 类通过 `createZodDto` 包装，既用于运行时校验（ZodValidationPipe）也用于 OpenAPI 文档
 */

// ===== 创建 =====

/**
 * 创建数据集 Schema
 *
 * projectId 的可选性由 shared `CreateDatasetRequestSchema` 定义。
 */
export const CreateDatasetSchema = _CreateDatasetRequestSchema;

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

export const ListDatasetQuerySchema = _ListDatasetQuerySchema;

export class ListDatasetQueryDto extends createZodDto(ListDatasetQuerySchema) {}

// ===== 响应 =====

/**
 * 数据集响应 Schema
 *
 * projectId 的响应语义由 shared `DatasetResponseSchema` 定义。
 * service 层在 `toResponse` 中将 Date 时间戳格式化为 "YYYY-MM-DD HH:mm:ss" 字符串，
 * 以匹配 shared `DateTimeStringSchema` 的正则约束。
 */
export const DatasetResponseSchema = _DatasetResponseSchema;

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

export const BatchDatasetExecuteItemResponseSchema = _BatchDatasetExecuteItemSchema;

export const BatchExecuteDatasetResultResponseSchema = _BatchExecuteDatasetResultSchema;

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
