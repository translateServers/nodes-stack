import { Link, useLocation } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store';
import { menuGroups, type NavItem } from '@/config/navigation';

function SidebarNavItem({
  item,
  collapsed,
  onClose,
}: {
  item: NavItem;
  collapsed: boolean;
  onClose?: () => void;
}) {
  const Icon = item.icon;
  const { pathname } = useLocation();
  const isActive = item.path === '/' ? pathname === '/' : pathname === item.path;

  const link = (
    <Link
      to={item.path}
      onClick={onClose}
      className={cn(
        'group relative flex items-center overflow-hidden rounded-xl py-2.5 text-sm font-medium',
        'transition-[background-color,color,box-shadow,padding-left,padding-right,gap] duration-300 ease-in-out',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
          : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
        collapsed ? 'lg:px-[14px] lg:gap-0' : 'px-3 gap-3',
      )}
    >
      <div className="flex size-5 shrink-0 items-center justify-center">
        <Icon className="size-4 shrink-0" />
      </div>
      <span
        className={cn(
          'min-w-0 whitespace-nowrap overflow-hidden',
          collapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[160px] opacity-100',
        )}
        style={{
          transitionProperty: 'max-width, opacity',
          transitionDuration: collapsed ? '100ms' : '150ms',
          transitionDelay: collapsed ? '50ms' : '150ms',
          transitionTimingFunction: 'ease-in-out',
        }}
      >
        {item.text}
      </span>
      {isActive && (
        <div
          className={cn(
            'absolute left-0 top-1/2 h-6 w-1 rounded-r-full bg-primary-foreground transition-opacity duration-150',
            collapsed ? 'lg:opacity-0' : 'opacity-100',
          )}
          style={{
            transform: 'translateY(-50%)',
            transitionDelay: collapsed ? '0ms' : '150ms',
          }}
        />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="w-auto">
          {item.text}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function AppSidebar() {
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const closeMobileSidebar = useUiStore((s) => s.closeMobileSidebar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/60 bg-card/80 backdrop-blur-md overflow-hidden',
        'lg:translate-x-0',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        mobileOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center overflow-hidden border-b border-border/60',
          'transition-[padding-left,padding-right,gap] duration-300 ease-in-out',
          collapsed ? 'lg:px-[14px] lg:gap-0' : 'px-4 gap-2.5',
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
          N
        </div>
        <span
          className={cn(
            'min-w-0 whitespace-nowrap overflow-hidden text-lg font-semibold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent',
            collapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[160px] opacity-100',
          )}
          style={{
            transitionProperty: 'max-width, opacity',
            transitionDuration: collapsed ? '100ms' : '150ms',
            transitionDelay: collapsed ? '50ms' : '150ms',
            transitionTimingFunction: 'ease-in-out',
          }}
        >
          Nebula
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto shrink-0 lg:hidden"
          onClick={closeMobileSidebar}
        >
          <X />
        </Button>
      </div>

      <nav
        className={cn(
          'flex-1 overflow-y-auto py-4 space-y-5',
          'transition-[padding-left,padding-right] duration-300 ease-in-out',
          collapsed ? 'lg:px-2 lg:space-y-3' : 'px-4',
        )}
      >
        {menuGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div
              className={cn(
                'whitespace-nowrap overflow-hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground/60',
                collapsed
                  ? 'lg:max-w-0 lg:opacity-0 lg:h-0 lg:mb-0 lg:px-0'
                  : 'max-w-[160px] opacity-100 h-auto mb-3 px-3',
              )}
              style={{
                transitionProperty:
                  'max-width, opacity, height, margin-bottom, padding-left, padding-right',
                transitionDuration: collapsed ? '100ms' : '150ms',
                transitionDelay: collapsed ? '50ms' : '150ms',
                transitionTimingFunction: 'ease-in-out',
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => (
              <SidebarNavItem
                key={item.text}
                item={item}
                collapsed={collapsed}
                onClose={closeMobileSidebar}
              />
            ))}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'shrink-0 border-t border-border/60 hidden lg:block py-4',
          'transition-[padding-left,padding-right] duration-300 ease-in-out',
          collapsed ? 'lg:px-2' : 'px-4',
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleSidebar}
              className={cn(
                'text-muted-foreground flex w-full items-center overflow-hidden rounded-xl py-2.5 text-sm font-medium',
                'transition-[background-color,color,padding-left,padding-right,gap] duration-300 ease-in-out hover:bg-muted hover:text-foreground cursor-pointer',
                collapsed ? 'lg:px-[14px] lg:gap-0' : 'px-3 gap-3',
              )}
            >
              <div className="flex size-5 shrink-0 items-center justify-center">
                {collapsed ? (
                  <PanelLeftOpen className="size-4 shrink-0" />
                ) : (
                  <PanelLeftClose className="size-4 shrink-0" />
                )}
              </div>
              <span
                className={cn(
                  'min-w-0 whitespace-nowrap overflow-hidden',
                  collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100',
                )}
                style={{
                  transitionProperty: 'max-width, opacity',
                  transitionDuration: collapsed ? '100ms' : '150ms',
                  transitionDelay: collapsed ? '50ms' : '150ms',
                  transitionTimingFunction: 'ease-in-out',
                }}
              >
                收起侧边栏
              </span>
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">展开侧边栏</TooltipContent>}
        </Tooltip>
      </div>
    </aside>
  );
}
