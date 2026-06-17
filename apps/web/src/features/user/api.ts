import { z } from 'zod';
import {
  type CreateUserParams,
  type UpdateUserParams,
  type UserResponse,
  CreateUserSchema,
  UpdateUserSchema,
  UserResponseSchema,
} from '@nebula/shared';
import { ENDPOINTS } from '@/api/core/endpoints';
import { del, get, patch, post } from '@/api/core/http';

const UserListSchema = z.array(UserResponseSchema);

export function createUser(params: CreateUserParams): Promise<UserResponse> {
  return post(ENDPOINTS.users, CreateUserSchema.parse(params), UserResponseSchema);
}

export function getUsers(): Promise<UserResponse[]> {
  return get(ENDPOINTS.users, UserListSchema);
}

export function getUserById(id: string): Promise<UserResponse> {
  return get(`${ENDPOINTS.users}/${id}`, UserResponseSchema);
}

export function updateUser(id: string, params: UpdateUserParams): Promise<UserResponse> {
  return patch(`${ENDPOINTS.users}/${id}`, UpdateUserSchema.parse(params), UserResponseSchema);
}

export function deleteUser(id: string): Promise<undefined> {
  return del(`${ENDPOINTS.users}/${id}`);
}
