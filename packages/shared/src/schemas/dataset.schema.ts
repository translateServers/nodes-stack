import { z } from 'zod';
import { DateTimeStringSchema } from './datetime.schema.js';
import { FieldMappingSchema } from './field-mapping.schema.js';

/**
 * 数据集管理 Schema 契约
 *
 * 设计依据：`docs/specs/dataset-management/data-model.md`
 *
 * 关键约定：
 * - 数据集与组件数据源绑定解耦：本文件定义数据集实体本身，ParamBinding 在
 *   `screen.schema.ts` 的 `DataSourceConfigSchema` 'dataset' 分支中定义（组件绑定层）
 * - `type` 枚举保留 `websocket`，第一阶段 execute 返回 `DATASET_TYPE_NOT_SUPPORTED`
 *   （80007），避免后续存量数据迁移
 * - mock 字段使用 `superRefine` 实现 generator 与 data/template 的联动必填校验
 * - SQL config 强制 select 开头 + 禁止多语句（结构层契约）
 * - api config 的 connectionId 阶段策略（第一阶段不启用）由 service 层校验，
 *   schema 层只校验结构
 */

// ===== 枚举 =====

export const DatasetTypeSchema = z.enum(['static', 'api', 'sql', 'websocket']);
export type DatasetType = z.infer<typeof DatasetTypeSchema>;

export const DatasetStatusSchema = z.enum(['active', 'archived']);
export type DatasetStatus = z.infer<typeof DatasetStatusSchema>;

// ===== 数据集配置（按 type 分支） =====

export const StaticDatasetConfigSchema = z.object({
  staticData: z.unknown().describe('静态数据'),
});
export type StaticDatasetConfig = z.infer<typeof StaticDatasetConfigSchema>;

export const ApiDatasetConfigSchema = z
  .object({
    connectionId: z
      .string()
      .optional()
      .describe(
        '可选关联 http-api 连接（提供 baseUrl + 公共 header）。第一阶段不启用，由 service 层校验阶段策略',
      ),
    path: z.string().min(1).describe('相对路径或完整 URL'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    headers: z.record(z.string(), z.string()).optional().describe('请求头'),
    params: z.record(z.string(), z.unknown()).optional().describe('请求参数'),
    body: z.unknown().optional().describe('请求体'),
    contentType: z.enum(['json', 'form-data', 'x-www-form-urlencoded']),
  })
  .describe('API 数据集配置');
export type ApiDatasetConfig = z.infer<typeof ApiDatasetConfigSchema>;

/** SQL select 开头校验（CTE/WITH 第一阶段不放行） */
const SQL_SELECT_REGEX = /^\s*select\b/i;

export const SqlDatasetConfigSchema = z
  .object({
    connectionId: z.string().min(1).describe('必须关联数据库连接'),
    sql: z
      .string()
      .min(1)
      .refine((s) => SQL_SELECT_REGEX.test(s), {
        message: 'SQL 必须以 select 开头（CTE 暂未开放）',
      })
      .refine((s) => !s.includes(';'), {
        message: '禁止多语句（不允许出现分号；参数值内的分号由参数化绑定处理）',
      })
      .describe('SQL 查询语句（强制 select 开头，禁止多语句）'),
  })
  .describe('SQL 数据集配置');
export type SqlDatasetConfig = z.infer<typeof SqlDatasetConfigSchema>;

export const WebsocketDatasetConfigSchema = z.object({
  url: z.string().min(1).describe('WebSocket URL'),
  protocol: z.array(z.string()).optional().describe('子协议列表'),
  messageFormat: z.enum(['json', 'text']),
});
export type WebsocketDatasetConfig = z.infer<typeof WebsocketDatasetConfigSchema>;

/**
 * 数据集配置判别联合
 *
 * 注意：此处 `type` 作为判别字段，与 DatasetSchema 顶层 `type` 同义；
 * DatasetSchema 顶层 type 与 config.type 必须一致（由 service 层保证）。
 */
export const DatasetConfigSchema = z.discriminatedUnion('type', [
  StaticDatasetConfigSchema.extend({ type: z.literal('static') }),
  ApiDatasetConfigSchema.extend({ type: z.literal('api') }),
  SqlDatasetConfigSchema.extend({ type: z.literal('sql') }),
  WebsocketDatasetConfigSchema.extend({ type: z.literal('websocket') }),
]);
export type DatasetConfig = z.infer<typeof DatasetConfigSchema>;

// ===== 数据形态契约 =====

export const DatasetShapeSchema = z.object({
  dataPath: z
    .string()
    .optional()
    .describe('点分隔路径，如 "data.list"，用于从嵌套响应中提取目标数组'),
  fieldMapping: FieldMappingSchema.optional().describe('默认字段映射（可被组件覆盖）'),
  filter: z
    .string()
    .optional()
    .describe('JSONata 表达式（服务端求值，图灵不完备，无 I/O 与全局对象访问）'),
});
export type DatasetShape = z.infer<typeof DatasetShapeSchema>;

// ===== 刷新策略 =====

export const RefreshIntervalUnitSchema = z.enum(['second', 'minute', 'hour']);
export type RefreshIntervalUnit = z.infer<typeof RefreshIntervalUnitSchema>;

export const RefreshStrategySchema = z.object({
  interval: z.number().int().min(0).describe('刷新间隔，0=不轮询，>0=按 intervalUnit 单位轮询'),
  intervalUnit: RefreshIntervalUnitSchema,
  stopOnHidden: z.boolean().describe('组件隐藏时是否停止刷新'),
});
export type RefreshStrategy = z.infer<typeof RefreshStrategySchema>;

// ===== 缓存策略（后端代理用） =====

export const DatasetCacheStrategySchema = z.object({
  enabled: z.boolean(),
  ttl: z.number().int().positive().describe('缓存 TTL（秒）'),
  tags: z.array(z.string()).optional().describe('缓存标签，支持批量失效'),
});
export type DatasetCacheStrategy = z.infer<typeof DatasetCacheStrategySchema>;

// ===== Mock 配置 =====

export const DatasetMockGeneratorSchema = z.enum(['static', 'faker-template', 'echo-params']);
export type DatasetMockGenerator = z.infer<typeof DatasetMockGeneratorSchema>;

/**
 * Mock 配置
 *
 * generator 与 data/template 的联动必填通过 superRefine 校验：
 * - generator = 'static' → data 必填
 * - generator = 'faker-template' → template 必填
 * - generator = 'echo-params' → 无额外必填
 *
 * useMock 调用时传 true 即覆盖 mock.enabled（见 security-decisions §5.4）
 */
export const DatasetMockConfigSchema = z
  .object({
    enabled: z.boolean(),
    generator: DatasetMockGeneratorSchema,
    data: z.unknown().optional().describe('static mock 数据'),
    template: z.string().optional().describe('faker 模板表达式'),
  })
  .superRefine((mock, ctx) => {
    if (mock.generator === 'static' && mock.data === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: "mock.generator = 'static' 时 data 必填",
        path: ['data'],
      });
    }
    if (
      mock.generator === 'faker-template' &&
      (mock.template === undefined || mock.template === '')
    ) {
      ctx.addIssue({
        code: 'custom',
        message: "mock.generator = 'faker-template' 时 template 必填",
        path: ['template'],
      });
    }
  });
export type DatasetMockConfig = z.infer<typeof DatasetMockConfigSchema>;

// ===== 数据集实体 =====

const DatasetCommonFieldsSchema = z.object({
  id: z.string().describe('数据集 ID（uuid）'),
  name: z.string().min(1).max(50).describe('数据集名称（1-50 字符，项目内唯一）'),
  description: z.string().optional().describe('数据集描述'),
  category: z.string().optional().describe('业务分组，如 "销售"/"库存"'),
  tags: z.array(z.string()).optional().describe('标签，便于检索'),
  shape: DatasetShapeSchema.optional().describe('数据形态契约'),
  refresh: RefreshStrategySchema.optional().describe('刷新策略'),
  cache: DatasetCacheStrategySchema.optional().describe('缓存策略（后端代理用）'),
  mock: DatasetMockConfigSchema.optional().describe('Mock 配置'),
  status: DatasetStatusSchema,
  createdBy: z.string().describe('创建者用户 ID'),
  createdAt: DateTimeStringSchema,
  updatedAt: DateTimeStringSchema,
});

/**
 * 数据集 Schema（判别联合，按 type 分发 config 结构）
 *
 * 顶层 `type` 与 `config.type` 由 service 层保证一致；
 * API 响应中 `config` 字段已包含 `type` 字段（与 DatasetConfigSchema 一致），
 * 因此客户端可只读 `config.type`，顶层 `type` 用于列表过滤与快速识别。
 */
export const DatasetSchema = z.discriminatedUnion('type', [
  DatasetCommonFieldsSchema.extend({
    type: z.literal('static'),
    config: StaticDatasetConfigSchema,
  }),
  DatasetCommonFieldsSchema.extend({
    type: z.literal('api'),
    config: ApiDatasetConfigSchema,
  }),
  DatasetCommonFieldsSchema.extend({
    type: z.literal('sql'),
    config: SqlDatasetConfigSchema,
  }),
  DatasetCommonFieldsSchema.extend({
    type: z.literal('websocket'),
    config: WebsocketDatasetConfigSchema,
  }),
]);
export type Dataset = z.infer<typeof DatasetSchema>;

// ===== DTO：创建/更新 =====

const CreateDatasetCommonSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  shape: DatasetShapeSchema.optional(),
  refresh: RefreshStrategySchema.optional(),
  cache: DatasetCacheStrategySchema.optional(),
  mock: DatasetMockConfigSchema.optional(),
});

export const CreateDatasetSchema = z.discriminatedUnion('type', [
  CreateDatasetCommonSchema.extend({
    type: z.literal('static'),
    config: StaticDatasetConfigSchema,
  }),
  CreateDatasetCommonSchema.extend({
    type: z.literal('api'),
    config: ApiDatasetConfigSchema,
  }),
  CreateDatasetCommonSchema.extend({
    type: z.literal('sql'),
    config: SqlDatasetConfigSchema,
  }),
  CreateDatasetCommonSchema.extend({
    type: z.literal('websocket'),
    config: WebsocketDatasetConfigSchema,
  }),
]);
export type CreateDatasetParams = z.infer<typeof CreateDatasetSchema>;

/**
 * 创建数据集请求体 Schema（API 契约层）
 *
 * 在 `CreateDatasetSchema` 基础上追加 `projectId` 字段。
 * projectId 设为可选：前端 UI 暂无项目上下文，未传时由后端 service 层
 * 回退到默认项目（取数据库第一个项目）。
 *
 * 此 Schema 是前后端创建数据集的契约单一数据源：
 * - 前端 api.ts 调用 `CreateDatasetRequestSchema.parse(params)` 预校验
 * - 后端 dto.ts 直接 `createZodDto(CreateDatasetRequestSchema)` 包装
 *
 * 设计依据：`docs/conventions/frontend-backend-contract.md`
 */
export const CreateDatasetRequestSchema = CreateDatasetSchema.and(
  z.object({
    projectId: z
      .string()
      .min(1)
      .optional()
      .describe('所属项目 ID（可选，未传时后端回退到默认项目）'),
  }),
);
export type CreateDatasetRequest = z.infer<typeof CreateDatasetRequestSchema>;

export const UpdateDatasetSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    type: DatasetTypeSchema.optional(),
    config: DatasetConfigSchema.optional(),
    shape: DatasetShapeSchema.optional(),
    refresh: RefreshStrategySchema.optional(),
    cache: DatasetCacheStrategySchema.optional(),
    mock: DatasetMockConfigSchema.optional(),
    status: DatasetStatusSchema.optional(),
  })
  .describe('更新数据集参数（所有字段可选，partial 风格）');
export type UpdateDatasetParams = z.infer<typeof UpdateDatasetSchema>;

// ===== DTO：列表查询 =====

/**
 * 数据集列表查询参数 Schema（API 契约层）
 *
 * 用于 GET /dataset 的 query string 校验。
 * projectId 设为可选：前端 UI 暂无项目上下文，未传时后端返回所有项目的数据集。
 *
 * 设计依据：`docs/conventions/frontend-backend-contract.md`
 */
export const ListDatasetQuerySchema = z.object({
  projectId: z.string().min(1).optional().describe('项目 ID（可选，未传时返回所有项目的数据集）'),
  status: DatasetStatusSchema.optional().describe('按状态过滤'),
  type: DatasetTypeSchema.optional().describe('按类型过滤'),
});
export type ListDatasetQuery = z.infer<typeof ListDatasetQuerySchema>;

// ===== DTO：响应 =====

/**
 * 数据集响应 Schema（API 契约层）
 *
 * 在 `DatasetSchema` 基础上追加可选 `projectId` 字段。
 * projectId 设为可选：前端 shared `DatasetSchema` 不含此字段，
 * Zod 默认 strip 模式会忽略额外字段，但显式声明 optional 可避免
 * OpenAPI 文档将 projectId 标为必填，让前后端契约在文档层对齐。
 *
 * 此 Schema 是前后端数据集响应的契约单一数据源：
 * - 前端 api.ts 用 `DatasetResponseSchema` 做 safeParse 校验
 * - 后端 service.toResponse 用 `DatasetResponseSchema.parse` 输出
 */
export const DatasetResponseSchema = z
  .object({
    projectId: z.string().optional().describe('所属项目 ID（可选）'),
  })
  .and(DatasetSchema);
export type DatasetResponse = z.infer<typeof DatasetResponseSchema>;

// ===== DTO：执行 =====

export const ExecuteDatasetParamsSchema = z.object({
  params: z.record(z.string(), z.unknown()).optional().default({}).describe('参数绑定值'),
  useMock: z
    .boolean()
    .optional()
    .default(false)
    .describe('是否使用 Mock 数据，传 true 即覆盖 mock.enabled（见 security-decisions §5.4）'),
});
/**
 * 执行数据集请求体（输入类型）
 *
 * 使用 `z.input` 而非 `z.infer`（= `z.output`）：字段经 `.optional().default()`
 * 处理后，output 类型为必填（默认值已填充），input 类型为可选（调用方可省略）。
 * 请求体类型应反映调用方需提供的字段，故使用 input 类型。
 */
export type ExecuteDatasetRequest = z.input<typeof ExecuteDatasetParamsSchema>;

export const DatasetExecuteMetaSchema = z.object({
  fromCache: z.boolean().describe('是否命中缓存'),
  durationMs: z.number().int().min(0).describe('执行耗时（毫秒）'),
});
export type DatasetExecuteMeta = z.infer<typeof DatasetExecuteMetaSchema>;

export const DatasetExecuteResultSchema = z.object({
  status: z.enum(['success', 'fail']),
  raw: z.unknown().describe('原始响应数据'),
  parsed: z.unknown().describe('应用 dataPath + fieldMapping + filter 后的解析数据'),
  meta: DatasetExecuteMetaSchema,
});
export type DatasetExecuteResult = z.infer<typeof DatasetExecuteResultSchema>;

/** 测试执行结果与正式执行同构，区别在不缓存 */
export const TestDatasetResultSchema = DatasetExecuteResultSchema;
export type TestDatasetResult = DatasetExecuteResult;

// ===== 批量执行（第三阶段，先定义契约） =====

export const BatchExecuteDatasetParamsSchema = z.object({
  ids: z.array(z.string()).min(1).describe('数据集 ID 列表'),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  useMock: z.boolean().optional().default(false),
});
/** 批量执行请求体（输入类型，理由同 ExecuteDatasetRequest） */
export type BatchExecuteDatasetRequest = z.input<typeof BatchExecuteDatasetParamsSchema>;

export const BatchDatasetExecuteItemSchema = z.object({
  datasetId: z.string(),
  result: DatasetExecuteResultSchema,
});
export type BatchDatasetExecuteItem = z.infer<typeof BatchDatasetExecuteItemSchema>;

export const BatchExecuteDatasetResultSchema = z.array(BatchDatasetExecuteItemSchema);
export type BatchExecuteDatasetResult = z.infer<typeof BatchExecuteDatasetResultSchema>;

// ===== 数据集引用索引（DTO 视图，对应 Prisma DatasetReference） =====

export const DatasetReferenceSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  projectId: z.string(),
  componentId: z.string(),
});
export type DatasetReference = z.infer<typeof DatasetReferenceSchema>;

/** 数据集引用数视图（列表页用） */
export const DatasetReferenceCountSchema = z.object({
  datasetId: z.string(),
  count: z.number().int().min(0),
});
export type DatasetReferenceCount = z.infer<typeof DatasetReferenceCountSchema>;
