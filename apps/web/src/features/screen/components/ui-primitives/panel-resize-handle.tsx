/**
 * 面板宽度拖拽手柄
 *
 * 4px 宽的拖拽条，贴在面板边缘；hover/拖拽中高亮，双击复位默认宽度。
 * 拖拽期间给 body 加 col-resize 光标并禁用文本选择。
 */

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PanelResizeHandleProps {
  /** 拖拽中状态（来自 useResizablePanel） */
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

export function PanelResizeHandle({
  isDragging,
  onPointerDown,
  onDoubleClick,
}: PanelResizeHandleProps) {
  // 拖拽期间全局光标 + 禁用文本选择
  useEffect(() => {
    if (!isDragging) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        'w-1 shrink-0 cursor-col-resize touch-none transition-colors',
        'hover:bg-primary/40',
        isDragging ? 'bg-primary/60' : 'bg-transparent',
      )}
    />
  );
}
