/**
 * 数据集管理 API 契约（端点注册表）
 *
 * 设计依据：`docs/conventions/frontend-backend-contract.md`
 *
 * 作用：把"端点元数据 + Schema"绑定在单一数据源，前后端共同消费：
 * - 前端 api.ts 从 contract 读 path / method / schema，不再硬编码
 * - 后端 controller 装饰器与 contract 保持一致（人工对齐 + 冒烟测试校验）
 *
 * 约定：
 * - 每个端点声明 `phase`（阶段标记）：1=本期实现，2/3=未来阶段
 * - 前后端开发对接前，对照 `phase=1` 的端点逐个冒烟测试
 * - contract 修改必须双方 review，避免单方面修改导致对接失败
 *
 * 注意：此文件只声明端点元数据（路径/方法/参数位置/Schema 引用），
 * 不包含实现。Schema 本身定义在 `packages/shared/src/schemas/` 下。
 */

import { z } from 'zod';
import {
  CreateDatasetRequestSchema,
  UpdateDatasetSchema,
  ListDatasetQuerySchema,
  DatasetResponseSchema,
  ExecuteDatasetParamsSchema,
  DatasetExecuteResultSchema,
  TestDatasetResultSchema,
  BatchExecuteDatasetParamsSchema,
  BatchExecuteDatasetResultSchema,
  DatasetReferenceCountSchema,
} from '../schemas/dataset.schema.js';
import {
  CreateDataSourceConnectionRequestSchema,
  UpdateDataSourceConnectionSchema,
  ListDataSourceConnectionQuerySchema,
  DataSourceConnectionResponseSchema,
  TestConnectionResultSchema,
} from '../schemas/datasource-connection.schema.js';

/** HTTP 方法枚举 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

/** 阶段标记：1=本期实现，2/3=未来阶段 */
export type Phase = 1 | 2 | 3;

/** 端点参数位置 */
export type ParamLocation = 'path' | 'query' | 'body';

/**
 * 端点契约描述
 *
 * - `pathParams`：路径参数（如 `:id`），列出参数名
 * - `query`：query string 参数的 Zod schema
 * - `body`：请求体的 Zod schema
 * - `response`：响应数据的 Zod schema（`undefined` 表示无 data 字段，如 DELETE）
 */
export interface EndpointContract {
  /** HTTP 方法 */
  method: HttpMethod;
  /** 端点路径（相对路径，不含全局前缀 `/api/v1`） */
  path: string;
  /** 阶段标记：1=本期实现，2/3=未来阶段 */
  phase: Phase;
  /** 端点描述 */
  description: string;
  /** 路径参数列表（如 `['id']`） */
  pathParams?: string[];
  /** query string 的 Zod schema */
  query?: z.ZodTypeAny;
  /** 请求体的 Zod schema */
  body?: z.ZodTypeAny;
  /** 响应数据的 Zod schema；undefined 表示无 data 字段 */
  response?: z.ZodTypeAny;
}

/**
 * 数据集管理 API 端点契约
 *
 * 路径不含全局前缀 `/api/v1`，由前后端各自拼接（前端 baseURL 默认 `/api/v1`，
 * 后端 `setGlobalPrefix('api/v1')`）。
 */
export const DATASET_CONTRACT = {
  /** 当前实现阶段 */
  phase: 1 as const,

  endpoints: {
    // ===== 数据集 CRUD =====

    list: {
      method: 'GET',
      path: '/dataset',
      phase: 1,
      description: '获取数据集列表（按 projectId 过滤，projectId 未传时返回全部）',
      query: ListDatasetQuerySchema,
      response: z.array(DatasetResponseSchema),
    } as const satisfies EndpointContract,

    getOne: {
      method: 'GET',
      path: '/dataset/:id',
      phase: 1,
      description: '获取数据集详情',
      pathParams: ['id'],
      response: DatasetResponseSchema,
    } as const satisfies EndpointContract,

    create: {
      method: 'POST',
      path: '/dataset',
      phase: 1,
      description: '创建数据集（projectId 可选，未传时后端回退到默认项目）',
      body: CreateDatasetRequestSchema,
      response: DatasetResponseSchema,
    } as const satisfies EndpointContract,

    update: {
      method: 'PATCH',
      path: '/dataset/:id',
      phase: 1,
      description: '更新数据集（所有字段可选，partial 风格）',
      pathParams: ['id'],
      body: UpdateDatasetSchema,
      response: DatasetResponseSchema,
    } as const satisfies EndpointContract,

    remove: {
      method: 'DELETE',
      path: '/dataset/:id',
      phase: 1,
      description: '删除数据集（存在组件引用时拒绝删除）',
      pathParams: ['id'],
      response: undefined,
    } as const satisfies EndpointContract,

    // ===== 数据集执行 =====

    execute: {
      method: 'POST',
      path: '/dataset/:id/execute',
      phase: 1,
      description: '执行数据集（@Public 匿名可访问，非 Mock 模式下仅允许已发布项目）',
      pathParams: ['id'],
      body: ExecuteDatasetParamsSchema,
      response: DatasetExecuteResultSchema,
    } as const satisfies EndpointContract,

    test: {
      method: 'POST',
      path: '/dataset/:id/test',
      phase: 1,
      description: '测试执行数据集（不缓存，需登录）',
      pathParams: ['id'],
      body: ExecuteDatasetParamsSchema,
      response: TestDatasetResultSchema,
    } as const satisfies EndpointContract,

    batchExecute: {
      method: 'POST',
      path: '/dataset/batch',
      phase: 1,
      description: '批量执行数据集（单个失败不影响其他，需登录）',
      body: BatchExecuteDatasetParamsSchema,
      response: BatchExecuteDatasetResultSchema,
    } as const satisfies EndpointContract,

    // ===== 数据集引用 =====

    getReferences: {
      method: 'GET',
      path: '/dataset/:id/references',
      phase: 1,
      description: '获取数据集被组件引用的次数',
      pathParams: ['id'],
      response: DatasetReferenceCountSchema,
    } as const satisfies EndpointContract,

    // ===== 数据源连接 CRUD =====

    listConnections: {
      method: 'GET',
      path: '/datasource-connection',
      phase: 1,
      description: '获取数据源连接列表',
      query: ListDataSourceConnectionQuerySchema,
      response: z.array(DataSourceConnectionResponseSchema),
    } as const satisfies EndpointContract,

    getConnection: {
      method: 'GET',
      path: '/datasource-connection/:id',
      phase: 1,
      description: '获取数据源连接详情（password/authConfig 脱敏）',
      pathParams: ['id'],
      response: DataSourceConnectionResponseSchema,
    } as const satisfies EndpointContract,

    createConnection: {
      method: 'POST',
      path: '/datasource-connection',
      phase: 1,
      description: '创建数据源连接',
      body: CreateDataSourceConnectionRequestSchema,
      response: DataSourceConnectionResponseSchema,
    } as const satisfies EndpointContract,

    updateConnection: {
      method: 'PATCH',
      path: '/datasource-connection/:id',
      phase: 1,
      description: '更新数据源连接（password/authConfig 留空表示不修改）',
      pathParams: ['id'],
      body: UpdateDataSourceConnectionSchema,
      response: DataSourceConnectionResponseSchema,
    } as const satisfies EndpointContract,

    removeConnection: {
      method: 'DELETE',
      path: '/datasource-connection/:id',
      phase: 1,
      description: '删除数据源连接',
      pathParams: ['id'],
      response: undefined,
    } as const satisfies EndpointContract,

    testConnection: {
      method: 'POST',
      path: '/datasource-connection/:id/test',
      phase: 1,
      description: '测试数据源连接（更新 lastTestedAt / lastTestResult）',
      pathParams: ['id'],
      body: undefined,
      response: TestConnectionResultSchema,
    } as const satisfies EndpointContract,
  },
} as const;

/** 所有端点契约的 key 列表（用于冒烟测试遍历） */
export type DatasetEndpointKey = keyof typeof DATASET_CONTRACT.endpoints;

/** 本期实现的端点 key 列表 */
export const PHASE_1_ENDPOINTS = Object.entries(DATASET_CONTRACT.endpoints)
  .filter(([, c]) => c.phase === 1)
  .map(([k]) => k as DatasetEndpointKey);
