import { z } from 'zod';
import {
  ScreenProjectSchema,
  CreateScreenProjectSchema,
  UpdateScreenProjectSchema,
  PublishScreenProjectSchema,
} from '@nebula/shared';
import { ENDPOINTS } from '@/api/core/endpoints';
import { del, get, patch, post } from '@/api/core/http';

const ScreenProjectListSchema = z.array(ScreenProjectSchema);

export function getScreenProjects() {
  return get(`${ENDPOINTS.screen}`, ScreenProjectListSchema);
}

export function getScreenProject(id: string, signal?: AbortSignal) {
  return signal === undefined
    ? get(`${ENDPOINTS.screen}/${id}`, ScreenProjectSchema)
    : get(`${ENDPOINTS.screen}/${id}`, ScreenProjectSchema, { signal });
}

export function createScreenProject(params: z.infer<typeof CreateScreenProjectSchema>) {
  return post(ENDPOINTS.screen, CreateScreenProjectSchema.parse(params), ScreenProjectSchema);
}

export function updateScreenProject(
  id: string,
  params: z.infer<typeof UpdateScreenProjectSchema>,
  signal?: AbortSignal,
) {
  const body = UpdateScreenProjectSchema.parse(params);
  return signal === undefined
    ? patch(`${ENDPOINTS.screen}/${id}`, body, ScreenProjectSchema)
    : patch(`${ENDPOINTS.screen}/${id}`, body, ScreenProjectSchema, { signal });
}

export function publishScreenProject(
  id: string,
  params: z.infer<typeof PublishScreenProjectSchema>,
  signal?: AbortSignal,
) {
  const body = PublishScreenProjectSchema.parse(params);
  return signal === undefined
    ? post(`${ENDPOINTS.screen}/${id}/publish`, body, ScreenProjectSchema)
    : post(`${ENDPOINTS.screen}/${id}/publish`, body, ScreenProjectSchema, { signal });
}

export function deleteScreenProject(id: string) {
  return del(`${ENDPOINTS.screen}/${id}`);
}

export function getScreenPreview(id: string) {
  return get(`${ENDPOINTS.screen}/${id}/preview`, ScreenProjectSchema);
}
