import { Outlet } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';

export function AppLayout() {
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const closeMobileSidebar = useUiStore((s) => s.closeMobileSidebar);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <button
          type="button"
          aria-label="关闭侧边栏"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <AppSidebar />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'lg:pl-16' : 'lg:pl-64',
        )}
      >
        <AppHeader />

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border/60 px-4 py-4 lg:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-muted-foreground">
            <span>&copy; 2024 Nebula Admin</span>
            <span>v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
