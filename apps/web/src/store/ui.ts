import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ── State ──────────────────────────────────────────────
interface UiData {
  mobileSidebarOpen: boolean;
}

// ── Actions ────────────────────────────────────────────
interface UiActions {
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

// ── Store ──────────────────────────────────────────────
export type UiState = UiData & UiActions;

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      mobileSidebarOpen: false,

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
    }),
    { name: 'UiStore' },
  ),
);
