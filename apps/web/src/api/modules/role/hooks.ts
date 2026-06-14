import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  AssignMenusSchema as _AssignMenusSchema,
  CreateRoleSchema as _CreateRoleSchema,
  UpdateRoleSchema as _UpdateRoleSchema,
} from '@nebula/shared/schemas';
import {
  createRole as _createRole,
  deleteRole as _deleteRole,
  getRoles as _getRoles,
  updateRole as _updateRole,
  assignRoleMenus as _assignRoleMenus,
} from './api';

type CreateRoleInput = z.infer<typeof _CreateRoleSchema>;
type UpdateRoleInput = z.infer<typeof _UpdateRoleSchema>;
type AssignMenusInput = z.infer<typeof _AssignMenusSchema>;

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: _getRoles,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateRoleInput) => _createRole(params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; params: UpdateRoleInput }) =>
      _updateRole(input.id, input.params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useAssignRoleMenus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; params: AssignMenusInput }) =>
      _assignRoleMenus(input.id, input.params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => _deleteRole(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}
