import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { FileSchema as _FileSchema } from '@nebula/shared/schemas';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';

export const FileResponseSchema = _FileSchema.extend({
  createdAt: DateTimeStringSchema.describe('上传时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class FileResponseDto extends createZodDto(FileResponseSchema) {}
export type FileResponse = z.infer<typeof FileResponseSchema>;
