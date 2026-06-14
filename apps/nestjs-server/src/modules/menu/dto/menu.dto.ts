import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateMenuSchema as _CreateMenuSchema,
  UpdateMenuSchema as _UpdateMenuSchema,
  MenuResponseSchema as _MenuResponseSchema,
} from '@nebula/shared/schemas';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';

export const CreateMenuSchema = _CreateMenuSchema;
export const UpdateMenuSchema = _UpdateMenuSchema;

export const MenuResponseSchema = _MenuResponseSchema.extend({
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateMenuDto extends createZodDto(CreateMenuSchema) {}
export class UpdateMenuDto extends createZodDto(UpdateMenuSchema) {}
export class MenuResponseDto extends createZodDto(MenuResponseSchema) {}

export type MenuResponse = z.infer<typeof MenuResponseSchema>;
