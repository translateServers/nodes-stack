import { useQuery } from '@tanstack/react-query';
import * as healthApi from './api';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: healthApi.checkHealth,
    refetchInterval: 30_000,
  });
}
