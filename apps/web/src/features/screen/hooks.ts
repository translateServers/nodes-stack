import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  CreateScreenProjectSchema as _CreateScreenProjectSchema,
  UpdateScreenProjectSchema as _UpdateScreenProjectSchema,
} from '@nebula/shared/schemas';
import {
  getScreenProjects as _getScreenProjects,
  getScreenProject as _getScreenProject,
  createScreenProject as _createScreenProject,
  updateScreenProject as _updateScreenProject,
  publishScreenProject as _publishScreenProject,
  deleteScreenProject as _deleteScreenProject,
  getScreenPreview as _getScreenPreview,
} from './api';

type CreateScreenProjectInput = z.infer<typeof _CreateScreenProjectSchema>;
type UpdateScreenProjectInput = z.infer<typeof _UpdateScreenProjectSchema>;

export const screenQueryKeys = {
  all: ['screen-projects'] as const,
  detail: (id: string) => ['screen-projects', id] as const,
  preview: (id: string) => ['screen-preview', id] as const,
};

export function useScreenProjects() {
  return useQuery({
    queryKey: screenQueryKeys.all,
    queryFn: _getScreenProjects,
  });
}

export function useScreenProject(id: string) {
  return useQuery({
    queryKey: screenQueryKeys.detail(id),
    queryFn: () => _getScreenProject(id),
    enabled: Boolean(id),
  });
}

export function useScreenPreview(id: string) {
  return useQuery({
    queryKey: screenQueryKeys.preview(id),
    queryFn: () => _getScreenPreview(id),
    enabled: Boolean(id),
  });
}

export function useCreateScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateScreenProjectInput) => _createScreenProject(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: screenQueryKeys.all });
    },
  });
}

export function useUpdateScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; params: UpdateScreenProjectInput }) =>
      _updateScreenProject(input.id, input.params),
    onSuccess: async (response, variables) => {
      // 用服务端响应（含新 updatedAt 与 draft 状态）更新详情缓存，作为下次保存基线
      queryClient.setQueryData(screenQueryKeys.detail(variables.id), response);
      // 仅失效列表查询（exact 匹配 ['screen-projects']），不重复 refetch 刚写入的详情
      await queryClient.invalidateQueries({ queryKey: screenQueryKeys.all, exact: true });
    },
  });
}

export function usePublishScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; expectedUpdatedAt: string }) =>
      _publishScreenProject(input.id, { expectedUpdatedAt: input.expectedUpdatedAt }),
    onSuccess: async (response, variables) => {
      // 用服务端响应（含新 updatedAt 与 published 状态）更新详情缓存，作为下次保存/发布基线
      queryClient.setQueryData(screenQueryKeys.detail(variables.id), response);
      // 仅失效列表查询（exact 匹配 ['screen-projects']），不重复 refetch 刚写入的详情
      await queryClient.invalidateQueries({ queryKey: screenQueryKeys.all, exact: true });
      // 失效公开预览缓存，确保发布后匿名预览立即拉取最新已发布内容
      await queryClient.invalidateQueries({ queryKey: screenQueryKeys.preview(variables.id) });
    },
  });
}

export function useDeleteScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => _deleteScreenProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: screenQueryKeys.all });
    },
  });
}
