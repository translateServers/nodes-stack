/**
 * 大屏编辑器快捷键集中 hook（基于 react-hotkeys-hook）
 *
 * 设计要点：
 * - 所有快捷键的键位、描述、分组、preventDefault 语义在 shortcuts-registry.ts 中单一维护
 * - useHotkeys 的 options 由 buildHotkeysOptions(entry, enabled) 统一生成，消除双轨制
 * - 全局快捷键（save/zoom/guides）通过 enableOnFormTags: true 在输入框内也放行
 * - 画布作用域快捷键通过 enabled: !isEditingText 控制
 * - 工具切换走 toolStateMachine（PS 级临时切换栈）
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
import type { ToolStateMachineApi } from './use-tool-state-machine';
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
  /** 工具状态机（PS 级临时切换栈） */
  toolStateMachine: ToolStateMachineApi;
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
  const { toolStateMachine } = options;
  const { isEditingText } = toolStateMachine;

  const saveRef = useLatestRef(options.onSave);
  const zoomInRef = useLatestRef(options.onZoomIn);
  const zoomOutRef = useLatestRef(options.onZoomOut);
  const fitToScreenRef = useLatestRef(options.onFitToScreen);
  const showHelpRef = useLatestRef(options.onShowHelp);

  const getStore = useCallback(() => useScreenEditorStore.getState(), []);
  // canvas 作用域：非文本编辑态时才触发画布相关快捷键
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
  // 单字母切换主工具（仅画布作用域，不在 registry 中文档化）
  useHotkeys('v', () => toolStateMachine.setTool('select'), {
    enabled: canvasEnabled,
  });
  useHotkeys('h', () => toolStateMachine.setTool('hand'), {
    enabled: canvasEnabled,
  });
  useHotkeys('t', () => toolStateMachine.setTool('text'), {
    enabled: canvasEnabled,
  });

  // 临时切换：按住 Space → 抓手，松开恢复
  // 注意：Space 的 preventDefault 与修饰键状态在 use-modifier-keys.ts 中已处理，
  // 这里只负责工具状态机的压栈/出栈
  useHotkeys('space', () => toolStateMachine.pushTemporaryTool('hand'), {
    keydown: true,
    keyup: false,
    enabled: canvasEnabled,
  });
  useHotkeys('space', () => toolStateMachine.popTemporaryTool('hand'), {
    keydown: false,
    keyup: true,
  });

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
