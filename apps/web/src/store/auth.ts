import { create } from 'zustand';
import type { ProfileResponse } from '@nebula/shared/schemas';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/api/token';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: ProfileResponse | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: ProfileResponse | null) => void;
  clearAuth: () => void;
  syncFromStorage: () => void;
}

function getInitialAuthState(): Pick<
  AuthState,
  'accessToken' | 'refreshToken' | 'user' | 'isAuthenticated'
> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  return {
    accessToken,
    refreshToken,
    user: null,
    isAuthenticated: accessToken !== null,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialAuthState(),
  setTokens: (accessToken, refreshToken) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    set({
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },
  setUser: (user) => {
    set({ user });
  },
  clearAuth: () => {
    clearTokens();
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
  syncFromStorage: () => {
    set(getInitialAuthState());
  },
}));
