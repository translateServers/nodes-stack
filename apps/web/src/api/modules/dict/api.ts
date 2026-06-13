import { z } from 'zod';
import { CreateDictTypeSchema, DictTypeSchema, DictValueSchema } from '@nebula/shared';
import { ENDPOINTS } from '../../core/endpoints';
import { del, get, patch, post } from '../../core/http';

const DictTypeListSchema = z.array(DictTypeSchema);
const DictValueListSchema = z.array(DictValueSchema);

export function getDictTypes() {
  return get(`${ENDPOINTS.dict}/types`, DictTypeListSchema);
}

export function getDictValues(typeCode: string) {
  return get(`${ENDPOINTS.dict}/types/${typeCode}/values`, DictValueListSchema);
}

export function createDictType(params: z.infer<typeof CreateDictTypeSchema>) {
  return post(`${ENDPOINTS.dict}/types`, CreateDictTypeSchema.parse(params), DictTypeSchema);
}

export function updateDictType(typeCode: string, params: z.infer<typeof CreateDictTypeSchema>) {
  return patch(
    `${ENDPOINTS.dict}/types/${typeCode}`,
    CreateDictTypeSchema.parse(params),
    DictTypeSchema,
  );
}

export function deleteDictType(typeCode: string) {
  return del(`${ENDPOINTS.dict}/types/${typeCode}`);
}
