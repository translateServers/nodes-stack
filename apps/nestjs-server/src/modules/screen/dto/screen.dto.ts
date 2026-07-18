import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import {
  CreateScreenProjectSchema as _CreateScreenProjectSchema,
  UpdateScreenProjectSchema as _UpdateScreenProjectSchema,
  PublishScreenProjectSchema as _PublishScreenProjectSchema,
  ScreenProjectSchema as _ScreenProjectSchema,
} from '@nebula/shared/schemas';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';

export const CreateScreenProjectSchema = _CreateScreenProjectSchema;
export const UpdateScreenProjectSchema = _UpdateScreenProjectSchema;
export const PublishScreenProjectSchema = _PublishScreenProjectSchema;

export const ScreenProjectResponseSchema = _ScreenProjectSchema.extend({
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateScreenProjectDto extends createZodDto(CreateScreenProjectSchema) {}
export class UpdateScreenProjectDto extends createZodDto(UpdateScreenProjectSchema) {}
export class PublishScreenProjectDto extends createZodDto(PublishScreenProjectSchema) {}
export class ScreenProjectResponseDto extends createZodDto(ScreenProjectResponseSchema) {}

export type ScreenProjectResponse = z.infer<typeof ScreenProjectResponseSchema>;
