/**
 * 面板宽度拖拽调整 hook
 *
 * 用于编辑器左右侧面板的宽度自定义：
 * - 拖拽 handle 实时调整，min/max 钳制
 * - 双击 handle 复位到默认宽度
 * - 宽度持久化到 localStorage（按 storageKey 区分左右面板）
 *
 * 性能优化（react-best-practices）：
 * - js-cache-storage：拖拽结束时一次性写 localStorage，避免 pointermove 高频写入
 * - advanced-event-handler-refs：widthRef 在 render 期同步，handlePointerDown 依赖空数组稳定
 * - client-passive-event-listeners：pointermove/pointerup 使用 passive 监听
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizablePanelOptions {
  /** 默认宽度（px） */
  defaultWidth: number;
  /** 最小宽度（px） */
  minWidth: number;
  /** 最大宽度（px） */
  maxWidth: number;
  /** localStorage 持久化 key */
  storageKey: string;
  /** 拖拽方向：左面板向右拖为 'right'，右面板向左拖为 'left' */
  direction: 'left' | 'right';
}

function readStoredWidth(storageKey: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function useResizablePanel({
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  direction,
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState(() =>
    Math.min(maxWidth, Math.max(minWidth, readStoredWidth(storageKey, defaultWidth))),
  );
  const [isDragging, setIsDragging] = useState(false);
  // 拖拽起点：初始指针 x 与初始宽度
  const dragStartRef = useRef<{ pointerX: number; width: number } | null>(null);

  // P0 优化：render 期同步 width 到 ref，handlePointerDown 依赖空数组稳定
  // advanced-event-handler-refs：避免 handlePointerDown 依赖 width 频繁重建
  const widthRef = useRef(width);
  widthRef.current = width;

  const clamp = useCallback(
    (value: number) => Math.min(maxWidth, Math.max(minWidth, Math.round(value))),
    [minWidth, maxWidth],
  );

  // js-cache-storage：拖拽结束后一次性写入 localStorage，避免 pointermove 高频写入
  const persistWidth = useCallback(
    (value: number) => {
      try {
        localStorage.setItem(storageKey, String(value));
      } catch {
        // 隐私模式等场景下写入失败，忽略
      }
    },
    [storageKey],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStartRef.current = { pointerX: e.clientX, width: widthRef.current };
    setIsDragging(true);
  }, []);

  /** 双击复位默认宽度并持久化 */
  const handleDoubleClick = useCallback(() => {
    setWidth(defaultWidth);
    persistWidth(defaultWidth);
  }, [defaultWidth, persistWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const delta = e.clientX - start.pointerX;
      // 左面板（direction=right）：指针右移增宽；右面板（direction=left）：指针左移增宽
      const next = direction === 'right' ? start.width + delta : start.width - delta;
      setWidth(clamp(next));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      // 拖拽结束时一次性持久化最终宽度
      persistWidth(widthRef.current);
    };

    // client-passive-event-listeners：拖拽场景不调用 preventDefault，passive 提升滚动性能
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, clamp, direction, persistWidth]);

  return { width, isDragging, handlePointerDown, handleDoubleClick };
}
