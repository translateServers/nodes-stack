/**
 * 工具栏图标按钮（编辑器统一视觉语言）
 *
 * 所有编辑器顶部/状态栏的图标按钮统一走此组件：
 * - 内置 Tooltip（支持快捷键提示，如 "撤销 Ctrl+Z"）
 * - 统一 active / disabled / hover 态
 */

import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ToolbarButtonProps extends ComponentProps<typeof Button> {
  /** Tooltip 文案；不传则不渲染 Tooltip */
  tooltip?: string;
  /** 快捷键提示（追加在 tooltip 后，如 "Ctrl+Z"） */
  shortcut?: string;
  /** 选中/激活态高亮 */
  active?: boolean;
  /** Tooltip 弹出方向，默认 bottom */
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

export function ToolbarButton({
  tooltip,
  shortcut,
  active = false,
  tooltipSide = 'bottom',
  className,
  children,
  ...props
}: ToolbarButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        'cursor-pointer text-muted-foreground hover:text-foreground',
        active && 'bg-accent text-accent-foreground hover:text-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={tooltipSide} className="text-xs">
        {tooltip}
        {shortcut && <span className="ml-1.5 text-muted-foreground">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
