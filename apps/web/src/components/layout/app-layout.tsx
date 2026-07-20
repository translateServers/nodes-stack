import { Outlet } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';
import { useLayoutConfig } from './use-layout-config';

export function AppLayout() {
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const closeMobileSidebar = useUiStore((s) => s.closeMobileSidebar);
  const layout = useLayoutConfig();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {layout.sidebar && mobileOpen && (
        <button
          type="button"
          aria-label="关闭侧边栏"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {layout.sidebar && <AppSidebar />}

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding-left] duration-300 ease-in-out',
          // 仅在显示侧边栏时根据折叠状态留出空间
          layout.sidebar && (collapsed ? 'lg:pl-16' : 'lg:pl-64'),
        )}
      >
        {layout.header && <AppHeader />}

        <main className={cn('flex-1', layout.mainPadding ? 'p-4 lg:p-6' : '')}>
          <Outlet />
        </main>

        {layout.footer && (
          <footer className="border-t border-border/60 px-4 py-4 lg:px-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>&copy; 2024 Nebula Admin</span>
              <span>v1.0.0</span>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
