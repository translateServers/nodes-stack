import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import {
  CreateDictTypeSchema as _CreateDictTypeSchema,
  UpdateDictTypeSchema as _UpdateDictTypeSchema,
  DictTypeSchema as _DictTypeSchema,
  CreateDictValueSchema as _CreateDictValueSchema,
  UpdateDictValueSchema as _UpdateDictValueSchema,
  DictValueSchema as _DictValueSchema,
} from '@nebula/shared/schemas';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';

// 字典类型
export const CreateDictTypeSchema = _CreateDictTypeSchema;
export const UpdateDictTypeSchema = _UpdateDictTypeSchema;

export const DictTypeResponseSchema = _DictTypeSchema.extend({
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateDictTypeDto extends createZodDto(CreateDictTypeSchema) {}
export class UpdateDictTypeDto extends createZodDto(UpdateDictTypeSchema) {}
export class DictTypeResponseDto extends createZodDto(DictTypeResponseSchema) {}

export type DictTypeResponse = z.infer<typeof DictTypeResponseSchema>;

// 字典值
export const CreateDictValueSchema = _CreateDictValueSchema;
export const UpdateDictValueSchema = _UpdateDictValueSchema;

export const DictValueResponseSchema = _DictValueSchema.extend({
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateDictValueDto extends createZodDto(CreateDictValueSchema) {}
export class UpdateDictValueDto extends createZodDto(UpdateDictValueSchema) {}
export class DictValueResponseDto extends createZodDto(DictValueResponseSchema) {}

export type DictValueResponse = z.infer<typeof DictValueResponseSchema>;
