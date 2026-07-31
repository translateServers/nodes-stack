/**
 * 蓝图编辑器快捷键分层 hook（任务 5.4 + 交互一致性缺口 1/2）
 *
 * 在全屏弹层（BlueprintSheet）打开期间接管键盘事件：
 * - Ctrl+Z / Ctrl+Shift+Z：走全局本地编辑历史（undo/redo）
 * - Ctrl+S：保存项目（防止浏览器"保存网页"对话框）
 * - Ctrl+= / Ctrl+- / Ctrl+0：视口放大/缩小/适配（防止浏览器页面缩放）
 * - Ctrl+/：打开快捷键帮助面板
 * - Esc 分层：关闭搜索面板 -> 取消连线 -> 取消选择 -> 关闭弹层
 *
 * Delete/Backspace：由 ReactFlow deleteKeyCode=['Backspace','Delete'] 内置处理，
 * 通过 onNodesChange/onEdgesChange 同步到 blueprint store。
 * Ctrl+A：由本 hook 处理（ReactFlow 无内置全选；表单聚焦时让位原生全选）。
 *
 * 使用 capture 阶段监听，在 ReactFlow 内部处理之前拦截，
 * 防止 Esc 在关闭弹层的同时也触发 ReactFlow 的取消选择。
 */

import { useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useScreenEditorStoreApi } from '../../stores/editor-store';
import { isFormElementFocused } from '../../hooks/use-modifier-keys';

interface UseBlueprintShortcutsOptions {
  onClose: () => void;
  searchPanelVisible: boolean;
  onCloseSearchPanel: () => void;
  nodes: Node[];
  edges: Edge[];
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
  isConnectingRef: React.RefObject<boolean>;
  /** 保存项目回调（缺口 1：Ctrl+S 接管） */
  onSave?: () => void;
  /** 视口放大（缺口 1：Ctrl+= 接管） */
  onZoomIn?: () => void;
  /** 视口缩小（缺口 1：Ctrl+- 接管） */
  onZoomOut?: () => void;
  /** 适配视图（缺口 1：Ctrl+0 接管） */
  onFitView?: () => void;
  /** 显示快捷键帮助（缺口 2：Ctrl+/ 接管） */
  onShowHelp?: () => void;
  /** 全选节点与边（Ctrl+A，ReactFlow 无内置全选） */
  onSelectAll?: () => void;
  /**
   * 当前实例是否处于活跃状态（拥有焦点）。
   * 多实例场景下，仅活跃实例的蓝图快捷键响应键盘事件。
   * 默认为 () => true，保留单实例向后兼容行为。
   */
  isActive?: () => boolean;
}

export function useBlueprintShortcuts(options: UseBlueprintShortcutsOptions): void {
  const editorStore = useScreenEditorStoreApi();
  // P0 优化：render 期同步最新 options 到 ref，keydown 监听只注册一次
  // advanced-event-handler-refs：避免 effect 依赖多个非 primitive 值导致监听频繁重注册
  // client-event-listeners：effect deps 为空数组，全局监听只挂载/卸载一次
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const opts = optionsRef.current;
      // 多实例焦点仲裁：非活跃实例不响应快捷键。
      // isActive 未提供时默认放行，保留单实例向后兼容行为。
      if (opts.isActive !== undefined && !opts.isActive()) return;
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z / Ctrl+Shift+Z：全局 undo/redo
      if (isCtrl && e.key === 'z') {
        e.preventDefault();
        const store = editorStore.getState();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }

      // 缺口 1：Ctrl+S 保存项目（防止浏览器"保存网页"对话框）
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        opts.onSave?.();
        return;
      }

      // 缺口 1：Ctrl+= / Ctrl++ 视口放大（防止浏览器页面缩放）
      if (isCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        opts.onZoomIn?.();
        return;
      }

      // 缺口 1：Ctrl+- 视口缩小
      if (isCtrl && e.key === '-') {
        e.preventDefault();
        opts.onZoomOut?.();
        return;
      }

      // 缺口 1：Ctrl+0 适配视图
      if (isCtrl && e.key === '0') {
        e.preventDefault();
        opts.onFitView?.();
        return;
      }

      // 缺口 2：Ctrl+/ 打开快捷键帮助
      if (isCtrl && e.key === '/') {
        e.preventDefault();
        opts.onShowHelp?.();
        return;
      }

      // Ctrl+A：全选节点与边（ReactFlow 无内置全选；表单聚焦时让位原生全选）
      if (isCtrl && (e.key === 'a' || e.key === 'A')) {
        if (isFormElementFocused()) return;
        e.preventDefault();
        opts.onSelectAll?.();
        return;
      }

      // Esc 分层
      if (e.key === 'Escape') {
        // 第一层：搜索面板
        if (opts.searchPanelVisible) {
          e.preventDefault();
          e.stopPropagation();
          opts.onCloseSearchPanel();
          return;
        }

        // 第二层：连线进行中（让 ReactFlow 内部处理取消连线）
        if (opts.isConnectingRef.current) {
          return;
        }

        // 第三层：取消选择
        const hasSelection =
          opts.nodes.some((n) => n.selected) || opts.edges.some((ed) => ed.selected);
        if (hasSelection) {
          e.preventDefault();
          e.stopPropagation();
          opts.setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
          opts.setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
          return;
        }

        // 第四层：关闭弹层
        e.preventDefault();
        e.stopPropagation();
        opts.onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [editorStore]);
}

export type { UseBlueprintShortcutsOptions };
