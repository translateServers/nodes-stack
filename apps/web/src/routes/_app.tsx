import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from '@tanstack/react-router';
import {
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  User,
  Users,
  X,
  BookOpen,
  Shield,
  FileText,
  Bell,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuthStore, useUiStore } from '@/store';
import { useLogout } from '@/api';

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    // 直接检查 accessToken 而非 isAuthenticated 标志，
    // 因为 Zustand persist 中间件的 onRehydrateStorage 回调是异步执行的，
    // 首次 beforeLoad 时 isAuthenticated 可能尚未被设置为 true，
    // 但 accessToken 已在水合阶段同步恢复。
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/login' });
    }
  },
  component: AppLayout,
});

const menuGroups = [
  {
    label: '概览',
    items: [{ text: '仪表盘', icon: LayoutDashboard, path: '/' }],
  },
  {
    label: '系统管理',
    items: [
      { text: '用户管理', icon: Users, path: '/users' },
      { text: '菜单管理', icon: BookOpen, path: '/menus' },
      { text: '角色管理', icon: Shield, path: '/roles' },
      { text: '字典管理', icon: FileText, path: '/dict' },
    ],
  },
];

const pathLabels: Record<string, string> = {
  '/': '仪表盘',
  '/users': '用户管理',
  '/menus': '菜单管理',
  '/roles': '角色管理',
  '/dict': '字典管理',
};

function Breadcrumb() {
  const { pathname } = useLocation();
  const label = pathLabels[pathname] ?? '';

  return (
    <nav aria-label="面包屑" className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">首页</span>
      {pathname !== '/' && label && (
        <>
          <ChevronRight className="text-muted-foreground/60 size-3.5" />
          <span className="font-medium">{label}</span>
        </>
      )}
    </nav>
  );
}

function SidebarNavItem({
  item,
  collapsed,
  onClose,
}: {
  item: { text: string; icon: React.ComponentType<{ className?: string }>; path: string };
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

function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const toggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={toggle} aria-label="切换主题">
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function NotificationButton() {
  return (
    <Button type="button" variant="ghost" size="icon-sm" className="relative">
      <Bell className="size-4" />
      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
        3
      </span>
    </Button>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : '管';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-xl p-1.5 transition-all hover:bg-muted cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar size="sm" className="border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left lg:block">
            <div className="text-sm font-medium leading-tight">{user?.name ?? '管理员'}</div>
            <div className="text-muted-foreground text-xs leading-tight">
              {user?.email ?? 'admin@nebula.app'}
            </div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56 border-border/60">
        <DropdownMenuLabel className="p-4">
          <div className="flex flex-col">
            <span className="font-medium">{user?.name ?? '管理员'}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {user?.email ?? 'admin@nebula.app'}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2">
          <User className="size-4" />
          <span>个人资料</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2">
          <Settings className="size-4" />
          <span>系统设置</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="gap-2"
          onClick={() => {
            logoutMutation.mutate(undefined, {
              onSettled: () => {
                void navigate({ to: '/login', replace: true });
              },
            });
          }}
        >
          <LogOut className="size-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppLayout() {
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleMobileSidebar = useUiStore((s) => s.toggleMobileSidebar);
  const closeMobileSidebar = useUiStore((s) => s.closeMobileSidebar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

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

      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300 ease-in-out',
          collapsed ? 'lg:pl-16' : 'lg:pl-64',
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-card/90 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={toggleMobileSidebar}
            >
              <Menu />
            </Button>
            <Breadcrumb />
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                type="text"
                placeholder="搜索..."
                className="w-64 pl-10 rounded-xl border-border/60 bg-muted/50 focus:bg-card"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationButton />
            <UserMenu />
          </div>
        </header>

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
