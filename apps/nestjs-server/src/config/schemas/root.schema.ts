import { z } from 'zod';
import { AppSchema } from './app.schema';
import { DatabaseSchema } from './database.schema';
import { JwtSchema } from './jwt.schema';
import { LoggerSchema } from './logger.schema';
import { RedisSchema } from './redis.schema';

/**
 * 聚合分层 Schema，形成 Namespace 结构。
 */
export const RootConfigSchema = z.object({
  app: AppSchema,
  database: DatabaseSchema,
  jwt: JwtSchema,
  logger: LoggerSchema,
  redis: RedisSchema,
});

/**
 * 由 RootConfigSchema 推导出的完整配置树类型。
 */
export type RootConfig = z.infer<typeof RootConfigSchema>;
