import { NavLink, Outlet } from 'react-router';
import { LayoutDashboard, Menu, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store';

const DRAWER_WIDTH = '16rem';

const menuItems = [
  { text: '仪表盘', icon: LayoutDashboard, path: '/' },
  { text: '用户管理', icon: Users, path: '/users' },
];

export default function MainLayout() {
  const mobileOpen = useUiStore((state) => state.mobileSidebarOpen);
  const toggleMobileSidebar = useUiStore((state) => state.toggleMobileSidebar);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);

  return (
    <div className="bg-muted/20 min-h-screen text-foreground">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="关闭侧边栏"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobileSidebar}
        />
      ) : null}

      <aside
        className={cn(
          'bg-background fixed inset-y-0 left-0 z-50 w-64 border-r transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ width: DRAWER_WIDTH }}
      >
        <div className="flex h-16 items-center justify-between border-b px-6 lg:justify-start">
          <div className="text-lg font-semibold">Nebula</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={closeMobileSidebar}
          >
            <X />
          </Button>
        </div>
        <nav className="space-y-1 p-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.text}
                to={item.path}
                end={item.path === '/'}
                onClick={closeMobileSidebar}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                <span>{item.text}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-background/95 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={toggleMobileSidebar}
          >
            <Menu />
          </Button>
          <div>
            <div className="text-base font-semibold">管理后台</div>
          </div>
        </header>
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
