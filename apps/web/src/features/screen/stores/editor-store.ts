import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ScreenProject, ScreenComponent, CanvasConfig, EventBlueprint } from '@nebula/shared';

/**
 * 历史栈条目：组件数组 + 画布配置 + 事件蓝图的三重快照（任务 5.1）。
 * 撤销/重做时同步恢复三者，画布配置、组件编辑与蓝图编辑共享同一时间线。
 *
 * `blueprint` 为可选字段：旧快照（任务 5.1 前的历史栈）无此字段，
 * undo/redo 时按 undefined 处理，向后兼容。
 */
interface HistoryEntry {
  components: ScreenComponent[];
  canvas: CanvasConfig;
  blueprint?: EventBlueprint;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
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
   * 当前进入的分组 ID（"编辑模式"下选中的组）。
   * - null：未进入任何分组，单击组内组件会选中整个分组
   * - 设置为某 groupId：用户已双击进入该分组，此时单击组内子组件仅选中该组件；
   *   画布会用虚线包围盒高亮当前活动分组，Esc 或单击外部组件退出。
   * 参考 Figma 的 "Enter Frame" 行为。
   */
  activeGroupId: string | null;
  /**
   * 智能对齐线开关：拖拽组件时是否显示与其他组件的对齐辅助线（会话级，不持久化）。
   * 与 `snapEnabled` 独立 —— 关闭吸附仍可显示对齐线参考。
   */
  smartGuidesEnabled: boolean;
  /**
   * 网格吸附开关：开启后组件拖拽时吸附到 `gridSize` 整数倍坐标（会话级，不持久化）。
   * 与 `snapEnabled` / `smartGuidesEnabled` 独立 —— 互不影响。
   */
  gridEnabled: boolean;
  /**
   * 网格大小（px）：仅当 `gridEnabled` 为 true 时生效，控制吸附网格的间距。
   * 默认 10，常见取值 4/5/8/10/20。
   */
  gridSize: number;
  /**
   * UI 可见性开关：控制工具栏 / 侧边栏 / 属性面板等编辑器 UI 的显隐（会话级，不持久化）。
   * 用于 Tab 快捷键切换"全屏画布预览"模式（与 Photoshop 的 Tab 行为一致）。
   * 关闭时仅保留画布主体，便于专注预览；再次按 Tab 恢复。
   */
  uiVisible: boolean;
  /**
   * 屏幕模式（F 快捷键循环切换，会话级，不持久化）：
   * - `standard`：完整编辑器（工具栏 + 侧边栏 + 属性面板 + 状态栏）
   * - `withMenu`：仅保留顶部工具栏 + 画布（隐藏侧边栏 / 属性面板 / 状态栏）
   * - `fullscreen`：仅画布（无任何 UI 干扰，用于纯预览）
   * 与 `uiVisible` 独立 —— `uiVisible=false` 优先级更高，会强制隐藏所有 UI。
   */
  screenMode: 'standard' | 'withMenu' | 'fullscreen';
  /**
   * 编辑器本地脏状态：当前内容是否相对最后一次加载/保存响应发生变化。
   * - `loadProject` 时置为 false（包括首次加载和保存成功后回写）
   * - 任何修改 project 内容的操作（updateComponent / addComponent / undo 等）后置为 true
   * - 用于阻止未保存时直接发布（任务 8.3）
   * - 仅布尔标志，不做内容 diff，不进入历史栈
   */
  isDirty: boolean;
  /**
   * 蓝图编辑手势状态（任务 5.2）：标识一次连续编辑手势（如节点拖拽）。
   * - `active=true` 期间 `updateBlueprint` 只更新数据与脏标记，不入历史栈，
   *   避免拖拽过程每帧产生一条历史（"历史语义不膨胀"）。
   * - `baseline` 记录手势开始时的 blueprint，作为手势结束补入历史栈的快照，
   *   使 undo 能回到手势前的状态。
   * 不进入历史栈本身，仅作运行时标记。
   */
  blueprintGesture: { active: boolean; baseline: EventBlueprint | undefined };
}

interface ScreenEditorActions {
  loadProject: (project: ScreenProject) => void;
  /** 重命名项目（不入历史栈，仅置脏；名称随下次保存持久化） */
  renameProject: (name: string) => void;
  selectComponent: (id: string | null) => void;
  selectComponents: (ids: string[]) => void;
  clearSelection: () => void;
  addComponent: (component: ScreenComponent) => void;
  /** 重命名组件（入历史栈；trim 后为空或与原名相同则忽略） */
  renameComponent: (id: string, name: string) => void;
  updateComponent: (id: string, updates: Partial<ScreenComponent>) => void;
  updateComponentsBatch: (
    updates: Array<{ id: string; changes: Partial<ScreenComponent> }>,
  ) => void;
  removeComponent: (id: string) => void;
  removeSelectedComponents: () => void;
  updateCanvas: (updates: Partial<CanvasConfig>) => void;
  /**
   * 更新事件蓝图（任务 4.7/5.2）：写入 project.blueprint 并入历史栈。
   * - 传入 undefined 表示清除蓝图
   * - 无实际变化时不入栈也不置脏（与 updateCanvas 语义一致）
   * - 手势进行中（beginBlueprintGesture 后）只更新数据与脏标记，不入历史栈
   */
  updateBlueprint: (blueprint: EventBlueprint | undefined) => void;
  /**
   * 开始一次蓝图连续编辑手势（任务 5.2），如节点拖拽。
   * 手势期间的 `updateBlueprint` 调用合并为一次提交，避免每帧入栈。
   * 重复调用幂等（手势已激活时不重置 baseline）。
   */
  beginBlueprintGesture: () => void;
  /**
   * 结束蓝图编辑手势（任务 5.2）。
   * 若手势期间蓝图有净变化，则补入一条历史（快照为手势起点，undo 回到手势前）；
   * 无净变化则不产生空历史记录。未处于手势中时调用为空操作。
   */
  endBlueprintGesture: () => void;
  setCanvasScale: (scale: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  setCanvasScaleAndOffset: (scale: number, offset: { x: number; y: number }) => void;
  resetViewport: () => void;
  reorderComponent: (id: string, newZIndex: number) => void;
  /**
   * 拖拽重排图层顺序（Task 3.23）：将组件移到图层列表的指定位置（0 表示最顶层），
   * 内部重新分配 zIndex 保持连续整数。用于 dnd-kit 拖拽结束。
   */
  reorderLayerToIndex: (id: string, toIndex: number) => void;
  reorderToTop: (id: string) => void;
  reorderToBottom: (id: string) => void;
  duplicateSelected: () => void;
  /**
   * Alt+拖拽复制（适配表 #12）：复制选中组件到指定坐标，保持选中组件之间的相对位置。
   * 与 `duplicateSelected` 的差异：
   * - 副本不偏移 20px，而是整体平移到 (x, y)（以选中组件边界框左上角为基准）
   * - 用于 Alt+拖拽场景：拖拽结束时复制并放置到光标位置，原件保持原位
   * - 入历史栈
   */
  duplicateSelectedToPosition: (x: number, y: number) => void;
  /**
   * [/] 边框宽度调整（适配表 #18）：调整选中组件的 style.borderWidth，
   * 步长 1px，范围 [0, 20]；文本类型组件忽略（其渲染语义不依赖边框）。
   * 用于 [ / ] 快捷键绑定。
   */
  adjustBorderWidth: (delta: number) => void;
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
  /** 设置智能对齐线开关（接受显式 value，便于未来接入设置面板） */
  setSmartGuidesEnabled: (value: boolean) => void;
  /** 设置网格吸附开关（接受显式 value，便于未来接入设置面板） */
  setGridEnabled: (value: boolean) => void;
  /** 设置网格大小（建议 ≥ 1，调用方负责边界校验） */
  setGridSize: (size: number) => void;
  /** 切换 UI 显隐（Tab 快捷键） */
  toggleUI: () => void;
  /** 循环切换屏幕模式：standard → withMenu → fullscreen → standard（F 快捷键） */
  cycleScreenMode: () => void;
  /** 进入/退出分组编辑模式：设置 activeGroupId（双击进入分组） */
  setActiveGroupId: (groupId: string | null) => void;
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
  activeGroupId: null,
  smartGuidesEnabled: true,
  gridEnabled: false,
  gridSize: 10,
  uiVisible: true,
  screenMode: 'standard',
  isDirty: false,
  blueprintGesture: { active: false, baseline: undefined },
};

/**
 * Zustand set 函数类型（兼容 devtools actionName 标签）。
 * 收窄到 ScreenEditorState，避免在迁移过程中扩散 any。
 */
type ScreenEditorSet = (
  partial:
    | ScreenEditorState
    | Partial<ScreenEditorState>
    | ((state: ScreenEditorState) => ScreenEditorState | Partial<ScreenEditorState>),
  replace?: false,
  actionName?: string,
) => void;

function pushHistory(set: ScreenEditorSet): void {
  set((state: ScreenEditorState) => {
    if (!state.project) return {};
    return {
      history: {
        // 浅拷贝即可：store 内所有 update 操作均为 immutable（用展开符产生新对象/新数组），
        // 不会原地修改 component / canvas / blueprint 对象，因此旧引用始终保留历史快照语义。
        // 改用浅拷贝避免大组件树深拷贝（structuredClone）带来的性能开销。
        // blueprint 为可选字段：仅当当前 project.blueprint 存在时写入快照，
        // 旧快照（任务 5.1 前）没有此字段，undo/redo 时按 undefined 处理。
        past: [
          ...state.history.past,
          {
            components: [...state.project.components],
            canvas: { ...state.project.canvas },
            ...(state.project.blueprint ? { blueprint: { ...state.project.blueprint } } : {}),
          },
        ].slice(-HISTORY_LIMIT),
        future: [],
      },
    };
  });
}

/**
 * 高阶函数：将"推入历史栈 + 应用业务更新"两个步骤打包为单一调用。
 * 用于替代 editor-store 中所有 action 的 `pushHistory(set); set(updater, false, name);` 模式。
 *
 * 行为：
 * 1. 先调用 `pushHistory(set)`：把当前 `project.components` 与 `project.canvas` 快照推入
 *    `history.past`，并清空 `future`
 * 2. 再调用 `set(updater, false, actionName)`：应用业务更新，并在 devtools 中标记 actionName
 *
 * 脏状态：所有进入历史栈的修改操作均视为"相对最后加载/保存响应发生变化"，自动置 `isDirty=true`。
 * 不影响历史栈本身的行为（past / future 推入与清空逻辑不变）。
 *
 * 不迁移任何现有 action（仅提供 API，迁移见 Task 2.16–2.20）。
 *
 * @param set zustand set 函数（由 store creator 提供）
 * @param actionName devtools 中显示的 action 名称（用于调试）
 * @param updater 业务状态更新函数，返回部分 state
 */
export function withHistory(
  set: ScreenEditorSet,
  actionName: string,
  updater: (state: ScreenEditorState) => Partial<ScreenEditorState>,
): void {
  pushHistory(set);
  set((state: ScreenEditorState) => ({ ...updater(state), isDirty: true }), false, actionName);
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
            isDirty: false,
            // 加载新项目时重置蓝图手势，避免跨项目残留手势态
            blueprintGesture: { active: false, baseline: undefined },
          },
          false,
          'loadProject',
        );
      },

      renameProject: (name) => {
        const trimmed = name.trim();
        set(
          (state) => {
            if (!state.project || !trimmed || trimmed === state.project.name) return {};
            return {
              project: { ...state.project, name: trimmed },
              isDirty: true,
            };
          },
          false,
          'renameProject',
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
        withHistory(set, 'addComponent', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: [...state.project.components, component],
            },
          };
        });
      },

      renameComponent: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        withHistory(set, 'renameComponent', (state) => {
          if (!state.project) return {};
          const target = state.project.components.find((c) => c.id === id);
          if (!target || target.name === trimmed) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                c.id === id ? { ...c, name: trimmed } : c,
              ),
            },
          };
        });
      },

      updateComponent: (id, updates) => {
        withHistory(set, 'updateComponent', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                c.id === id ? { ...c, ...updates } : c,
              ),
            },
          };
        });
      },

      updateComponentsBatch: (updates) => {
        withHistory(set, 'updateComponentsBatch', (state) => {
          if (!state.project) return {};
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
        });
      },

      removeComponent: (id) => {
        withHistory(set, 'removeComponent', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.filter((c: ScreenComponent) => c.id !== id),
            },
            selectedComponentIds: state.selectedComponentIds.filter((sid: string) => sid !== id),
          };
        });
      },

      removeSelectedComponents: () => {
        const ids = get().selectedComponentIds;
        if (ids.length === 0) return;
        withHistory(set, 'removeSelectedComponents', (state) => {
          if (!state.project) return {};
          const idSet = new Set(ids);
          return {
            project: {
              ...state.project,
              components: state.project.components.filter((c: ScreenComponent) => !idSet.has(c.id)),
            },
            selectedComponentIds: [],
          };
        });
      },

      updateCanvas: (updates) => {
        const { project } = get();
        if (!project) return;
        // 无实际变化时不入栈也不置脏（任务 8.2/8.3：一次业务修改只产生一条历史，
        // 无变化提交不产生空历史记录或错误脏状态）
        const hasChange = (Object.keys(updates) as Array<keyof CanvasConfig>).some(
          (key) => updates[key] !== project.canvas[key],
        );
        if (!hasChange) return;
        withHistory(set, 'updateCanvas', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              canvas: { ...state.project.canvas, ...updates },
            },
          };
        });
      },

      updateBlueprint: (blueprint) => {
        const { project, blueprintGesture } = get();
        if (!project) return;
        // 无实际变化时不入栈也不置脏（与 updateCanvas 语义一致）
        // undefined === undefined 或同引用即无变化
        if (project.blueprint === blueprint) return;
        // 深比较：内容相同也不入栈（避免空提交）
        if (
          project.blueprint &&
          blueprint &&
          JSON.stringify(project.blueprint) === JSON.stringify(blueprint)
        ) {
          return;
        }
        // 手势进行中（任务 5.2）：只更新数据与脏标记，不入历史栈。
        // 拖拽等连续编辑会高频调用 updateBlueprint，合并到手势结束时统一入栈。
        if (blueprintGesture.active) {
          set(
            (state) => {
              if (!state.project) return {};
              return {
                project: { ...state.project, blueprint },
                isDirty: true,
              };
            },
            false,
            'updateBlueprintGesture',
          );
          return;
        }
        withHistory(set, 'updateBlueprint', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              blueprint,
            },
          };
        });
      },

      beginBlueprintGesture: () => {
        const { project, blueprintGesture } = get();
        // 无项目或手势已激活时幂等返回（不重置 baseline，保证嵌套/重复调用安全）
        if (!project || blueprintGesture.active) return;
        set(
          { blueprintGesture: { active: true, baseline: project.blueprint } },
          false,
          'beginBlueprintGesture',
        );
      },

      endBlueprintGesture: () => {
        const { project, blueprintGesture } = get();
        if (!blueprintGesture.active) return;
        const baseline = blueprintGesture.baseline;
        const current = project?.blueprint;
        // 先退出手势态，再决定是否补历史（避免补历史期间被误判为手势中）
        set(
          { blueprintGesture: { active: false, baseline: undefined } },
          false,
          'endBlueprintGesture',
        );
        if (!project) return;
        // 手势期间无净变化则不补历史（与"无变化不入栈"语义一致）
        const unchanged =
          baseline === current ||
          (baseline !== undefined &&
            current !== undefined &&
            JSON.stringify(baseline) === JSON.stringify(current));
        if (unchanged) return;
        // 补入一条历史：快照的 blueprint 取手势起点 baseline，使 undo 回到手势前；
        // 组件/画布取当前值（手势仅改动蓝图，二者在手势期间不变）。
        set(
          (state) => {
            if (!state.project) return {};
            return {
              history: {
                past: [
                  ...state.history.past,
                  {
                    components: [...state.project.components],
                    canvas: { ...state.project.canvas },
                    ...(baseline ? { blueprint: { ...baseline } } : {}),
                  },
                ].slice(-HISTORY_LIMIT),
                future: [],
              },
            };
          },
          false,
          'endBlueprintGestureCommit',
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
        withHistory(set, 'reorderComponent', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                c.id === id ? { ...c, zIndex: newZIndex } : c,
              ),
            },
          };
        });
      },

      reorderLayerToIndex: (id, toIndex) => {
        withHistory(set, 'reorderLayerToIndex', (state) => {
          if (!state.project) return {};
          // 仅在顶层组件（无 parentId）中重排，与 layer-panel 树结构一致
          const topLevel = state.project.components
            .filter((c: ScreenComponent) => !c.parentId)
            .sort((a: ScreenComponent, b: ScreenComponent) => b.zIndex - a.zIndex);
          const fromIdx = topLevel.findIndex((c) => c.id === id);
          if (fromIdx === -1) return {};
          const clampedTo = Math.max(0, Math.min(topLevel.length - 1, toIndex));
          if (fromIdx === clampedTo) return {};
          // 移除源并插入到目标位置
          const [moved] = topLevel.splice(fromIdx, 1);
          topLevel.splice(clampedTo, 0, moved);
          // 重新分配顶层 zIndex：index 0 = 最高 zIndex（与原 maxZ 对齐，避免越界）
          const maxZ = state.project.components.reduce(
            (max: number, c: ScreenComponent) => Math.max(max, c.zIndex),
            0,
          );
          const newZByCompId = new Map<string, number>();
          topLevel.forEach((c, idx) => newZByCompId.set(c.id, maxZ - idx));
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                newZByCompId.has(c.id) ? { ...c, zIndex: newZByCompId.get(c.id)! } : c,
              ),
            },
          };
        });
      },

      reorderToTop: (id) => {
        withHistory(set, 'reorderToTop', (state) => {
          if (!state.project) return {};
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
        });
      },

      reorderToBottom: (id) => {
        withHistory(set, 'reorderToBottom', (state) => {
          if (!state.project) return {};
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
        });
      },

      duplicateSelected: () => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length === 0 || !project) return;
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
        withHistory(set, 'duplicateSelected', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: [...state.project.components, ...newComponents],
            },
            selectedComponentIds: newComponents.map((c: ScreenComponent) => c.id),
          };
        });
      },

      duplicateSelectedToPosition: (x, y) => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length === 0 || !project) return;
        // M3 优化：用 Set 替代 Array.includes，O(N+M) → O(N)，避免组件数与选中数
        // 同时较多时的 O(N×M) 累积开销
        const selectedSet = new Set(selectedComponentIds);
        const selectedComps = project.components.filter((c) => selectedSet.has(c.id));
        if (selectedComps.length === 0) return;
        // 以选中组件边界框左上角为基准，整体平移到 (x, y)，保持组件间相对位置
        const minX = Math.min(...selectedComps.map((c) => c.position.x));
        const minY = Math.min(...selectedComps.map((c) => c.position.y));
        const offsetX = x - minX;
        const offsetY = y - minY;
        const newComponents: ScreenComponent[] = selectedComps.map((c) => ({
          ...structuredClone(c),
          id: crypto.randomUUID(),
          name: `${c.name} 副本`,
          position: { ...c.position, x: c.position.x + offsetX, y: c.position.y + offsetY },
        }));
        withHistory(set, 'duplicateSelectedToPosition', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: [...state.project.components, ...newComponents],
            },
            selectedComponentIds: newComponents.map((c: ScreenComponent) => c.id),
          };
        });
      },

      nudgeSelected: (dx, dy) => {
        const { selectedComponentIds } = get();
        if (selectedComponentIds.length === 0) return;
        const idSet = new Set(selectedComponentIds);
        withHistory(set, 'nudgeSelected', (state) => {
          if (!state.project) return {};
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
        });
      },

      adjustBorderWidth: (delta) => {
        const { selectedComponentIds } = get();
        if (selectedComponentIds.length === 0) return;
        const idSet = new Set(selectedComponentIds);
        withHistory(set, 'adjustBorderWidth', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) => {
                if (!idSet.has(c.id) || c.status.locked) return c;
                // 文本类型不依赖边框语义，忽略 [/] 调整
                if (c.type === 'text') return c;
                const current = c.style.borderWidth ?? 0;
                const next = Math.max(0, Math.min(20, current + delta));
                return {
                  ...c,
                  style: { ...c.style, borderWidth: next },
                };
              }),
            },
          };
        });
      },

      setLocked: (ids, locked) => {
        const idSet = new Set(ids);
        withHistory(set, 'setLocked', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                idSet.has(c.id) ? { ...c, status: { ...c.status, locked } } : c,
              ),
            },
          };
        });
      },

      setHidden: (ids, hidden) => {
        const idSet = new Set(ids);
        withHistory(set, 'setHidden', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                idSet.has(c.id) ? { ...c, status: { ...c.status, hidden } } : c,
              ),
            },
          };
        });
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
          (state: ScreenEditorState) => {
            if (!state.project) return {};
            return {
              project: {
                ...state.project,
                components: previous.components,
                canvas: previous.canvas,
                // blueprint 可选：旧快照无此字段时按 undefined 恢复（清空当前 blueprint）
                blueprint: previous.blueprint ? { ...previous.blueprint } : undefined,
              },
              selectedComponentIds: [],
              history: {
                past: state.history.past.slice(0, -1),
                // 浅拷贝当前快照存入 future（同 pushHistory 的 immutable 前提）
                future: [
                  {
                    components: [...state.project.components],
                    canvas: { ...state.project.canvas },
                    ...(state.project.blueprint
                      ? { blueprint: { ...state.project.blueprint } }
                      : {}),
                  },
                  ...state.history.future,
                ],
              },
              isDirty: true,
            };
          },
          false,
          'undo',
        );
      },

      redo: () => {
        const { history, project } = get();
        if (history.future.length === 0 || !project) return;
        const next = history.future[0];
        set(
          (state: ScreenEditorState) => {
            if (!state.project) return {};
            return {
              project: {
                ...state.project,
                components: next.components,
                canvas: next.canvas,
                // blueprint 可选：旧快照无此字段时按 undefined 恢复（清空当前 blueprint）
                blueprint: next.blueprint ? { ...next.blueprint } : undefined,
              },
              selectedComponentIds: [],
              history: {
                past: [
                  ...state.history.past,
                  {
                    components: [...state.project.components],
                    canvas: { ...state.project.canvas },
                    ...(state.project.blueprint
                      ? { blueprint: { ...state.project.blueprint } }
                      : {}),
                  },
                ],
                future: state.history.future.slice(1),
              },
              isDirty: true,
            };
          },
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
        withHistory(set, 'pasteFromClipboard', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: [...state.project.components, ...newComponents],
            },
            selectedComponentIds: newComponents.map((c: ScreenComponent) => c.id),
            pasteCount: state.pasteCount + 1,
          };
        });
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
        const groupId = `group-${crypto.randomUUID()}`;
        const idSet = new Set(selectedComponentIds);
        withHistory(set, 'groupSelected', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                idSet.has(c.id) ? { ...c, parentId: groupId } : c,
              ),
            },
          };
        });
      },

      ungroupSelected: () => {
        const { selectedComponentIds, project } = get();
        if (selectedComponentIds.length === 0 || !project) return;
        const idSet = new Set(selectedComponentIds);
        withHistory(set, 'ungroupSelected', (state) => {
          if (!state.project) return {};
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c: ScreenComponent) =>
                idSet.has(c.id) ? { ...c, parentId: null } : c,
              ),
            },
          };
        });
      },

      toggleSnap: () => {
        set(
          (state: ScreenEditorState) => ({ snapEnabled: !state.snapEnabled }),
          false,
          'toggleSnap',
        );
      },

      setSmartGuidesEnabled: (value) => {
        set({ smartGuidesEnabled: value }, false, 'setSmartGuidesEnabled');
      },

      setGridEnabled: (value) => {
        set({ gridEnabled: value }, false, 'setGridEnabled');
      },

      setGridSize: (size) => {
        set({ gridSize: size }, false, 'setGridSize');
      },

      toggleUI: () => {
        set((state: ScreenEditorState) => ({ uiVisible: !state.uiVisible }), false, 'toggleUI');
      },

      cycleScreenMode: () => {
        set(
          (state: ScreenEditorState) => ({
            screenMode:
              state.screenMode === 'standard'
                ? 'withMenu'
                : state.screenMode === 'withMenu'
                  ? 'fullscreen'
                  : 'standard',
          }),
          false,
          'cycleScreenMode',
        );
      },

      setActiveGroupId: (groupId) => {
        set({ activeGroupId: groupId }, false, 'setActiveGroupId');
      },
    }),
    { name: 'ScreenEditorStore' },
  ),
);

/**
 * E2E 测试辅助：在开发模式下将 store 暴露到 window，供 Playwright 通过 page.evaluate 直接调用
 * store actions（如 duplicateSelectedToPosition / reorderLayerToIndex）。
 * 仅在 import.meta.env.DEV 为 true 时生效，生产构建无副作用。
 */
declare global {
  interface Window {
    __screenEditorStore?: typeof useScreenEditorStore;
  }
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__screenEditorStore = useScreenEditorStore;
}
