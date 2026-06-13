import { z } from 'zod';

export const AppSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().int().positive().default(3000),
  apiPrefix: z.string().default('api/v1'),
  corsOrigin: z.string().default('*'),
  enableSwagger: z.coerce.boolean().default(true),
});

export type AppConfig = z.infer<typeof AppSchema>;
