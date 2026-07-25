import { z } from 'zod';
import { DateTimeStringSchema } from './datetime.schema.js';

/**
 * 数据源连接 Schema 契约
 *
 * 设计依据：`docs/specs/dataset-management/data-model.md` §2
 *
 * 关键约定：
 * - 类型分类：mysql / postgres / http-api 三类，覆盖数据库与 HTTP API 两种主流外部数据源
 * - 凭证隔离：password / authConfig 字段独立加密存储，不回显明文
 *   - 响应 Schema 中这些字段为可选 string，后端返回时填脱敏值（如 `'***'`）或省略
 *   - 创建/更新 Schema 中接收明文（前端 AES+RSA 加密传输由 service 层处理）
 * - 测试状态：`lastTestedAt` + `lastTestResult` 仅记录 success/fail，不记录错误详情（防信息泄露）
 * - 作用域：按 projectId 隔离（projectId 不在此 Schema 中，由 API 层从上下文注入）
 */

// ===== 枚举 =====

export const DataSourceConnectionTypeSchema = z.enum(['mysql', 'postgres', 'http-api']);
export type DataSourceConnectionType = z.infer<typeof DataSourceConnectionTypeSchema>;

export const DataSourceConnectionStatusSchema = z.enum(['active', 'archived']);
export type DataSourceConnectionStatus = z.infer<typeof DataSourceConnectionStatusSchema>;

export const ConnectionTestResultSchema = z.enum(['success', 'fail']);
export type ConnectionTestResult = z.infer<typeof ConnectionTestResultSchema>;

// ===== 连接配置（按 type 分支） =====

export const DatabaseConnectionConfigSchema = z.object({
  host: z.string().min(1).describe('数据库主机'),
  port: z.number().int().min(1).max(65535).describe('数据库端口'),
  database: z.string().min(1).describe('数据库名'),
  username: z.string().min(1).describe('数据库用户名'),
  password: z.string().describe('数据库密码（加密存储，响应中脱敏）'),
  ssl: z.boolean().optional().describe('是否启用 SSL'),
});
export type DatabaseConnectionConfig = z.infer<typeof DatabaseConnectionConfigSchema>;

export const HttpApiAuthTypeSchema = z.enum(['none', 'bearer', 'basic', 'api-key']);
export type HttpApiAuthType = z.infer<typeof HttpApiAuthTypeSchema>;

export const HttpApiConnectionConfigSchema = z.object({
  baseUrl: z.string().min(1).describe('API 基地址'),
  defaultHeaders: z.record(z.string(), z.string()).optional().describe('默认请求头'),
  authType: HttpApiAuthTypeSchema.optional().describe('鉴权类型'),
  authConfig: z
    .string()
    .optional()
    .describe('鉴权配置（加密存储，响应中脱敏；结构由 authType 决定）'),
});
export type HttpApiConnectionConfig = z.infer<typeof HttpApiConnectionConfigSchema>;

// ===== 连接实体 =====

const DataSourceConnectionCommonFieldsSchema = z.object({
  id: z.string().describe('连接 ID（uuid）'),
  name: z.string().min(1).max(50).describe('连接名称（项目内唯一）'),
  description: z.string().optional().describe('连接描述'),
  status: DataSourceConnectionStatusSchema,
  lastTestedAt: DateTimeStringSchema.optional().nullable().describe('最近测试时间'),
  lastTestResult: ConnectionTestResultSchema.optional()
    .nullable()
    .describe('最近测试结果（仅 success/fail）'),
  createdBy: z.string().describe('创建者用户 ID'),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

/**
 * 数据源连接 Schema（判别联合，按 type 分发 config 结构）
 *
 * 响应中 password / authConfig 字段由后端脱敏后填充（如 `'***'`），
 * 此 Schema 仅做结构校验，不约束脱敏值的具体格式。
 */
export const DataSourceConnectionSchema = z.discriminatedUnion('type', [
  DataSourceConnectionCommonFieldsSchema.extend({
    type: z.literal('mysql'),
    config: DatabaseConnectionConfigSchema,
  }),
  DataSourceConnectionCommonFieldsSchema.extend({
    type: z.literal('postgres'),
    config: DatabaseConnectionConfigSchema,
  }),
  DataSourceConnectionCommonFieldsSchema.extend({
    type: z.literal('http-api'),
    config: HttpApiConnectionConfigSchema,
  }),
]);
export type DataSourceConnection = z.infer<typeof DataSourceConnectionSchema>;

// ===== DTO：创建/更新 =====

const CreateConnectionCommonSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
});

export const CreateDataSourceConnectionSchema = z.discriminatedUnion('type', [
  CreateConnectionCommonSchema.extend({
    type: z.literal('mysql'),
    config: DatabaseConnectionConfigSchema,
  }),
  CreateConnectionCommonSchema.extend({
    type: z.literal('postgres'),
    config: DatabaseConnectionConfigSchema,
  }),
  CreateConnectionCommonSchema.extend({
    type: z.literal('http-api'),
    config: HttpApiConnectionConfigSchema,
  }),
]);
export type CreateDataSourceConnectionParams = z.infer<typeof CreateDataSourceConnectionSchema>;

export const UpdateDataSourceConnectionSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  // type 与 config 不可单独更新（变更类型应重建连接）
  // config 部分字段可更新；password/authConfig 留空表示不修改（由 service 层处理）
  config: z
    .union([DatabaseConnectionConfigSchema.partial(), HttpApiConnectionConfigSchema.partial()])
    .optional(),
  status: DataSourceConnectionStatusSchema.optional(),
});
export type UpdateDataSourceConnectionParams = z.infer<typeof UpdateDataSourceConnectionSchema>;

// ===== DTO：创建请求体（API 契约层） =====

/**
 * 创建数据源连接请求体 Schema（API 契约层）
 *
 * 在 `CreateDataSourceConnectionSchema` 基础上追加可选 `projectId` 字段。
 * projectId 设为可选：前端 UI 暂无项目上下文，未传时由后端 service 层
 * 回退到默认项目（取数据库第一个项目）。
 *
 * 此 Schema 是前后端创建连接的契约单一数据源：
 * - 前端 api.ts 调用 `CreateDataSourceConnectionRequestSchema.parse(params)` 预校验
 * - 后端 dto.ts 直接 `createZodDto(CreateDataSourceConnectionRequestSchema)` 包装
 *
 * 设计依据：`docs/conventions/frontend-backend-contract.md`
 */
export const CreateDataSourceConnectionRequestSchema = CreateDataSourceConnectionSchema.and(
  z.object({
    projectId: z
      .string()
      .min(1)
      .optional()
      .describe('所属项目 ID（可选，未传时后端回退到默认项目）'),
  }),
);
export type CreateDataSourceConnectionRequest = z.infer<
  typeof CreateDataSourceConnectionRequestSchema
>;

// ===== DTO：列表查询 =====

/**
 * 数据源连接列表查询参数 Schema（API 契约层）
 *
 * 用于 GET /datasource-connection 的 query string 校验。
 * projectId 设为可选：前端 UI 暂无项目上下文，未传时后端返回所有项目的连接。
 */
export const ListDataSourceConnectionQuerySchema = z.object({
  projectId: z.string().min(1).optional().describe('项目 ID（可选，未传时返回所有项目的连接）'),
  status: DataSourceConnectionStatusSchema.optional().describe('按状态过滤'),
  type: DataSourceConnectionTypeSchema.optional().describe('按类型过滤'),
});
export type ListDataSourceConnectionQuery = z.infer<typeof ListDataSourceConnectionQuerySchema>;

// ===== DTO：响应 =====

/**
 * 数据源连接响应 Schema（API 契约层）
 *
 * 在 `DataSourceConnectionSchema` 基础上追加可选 `projectId` 字段。
 * password / authConfig 字段由后端脱敏为 `'***'` 后填充。
 */
export const DataSourceConnectionResponseSchema = z
  .object({
    projectId: z.string().optional().describe('所属项目 ID（可选）'),
  })
  .and(DataSourceConnectionSchema);
export type DataSourceConnectionResponse = z.infer<typeof DataSourceConnectionResponseSchema>;

// ===== DTO：测试结果 =====

export const TestConnectionResultSchema = z.object({
  success: z.boolean().describe('测试是否成功'),
  latencyMs: z.number().int().min(0).optional().describe('测试耗时（毫秒），失败时可省略'),
  // 失败时不返回详细错误信息（防信息泄露，仅记录 success/fail 到 lastTestResult）
  errorMessage: z
    .string()
    .optional()
    .describe('错误信息（仅返回分类后的简短提示，不暴露内部细节）'),
});
export type TestConnectionResult = z.infer<typeof TestConnectionResultSchema>;
