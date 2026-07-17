import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ScreenProject, ScreenComponent, CanvasConfig } from '@nebula/shared';

interface HistoryState {
  past: ScreenComponent[][];
  future: ScreenComponent[][];
}

interface GuidesState {
  /** 垂直参考线 x 坐标（画布坐标系） */
  vertical: number[];
  /** 水平参考线 y 坐标（画布坐标系） */
  horizontal: number[];
  visible: boolean;
  locked: boolean;
}

interface ScreenEditorData {
  project: ScreenProject | null;
  selectedComponentIds: string[];
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  showBorderGuides: boolean;
  guides: GuidesState;
  history: HistoryState;
  /** 剪贴板（不入历史栈），保存最近一次复制的组件深拷贝 */
  clipboard: ScreenComponent[] | null;
  /** 粘贴次数计数器，用于累加偏移避免重叠 */
  pasteCount: number;
  /** 吸附开关：控制 Moveable 的 snappable 行为（会话级，不持久化） */
  snapEnabled: boolean;
  /**
   * 原生事件触发开关：编辑模式下是否允许组件触发原生 onClick/onHover 等事件。
   * 默认关闭（编辑模式下仅响应拖拽/选中），开启时用于调试组件交互。
   */
  nativeEventEnabled: boolean;
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
  addGuide: (orientation: 'vertical' | 'horizontal', position: number) => void;
  updateGuide: (orientation: 'vertical' | 'horizontal', index: number, position: number) => void;
  removeGuide: (orientation: 'vertical' | 'horizontal', index: number) => void;
  clearGuides: () => void;
  toggleGuidesVisibility: () => void;
  toggleGuidesLock: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getProject: () => ScreenProject | null;
  getSelectedComponents: () => ScreenComponent[];

  /** 复制选中组件到内存剪贴板（不入历史栈） */
  copySelectedToClipboard: () => void;
  /** 从内存剪贴板粘贴（入历史栈，每次偏移累加 20px） */
  pasteFromClipboard: () => void;
  /** 水平对齐选中组件（至少 2 个） */
  alignSelectedHorizontal: (alignment: 'left' | 'center' | 'right') => void;
  /** 垂直对齐选中组件（至少 2 个） */
  alignSelectedVertical: (alignment: 'top' | 'middle' | 'bottom') => void;
  /** 水平等距分布选中组件（至少 3 个） */
  distributeSelectedHorizontal: () => void;
  /** 垂直等距分布选中组件（至少 3 个） */
  distributeSelectedVertical: () => void;
  /** 成组：为选中组件赋值虚拟 parentId（骨架阶段不渲染组容器） */
  groupSelected: () => void;
  /** 解组：清除选中组件的 parentId */
  ungroupSelected: () => void;
  /** 切换吸附开关 */
  toggleSnap: () => void;
  /** 切换原生事件触发开关 */
  toggleNativeEvent: () => void;
}

export type ScreenEditorState = ScreenEditorData & ScreenEditorActions;

const HISTORY_LIMIT = 50;

const initialData: ScreenEditorData = {
  project: null,
  selectedComponentIds: [],
  canvasScale: 1,
  canvasOffset: { x: 0, y: 0 },
  showBorderGuides: false,
  guides: { vertical: [], horizontal: [], visible: true, locked: false },
  history: { past: [], future: [] },
  clipboard: null,
  pasteCount: 0,
  snapEnabled: true,
  nativeEventEnabled: false,
};

function pushHistory(set: (fn: (state: ScreenEditorState) => Partial<ScreenEditorState>) => void) {
  set((state: ScreenEditorState) => {
    if (!state.project) return {};
    return {
      history: {
        // 浅拷贝即可：store 内所有 update 操作均为 immutable（用展开符产生新对象/新数组），
        // 不会原地修改 component 对象，因此旧数组及其内部引用始终保留历史快照语义。
        // 改用浅拷贝避免大组件树深拷贝（structuredClone）带来的性能开销。
        past: [...state.history.past, [...state.project.components]].slice(-HISTORY_LIMIT),
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

      addGuide: (orientation, position) => {
        set(
          (state: ScreenEditorState) => ({
            guides: {
              ...state.guides,
              [orientation]: [...state.guides[orientation], position].sort((a, b) => a - b),
            },
          }),
          false,
          'addGuide',
        );
      },

      updateGuide: (orientation, index, position) => {
        set(
          (state: ScreenEditorState) => {
            const list = [...state.guides[orientation]];
            if (index < 0 || index >= list.length) return {};
            list[index] = position;
            list.sort((a, b) => a - b);
            return { guides: { ...state.guides, [orientation]: list } };
          },
          false,
          'updateGuide',
        );
      },

      removeGuide: (orientation, index) => {
        set(
          (state: ScreenEditorState) => ({
            guides: {
              ...state.guides,
              [orientation]: state.guides[orientation].filter((_, i) => i !== index),
            },
          }),
          false,
          'removeGuide',
        );
      },

      clearGuides: () => {
        set(
          (state: ScreenEditorState) => ({
            guides: { ...state.guides, vertical: [], horizontal: [] },
          }),
          false,
          'clearGuides',
        );
      },

      toggleGuidesVisibility: () => {
        set(
          (state: ScreenEditorState) => ({
            guides: { ...state.guides, visible: !state.guides.visible },
          }),
          false,
          'toggleGuidesVisibility',
        );
      },

      toggleGuidesLock: () => {
        set(
          (state: ScreenEditorState) => ({
            guides: { ...state.guides, locked: !state.guides.locked },
          }),
          false,
          'toggleGuidesLock',
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
              // 浅拷贝当前 components 存入 future（同 pushHistory 的immutable前提）
              future: [[...(state.project?.components ?? [])], ...state.history.future],
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
              past: [...state.history.past, [...(state.project?.components ?? [])]],
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

      copySelectedToClipboard: () => {
        const selected = get().getSelectedComponents();
        if (selected.length === 0) return;
        // 深拷贝避免后续修改剪贴板内容影响已粘贴的组件
        set(
          { clipboard: structuredClone(selected), pasteCount: 0 },
          false,
          'copySelectedToClipboard',
        );
      },

      pasteFromClipboard: () => {
        const { clipboard, pasteCount, project } = get();
        if (!clipboard || clipboard.length === 0 || !project) return;
        pushHistory(set);
        // 每次粘贴偏移累加 20px，避免连续粘贴重叠
        const offset = (pasteCount + 1) * 20;
        const newComponents: ScreenComponent[] = clipboard.map((c: ScreenComponent) => ({
          ...structuredClone(c),
          id: crypto.randomUUID(),
          name: c.name,
          position: {
            ...c.position,
            x: c.position.x + offset,
            y: c.position.y + offset,
          },
        }));
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: [...state.project.components, ...newComponents],
              },
              selectedComponentIds: newComponents.map((c: ScreenComponent) => c.id),
              pasteCount: state.pasteCount + 1,
            };
          },
          false,
          'pasteFromClipboard',
        );
      },

      alignSelectedHorizontal: (alignment) => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length < 2 || !project) return;
        const idSet = new Set(selectedComponentIds);
        const selected = project.components.filter((c: ScreenComponent) => idSet.has(c.id));
        if (selected.length < 2) return;

        const xs = selected.map((c: ScreenComponent) => c.position.x);
        const rights = selected.map((c: ScreenComponent) => c.position.x + c.position.width);
        const minX = Math.min(...xs);
        const maxRight = Math.max(...rights);
        const centerX = (minX + maxRight) / 2;

        const updates = selected.map((c: ScreenComponent) => {
          let x: number;
          if (alignment === 'left') x = minX;
          else if (alignment === 'right') x = maxRight - c.position.width;
          else x = centerX - c.position.width / 2;
          return {
            id: c.id,
            changes: { position: { ...c.position, x: Math.round(x) } },
          };
        });
        // updateComponentsBatch 内部已 pushHistory
        get().updateComponentsBatch(updates);
      },

      alignSelectedVertical: (alignment) => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length < 2 || !project) return;
        const idSet = new Set(selectedComponentIds);
        const selected = project.components.filter((c: ScreenComponent) => idSet.has(c.id));
        if (selected.length < 2) return;

        const ys = selected.map((c: ScreenComponent) => c.position.y);
        const bottoms = selected.map((c: ScreenComponent) => c.position.y + c.position.height);
        const minY = Math.min(...ys);
        const maxBottom = Math.max(...bottoms);
        const centerY = (minY + maxBottom) / 2;

        const updates = selected.map((c: ScreenComponent) => {
          let y: number;
          if (alignment === 'top') y = minY;
          else if (alignment === 'bottom') y = maxBottom - c.position.height;
          else y = centerY - c.position.height / 2;
          return {
            id: c.id,
            changes: { position: { ...c.position, y: Math.round(y) } },
          };
        });
        get().updateComponentsBatch(updates);
      },

      distributeSelectedHorizontal: () => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length < 3 || !project) return;
        const idSet = new Set(selectedComponentIds);
        const selected = project.components
          .filter((c: ScreenComponent) => idSet.has(c.id))
          .sort((a: ScreenComponent, b: ScreenComponent) => a.position.x - b.position.x);
        if (selected.length < 3) return;

        const first = selected[0];
        const last = selected[selected.length - 1];
        const minX = first.position.x;
        const maxRight = last.position.x + last.position.width;
        const totalWidth = selected.reduce(
          (sum: number, c: ScreenComponent) => sum + c.position.width,
          0,
        );
        const gap = (maxRight - minX - totalWidth) / (selected.length - 1);

        let cursor = minX;
        const updates = selected.map((c: ScreenComponent) => {
          const newX = cursor;
          cursor += c.position.width + gap;
          return {
            id: c.id,
            changes: { position: { ...c.position, x: Math.round(newX) } },
          };
        });
        get().updateComponentsBatch(updates);
      },

      distributeSelectedVertical: () => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length < 3 || !project) return;
        const idSet = new Set(selectedComponentIds);
        const selected = project.components
          .filter((c: ScreenComponent) => idSet.has(c.id))
          .sort((a: ScreenComponent, b: ScreenComponent) => a.position.y - b.position.y);
        if (selected.length < 3) return;

        const first = selected[0];
        const last = selected[selected.length - 1];
        const minY = first.position.y;
        const maxBottom = last.position.y + last.position.height;
        const totalHeight = selected.reduce(
          (sum: number, c: ScreenComponent) => sum + c.position.height,
          0,
        );
        const gap = (maxBottom - minY - totalHeight) / (selected.length - 1);

        let cursor = minY;
        const updates = selected.map((c: ScreenComponent) => {
          const newY = cursor;
          cursor += c.position.height + gap;
          return {
            id: c.id,
            changes: { position: { ...c.position, y: Math.round(newY) } },
          };
        });
        get().updateComponentsBatch(updates);
      },

      groupSelected: () => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length < 2 || !project) return;
        pushHistory(set);
        const groupId = `group-${crypto.randomUUID()}`;
        const idSet = new Set(selectedComponentIds);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  idSet.has(c.id) ? { ...c, parentId: groupId } : c,
                ),
              },
            };
          },
          false,
          'groupSelected',
        );
      },

      ungroupSelected: () => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length === 0 || !project) return;
        pushHistory(set);
        const idSet = new Set(selectedComponentIds);
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return state;
            return {
              project: {
                ...state.project,
                components: state.project.components.map((c: ScreenComponent) =>
                  idSet.has(c.id) ? { ...c, parentId: null } : c,
                ),
              },
            };
          },
          false,
          'ungroupSelected',
        );
      },

      toggleSnap: () => {
        set(
          (state: ScreenEditorState) => ({ snapEnabled: !state.snapEnabled }),
          false,
          'toggleSnap',
        );
      },

      toggleNativeEvent: () => {
        set(
          (state: ScreenEditorState) => ({
            nativeEventEnabled: !state.nativeEventEnabled,
          }),
          false,
          'toggleNativeEvent',
        );
      },
    }),
    { name: 'ScreenEditorStore' },
  ),
);
