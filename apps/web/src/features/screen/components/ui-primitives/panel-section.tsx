/**
 * 编辑器分区容器（面板内统一视觉语言）
 *
 * 用于左侧组件库/图层面板与右侧属性面板内的分区：
 * - 统一标题样式（text-xs font-medium）与间距
 * - 可折叠（collapsible 时点击标题切换内容显隐，折叠态记忆在组件内部）
 * - 支持标题右侧操作位（actions）
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PanelSectionProps {
  /** 分区标题 */
  title: ReactNode;
  /** 标题右侧操作位（如小型图标按钮） */
  actions?: ReactNode;
  /** 是否可折叠，默认 false */
  collapsible?: boolean;
  /** 可折叠时的初始展开状态，默认 true */
  defaultOpen?: boolean;
  /** 内容区额外 className */
  contentClassName?: string;
  /** E2E/单测定位用 data-testid（渲染在 section 根节点上） */
  testId?: string;
  children: ReactNode;
}

export function PanelSection({
  title,
  actions,
  collapsible = false,
  defaultOpen = true,
  contentClassName,
  testId,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section data-testid={testId} className="border-b border-border last:border-b-0">
      <div
        className={cn(
          'flex h-8 items-center gap-1 px-3 text-xs font-medium text-foreground',
          collapsible && 'cursor-pointer select-none hover:bg-accent/50',
        )}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        {collapsible && (
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              !open && '-rotate-90',
            )}
          />
        )}
        <span className="flex-1 truncate">{title}</span>
        {actions && (
          // 操作位点击不触发折叠
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5">
            {actions}
          </div>
        )}
      </div>
      {(!collapsible || open) && (
        <div className={cn('px-3 pt-1 pb-3', contentClassName)}>{children}</div>
      )}
    </section>
  );
}
