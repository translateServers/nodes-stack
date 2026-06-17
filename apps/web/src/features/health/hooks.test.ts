import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../../../test/utils';
import * as healthApi from './api';
import { useHealth } from './hooks';

vi.mock('./api', () => ({
  checkHealth: vi.fn(),
}));

describe('useHealth', () => {
  it('should fetch health data', async () => {
    vi.mocked(healthApi.checkHealth).mockResolvedValue({
      status: 'ok',
      timestamp: '2025-06-01T10:00:00Z',
      uptime: 1234,
      database: 'connected',
    });

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.status).toBe('ok');
  });

  it('should handle error', async () => {
    vi.mocked(healthApi.checkHealth).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Network error');
  });
});
