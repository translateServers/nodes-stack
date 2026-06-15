import { z } from 'zod';
import {
  CreateDictTypeSchema,
  UpdateDictTypeSchema,
  DictTypeSchema,
  CreateDictValueSchema,
  UpdateDictValueSchema,
  DictValueSchema,
} from '@nebula/shared';
import { ENDPOINTS } from '../../core/endpoints';
import { del, get, patch, post } from '../../core/http';

const DictTypeListSchema = z.array(DictTypeSchema);
const DictValueListSchema = z.array(DictValueSchema);

// ──────────────────────── 字典类型 ────────────────────────

export function getDictTypes() {
  return get(`${ENDPOINTS.dict}/types`, DictTypeListSchema);
}

export function getDictTypeById(id: string) {
  return get(`${ENDPOINTS.dict}/types/${id}`, DictTypeSchema);
}

export function createDictType(params: z.infer<typeof CreateDictTypeSchema>) {
  return post(`${ENDPOINTS.dict}/types`, CreateDictTypeSchema.parse(params), DictTypeSchema);
}

export function updateDictType(id: string, params: z.infer<typeof UpdateDictTypeSchema>) {
  return patch(`${ENDPOINTS.dict}/types/${id}`, UpdateDictTypeSchema.parse(params), DictTypeSchema);
}

export function deleteDictType(id: string) {
  return del(`${ENDPOINTS.dict}/types/${id}`);
}

// ──────────────────────── 字典值 ────────────────────────

export function getDictValues(typeId: string) {
  return get(`${ENDPOINTS.dict}/types/${typeId}/values`, DictValueListSchema);
}

export function createDictValue(params: z.infer<typeof CreateDictValueSchema>) {
  return post(`${ENDPOINTS.dict}/values`, CreateDictValueSchema.parse(params), DictValueSchema);
}

export function updateDictValue(id: string, params: z.infer<typeof UpdateDictValueSchema>) {
  return patch(
    `${ENDPOINTS.dict}/values/${id}`,
    UpdateDictValueSchema.parse(params),
    DictValueSchema,
  );
}

export function deleteDictValue(id: string) {
  return del(`${ENDPOINTS.dict}/values/${id}`);
}
