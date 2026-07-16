import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ScreenProject, ScreenComponent, CanvasConfig } from '@nebula/shared';

interface ScreenEditorData {
  project: ScreenProject | null;
  selectedComponentId: string | null;
  canvasScale: number;
}

interface ScreenEditorActions {
  loadProject: (project: ScreenProject) => void;
  selectComponent: (id: string | null) => void;
  addComponent: (component: ScreenComponent) => void;
  updateComponent: (id: string, updates: Partial<ScreenComponent>) => void;
  removeComponent: (id: string) => void;
  updateCanvas: (updates: Partial<CanvasConfig>) => void;
  setCanvasScale: (scale: number) => void;
  reorderComponent: (id: string, newZIndex: number) => void;
  getProject: () => ScreenProject | null;
}

export type ScreenEditorState = ScreenEditorData & ScreenEditorActions;

const initialData: ScreenEditorData = {
  project: null,
  selectedComponentId: null,
  canvasScale: 1,
};

export const useScreenEditorStore = create<ScreenEditorState>()(
  devtools(
    (set, get) => ({
      ...initialData,

      loadProject: (project) => {
        set({ project, selectedComponentId: null }, false, 'loadProject');
      },

      selectComponent: (id) => {
        set({ selectedComponentId: id }, false, 'selectComponent');
      },

      addComponent: (component) => {
        set(
          (state) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: [...state.project.components, component],
              },
            };
          },
          false,
          'addComponent',
        );
      },

      updateComponent: (id, updates) => {
        set(
          (state) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c) =>
                  c.id === id ? { ...c, ...updates } : c,
                ),
              },
            };
          },
          false,
          'updateComponent',
        );
      },

      removeComponent: (id) => {
        set(
          (state) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.filter((c) => c.id !== id),
              },
              selectedComponentId:
                state.selectedComponentId === id ? null : state.selectedComponentId,
            };
          },
          false,
          'removeComponent',
        );
      },

      updateCanvas: (updates) => {
        set(
          (state) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                canvas: { ...state.project.canvas, ...updates },
              },
            };
          },
          false,
          'updateCanvas',
        );
      },

      setCanvasScale: (scale) => {
        set({ canvasScale: scale }, false, 'setCanvasScale');
      },

      reorderComponent: (id, newZIndex) => {
        set(
          (state) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c) =>
                  c.id === id ? { ...c, zIndex: newZIndex } : c,
                ),
              },
            };
          },
          false,
          'reorderComponent',
        );
      },

      getProject: () => get().project,
    }),
    { name: 'ScreenEditorStore' },
  ),
);
