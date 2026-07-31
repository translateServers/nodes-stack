/**
 * 画布组件闪烁高亮 Hook（任务 9.1）
 *
 * 职责：管理"待闪烁"的 componentId 与自动清除定时器。
 * - 触发：调用 flashComponent(id) 设置待闪烁 id
 * - 清除：FLASH_MS 后自动清除（默认 1500ms）
 * - 手动清除：调用 clearFlash() 立即清除
 *
 * 使用场景：
 * - 蓝图 Sheet 内点击节点 → getNodeLocateComponentId → flashComponent(id)
 * - 主画布渲染时读取 flashingComponentId，匹配则应用闪烁动画样式
 *
 * 注意：本 Hook 仅管理"哪个 componentId 需要闪烁"，不负责具体渲染（由调用方读取 state 应用样式）。
 * 卸载时自动清理定时器，避免浮动回调。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** 闪烁保持时间（ms）：1.5s 后自动清除 */
const FLASH_MS = 1500;

export interface UseCanvasFlashReturn {
  /** 当前待闪烁的 componentId；为 null 表示无闪烁 */
  flashingComponentId: string | null;
  /** 触发对指定 componentId 的闪烁 */
  flashComponent: (componentId: string) => void;
  /** 立即清除闪烁状态 */
  clearFlash: () => void;
}

/**
 * 画布闪烁高亮状态机。
 *
 * @param flashMs  闪烁保持时间（测试可注入；默认 1500ms）
 */
export function useCanvasFlash(flashMs: number = FLASH_MS): UseCanvasFlashReturn {
  const [flashingComponentId, setFlashingComponentId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlash = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFlashingComponentId(null);
  }, []);

  const flashComponent = useCallback(
    (componentId: string): void => {
      // 清除上一次的定时器（重复触发时重置计时）
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setFlashingComponentId(componentId);
      timerRef.current = setTimeout(() => {
        setFlashingComponentId(null);
        timerRef.current = null;
      }, flashMs);
    },
    [flashMs],
  );

  // 卸载清理
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return {
    flashingComponentId,
    flashComponent,
    clearFlash,
  };
}
