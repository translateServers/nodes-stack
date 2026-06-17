import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../../../test/utils';
import * as roleApi from './api';
import { useRoles, useCreateRole, useDeleteRole } from './hooks';

vi.mock('./api', () => ({
  getRoles: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  assignRoleMenus: vi.fn(),
}));

describe('useRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch roles list', async () => {
    const mockRoles = [
      {
        id: '1',
        name: 'admin',
        description: null,
        isActive: true,
        createdAt: '2025-06-01 10:00:00',
        updatedAt: '2025-06-01 10:00:00',
      },
    ];
    vi.mocked(roleApi.getRoles).mockResolvedValue(mockRoles);

    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe('admin');
  });
});

describe('useCreateRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a role', async () => {
    vi.mocked(roleApi.createRole).mockResolvedValue({
      id: '2',
      name: 'viewer',
      description: 'Viewer',
      isActive: true,
      createdAt: '2025-06-01 10:00:00',
      updatedAt: '2025-06-01 10:00:00',
    });

    const { result } = renderHook(() => useCreateRole(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: 'viewer', description: 'Viewer' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(roleApi.createRole).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'viewer', description: 'Viewer' }),
    );
  });
});

describe('useDeleteRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a role', async () => {
    vi.mocked(roleApi.deleteRole).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteRole(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('role-id');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(roleApi.deleteRole).toHaveBeenCalledWith('role-id');
  });
});
