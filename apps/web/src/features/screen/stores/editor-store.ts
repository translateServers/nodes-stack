import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ScreenProject, ScreenComponent, CanvasConfig } from '@nebula/shared';

interface HistoryState {
  past: ScreenComponent[][];
  future: ScreenComponent[][];
}

interface ScreenEditorData {
  project: ScreenProject | null;
  selectedComponentIds: string[];
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  showBorderGuides: boolean;
  history: HistoryState;
}

interface ScreenEditorActions {
  loadProject: (project: ScreenProject) => void;
  selectComponent: (id: string | null) => void;
  selectComponents: (ids: string[]) => void;
  clearSelection: () => void;
  addComponent: (component: ScreenComponent) => void;
  updateComponent: (id: string, updates: Partial<ScreenComponent>) => void;
  updateComponentsBatch: (
    updates: Array<{ id: string; changes: Partial<ScreenComponent> }>,
  ) => void;
  removeComponent: (id: string) => void;
  removeSelectedComponents: () => void;
  updateCanvas: (updates: Partial<CanvasConfig>) => void;
  setCanvasScale: (scale: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  setCanvasScaleAndOffset: (scale: number, offset: { x: number; y: number }) => void;
  resetViewport: () => void;
  reorderComponent: (id: string, newZIndex: number) => void;
  reorderToTop: (id: string) => void;
  reorderToBottom: (id: string) => void;
  duplicateSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  setLocked: (ids: string[], locked: boolean) => void;
  setHidden: (ids: string[], hidden: boolean) => void;
  toggleBorderGuides: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getProject: () => ScreenProject | null;
  getSelectedComponents: () => ScreenComponent[];
}

export type ScreenEditorState = ScreenEditorData & ScreenEditorActions;

const HISTORY_LIMIT = 50;

const initialData: ScreenEditorData = {
  project: null,
  selectedComponentIds: [],
  canvasScale: 1,
  canvasOffset: { x: 0, y: 0 },
  showBorderGuides: false,
  history: { past: [], future: [] },
};

function pushHistory(set: (fn: (state: ScreenEditorState) => Partial<ScreenEditorState>) => void) {
  set((state: ScreenEditorState) => {
    if (!state.project) return {};
    return {
      history: {
        past: [...state.history.past, structuredClone(state.project.components)].slice(
          -HISTORY_LIMIT,
        ),
        future: [],
      },
    };
  });
}

export const useScreenEditorStore = create<ScreenEditorState>()(
  devtools(
    (set, get) => ({
      ...initialData,

      loadProject: (project) => {
        set(
          {
            project,
            selectedComponentIds: [],
            history: { past: [], future: [] },
          },
          false,
          'loadProject',
        );
      },

      selectComponent: (id) => {
        set({ selectedComponentIds: id ? [id] : [] }, false, 'selectComponent');
      },

      selectComponents: (ids) => {
        set({ selectedComponentIds: ids }, false, 'selectComponents');
      },

      clearSelection: () => {
        set({ selectedComponentIds: [] }, false, 'clearSelection');
      },

      addComponent: (component) => {
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
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
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  c.id === id ? { ...c, ...updates } : c,
                ),
              },
            };
          },
          false,
          'updateComponent',
        );
      },

      updateComponentsBatch: (updates) => {
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            const updateMap = new Map(
              updates.map((u: { id: string; changes: Partial<ScreenComponent> }) => [
                u.id,
                u.changes,
              ]),
            );
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) => {
                  const changes = updateMap.get(c.id);
                  return changes ? { ...c, ...changes } : c;
                }),
              },
            };
          },
          false,
          'updateComponentsBatch',
        );
      },

      removeComponent: (id) => {
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.filter((c: ScreenComponent) => c.id !== id),
              },
              selectedComponentIds: state.selectedComponentIds.filter((sid: string) => sid !== id),
            };
          },
          false,
          'removeComponent',
        );
      },

      removeSelectedComponents: () => {
        const ids = get().selectedComponentIds;
        if (ids.length === 0) return;
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            const idSet = new Set(ids);
            return {
              project: {
                ...state.project,
                components: state.project.components.filter(
                  (c: ScreenComponent) => !idSet.has(c.id),
                ),
              },
              selectedComponentIds: [],
            };
          },
          false,
          'removeSelectedComponents',
        );
      },

      updateCanvas: (updates) => {
        set(
          (state: ScreenEditorState) => {
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

      setCanvasOffset: (offset) => {
        set({ canvasOffset: offset }, false, 'setCanvasOffset');
      },

      setCanvasScaleAndOffset: (scale, offset) => {
        set({ canvasScale: scale, canvasOffset: offset }, false, 'setCanvasScaleAndOffset');
      },

      resetViewport: () => {
        set({ canvasScale: 1, canvasOffset: { x: 0, y: 0 } }, false, 'resetViewport');
      },

      reorderComponent: (id, newZIndex) => {
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  c.id === id ? { ...c, zIndex: newZIndex } : c,
                ),
              },
            };
          },
          false,
          'reorderComponent',
        );
      },

      reorderToTop: (id) => {
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            const maxZ = state.project.components.reduce(
              (max: number, c: ScreenComponent) => Math.max(max, c.zIndex),
              0,
            );
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  c.id === id ? { ...c, zIndex: maxZ + 1 } : c,
                ),
              },
            };
          },
          false,
          'reorderToTop',
        );
      },

      reorderToBottom: (id) => {
        pushHistory(set);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            const minZ = state.project.components.reduce(
              (min: number, c: ScreenComponent) => Math.min(min, c.zIndex),
              Number.POSITIVE_INFINITY,
            );
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  c.id === id ? { ...c, zIndex: minZ - 1 } : c,
                ),
              },
            };
          },
          false,
          'reorderToBottom',
        );
      },

      duplicateSelected: () => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length === 0 || !project) return;
        pushHistory(set);
        const selectedSet = new Set(selectedComponentIds);
        const newComponents: ScreenComponent[] = [];
        for (const c of project.components) {
          if (selectedSet.has(c.id)) {
            newComponents.push({
              ...structuredClone(c),
              id: crypto.randomUUID(),
              name: `${c.name} 副本`,
              position: { ...c.position, x: c.position.x + 20, y: c.position.y + 20 },
            });
          }
        }
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: [...state.project.components, ...newComponents],
              },
              selectedComponentIds: newComponents.map((c: ScreenComponent) => c.id),
            };
          },
          false,
          'duplicateSelected',
        );
      },

      nudgeSelected: (dx, dy) => {
        const { selectedComponentIds } = get();
        if (selectedComponentIds.length === 0) return;
        pushHistory(set);
        const idSet = new Set(selectedComponentIds);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  idSet.has(c.id) && !c.status.locked
                    ? {
                        ...c,
                        position: { ...c.position, x: c.position.x + dx, y: c.position.y + dy },
                      }
                    : c,
                ),
              },
            };
          },
          false,
          'nudgeSelected',
        );
      },

      setLocked: (ids, locked) => {
        pushHistory(set);
        const idSet = new Set(ids);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  idSet.has(c.id) ? { ...c, status: { ...c.status, locked } } : c,
                ),
              },
            };
          },
          false,
          'setLocked',
        );
      },

      setHidden: (ids, hidden) => {
        pushHistory(set);
        const idSet = new Set(ids);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  idSet.has(c.id) ? { ...c, status: { ...c.status, hidden } } : c,
                ),
              },
            };
          },
          false,
          'setHidden',
        );
      },

      toggleBorderGuides: () => {
        set(
          (state: ScreenEditorState) => ({ showBorderGuides: !state.showBorderGuides }),
          false,
          'toggleBorderGuides',
        );
      },

      undo: () => {
        const { history, project } = get();
        if (history.past.length === 0 || !project) return;
        const previous = history.past[history.past.length - 1];
        set(
          (state: ScreenEditorState) => ({
            project: state.project ? { ...state.project, components: previous } : state.project,
            selectedComponentIds: [],
            history: {
              past: state.history.past.slice(0, -1),
              future: [structuredClone(state.project?.components ?? []), ...state.history.future],
            },
          }),
          false,
          'undo',
        );
      },

      redo: () => {
        const { history, project } = get();
        if (history.future.length === 0 || !project) return;
        const next = history.future[0];
        set(
          (state: ScreenEditorState) => ({
            project: state.project ? { ...state.project, components: next } : state.project,
            selectedComponentIds: [],
            history: {
              past: [...state.history.past, structuredClone(state.project?.components ?? [])],
              future: state.history.future.slice(1),
            },
          }),
          false,
          'redo',
        );
      },

      canUndo: () => get().history.past.length > 0,
      canRedo: () => get().history.future.length > 0,

      getProject: () => get().project,
      getSelectedComponents: () => {
        const { project, selectedComponentIds } = get();
        if (!project) return [];
        const idSet = new Set(selectedComponentIds);
        return project.components.filter((c: ScreenComponent) => idSet.has(c.id));
      },
    }),
    { name: 'ScreenEditorStore' },
  ),
);
