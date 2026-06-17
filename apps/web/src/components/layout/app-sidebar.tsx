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
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
          : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span>{item.text}</span>}
      {!collapsed && isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary-foreground" />
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
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/60 bg-card/80 backdrop-blur-md transition-all duration-300 ease-in-out',
        'lg:translate-x-0',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        mobileOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border/60 px-5 transition-all',
          collapsed && 'lg:justify-center lg:px-3',
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-primary to-primary/70 flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
            N
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Nebula
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto lg:hidden"
          onClick={closeMobileSidebar}
        >
          <X />
        </Button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {menuGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <div className="text-muted-foreground/60 mb-3 px-3 text-xs font-semibold uppercase tracking-wider">
                {group.label}
              </div>
            )}
            {collapsed && <div className="mx-auto mb-3 h-px w-8 bg-border/60" />}
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

      <div className="hidden shrink-0 border-t border-border/60 p-4 lg:block">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'text-muted-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground cursor-pointer',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <PanelLeftOpen className="size-4 shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right">展开侧边栏</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span>收起侧边栏</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
