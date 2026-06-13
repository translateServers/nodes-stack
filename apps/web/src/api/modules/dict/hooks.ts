import { useQuery } from '@tanstack/react-query';
import * as dictApi from './api';

export function useDictTypes() {
  return useQuery({
    queryKey: ['dict-types'],
    queryFn: dictApi.getDictTypes,
  });
}

export function useDictValues(typeCode: string) {
  return useQuery({
    queryKey: ['dict-values', typeCode],
    queryFn: () => dictApi.getDictValues(typeCode),
    enabled: Boolean(typeCode),
  });
}
