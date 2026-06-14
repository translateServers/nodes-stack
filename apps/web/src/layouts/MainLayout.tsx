import { NavLink, Outlet, useLocation } from 'react-router';
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
import { cn } from '@/lib/utils';
import { useAuthStore, useUiStore } from '@/store';

// ── Menu Config ─────────────────────────────────────────
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

// ── Breadcrumb ──────────────────────────────────────────
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

// ── Sidebar Nav Item ────────────────────────────────────
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
  const link = (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          collapsed && 'justify-center px-2',
        )
      }
    >
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && <span>{item.text}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.text}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

// ── Theme Toggle ────────────────────────────────────────
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

// ── User Menu ───────────────────────────────────────────
function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : '管';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar size="sm">
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
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{user?.name ?? '管理员'}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {user?.email ?? 'admin@nebula.app'}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User />
          <span>个人资料</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          <span>系统设置</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={clearAuth}>
          <LogOut />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main Layout ─────────────────────────────────────────
export default function MainLayout() {
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleMobileSidebar = useUiStore((s) => s.toggleMobileSidebar);
  const closeMobileSidebar = useUiStore((s) => s.closeMobileSidebar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="bg-muted/20 min-h-screen text-foreground">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="关闭侧边栏"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside
        className={cn(
          'bg-background fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-[width,transform] duration-300 ease-in-out',
          // Desktop: show + collapsible
          'lg:translate-x-0',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
          // Mobile: slide in/out
          mobileOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full',
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b px-5 transition-all',
            collapsed && 'lg:justify-center lg:px-3',
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground">
              N
            </div>
            {!collapsed && <span className="text-lg font-semibold tracking-tight">Nebula</span>}
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

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          {menuGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <div className="text-muted-foreground/70 mb-2 px-3 text-xs font-semibold uppercase tracking-wider">
                  {group.label}
                </div>
              )}
              {collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
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

        {/* Collapse toggle (desktop only) */}
        <div className="hidden shrink-0 border-t p-3 lg:block">
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              'text-muted-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground cursor-pointer',
              collapsed && 'justify-center px-2',
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PanelLeftOpen className="size-[18px] shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="right">展开侧边栏</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <PanelLeftClose className="size-[18px] shrink-0" />
                <span>收起侧边栏</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────── */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding-left] duration-300 ease-in-out',
          collapsed ? 'lg:pl-18' : 'lg:pl-64',
        )}
      >
        {/* Header */}
        <header className="bg-background/95 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur-md lg:px-6">
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t px-4 py-4 lg:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-muted-foreground">
            <span>&copy; 2024 Nebula Admin</span>
            <span>v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
