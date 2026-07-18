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

export function getScreenProject(id: string) {
  return get(`${ENDPOINTS.screen}/${id}`, ScreenProjectSchema);
}

export function createScreenProject(params: z.infer<typeof CreateScreenProjectSchema>) {
  return post(ENDPOINTS.screen, CreateScreenProjectSchema.parse(params), ScreenProjectSchema);
}

export function updateScreenProject(id: string, params: z.infer<typeof UpdateScreenProjectSchema>) {
  return patch(
    `${ENDPOINTS.screen}/${id}`,
    UpdateScreenProjectSchema.parse(params),
    ScreenProjectSchema,
  );
}

export function publishScreenProject(
  id: string,
  params: z.infer<typeof PublishScreenProjectSchema>,
) {
  return post(
    `${ENDPOINTS.screen}/${id}/publish`,
    PublishScreenProjectSchema.parse(params),
    ScreenProjectSchema,
  );
}

export function deleteScreenProject(id: string) {
  return del(`${ENDPOINTS.screen}/${id}`);
}

export function getScreenPreview(id: string) {
  return get(`${ENDPOINTS.screen}/${id}/preview`, ScreenProjectSchema);
}
