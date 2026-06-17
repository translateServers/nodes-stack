import { useMutation, useQuery } from '@tanstack/react-query';
import * as menuApi from './api';

export function useMenus() {
  return useQuery({
    queryKey: ['menus'],
    queryFn: menuApi.getMenus,
  });
}

export function useMenuTree() {
  return useQuery({
    queryKey: ['menus', 'tree'],
    queryFn: menuApi.getMenuTree,
  });
}

export function useCreateMenu() {
  return useMutation({
    mutationFn: menuApi.createMenu,
  });
}

export function useUpdateMenu() {
  return useMutation({
    mutationFn: ({
      id,
      params,
    }: {
      id: string;
      params: Parameters<typeof menuApi.updateMenu>[1];
    }) => menuApi.updateMenu(id, params),
  });
}

export function useDeleteMenu() {
  return useMutation({
    mutationFn: menuApi.deleteMenu,
  });
}
