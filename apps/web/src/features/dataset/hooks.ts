/**
 * 数据集管理 TanStack Query Hooks
 *
 * 设计依据：`docs/specs/dataset-management/architecture.md` §3
 *
 * queryKey 约定：
 * - `['datasets']` — 列表
 * - `['datasets', id]` — 详情
 * - `['datasource-connections']` — 连接列表
 * - `['datasource-connections', id]` — 连接详情
 *
 * mutation 在 onSuccess 中 invalidateQueries 刷新列表（与 user/role feature 一致）
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateDataSourceConnectionParams, ExecuteDatasetRequest } from '@nebula/shared';
import * as datasetApi from './api';

// ===== 数据集 =====

type UpdateDatasetMutationParams =
  Parameters<typeof datasetApi.updateDataset> extends [infer TId, infer TParams]
    ? { id: TId; params: TParams }
    : never;

type UpdateConnectionMutationParams =
  Parameters<typeof datasetApi.updateConnection> extends [infer TId, infer TParams]
    ? { id: TId; params: TParams }
    : never;

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: datasetApi.getDatasets,
  });
}

export function useDataset(id: string) {
  return useQuery({
    queryKey: ['datasets', id],
    queryFn: () => datasetApi.getDatasetById(id),
    enabled: Boolean(id),
  });
}

export function useCreateDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: datasetApi.createDataset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
}

export function useUpdateDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: UpdateDatasetMutationParams) =>
      datasetApi.updateDataset(id, params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
}

export function useDeleteDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: datasetApi.deleteDataset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
}

export function useExecuteDataset() {
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: ExecuteDatasetRequest }) =>
      datasetApi.executeDataset(id, params ?? {}),
  });
}

export function useTestDataset() {
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: ExecuteDatasetRequest }) =>
      datasetApi.testDataset(id, params ?? {}),
  });
}

// ===== 数据源连接 =====

export function useConnections() {
  return useQuery({
    queryKey: ['datasource-connections'],
    queryFn: datasetApi.getConnections,
  });
}

export function useConnection(id: string) {
  return useQuery({
    queryKey: ['datasource-connections', id],
    queryFn: () => datasetApi.getConnectionById(id),
    enabled: Boolean(id),
  });
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateDataSourceConnectionParams) => datasetApi.createConnection(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasource-connections'] });
    },
  });
}

export function useUpdateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: UpdateConnectionMutationParams) =>
      datasetApi.updateConnection(id, params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasource-connections'] });
    },
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: datasetApi.deleteConnection,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasource-connections'] });
    },
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: datasetApi.testConnection,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasource-connections'] });
    },
  });
}
