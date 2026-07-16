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

const SCREEN_QUERY_KEY = ['screen-projects'] as const;

export function useScreenProjects() {
  return useQuery({
    queryKey: SCREEN_QUERY_KEY,
    queryFn: _getScreenProjects,
  });
}

export function useScreenProject(id: string) {
  return useQuery({
    queryKey: [...SCREEN_QUERY_KEY, id],
    queryFn: () => _getScreenProject(id),
    enabled: Boolean(id),
  });
}

export function useScreenPreview(id: string) {
  return useQuery({
    queryKey: ['screen-preview', id],
    queryFn: () => _getScreenPreview(id),
    enabled: Boolean(id),
  });
}

export function useCreateScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateScreenProjectInput) => _createScreenProject(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SCREEN_QUERY_KEY });
    },
  });
}

export function useUpdateScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; params: UpdateScreenProjectInput }) =>
      _updateScreenProject(input.id, input.params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SCREEN_QUERY_KEY });
    },
  });
}

export function usePublishScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => _publishScreenProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SCREEN_QUERY_KEY });
    },
  });
}

export function useDeleteScreenProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => _deleteScreenProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SCREEN_QUERY_KEY });
    },
  });
}
