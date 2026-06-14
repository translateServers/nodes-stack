import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ── State ──────────────────────────────────────────────
interface UiData {
  mobileSidebarOpen: boolean;
  sidebarCollapsed: boolean;
}

// ── Actions ────────────────────────────────────────────
interface UiActions {
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleSidebar: () => void;
}

// ── Store ──────────────────────────────────────────────
export type UiState = UiData & UiActions;

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      mobileSidebarOpen: false,
      sidebarCollapsed: false,

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
    }),
    { name: 'UiStore' },
  ),
);
