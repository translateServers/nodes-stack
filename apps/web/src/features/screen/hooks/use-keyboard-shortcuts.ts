/**
 * 大屏编辑器快捷键集中 hook（基于 react-hotkeys-hook）
 *
 * 设计要点：
 * - 所有快捷键的键位、描述、分组、preventDefault 语义在 shortcuts-registry.ts 中单一维护
 * - useHotkeys 的 options 由 buildHotkeysOptions(entry, enabled) 统一生成，消除双轨制
 * - 全局快捷键（save/zoom/guides）通过 enableOnFormTags: true 在输入框内也放行
 * - 画布作用域快捷键通过 enabled: !isEditingText 控制（来自会话控制器）
 * - 工具切换走会话控制器（PS 级临时切换栈）
 * - useHotkeys 在组件卸载时自动解绑，无需手动 unbind
 *
 * 防冲突方法论：
 * - registry 中 preventDefault='always' 的条目，options.preventDefault 自动为 true
 * - registry 中 preventDefault='callback-only' 的条目，callback 内必须调用 e.preventDefault()
 * - registry 中 preventDefault='none' 的条目，不阻止默认行为
 */

import { useCallback, useRef } from 'react';
import { useHotkeys, type Options } from 'react-hotkeys-hook';
import { useScreenEditorStore } from '../stores/editor-store';
import { getShortcutById, type ShortcutDefinition } from './shortcuts-registry';
import { isFormElementFocused } from './use-modifier-keys';
import type { EditorSessionApi } from './use-editor-session';
import type { ScreenComponent } from '@nebula/shared';

interface KeyboardShortcutsOptions {
  onSave: () => void;
  /** 放大画布（Ctrl/Cmd + =） */
  onZoomIn?: () => void;
  /** 缩小画布（Ctrl/Cmd + -） */
  onZoomOut?: () => void;
  /** 适应屏幕（Ctrl/Cmd + 0） */
  onFitToScreen?: () => void;
  /** 显示快捷键帮助面板（Ctrl/Cmd + /） */
  onShowHelp?: () => void;
  /**
   * 编辑器会话控制器（任务 12.4：唯一来源，原 toolStateMachine 回退已删除）。
   * 工具切换和 canvasEnabled 都走会话控制器。
   * 任务 13.2：新增 dispatchInteraction 用于 Escape 派发到交互状态机。
   */
  editorSession: Pick<
    EditorSessionApi,
    | 'activeTool'
    | 'setTool'
    | 'pushTemporaryTool'
    | 'popTemporaryTool'
    | 'isEditingText'
    | 'dispatchInteraction'
  >;
}

/** 用 ref 包裹外部回调，使 useHotkeys 的 callback 始终调用最新值 */
function useLatestRef<T>(value: T): React.RefObject<T> {
  const ref = useRef<T>(value);
  ref.current = value;
  return ref;
}

/**
 * 根据 registry 条目统一生成 useHotkeys 的 options。
 * - preventDefault='always' → preventDefault: true（库在事件触发前阻止默认行为）
 * - preventDefault='callback-only' / 'none' → preventDefault: false（由 callback 内决定）
 * - enableOnFormTags 不传时按 scope 推断（global → true, canvas → false）
 */
export function buildHotkeysOptions(
  entry: ShortcutDefinition,
  enabled: boolean | (() => boolean),
): Options {
  return {
    enabled,
    preventDefault: entry.preventDefault === 'always',
    enableOnFormTags: entry.enableOnFormTags ?? entry.scope === 'global',
  };
}

/** 合并主键位与别名为一个逗号分隔的字符串（react-hotkeys-hook 多键位语法） */
function getAllKeys(entry: ShortcutDefinition): string {
  return [entry.keys, ...(entry.aliases ?? [])].join(',');
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions): void {
  const { editorSession } = options;
  const { setTool, pushTemporaryTool, popTemporaryTool, isEditingText, dispatchInteraction } =
    editorSession;

  const saveRef = useLatestRef(options.onSave);
  const zoomInRef = useLatestRef(options.onZoomIn);
  const zoomOutRef = useLatestRef(options.onZoomOut);
  const fitToScreenRef = useLatestRef(options.onFitToScreen);
  const showHelpRef = useLatestRef(options.onShowHelp);

  const getStore = useCallback(() => useScreenEditorStore.getState(), []);
  // canvas 作用域：非文本编辑态时才触发画布相关快捷键
  // 任务 12.4：isEditingText 唯一来源是会话控制器（派生自交互状态机 'text-editing' 状态）
  const canvasEnabled = useCallback(() => !isEditingText, [isEditingText]);

  // ===== 文件 =====
  const saveEntry = getShortcutById('save')!;
  useHotkeys(
    getAllKeys(saveEntry),
    () => {
      saveRef.current();
    },
    buildHotkeysOptions(saveEntry, true),
  );

  // ===== 视图 =====
  const zoomInEntry = getShortcutById('zoomIn')!;
  useHotkeys(
    getAllKeys(zoomInEntry),
    () => {
      zoomInRef.current?.();
    },
    buildHotkeysOptions(zoomInEntry, true),
  );
  const zoomOutEntry = getShortcutById('zoomOut')!;
  useHotkeys(
    getAllKeys(zoomOutEntry),
    () => {
      zoomOutRef.current?.();
    },
    buildHotkeysOptions(zoomOutEntry, true),
  );
  const fitToScreenEntry = getShortcutById('fitToScreen')!;
  useHotkeys(
    getAllKeys(fitToScreenEntry),
    () => {
      fitToScreenRef.current?.();
    },
    buildHotkeysOptions(fitToScreenEntry, true),
  );
  const toggleGuidesEntry = getShortcutById('toggleGuides')!;
  useHotkeys(
    getAllKeys(toggleGuidesEntry),
    () => {
      getStore().toggleGuidesVisibility();
    },
    buildHotkeysOptions(toggleGuidesEntry, true),
  );
  const toggleBorderGuidesEntry = getShortcutById('toggleBorderGuides')!;
  useHotkeys(
    getAllKeys(toggleBorderGuidesEntry),
    (e) => {
      e.preventDefault();
      getStore().toggleBorderGuides();
    },
    buildHotkeysOptions(toggleBorderGuidesEntry, canvasEnabled),
  );

  // ===== 编辑 =====
  const undoEntry = getShortcutById('undo')!;
  useHotkeys(
    getAllKeys(undoEntry),
    (e) => {
      e.preventDefault();
      getStore().undo();
    },
    buildHotkeysOptions(undoEntry, canvasEnabled),
  );
  const redoEntry = getShortcutById('redo')!;
  useHotkeys(
    getAllKeys(redoEntry),
    (e) => {
      e.preventDefault();
      getStore().redo();
    },
    buildHotkeysOptions(redoEntry, canvasEnabled),
  );
  const deleteEntry = getShortcutById('delete')!;
  useHotkeys(
    getAllKeys(deleteEntry),
    (e) => {
      e.preventDefault();
      getStore().removeSelectedComponents();
    },
    buildHotkeysOptions(deleteEntry, canvasEnabled),
  );
  const selectAllEntry = getShortcutById('selectAll')!;
  useHotkeys(
    getAllKeys(selectAllEntry),
    (e) => {
      e.preventDefault();
      const store = getStore();
      if (store.project) {
        const allIds = store.project.components
          .filter((c: ScreenComponent) => !c.status.locked && !c.status.hidden)
          .map((c: ScreenComponent) => c.id);
        store.selectComponents(allIds);
      }
    },
    buildHotkeysOptions(selectAllEntry, canvasEnabled),
  );
  const copyEntry = getShortcutById('copy')!;
  useHotkeys(
    getAllKeys(copyEntry),
    (e) => {
      // 若用户用鼠标拖选了文字（如画布上文本组件内的文字、或双击选中的词），
      // 让浏览器原生 copy 生效，把选中文字写入系统剪贴板。
      // 仅当没有原生选区时，才执行"复制选中组件到内存剪贴板"的逻辑。
      const selection = typeof window !== 'undefined' ? window.getSelection() : null;
      if (selection && selection.toString().length > 0) {
        return;
      }
      e.preventDefault();
      getStore().copySelectedToClipboard();
    },
    buildHotkeysOptions(copyEntry, canvasEnabled),
  );
  const pasteEntry = getShortcutById('paste')!;
  useHotkeys(
    getAllKeys(pasteEntry),
    (e) => {
      e.preventDefault();
      getStore().pasteFromClipboard();
    },
    buildHotkeysOptions(pasteEntry, canvasEnabled),
  );
  const duplicateEntry = getShortcutById('duplicate')!;
  useHotkeys(
    getAllKeys(duplicateEntry),
    (e) => {
      e.preventDefault();
      getStore().duplicateSelected();
    },
    buildHotkeysOptions(duplicateEntry, canvasEnabled),
  );

  // ===== 组件 =====
  const bringToFrontEntry = getShortcutById('bringToFront')!;
  useHotkeys(
    getAllKeys(bringToFrontEntry),
    (e) => {
      e.preventDefault();
      const store = getStore();
      for (const id of store.selectedComponentIds) store.reorderToTop(id);
    },
    buildHotkeysOptions(bringToFrontEntry, canvasEnabled),
  );
  const sendToBackEntry = getShortcutById('sendToBack')!;
  useHotkeys(
    getAllKeys(sendToBackEntry),
    (e) => {
      e.preventDefault();
      const store = getStore();
      for (const id of store.selectedComponentIds) store.reorderToBottom(id);
    },
    buildHotkeysOptions(sendToBackEntry, canvasEnabled),
  );
  const groupEntry = getShortcutById('group')!;
  useHotkeys(
    getAllKeys(groupEntry),
    (e) => {
      e.preventDefault();
      getStore().groupSelected();
    },
    buildHotkeysOptions(groupEntry, canvasEnabled),
  );
  const ungroupEntry = getShortcutById('ungroup')!;
  useHotkeys(
    getAllKeys(ungroupEntry),
    (e) => {
      e.preventDefault();
      getStore().ungroupSelected();
    },
    buildHotkeysOptions(ungroupEntry, canvasEnabled),
  );
  const lockEntry = getShortcutById('lock')!;
  useHotkeys(
    getAllKeys(lockEntry),
    (e) => {
      e.preventDefault();
      const store = getStore();
      store.setLocked(store.selectedComponentIds, true);
    },
    buildHotkeysOptions(lockEntry, canvasEnabled),
  );
  const unlockEntry = getShortcutById('unlock')!;
  useHotkeys(
    getAllKeys(unlockEntry),
    (e) => {
      e.preventDefault();
      const store = getStore();
      store.setLocked(store.selectedComponentIds, false);
    },
    buildHotkeysOptions(unlockEntry, canvasEnabled),
  );
  const hideEntry = getShortcutById('hide')!;
  useHotkeys(
    getAllKeys(hideEntry),
    (e) => {
      e.preventDefault();
      const store = getStore();
      store.setHidden(store.selectedComponentIds, true);
    },
    buildHotkeysOptions(hideEntry, canvasEnabled),
  );
  const clearSelectionEntry = getShortcutById('clearSelection')!;
  useHotkeys(
    getAllKeys(clearSelectionEntry),
    () => {
      // 任务 13.2：Escape 键首先派发 escape 事件到交互状态机，恢复任意瞬时状态到 idle。
      // 修复 bug：原实现只操作 store，状态机可能卡在 dragging/resizing/rotating/panning/creating，
      // 导致后续 Selecto onDragStart 仲裁（非 idle/hovering 拒绝）阻塞单击选中。
      dispatchInteraction('escape');
      const store = getStore();
      // 分层语义：先退出当前活动分组（保留选中），再次 Esc 才清空选中。
      if (store.activeGroupId) {
        store.setActiveGroupId(null);
      } else {
        store.clearSelection();
      }
    },
    buildHotkeysOptions(clearSelectionEntry, canvasEnabled),
  );

  // 微移（键位由 shortcuts-registry 单一数据源提供，便于帮助面板自动显示）
  const nudgeUpEntry = getShortcutById('nudgeUp')!;
  useHotkeys(
    getAllKeys(nudgeUpEntry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(0, -1);
    },
    buildHotkeysOptions(nudgeUpEntry, canvasEnabled),
  );
  const nudgeDownEntry = getShortcutById('nudgeDown')!;
  useHotkeys(
    getAllKeys(nudgeDownEntry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(0, 1);
    },
    buildHotkeysOptions(nudgeDownEntry, canvasEnabled),
  );
  const nudgeLeftEntry = getShortcutById('nudgeLeft')!;
  useHotkeys(
    getAllKeys(nudgeLeftEntry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(-1, 0);
    },
    buildHotkeysOptions(nudgeLeftEntry, canvasEnabled),
  );
  const nudgeRightEntry = getShortcutById('nudgeRight')!;
  useHotkeys(
    getAllKeys(nudgeRightEntry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(1, 0);
    },
    buildHotkeysOptions(nudgeRightEntry, canvasEnabled),
  );
  const nudgeUp10Entry = getShortcutById('nudgeUp10')!;
  useHotkeys(
    getAllKeys(nudgeUp10Entry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(0, -10);
    },
    buildHotkeysOptions(nudgeUp10Entry, canvasEnabled),
  );
  const nudgeDown10Entry = getShortcutById('nudgeDown10')!;
  useHotkeys(
    getAllKeys(nudgeDown10Entry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(0, 10);
    },
    buildHotkeysOptions(nudgeDown10Entry, canvasEnabled),
  );
  const nudgeLeft10Entry = getShortcutById('nudgeLeft10')!;
  useHotkeys(
    getAllKeys(nudgeLeft10Entry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(-10, 0);
    },
    buildHotkeysOptions(nudgeLeft10Entry, canvasEnabled),
  );
  const nudgeRight10Entry = getShortcutById('nudgeRight10')!;
  useHotkeys(
    getAllKeys(nudgeRight10Entry),
    (e) => {
      e.preventDefault();
      getStore().nudgeSelected(10, 0);
    },
    buildHotkeysOptions(nudgeRight10Entry, canvasEnabled),
  );

  // noop：拦截 Alt+方向键触发的浏览器历史导航（macOS / Firefox）
  // 4 个 noop 条目合并为一次 useHotkeys 调用，callback 仅 preventDefault
  const noopAltEntries = ['noopAltLeft', 'noopAltRight', 'noopAltUp', 'noopAltDown'].map(
    (id) => getShortcutById(id)!,
  );
  const noopAltKeys = noopAltEntries.flatMap((e) => [e.keys, ...(e.aliases ?? [])]).join(',');
  useHotkeys(
    noopAltKeys,
    (e) => {
      e.preventDefault();
    },
    buildHotkeysOptions(noopAltEntries[0], canvasEnabled),
  );

  // ===== 对齐 =====
  const alignLeftEntry = getShortcutById('alignLeft')!;
  useHotkeys(
    getAllKeys(alignLeftEntry),
    (e) => {
      e.preventDefault();
      getStore().alignSelectedHorizontal('left');
    },
    buildHotkeysOptions(alignLeftEntry, canvasEnabled),
  );
  const alignCenterHEntry = getShortcutById('alignCenterH')!;
  useHotkeys(
    getAllKeys(alignCenterHEntry),
    (e) => {
      e.preventDefault();
      getStore().alignSelectedHorizontal('center');
    },
    buildHotkeysOptions(alignCenterHEntry, canvasEnabled),
  );
  const alignRightEntry = getShortcutById('alignRight')!;
  useHotkeys(
    getAllKeys(alignRightEntry),
    (e) => {
      e.preventDefault();
      getStore().alignSelectedHorizontal('right');
    },
    buildHotkeysOptions(alignRightEntry, canvasEnabled),
  );
  const alignTopEntry = getShortcutById('alignTop')!;
  useHotkeys(
    getAllKeys(alignTopEntry),
    (e) => {
      e.preventDefault();
      getStore().alignSelectedVertical('top');
    },
    buildHotkeysOptions(alignTopEntry, canvasEnabled),
  );
  const alignMiddleVEntry = getShortcutById('alignMiddleV')!;
  useHotkeys(
    getAllKeys(alignMiddleVEntry),
    (e) => {
      e.preventDefault();
      getStore().alignSelectedVertical('middle');
    },
    buildHotkeysOptions(alignMiddleVEntry, canvasEnabled),
  );
  const alignBottomEntry = getShortcutById('alignBottom')!;
  useHotkeys(
    getAllKeys(alignBottomEntry),
    (e) => {
      e.preventDefault();
      getStore().alignSelectedVertical('bottom');
    },
    buildHotkeysOptions(alignBottomEntry, canvasEnabled),
  );
  const distributeHEntry = getShortcutById('distributeH')!;
  useHotkeys(
    getAllKeys(distributeHEntry),
    (e) => {
      e.preventDefault();
      getStore().distributeSelectedHorizontal();
    },
    buildHotkeysOptions(distributeHEntry, canvasEnabled),
  );
  const distributeVEntry = getShortcutById('distributeV')!;
  useHotkeys(
    getAllKeys(distributeVEntry),
    (e) => {
      e.preventDefault();
      getStore().distributeSelectedVertical();
    },
    buildHotkeysOptions(distributeVEntry, canvasEnabled),
  );

  // ===== 工具切换（PS 级） =====
  // 7 个主工具切换：键位由 SHORTCUTS_REGISTRY 单一数据源提供
  // 吸管工具没有 shortcutId（null），不绑定快捷键
  const toolSelectEntry = getShortcutById('toolSelect')!;
  useHotkeys(
    getAllKeys(toolSelectEntry),
    () => setTool('select'),
    buildHotkeysOptions(toolSelectEntry, canvasEnabled),
  );
  const toolHandEntry = getShortcutById('toolHand')!;
  useHotkeys(
    getAllKeys(toolHandEntry),
    () => setTool('hand'),
    buildHotkeysOptions(toolHandEntry, canvasEnabled),
  );
  const toolTextEntry = getShortcutById('toolText')!;
  useHotkeys(
    getAllKeys(toolTextEntry),
    () => setTool('text'),
    buildHotkeysOptions(toolTextEntry, canvasEnabled),
  );
  const toolRectEntry = getShortcutById('toolRect')!;
  useHotkeys(
    getAllKeys(toolRectEntry),
    () => setTool('rect'),
    buildHotkeysOptions(toolRectEntry, canvasEnabled),
  );
  const toolEllipseEntry = getShortcutById('toolEllipse')!;
  useHotkeys(
    getAllKeys(toolEllipseEntry),
    () => setTool('ellipse'),
    buildHotkeysOptions(toolEllipseEntry, canvasEnabled),
  );
  const toolImageEntry = getShortcutById('toolImage')!;
  useHotkeys(
    getAllKeys(toolImageEntry),
    () => setTool('image'),
    buildHotkeysOptions(toolImageEntry, canvasEnabled),
  );
  const toolZoomEntry = getShortcutById('toolZoom')!;
  useHotkeys(
    getAllKeys(toolZoomEntry),
    () => setTool('zoom'),
    buildHotkeysOptions(toolZoomEntry, canvasEnabled),
  );

  // 临时切换：按住 Space → 抓手，松开恢复
  // 任务 4.3：Space 临时抓手完全由工具栈仲裁，不再依赖 use-modifier-keys 的 spaceRef。
  // - keydown：检查表单焦点（contenteditable 等 enableOnFormTags 未覆盖的场景），
  //   preventDefault 阻止页面滚动，pushTemporaryTool('hand') 使 activeTool 变为 'hand'
  // - keyup：popTemporaryTool('hand') 恢复原工具
  // - 失焦/异常取消：useToolStateMachine 的 window blur 监听清空临时栈
  // 键位 'space' 由 SHORTCUTS_REGISTRY 中 toolHandTemp 条目文档化（帮助面板展示）
  const toolHandTempEntry = getShortcutById('toolHandTemp')!;
  useHotkeys(
    getAllKeys(toolHandTempEntry),
    (e) => {
      // contenteditable 等 enableOnFormTags 未覆盖的表单元素中不抢占 Space
      if (isFormElementFocused()) return;
      e.preventDefault();
      pushTemporaryTool('hand');
    },
    {
      ...buildHotkeysOptions(toolHandTempEntry, canvasEnabled),
      keydown: true,
      keyup: false,
    },
  );
  useHotkeys(
    getAllKeys(toolHandTempEntry),
    () => {
      popTemporaryTool('hand');
    },
    {
      ...buildHotkeysOptions(toolHandTempEntry, true),
      keydown: false,
      keyup: true,
    },
  );

  // [/] 边框宽度调整（适配表 #18，复用 Task 2.2 的 brushSize 条目）：
  // [ 减小 1px，] 增大 1px，范围 [0, 20]，文本类型忽略
  const brushSizeDecreaseEntry = getShortcutById('brushSizeDecrease')!;
  useHotkeys(
    getAllKeys(brushSizeDecreaseEntry),
    () => {
      getStore().adjustBorderWidth(-1);
    },
    buildHotkeysOptions(brushSizeDecreaseEntry, canvasEnabled),
  );
  const brushSizeIncreaseEntry = getShortcutById('brushSizeIncrease')!;
  useHotkeys(
    getAllKeys(brushSizeIncreaseEntry),
    () => {
      getStore().adjustBorderWidth(1);
    },
    buildHotkeysOptions(brushSizeIncreaseEntry, canvasEnabled),
  );

  // ===== 帮助 =====
  const showHelpEntry = getShortcutById('showHelp')!;
  useHotkeys(
    getAllKeys(showHelpEntry),
    () => {
      showHelpRef.current?.();
    },
    buildHotkeysOptions(showHelpEntry, true),
  );

  // ===== 界面 =====
  // Tab 切换 UI 显隐：仅在画布激活时触发，避免干扰 Radix Popover/Dialog 焦点流转
  // enableOnFormTags: false 保留 input/textarea 内 Tab 焦点切换
  const toggleUIEntry = getShortcutById('toggleUI')!;
  useHotkeys(
    getAllKeys(toggleUIEntry),
    (e) => {
      e.preventDefault();
      getStore().toggleUI();
    },
    buildHotkeysOptions(toggleUIEntry, canvasEnabled),
  );
  // F 循环切换屏幕模式：standard → withMenu → fullscreen → standard
  const cycleScreenModeEntry = getShortcutById('cycleScreenMode')!;
  useHotkeys(
    getAllKeys(cycleScreenModeEntry),
    () => {
      getStore().cycleScreenMode();
    },
    buildHotkeysOptions(cycleScreenModeEntry, canvasEnabled),
  );
}
