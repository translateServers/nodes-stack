import { z } from 'zod';
import { LogLevel } from '@/common/constants/log-level.constants';

export const LoggerSchema = z.object({
  loggerDir: z.string().default('logs'),
  loggerLevel: z.enum(Object.values(LogLevel)).default(LogLevel.Info),
  loggerEnableFile: z.coerce.boolean().default(false),
  loggerMaxFiles: z.coerce.number().default(7),
  loggerMaxSize: z.string().default('20m'),
});

export type LoggerConfig = z.infer<typeof LoggerSchema>;
