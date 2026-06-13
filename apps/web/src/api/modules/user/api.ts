import { z } from 'zod';
import type { CreateUserParams, UpdateUserParams, UserResponse } from '@nebula/shared/schemas';
import { CreateUserSchema, UpdateUserSchema, UserResponseSchema } from '@nebula/shared/schemas';
import { ENDPOINTS } from '../../core/endpoints';
import { del, get, patch, post } from '../../core/http';

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
