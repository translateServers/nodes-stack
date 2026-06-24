import { createZodDto } from 'nestjs-zod';
import type { z } from 'zod';
import {
  CreateUserSchema as _CreateUserSchema,
  UpdateUserSchema as _UpdateUserSchema,
  UserResponseSchema as _UserResponseSchema,
} from '@nebula/shared/schemas';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';

// 请求 Schema 直接从 shared 导入（无日期字段，完全一致）
export const CreateUserSchema = _CreateUserSchema;
export const UpdateUserSchema = _UpdateUserSchema;

// 响应 Schema 需要用后端的 DateTimeStringSchema 覆盖时间字段
// （后端 Prisma 返回 Date 对象，需要 z.preprocess 自动转为字符串）
export const UserResponseSchema = _UserResponseSchema.extend({
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
export class UserResponseDto extends createZodDto(UserResponseSchema) {}

export type UserResponse = z.infer<typeof UserResponseSchema>;
