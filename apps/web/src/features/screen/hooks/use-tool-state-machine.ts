/**
 * 工具状态机 + 临时切换栈（PS 软件级骨架）
 *
 * 实现"按住临时切工具，松开恢复"的核心能力。
 * 例如：用户当前在"移动"工具，按住 Space 临时切到"抓手"，
 * 松开 Space 自动恢复"移动"。支持多个修饰键压栈。
 *
 * 任务 2.4 补充恢复语义：
 * - 窗口失焦（window blur）时清空临时栈，避免用户按住 Space 切到其他应用后
 *   工具卡在"抓手"状态（松开 Space 的 keyup 事件不会到达本窗口）
 * - 任何异常结束后 `activeTool` 必须恢复为 `currentTool`，栈中不残留临时工具
 *
 * 本文件仅提供状态机骨架，工具切换的实际副作用
 * （光标样式、画布交互模式等）由调用方根据 activeTool 自行实现。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type EditorTool } from './tool-registry';

export type { EditorTool };

export interface ToolStateMachineApi {
  /** 当前生效的工具（可能是临时工具，栈顶非空时取栈顶） */
  activeTool: EditorTool;
  /** 用户选定的主工具（不含临时切换） */
  currentTool: EditorTool;
  /** 临时工具栈是否非空 */
  hasTemporaryTool: boolean;
  /** 切换主工具（清空临时栈） */
  setTool: (tool: EditorTool) => void;
  /** 按住修饰键时压入临时工具（幂等：已存在则不重复压入） */
  pushTemporaryTool: (tool: EditorTool) => void;
  /** 松开修饰键时弹出临时工具（移除栈中所有该工具实例） */
  popTemporaryTool: (tool: EditorTool) => void;
  /** 手动清空临时工具栈（如异常恢复、菜单关闭） */
  clearTemporaryTools: () => void;
}

/**
 * 工具状态机 hook
 *
 * - currentTool 用 useState（需触发 UI 重渲染切换光标样式）
 * - temporaryToolStack 用 useRef（避免高频 keydown 引起重渲染）
 * - activeTool 通过 useState 触发派生更新
 *
 * 由于 React 19 没有 useSyncExternalStore 的需要，
 * 这里用 state + ref 双轨：ref 在回调中读取避免闭包陈旧，
 * state 触发 UI 重渲染。
 */
export function useToolStateMachine(): ToolStateMachineApi {
  const [currentTool, setCurrentTool] = useState<EditorTool>('select');
  const [temporaryTop, setTemporaryTop] = useState<EditorTool | null>(null);

  // 临时工具栈，用 ref 维护避免高频 keydown 触发重渲染
  const stackRef = useRef<EditorTool[]>([]);

  const syncTop = useCallback(() => {
    const stack = stackRef.current;
    const top = stack.length > 0 ? stack[stack.length - 1] : null;
    setTemporaryTop(top);
  }, []);

  const setTool = useCallback((tool: EditorTool) => {
    // 切换主工具时清空临时栈
    stackRef.current = [];
    setTemporaryTop(null);
    setCurrentTool(tool);
  }, []);

  const pushTemporaryTool = useCallback(
    (tool: EditorTool) => {
      const stack = stackRef.current;
      // 幂等：避免 keydown repeat 事件重复压栈
      if (stack[stack.length - 1] === tool) return;
      // 也避免同一工具在栈中重复出现
      if (stack.includes(tool)) return;
      stackRef.current = [...stack, tool];
      syncTop();
    },
    [syncTop],
  );

  const popTemporaryTool = useCallback(
    (tool: EditorTool) => {
      const stack = stackRef.current;
      if (!stack.includes(tool)) return;
      stackRef.current = stack.filter((t) => t !== tool);
      syncTop();
    },
    [syncTop],
  );

  const clearTemporaryTools = useCallback(() => {
    if (stackRef.current.length === 0) return;
    stackRef.current = [];
    syncTop();
  }, [syncTop]);

  /**
   * 任务 2.4：监听 window blur 事件，失焦时清空临时栈
   *
   * 用户按住 Space 临时切到抓手后，如果切到其他应用（window blur），
   * 松开 Space 的 keyup 事件不会到达本窗口，导致 activeTool 卡在 'hand'。
   * 失焦时主动清空栈，确保 activeTool 恢复为 currentTool。
   *
   * 注意：仅在浏览器环境执行，SSR / 测试环境（无 window）安全跳过。
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBlur = () => {
      clearTemporaryTools();
    };
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [clearTemporaryTools]);

  const activeTool = useMemo<EditorTool>(
    () => temporaryTop ?? currentTool,
    [temporaryTop, currentTool],
  );

  const hasTemporaryTool = temporaryTop !== null;

  return {
    activeTool,
    currentTool,
    hasTemporaryTool,
    setTool,
    pushTemporaryTool,
    popTemporaryTool,
    clearTemporaryTools,
  };
}
