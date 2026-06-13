import { z } from 'zod';

// 日期时间字符串 Schema（与后端 DateTimeStringSchema 同源）
export const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export const DateTimeStringSchema = z
  .string()
  .regex(DATETIME_REGEX, {
    message: '无效的日期时间格式，期望 YYYY-MM-DD HH:mm:ss',
  })
  .describe('日期时间字符串，格式 YYYY-MM-DD HH:mm:ss');

export type DateTimeString = z.infer<typeof DateTimeStringSchema>;
