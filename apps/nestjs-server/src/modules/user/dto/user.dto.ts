import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DateTimeStringSchema } from '@/common/schemas/datetime.schema';
import { userFields } from '@/common/schemas/user-fields.schema';

export const CreateUserSchema = z.object({
  email: userFields.email,
  username: userFields.username,
  password: userFields.password,
  name: userFields.name,
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({
  password: true,
});

export const UserResponseSchema = z.object({
  id: z.string().describe('用户唯一标识（UUID）'),
  email: z.string().describe('用户邮箱地址'),
  username: z.string().describe('用户名'),
  name: z.string().nullable().optional().describe('用户显示名称'),
  isActive: z.boolean().describe('是否启用'),
  createdAt: DateTimeStringSchema.describe('创建时间'),
  updatedAt: DateTimeStringSchema.describe('更新时间'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
export class UserResponseDto extends createZodDto(UserResponseSchema) {}

export type UserResponse = z.infer<typeof UserResponseSchema>;
