import { z } from 'zod';

export const DatabaseSchema = z.object({
  provider: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  url: z.string().min(1, 'DATABASE_URL 不能为空'),
  maxConnections: z.coerce.number().int().positive().default(10),
  logging: z.coerce.boolean().default(false),
});

export type DatabaseConfig = z.infer<typeof DatabaseSchema>;
