import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../../../test/utils';
import * as menuApi from './api';
import { useMenus, useMenuTree, useDeleteMenu } from './hooks';

vi.mock('./api', () => ({
  getMenus: vi.fn(),
  getMenuTree: vi.fn(),
  createMenu: vi.fn(),
  updateMenu: vi.fn(),
  deleteMenu: vi.fn(),
}));

describe('useMenus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch menus', async () => {
    const mockMenus = [{ id: '1', name: 'Dashboard', type: 'MENU' as const, sort: 0, isVisible: true, createdAt: '2025-06-01 10:00:00', updatedAt: '2025-06-01 10:00:00' }];
    vi.mocked(menuApi.getMenus).mockResolvedValue(mockMenus);

    const { result } = renderHook(() => useMenus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
  });
});

describe('useMenuTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch menu tree', async () => {
    const mockTree = [{ id: '1', name: 'System', type: 'DIRECTORY' as const, sort: 0, isVisible: true, children: [], createdAt: '2025-06-01 10:00:00', updatedAt: '2025-06-01 10:00:00' }];
    vi.mocked(menuApi.getMenuTree).mockResolvedValue(mockTree);

    const { result } = renderHook(() => useMenuTree(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].name).toBe('System');
  });
});

describe('useDeleteMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a menu', async () => {
    vi.mocked(menuApi.deleteMenu).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteMenu(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('menu-id');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(menuApi.deleteMenu).toHaveBeenCalledWith('menu-id', expect.anything());
  });
});
