import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('should have correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set tokens and mark as authenticated', () => {
    useAuthStore.getState().setTokens('access-123', 'refresh-456');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-123');
    expect(state.refreshToken).toBe('refresh-456');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should set user', () => {
    const user = { id: '1', email: 'test@test.com', username: 'test', name: 'Test' };
    useAuthStore.getState().setUser(user);

    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('should clear auth state', () => {
    useAuthStore.getState().setTokens('a', 'r');
    useAuthStore.getState().setUser({ id: '1', email: 'e', username: 'u', name: 'n' });
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set user to null', () => {
    useAuthStore.getState().setUser({ id: '1', email: 'e', username: 'u', name: 'n' });
    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().user).toBeNull();
  });
});
