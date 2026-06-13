import { BizCode, isBusinessError } from '@nebula/shared';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { emitApiError } from '@/api/api-error';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      emitApiError(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      emitApiError(error);
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isBusinessError(error) && error.code === BizCode.UNAUTHORIZED) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
