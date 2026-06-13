import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ApiErrorResponseSchema = z.object({
  code: z.number().describe('业务错误码，非 0'),
  message: z.string().describe('错误消息'),
  details: z
    .array(z.string())
    .optional()
    .describe('错误详情列表（如字段级校验错误）'),
});

export class ApiErrorResponseDto extends createZodDto(ApiErrorResponseSchema) {}
