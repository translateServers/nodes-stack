import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import {
  CreateScreenProjectSchema as _CreateScreenProjectSchema,
  ExecuteScreenHostResourceSchema as _ExecuteScreenHostResourceSchema,
  ListScreenHostResourcesQuerySchema as _ListScreenHostResourcesQuerySchema,
  UpdateScreenProjectSchema as _UpdateScreenProjectSchema,
  PublishScreenProjectSchema as _PublishScreenProjectSchema,
  ScreenHostResourceResponseSchema as _ScreenHostResourceResponseSchema,
  ScreenHostResourceSummarySchema,
  ScreenProjectSchema as _ScreenProjectSchema,
} from '@nebula/shared/schemas';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';

export const CreateScreenProjectSchema = _CreateScreenProjectSchema;
export const UpdateScreenProjectSchema = _UpdateScreenProjectSchema;
export const PublishScreenProjectSchema = _PublishScreenProjectSchema;
export const ListScreenHostResourcesQuerySchema = _ListScreenHostResourcesQuerySchema;
export const ExecuteScreenHostResourceSchema = _ExecuteScreenHostResourceSchema;
export const ScreenHostResourceResponseSchema = _ScreenHostResourceResponseSchema;

export const ScreenProjectResponseSchema = _ScreenProjectSchema.extend({
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateScreenProjectDto extends createZodDto(CreateScreenProjectSchema) {}
export class UpdateScreenProjectDto extends createZodDto(UpdateScreenProjectSchema) {}
export class PublishScreenProjectDto extends createZodDto(PublishScreenProjectSchema) {}
export class ScreenProjectResponseDto extends createZodDto(ScreenProjectResponseSchema) {}
export class ListScreenHostResourcesQueryDto extends createZodDto(
  ListScreenHostResourcesQuerySchema,
) {}
export class ExecuteScreenHostResourceDto extends createZodDto(ExecuteScreenHostResourceSchema) {}
export class ScreenHostResourceSummaryDto extends createZodDto(ScreenHostResourceSummarySchema) {}
export class ScreenHostResourceResponseDto extends createZodDto(ScreenHostResourceResponseSchema) {}

export type ScreenProjectResponse = z.infer<typeof ScreenProjectResponseSchema>;
export type ScreenHostResourceSummary = z.infer<typeof ScreenHostResourceSummarySchema>;
export type ScreenHostResourceResponse = z.infer<typeof ScreenHostResourceResponseSchema>;
