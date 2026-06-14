import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ── Theme ──────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ── State ──────────────────────────────────────────────
interface UiData {
  mobileSidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: Theme;
}

// ── Actions ────────────────────────────────────────────
interface UiActions {
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}

// ── Store ──────────────────────────────────────────────
export type UiState = UiData & UiActions;

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set) => ({
        mobileSidebarOpen: false,
        sidebarCollapsed: false,
        theme: 'system',

        toggleMobileSidebar: () => {
          set(
            (state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen }),
            false,
            'toggleMobileSidebar',
          );
        },
        closeMobileSidebar: () => {
          set({ mobileSidebarOpen: false }, false, 'closeMobileSidebar');
        },
        toggleSidebar: () => {
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }), false, 'toggleSidebar');
        },
        setTheme: (theme) => {
          applyTheme(theme);
          set({ theme }, false, 'setTheme');
        },
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            applyTheme(state.theme);
          }
        },
      },
    ),
    { name: 'UiStore' },
  ),
);

// Listen for system theme changes when theme is 'system'
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const state = useUiStore.getState();
    if (state.theme === 'system') {
      applyTheme('system');
    }
  });
}
