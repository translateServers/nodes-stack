import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ProfileResponse } from '@nebula/shared';

// ── State ──────────────────────────────────────────────
interface AuthData {
  accessToken: string | null;
  refreshToken: string | null;
  user: ProfileResponse | null;
  isAuthenticated: boolean;
}

// ── Actions ────────────────────────────────────────────
interface AuthActions {
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: ProfileResponse | null) => void;
  clearAuth: () => void;
}

// ── Store ──────────────────────────────────────────────
export type AuthState = AuthData & AuthActions;

const initialData: AuthData = {
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        ...initialData,

        setTokens: (accessToken, refreshToken) => {
          set({ accessToken, refreshToken, isAuthenticated: true }, false, 'setTokens');
        },

        setUser: (user) => {
          set({ user }, false, 'setUser');
        },

        clearAuth: () => {
          set({ ...initialData }, false, 'clearAuth');
        },
      }),
      {
        name: 'nebula-auth',
        partialize: (state) => ({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        }),
        onRehydrateStorage: () => (state) => {
          if (state?.accessToken) {
            state.isAuthenticated = true;
          }
        },
      },
    ),
    { name: 'AuthStore' },
  ),
);
