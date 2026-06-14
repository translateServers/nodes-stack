import { z } from 'zod';

export const RedisSchema = z.object({
  host: z.string().min(1, 'REDIS_HOST 不能为空'),
  port: z.coerce.number().int().positive().default(6379),
  password: z.string().optional(),
  db: z.coerce.number().int().nonnegative().default(0),
  keyPrefix: z.string().default('nebula:'),
  /** 连接超时时间（毫秒） */
  connectTimeout: z.coerce.number().int().positive().default(5000),
  /** 最大重连尝试次数，超过后放弃 */
  maxRetries: z.coerce.number().int().nonnegative().default(3),
  /** 启用后延迟到首次使用时才建立连接，应用启动不等待 Redis */
  lazyConnect: z.coerce.boolean().default(false),
});

export type RedisConfig = z.infer<typeof RedisSchema>;
