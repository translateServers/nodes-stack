import { useQuery } from '@tanstack/react-query';
import * as roleApi from './api';

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: roleApi.getRoles,
  });
}
