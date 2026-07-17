/**
 * 大屏编辑器快捷键集中 hook（基于 react-hotkeys-hook）
 *
 * 设计要点：
 * - 所有快捷键的键位、描述、分组在 shortcuts-registry.ts 中单一维护
 * - 全局快捷键（save/zoom/guides）通过 enableOnFormTags: true 在输入框内也放行
 * - 画布作用域快捷键通过 enabled: !isEditingText 控制
 * - 工具切换走 toolStateMachine（PS 级临时切换栈）
 * - useHotkeys 在组件卸载时自动解绑，无需手动 unbind
 */

import { useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useScreenEditorStore } from '../stores/editor-store';
import { getShortcutById } from './shortcuts-registry';
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
  useHotkeys(
    getShortcutById('save')!.keys,
    (e) => {
      e.preventDefault();
      saveRef.current();
    },
    { enableOnFormTags: true, preventDefault: true },
  );

  // ===== 视图 =====
  useHotkeys(
    getShortcutById('zoomIn')!.keys,
    (e) => {
      e.preventDefault();
      zoomInRef.current?.();
    },
    { enableOnFormTags: true, preventDefault: true },
  );
  useHotkeys(
    getShortcutById('zoomOut')!.keys,
    (e) => {
      e.preventDefault();
      zoomOutRef.current?.();
    },
    { enableOnFormTags: true, preventDefault: true },
  );
  useHotkeys(
    getShortcutById('fitToScreen')!.keys,
    (e) => {
      e.preventDefault();
      fitToScreenRef.current?.();
    },
    { enableOnFormTags: true, preventDefault: true },
  );
  useHotkeys(
    getShortcutById('toggleGuides')!.keys,
    (e) => {
      e.preventDefault();
      getStore().toggleGuidesVisibility();
    },
    { enableOnFormTags: true, preventDefault: true },
  );
  useHotkeys(getShortcutById('toggleBorderGuides')!.keys, () => getStore().toggleBorderGuides(), {
    enabled: canvasEnabled,
  });

  // ===== 编辑 =====
  useHotkeys(
    getShortcutById('undo')!.keys,
    (e) => {
      e.preventDefault();
      getStore().undo();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('redo')!.keys,
    (e) => {
      e.preventDefault();
      getStore().redo();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('delete')!.keys,
    (e) => {
      e.preventDefault();
      getStore().removeSelectedComponents();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('selectAll')!.keys,
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
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('copy')!.keys,
    (e) => {
      e.preventDefault();
      getStore().copySelectedToClipboard();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('paste')!.keys,
    (e) => {
      e.preventDefault();
      getStore().pasteFromClipboard();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('duplicate')!.keys,
    (e) => {
      e.preventDefault();
      getStore().duplicateSelected();
    },
    { enabled: canvasEnabled },
  );

  // ===== 组件 =====
  useHotkeys(
    getShortcutById('bringToFront')!.keys,
    (e) => {
      e.preventDefault();
      const store = getStore();
      for (const id of store.selectedComponentIds) store.reorderToTop(id);
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('sendToBack')!.keys,
    (e) => {
      e.preventDefault();
      const store = getStore();
      for (const id of store.selectedComponentIds) store.reorderToBottom(id);
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('group')!.keys,
    (e) => {
      e.preventDefault();
      getStore().groupSelected();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('ungroup')!.keys,
    (e) => {
      e.preventDefault();
      getStore().ungroupSelected();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('lock')!.keys,
    () => {
      const store = getStore();
      store.setLocked(store.selectedComponentIds, true);
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('unlock')!.keys,
    () => {
      const store = getStore();
      store.setLocked(store.selectedComponentIds, false);
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('hide')!.keys,
    () => {
      const store = getStore();
      store.setHidden(store.selectedComponentIds, true);
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('clearSelection')!.keys,
    () => {
      const store = getStore();
      // 分层语义：先退出当前活动分组（保留选中），再次 Esc 才清空选中。
      if (store.activeGroupId) {
        store.setActiveGroupId(null);
      } else {
        store.clearSelection();
      }
    },
    { enabled: canvasEnabled },
  );

  // 微移
  useHotkeys('up', () => getStore().nudgeSelected(0, -1), { enabled: canvasEnabled });
  useHotkeys('down', () => getStore().nudgeSelected(0, 1), { enabled: canvasEnabled });
  useHotkeys('left', () => getStore().nudgeSelected(-1, 0), { enabled: canvasEnabled });
  useHotkeys('right', () => getStore().nudgeSelected(1, 0), { enabled: canvasEnabled });
  useHotkeys('shift+up', () => getStore().nudgeSelected(0, -10), {
    enabled: canvasEnabled,
  });
  useHotkeys('shift+down', () => getStore().nudgeSelected(0, 10), {
    enabled: canvasEnabled,
  });
  useHotkeys('shift+left', () => getStore().nudgeSelected(-10, 0), {
    enabled: canvasEnabled,
  });
  useHotkeys('shift+right', () => getStore().nudgeSelected(10, 0), {
    enabled: canvasEnabled,
  });

  // ===== 对齐 =====
  useHotkeys(
    getShortcutById('alignLeft')!.keys,
    (e) => {
      e.preventDefault();
      getStore().alignSelectedHorizontal('left');
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('alignCenterH')!.keys,
    (e) => {
      e.preventDefault();
      getStore().alignSelectedHorizontal('center');
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('alignRight')!.keys,
    (e) => {
      e.preventDefault();
      getStore().alignSelectedHorizontal('right');
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('alignTop')!.keys,
    (e) => {
      e.preventDefault();
      getStore().alignSelectedVertical('top');
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('alignMiddleV')!.keys,
    (e) => {
      e.preventDefault();
      getStore().alignSelectedVertical('middle');
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('alignBottom')!.keys,
    (e) => {
      e.preventDefault();
      getStore().alignSelectedVertical('bottom');
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('distributeH')!.keys,
    (e) => {
      e.preventDefault();
      getStore().distributeSelectedHorizontal();
    },
    { enabled: canvasEnabled },
  );
  useHotkeys(
    getShortcutById('distributeV')!.keys,
    (e) => {
      e.preventDefault();
      getStore().distributeSelectedVertical();
    },
    { enabled: canvasEnabled },
  );

  // ===== 工具切换（PS 级） =====
  // 单字母切换主工具（仅画布作用域）
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

  // ===== 帮助 =====
  useHotkeys(
    getShortcutById('showHelp')!.keys,
    (e) => {
      e.preventDefault();
      showHelpRef.current?.();
    },
    { enableOnFormTags: true, preventDefault: true },
  );
}
