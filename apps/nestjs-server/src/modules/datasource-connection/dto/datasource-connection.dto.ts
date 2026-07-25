import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateDataSourceConnectionSchema as _CreateDataSourceConnectionSchema,
  UpdateDataSourceConnectionSchema as _UpdateDataSourceConnectionSchema,
  DataSourceConnectionSchema as _DataSourceConnectionSchema,
  TestConnectionResultSchema as _TestConnectionResultSchema,
  DataSourceConnectionTypeSchema,
  DataSourceConnectionStatusSchema,
} from '@nebula/shared/schemas';

/**
 * 数据源连接模块 DTO
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §2
 *
 * 关键约定：
 * - `projectId` 不在 shared Schema 中（由 API 层注入），Create 与 List DTO 在此扩展
 * - 响应 Schema 直接复用 shared `DataSourceConnectionSchema`
 *   - service 层将 password / authConfig 字段脱敏（填 `'***'`）后返回
 *   - 时间戳格式化为 "YYYY-MM-DD HH:mm:ss" 字符串以匹配 shared `DateTimeStringSchema`
 * - DTO 类通过 `createZodDto` 包装，既用于运行时校验（ZodValidationPipe）也用于 OpenAPI 文档
 *
 * projectId 处理策略（与 dataset 模块保持一致）：
 * - Create / List 中 projectId 改为可选，未传时由 service 层回退到默认项目
 * - 响应中 projectId 设为可选，避免前端 shared schema 校验失败
 */

// ===== 创建 =====

/**
 * 创建数据源连接 Schema
 *
 * shared `CreateDataSourceConnectionSchema` 是判别联合（不含 projectId），
 * 此处通过 `.and()` 追加可选 `projectId` 字段。
 */
export const CreateDataSourceConnectionSchema = _CreateDataSourceConnectionSchema.and(
  z.object({
    projectId: z.string().min(1).optional().describe('所属项目 ID（可选，未传时使用默认项目）'),
  }),
);

/**
 * 同 dataset.dto.ts：判别联合 + 交集场景下 `extends createZodDto(...)` 触发 TS2509，
 * 改为 const + type 同名导出。
 */
export const CreateDataSourceConnectionDto = createZodDto(CreateDataSourceConnectionSchema);
export type CreateDataSourceConnectionDto = z.infer<typeof CreateDataSourceConnectionSchema>;

// ===== 更新 =====

export const UpdateDataSourceConnectionSchema = _UpdateDataSourceConnectionSchema;

export class UpdateDataSourceConnectionDto extends createZodDto(UpdateDataSourceConnectionSchema) {}

// ===== 列表查询 =====

export const ListDataSourceConnectionQuerySchema = z.object({
  projectId: z.string().min(1).optional().describe('项目 ID（可选，未传时返回所有项目的连接）'),
  status: DataSourceConnectionStatusSchema.optional().describe('按状态过滤'),
  type: DataSourceConnectionTypeSchema.optional().describe('按类型过滤'),
});

export class ListDataSourceConnectionQueryDto extends createZodDto(
  ListDataSourceConnectionQuerySchema,
) {}

// ===== 响应 =====

/**
 * 数据源连接响应 Schema
 *
 * 通过 `.and()` 追加可选 `projectId`，使 API 响应包含项目归属信息。
 * service 层将 password / authConfig 字段脱敏后填充（如 `'***'`）。
 */
export const DataSourceConnectionResponseSchema = z
  .object({
    projectId: z.string().optional().describe('所属项目 ID（可选）'),
  })
  .and(_DataSourceConnectionSchema);

export const DataSourceConnectionResponseDto = createZodDto(DataSourceConnectionResponseSchema);
export type DataSourceConnectionResponse = z.infer<typeof DataSourceConnectionResponseSchema>;

// ===== 测试结果响应 =====

export const TestConnectionResultResponseSchema = _TestConnectionResultSchema;

export class TestConnectionResultDto extends createZodDto(TestConnectionResultResponseSchema) {}

export type TestConnectionResultResponse = z.infer<typeof TestConnectionResultResponseSchema>;
