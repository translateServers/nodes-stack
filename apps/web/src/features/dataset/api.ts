/**
 * 数据集管理 API 客户端
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §2
 *
 * 端点：
 * - 数据集 CRUD + execute + test：`/dataset`
 * - 数据源连接 CRUD + test：`/datasource-connection`
 *
 * 约定：
 * - 列表 schema 在本地定义 `z.array(XxxSchema)`
 * - 创建/更新前在客户端再 `Schema.parse(params)` 一次（与 user/role feature 一致）
 * - DELETE 不带 schema，返回 `Promise<undefined>`
 */

import { z } from 'zod';
import {
  type BatchExecuteDatasetRequest,
  type BatchExecuteDatasetResult,
  type CreateDataSourceConnectionParams,
  type CreateDatasetParams,
  type Dataset,
  type DatasetExecuteResult,
  type DataSourceConnection,
  type ExecuteDatasetRequest,
  type TestConnectionResult,
  type TestDatasetResult,
  type UpdateDataSourceConnectionParams,
  type UpdateDatasetParams,
  BatchExecuteDatasetParamsSchema,
  BatchExecuteDatasetResultSchema,
  CreateDataSourceConnectionSchema,
  CreateDatasetSchema,
  DatasetExecuteResultSchema,
  DatasetSchema,
  DataSourceConnectionSchema,
  ExecuteDatasetParamsSchema,
  TestConnectionResultSchema,
  TestDatasetResultSchema,
  UpdateDataSourceConnectionSchema,
  UpdateDatasetSchema,
} from '@nebula/shared';
import { ENDPOINTS } from '@/api/core/endpoints';
import { del, get, patch, post } from '@/api/core/http';

// ===== 数据集 =====

const DatasetListSchema = z.array(DatasetSchema);

export function getDatasets(): Promise<Dataset[]> {
  return get(ENDPOINTS.dataset, DatasetListSchema);
}

export function getDatasetById(id: string): Promise<Dataset> {
  return get(`${ENDPOINTS.dataset}/${id}`, DatasetSchema);
}

export function createDataset(params: CreateDatasetParams): Promise<Dataset> {
  return post(ENDPOINTS.dataset, CreateDatasetSchema.parse(params), DatasetSchema);
}

export function updateDataset(id: string, params: UpdateDatasetParams): Promise<Dataset> {
  return patch(`${ENDPOINTS.dataset}/${id}`, UpdateDatasetSchema.parse(params), DatasetSchema);
}

export function deleteDataset(id: string): Promise<undefined> {
  return del(`${ENDPOINTS.dataset}/${id}`);
}

export function executeDataset(
  id: string,
  params: ExecuteDatasetRequest = {},
): Promise<DatasetExecuteResult> {
  return post(
    `${ENDPOINTS.dataset}/${id}/execute`,
    ExecuteDatasetParamsSchema.parse(params),
    DatasetExecuteResultSchema,
  );
}

export function testDataset(
  id: string,
  params: ExecuteDatasetRequest = {},
): Promise<TestDatasetResult> {
  return post(
    `${ENDPOINTS.dataset}/${id}/test`,
    ExecuteDatasetParamsSchema.parse(params),
    TestDatasetResultSchema,
  );
}

export function batchExecuteDatasets(
  params: BatchExecuteDatasetRequest,
): Promise<BatchExecuteDatasetResult> {
  return post(
    `${ENDPOINTS.dataset}/batch`,
    BatchExecuteDatasetParamsSchema.parse(params),
    BatchExecuteDatasetResultSchema,
  );
}

// ===== 数据源连接 =====

const ConnectionListSchema = z.array(DataSourceConnectionSchema);

export function getConnections(): Promise<DataSourceConnection[]> {
  return get(ENDPOINTS.datasourceConnection, ConnectionListSchema);
}

export function getConnectionById(id: string): Promise<DataSourceConnection> {
  return get(`${ENDPOINTS.datasourceConnection}/${id}`, DataSourceConnectionSchema);
}

export function createConnection(
  params: CreateDataSourceConnectionParams,
): Promise<DataSourceConnection> {
  return post(
    ENDPOINTS.datasourceConnection,
    CreateDataSourceConnectionSchema.parse(params),
    DataSourceConnectionSchema,
  );
}

export function updateConnection(
  id: string,
  params: UpdateDataSourceConnectionParams,
): Promise<DataSourceConnection> {
  return patch(
    `${ENDPOINTS.datasourceConnection}/${id}`,
    UpdateDataSourceConnectionSchema.parse(params),
    DataSourceConnectionSchema,
  );
}

export function deleteConnection(id: string): Promise<undefined> {
  return del(`${ENDPOINTS.datasourceConnection}/${id}`);
}

export function testConnection(id: string): Promise<TestConnectionResult> {
  return post(
    `${ENDPOINTS.datasourceConnection}/${id}/test`,
    undefined,
    TestConnectionResultSchema,
  );
}
