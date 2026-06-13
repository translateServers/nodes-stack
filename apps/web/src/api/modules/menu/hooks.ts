import { useQuery } from '@tanstack/react-query';
import * as menuApi from './api';

export function useMenus() {
  return useQuery({
    queryKey: ['menus'],
    queryFn: menuApi.getMenus,
  });
}
