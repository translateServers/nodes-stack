import { create } from 'zustand';

interface UiState {
  mobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileSidebarOpen: false,
  toggleMobileSidebar: () => {
    set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen }));
  },
  closeMobileSidebar: () => {
    set({ mobileSidebarOpen: false });
  },
}));
