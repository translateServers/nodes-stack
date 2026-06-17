import { z } from 'zod';
import { ENDPOINTS } from '@/api/core/endpoints';
import { get } from '@/api/core/http';

export const HealthStatusSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  timestamp: z.string(),
  uptime: z.number(),
  database: z.enum(['connected', 'disconnected']),
});

export const PingResponseSchema = z.object({
  message: z.string(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type PingResponse = z.infer<typeof PingResponseSchema>;

export function checkHealth(): Promise<HealthStatus> {
  return get(ENDPOINTS.health.check, HealthStatusSchema);
}

export function ping(): Promise<PingResponse> {
  return get(ENDPOINTS.health.ping, PingResponseSchema);
}
