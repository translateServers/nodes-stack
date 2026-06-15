import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  CreateDictTypeSchema as _CreateDictTypeSchema,
  UpdateDictTypeSchema as _UpdateDictTypeSchema,
  CreateDictValueSchema as _CreateDictValueSchema,
  UpdateDictValueSchema as _UpdateDictValueSchema,
} from '@nebula/shared/schemas';
import {
  getDictTypes as _getDictTypes,
  getDictTypeById as _getDictTypeById,
  createDictType as _createDictType,
  updateDictType as _updateDictType,
  deleteDictType as _deleteDictType,
  getDictValues as _getDictValues,
  createDictValue as _createDictValue,
  updateDictValue as _updateDictValue,
  deleteDictValue as _deleteDictValue,
} from './api';

type CreateDictTypeInput = z.infer<typeof _CreateDictTypeSchema>;
type UpdateDictTypeInput = z.infer<typeof _UpdateDictTypeSchema>;
type CreateDictValueInput = z.infer<typeof _CreateDictValueSchema>;
type UpdateDictValueInput = z.infer<typeof _UpdateDictValueSchema>;

// ──────────────────────── 字典类型 ────────────────────────

export function useDictTypes() {
  return useQuery({
    queryKey: ['dict-types'],
    queryFn: _getDictTypes,
  });
}

export function useDictTypeById(id: string) {
  return useQuery({
    queryKey: ['dict-types', id],
    queryFn: () => _getDictTypeById(id),
    enabled: Boolean(id),
  });
}

export function useCreateDictType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateDictTypeInput) => _createDictType(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dict-types'] });
    },
  });
}

export function useUpdateDictType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; params: UpdateDictTypeInput }) =>
      _updateDictType(input.id, input.params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dict-types'] });
    },
  });
}

export function useDeleteDictType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => _deleteDictType(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dict-types'] });
    },
  });
}

// ──────────────────────── 字典值 ────────────────────────

export function useDictValues(typeId: string) {
  return useQuery({
    queryKey: ['dict-values', typeId],
    queryFn: () => _getDictValues(typeId),
    enabled: Boolean(typeId),
  });
}

export function useCreateDictValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateDictValueInput) => _createDictValue(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dict-values'] });
    },
  });
}

export function useUpdateDictValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; params: UpdateDictValueInput }) =>
      _updateDictValue(input.id, input.params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dict-values'] });
    },
  });
}

export function useDeleteDictValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => _deleteDictValue(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dict-values'] });
    },
  });
}
