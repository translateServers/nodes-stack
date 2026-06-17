import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../../../test/utils';
import * as authApi from './api';
import { useCaptcha, useProfile } from './hooks';
import { useAuthStore } from '@/store/auth';

vi.mock('./api', () => ({
  getCaptcha: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
}));

describe('useCaptcha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch captcha', async () => {
    const mockCaptcha = { captchaId: 'id-1', captchaImage: '<svg></svg>' };
    vi.mocked(authApi.getCaptcha).mockResolvedValue(mockCaptcha);

    const { result } = renderHook(() => useCaptcha(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.captchaId).toBe('id-1');
  });
});

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('should not fetch when no access token', () => {
    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(authApi.getProfile).not.toHaveBeenCalled();
  });

  it('should fetch profile when access token exists', async () => {
    useAuthStore.getState().setTokens('token', 'refresh');

    const mockProfile = { id: '1', email: 'test@test.com', username: 'test', name: 'Test' };
    vi.mocked(authApi.getProfile).mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.username).toBe('test');
  });
});
