/**
 * 蓝图选择模型 Hook（任务 4.5）
 *
 * 封装 React Flow 多选/框选/Ctrl+A 相关配置：
 * - 点选：默认由 React Flow 提供
 * - Shift 多选：multiSelectionKeyCode="Shift"
 * - 框选：selectionOnDrag + selectionMode=Partial
 * - Ctrl+A：通过 useKeyPress 监听，回调 onSelectAll
 * - Delete：通过 useKeyPress 监听，回调 onDelete
 * - 多选整体拖拽：默认由 React Flow 提供（selectedNodes 联动）
 *
 * 网格吸附与对齐吸附通过 useBlueprintSnap 提供（独立 Hook，避免耦合）。
 */

import { useCallback, useEffect } from 'react';
import { useKeyPress } from '@xyflow/react';

/** 选择模型配置（传给 <ReactFlow /> 的 props） */
export interface SelectionModelConfig {
  /** Shift 多选快捷键 */
  multiSelectionKeyCode: string | string[];
  /** 框选快捷键 */
  selectionKeyCode: string | string[];
  /** 是否启用框选 */
  selectionOnDrag: boolean;
  /** 框选模式 */
  selectionMode: 'partial' | 'full';
  /** 节点是否可选 */
  nodesSelectable: boolean;
  /** 边是否可选 */
  edgesSelectable: boolean;
  /** 选择时是否自动聚焦 */
  selectNodesOnDrag: boolean;
}

/** 默认选择模型（M1） */
export const DEFAULT_SELECTION_CONFIG: SelectionModelConfig = {
  multiSelectionKeyCode: 'Shift',
  selectionKeyCode: 'Meta',
  selectionOnDrag: true,
  selectionMode: 'partial',
  nodesSelectable: true,
  edgesSelectable: true,
  selectNodesOnDrag: true,
};

export interface UseBlueprintSelectionOptions {
  /** Ctrl+A 全选回调 */
  onSelectAll?: () => void;
  /** Delete 删除回调 */
  onDelete?: () => void;
  /** 配置覆盖（用于测试或自定义） */
  configOverrides?: Partial<SelectionModelConfig>;
}

/**
 * 蓝图选择模型 Hook。
 *
 * 返回：
 * - config：传给 <ReactFlow /> 的选择相关 props
 * - 通过 useKeyPress 监听 Ctrl+A / Delete 快捷键，触发回调
 */
export function useBlueprintSelection(options: UseBlueprintSelectionOptions = {}): {
  config: SelectionModelConfig;
} {
  const { onSelectAll, onDelete, configOverrides } = options;

  const config: SelectionModelConfig = {
    ...DEFAULT_SELECTION_CONFIG,
    ...configOverrides,
  };

  // Ctrl+A 全选（Mac 用 Meta+A，Windows 用 Control+A）
  const isSelectAllPressed = useKeyPress(['Control+a', 'Meta+a'], {
    preventDefault: true,
  });

  // Delete/Backspace 删除选中
  const isDeletePressed = useKeyPress(['Delete', 'Backspace'], {
    preventDefault: true,
  });

  // 按键按下时触发回调（仅在 false→true 边沿触发，避免重复）
  useEffect(() => {
    if (isSelectAllPressed) {
      onSelectAll?.();
    }
  }, [isSelectAllPressed, onSelectAll]);

  useEffect(() => {
    if (isDeletePressed) {
      onDelete?.();
    }
  }, [isDeletePressed, onDelete]);

  // 稳定 config 引用，避免子组件重渲染
  const stableConfig = useCallback(() => config, [config])();
  return { config: stableConfig };
}
