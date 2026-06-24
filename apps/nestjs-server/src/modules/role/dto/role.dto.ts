import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import {
  AssignMenusSchema as _AssignMenusSchema,
  CreateRoleSchema as _CreateRoleSchema,
  UpdateRoleSchema as _UpdateRoleSchema,
  RoleResponseSchema as _RoleResponseSchema,
} from '@nebula/shared/schemas';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';

export const CreateRoleSchema = _CreateRoleSchema;
export const UpdateRoleSchema = _UpdateRoleSchema;
export const AssignMenusSchema = _AssignMenusSchema;

export const RoleResponseSchema = _RoleResponseSchema.extend({
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
export class AssignMenusDto extends createZodDto(AssignMenusSchema) {}
export class RoleResponseDto extends createZodDto(RoleResponseSchema) {}

export type RoleResponse = z.infer<typeof RoleResponseSchema>;
