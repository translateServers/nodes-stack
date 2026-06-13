import dayjs from 'dayjs';
import { z } from 'zod';
import { DATETIME_REGEX } from '@nebula/shared/schemas';

/**
 * 兼容 Date 对象与日期字符串的 DateTime Schema（后端专属增强版）
 *
 * 1. 使用 z.preprocess 在验证前将 Date 对象转为格式化字符串
 *    （Prisma 返回的是 Date 对象，需要自动转换）
 * 2. z.toJSONSchema() 通常只识别内部的 z.string()，因此 OpenAPI 文档仍显示为 string
 * 3. 运行时无论传入 Date 还是 String，最终校验和输出的都是 "YYYY-MM-DD HH:mm:ss" 字符串
 * 4. 正则表达式从 @nebula/shared 导入，确保前后端日期格式同源
 */
export const DateTimeStringSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') return val;
    if (val instanceof Date) return dayjs(val).format('YYYY-MM-DD HH:mm:ss');
    return val; // 非法类型原样抛出，交给 refine 报错
  },
  z
    .string()
    .regex(DATETIME_REGEX, {
      message: '无效的日期时间格式，期望 YYYY-MM-DD HH:mm:ss',
    })
    .describe('日期时间字符串，格式 YYYY-MM-DD HH:mm:ss'),
);
