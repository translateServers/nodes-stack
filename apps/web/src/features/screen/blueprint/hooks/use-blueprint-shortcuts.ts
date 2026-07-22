/**
 * 蓝图编辑器快捷键分层 hook（任务 5.4）
 *
 * 在全屏弹层（BlueprintSheet）打开期间接管键盘事件：
 * - Ctrl+Z / Ctrl+Shift+Z：走全局本地编辑历史（undo/redo）
 * - Esc 分层：关闭搜索面板 → 取消连线 → 取消选择 → 关闭弹层
 *
 * Delete/Backspace 和 Ctrl+A 由 ReactFlow 内置处理，
 * 通过 onNodesChange/onEdgesChange 同步到 blueprint store。
 *
 * 使用 capture 阶段监听 Esc，在 ReactFlow 内部处理之前拦截，
 * 防止 Esc 在关闭弹层的同时也触发 ReactFlow 的取消选择。
 */

import { useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useScreenEditorStore } from '../../stores/editor-store';

interface UseBlueprintShortcutsOptions {
  onClose: () => void;
  searchPanelVisible: boolean;
  onCloseSearchPanel: () => void;
  nodes: Node[];
  edges: Edge[];
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
  isConnectingRef: React.RefObject<boolean>;
}

export function useBlueprintShortcuts(options: UseBlueprintShortcutsOptions): void {
  const {
    onClose,
    searchPanelVisible,
    onCloseSearchPanel,
    nodes,
    edges,
    setNodes,
    setEdges,
    isConnectingRef,
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z / Ctrl+Shift+Z：全局 undo/redo
      if (isCtrl && e.key === 'z') {
        e.preventDefault();
        const store = useScreenEditorStore.getState();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }

      // Esc 分层
      if (e.key === 'Escape') {
        // 第一层：搜索面板
        if (searchPanelVisible) {
          e.preventDefault();
          e.stopPropagation();
          onCloseSearchPanel();
          return;
        }

        // 第二层：连线进行中（让 ReactFlow 内部处理取消连线）
        if (isConnectingRef.current) {
          return;
        }

        // 第三层：取消选择
        const hasSelection = nodes.some((n) => n.selected) || edges.some((e) => e.selected);
        if (hasSelection) {
          e.preventDefault();
          e.stopPropagation();
          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
          setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
          return;
        }

        // 第四层：关闭弹层
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    onClose,
    searchPanelVisible,
    onCloseSearchPanel,
    nodes,
    edges,
    setNodes,
    setEdges,
    isConnectingRef,
  ]);
}

export type { UseBlueprintShortcutsOptions };
