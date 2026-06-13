import { z } from 'zod';
import {
  CreateMenuSchema,
  MenuResponseSchema,
  MenuTreeNodeSchema,
  UpdateMenuSchema,
} from '@nebula/shared';
import { ENDPOINTS } from '../../core/endpoints';
import { del, get, patch, post } from '../../core/http';

const MenuListSchema = z.array(MenuResponseSchema);
const MenuTreeSchema = z.array(MenuTreeNodeSchema);

export function getMenus() {
  return get(ENDPOINTS.menus, MenuListSchema);
}

export function getMenuTree() {
  return get(`${ENDPOINTS.menus}/tree`, MenuTreeSchema);
}

export function createMenu(params: z.infer<typeof CreateMenuSchema>) {
  return post(ENDPOINTS.menus, CreateMenuSchema.parse(params), MenuResponseSchema);
}

export function updateMenu(id: string, params: z.infer<typeof UpdateMenuSchema>) {
  return patch(`${ENDPOINTS.menus}/${id}`, UpdateMenuSchema.parse(params), MenuResponseSchema);
}

export function deleteMenu(id: string) {
  return del(`${ENDPOINTS.menus}/${id}`);
}
