import http from '@/api/http';

// 用户响应
export interface UserResponse {
  id: string;
  email: string;
  username: string;
  name?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 创建用户参数
export interface CreateUserParams {
  email: string;
  username: string;
  password: string;
  name?: string;
}

// 更新用户参数
export interface UpdateUserParams {
  email?: string;
  username?: string;
  name?: string;
}

// 创建用户
export function createUser(params: CreateUserParams): Promise<UserResponse> {
  return http.post<unknown, UserResponse>('/users', params);
}

// 获取所有用户
export function getUsers(): Promise<UserResponse[]> {
  return http.get<unknown, UserResponse[]>('/users');
}

// 根据 ID 获取用户
export function getUserById(id: string): Promise<UserResponse> {
  return http.get<unknown, UserResponse>(`/users/${id}`);
}

// 更新用户
export function updateUser(id: string, params: UpdateUserParams): Promise<UserResponse> {
  return http.patch<unknown, UserResponse>(`/users/${id}`, params);
}

// 删除用户
export function deleteUser(id: string): Promise<void> {
  return http.delete<unknown, void>(`/users/${id}`);
}
