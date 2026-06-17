import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../../../test/utils';
import * as userApi from './api';
import { useUsers, useUser, useCreateUser, useDeleteUser } from './hooks';

vi.mock('./api', () => ({
  getUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch users list', async () => {
    const mockUsers = [{ id: '1', email: 'a@b.com', username: 'alice', name: 'Alice', isActive: true, createdAt: '2025-01-01', updatedAt: '2025-01-01' }];
    vi.mocked(userApi.getUsers).mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockUsers);
  });
});

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user by id', async () => {
    const mockUser = { id: '1', email: 'a@b.com', username: 'alice', name: 'Alice', isActive: true, createdAt: '2025-01-01', updatedAt: '2025-01-01' };
    vi.mocked(userApi.getUserById).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useUser('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('1');
  });

  it('should not fetch when id is empty', () => {
    const { result } = renderHook(() => useUser(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(userApi.getUserById).not.toHaveBeenCalled();
  });
});

describe('useCreateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call createUser API', async () => {
    const newUser = { id: '2', email: 'new@test.com', username: 'new', name: null, isActive: true, createdAt: '2025-01-01', updatedAt: '2025-01-01' };
    vi.mocked(userApi.createUser).mockResolvedValue(newUser);

    const { result } = renderHook(() => useCreateUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ email: 'new@test.com', username: 'new', password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(userApi.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@test.com',
        username: 'new',
        password: 'password123',
      }),
      expect.anything(),
    );
  });
});

describe('useDeleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call deleteUser API', async () => {
    vi.mocked(userApi.deleteUser).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('user-id');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(userApi.deleteUser).toHaveBeenCalledWith('user-id', expect.anything());
  });
});
