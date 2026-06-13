import { create } from 'zustand';
import type { ProfileResponse } from '@nebula/shared';

const ACCESS_TOKEN_KEY = 'nebula_access_token';
const REFRESH_TOKEN_KEY = 'nebula_refresh_token';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: ProfileResponse | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: ProfileResponse | null) => void;
  clearAuth: () => void;
}

function readTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function writeTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function removeTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function createInitialState(): Pick<
  AuthState,
  'accessToken' | 'refreshToken' | 'user' | 'isAuthenticated'
> {
  const { accessToken, refreshToken } = readTokens();
  return {
    accessToken,
    refreshToken,
    user: null,
    isAuthenticated: accessToken !== null,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...createInitialState(),

  setTokens: (accessToken, refreshToken) => {
    writeTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  setUser: (user) => {
    set({ user });
  },

  clearAuth: () => {
    removeTokens();
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
