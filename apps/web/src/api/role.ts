import { z } from 'zod';
import {
  AssignMenusSchema,
  CreateRoleSchema,
  RoleResponseSchema,
  UpdateRoleSchema,
} from '@nebula/shared/schemas';
import { ENDPOINTS } from '@/api/endpoints';
import { del, get, patch, post } from '@/api/http';

const RoleListSchema = z.array(RoleResponseSchema);

export function getRoles() {
  return get(ENDPOINTS.roles, RoleListSchema);
}

export function createRole(params: z.infer<typeof CreateRoleSchema>) {
  return post(ENDPOINTS.roles, CreateRoleSchema.parse(params), RoleResponseSchema);
}

export function updateRole(id: string, params: z.infer<typeof UpdateRoleSchema>) {
  return patch(`${ENDPOINTS.roles}/${id}`, UpdateRoleSchema.parse(params), RoleResponseSchema);
}

export function assignRoleMenus(id: string, params: z.infer<typeof AssignMenusSchema>) {
  return post(`${ENDPOINTS.roles}/${id}/menus`, AssignMenusSchema.parse(params));
}

export function deleteRole(id: string) {
  return del(`${ENDPOINTS.roles}/${id}`);
}
