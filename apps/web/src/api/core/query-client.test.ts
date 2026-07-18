import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BizCode, BusinessError } from '@nebula/shared';
import { useMutation, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';

// emitApiError 必须在 query-client 模块加载前被 mock，
// 否则 query-client 顶层会绑定真实实现。
vi.mock('./api-error', () => ({
  emitApiError: vi.fn(),
}));

import { queryClient } from './query-client';
import { emitApiError } from './api-error';

describe('queryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    queryClient.getMutationCache().clear();
  });

  describe('defaultOptions.queries.retry', () => {
    const retryFn = queryClient.getDefaultOptions().queries?.retry as
      | ((failureCount: number, error: unknown) => boolean)
      | undefined;

    it('retry 应为函数', () => {
      expect(typeof retryFn).toBe('function');
    });

    it('UNAUTHORIZED BusinessError 不重试（任何 failureCount）', () => {
      const fn = retryFn as (f: number, e: unknown) => boolean;
      const error = new BusinessError(BizCode.UNAUTHORIZED, '未授权');
      expect(fn(0, error)).toBe(false);
      expect(fn(1, error)).toBe(false);
      expect(fn(2, error)).toBe(false);
    });

    it('非 UNAUTHORIZED 的 BusinessError 在 failureCount<2 时重试', () => {
      const fn = retryFn as (f: number, e: unknown) => boolean;
      const error = new BusinessError(BizCode.NOT_FOUND, '不存在');
      expect(fn(0, error)).toBe(true);
      expect(fn(1, error)).toBe(true);
    });

    it('非 UNAUTHORIZED 的 BusinessError 在 failureCount>=2 时不重试', () => {
      const fn = retryFn as (f: number, e: unknown) => boolean;
      const error = new BusinessError(BizCode.NOT_FOUND, '不存在');
      expect(fn(2, error)).toBe(false);
      expect(fn(3, error)).toBe(false);
    });

    it('普通 Error 在 failureCount<2 时重试', () => {
      const fn = retryFn as (f: number, e: unknown) => boolean;
      const error = new Error('网络异常');
      expect(fn(0, error)).toBe(true);
      expect(fn(1, error)).toBe(true);
    });

    it('普通 Error 在 failureCount>=2 时不重试', () => {
      const fn = retryFn as (f: number, e: unknown) => boolean;
      const error = new Error('网络异常');
      expect(fn(2, error)).toBe(false);
    });
  });

  describe('defaultOptions.mutations.retry', () => {
    it('mutations 不重试（retry=0）', () => {
      expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0);
    });
  });

  describe('defaultOptions.queries 其他默认项', () => {
    it('staleTime=30_000', () => {
      expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(30_000);
    });

    it('refetchOnWindowFocus=false', () => {
      expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
    });
  });

  describe('QueryCache.onError', () => {
    it('query 失败时调用 emitApiError', async () => {
      const error = new BusinessError(BizCode.NOT_FOUND, '不存在');

      await expect(
        queryClient.fetchQuery({
          queryKey: ['test-query-failure'],
          queryFn: () => Promise.reject(error),
          retry: false,
        }),
      ).rejects.toThrow();

      // cache.onError 是异步触发，等待 emitApiError 被调用
      await waitFor(() => {
        expect(emitApiError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('MutationCache.onError', () => {
    it('mutation 失败时调用 emitApiError', async () => {
      const error = new BusinessError(BizCode.NOT_FOUND, '不存在');

      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(
        () => useMutation({ mutationFn: () => Promise.reject(error) }),
        { wrapper },
      );

      result.current.mutate(undefined);

      await waitFor(() => {
        expect(emitApiError).toHaveBeenCalledWith(error);
      });
    });
  });
});
