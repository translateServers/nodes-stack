import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUiStore } from '@/store';
import { Breadcrumb } from './breadcrumb';
import { UserMenu } from './user-menu';

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

export function AppHeader() {
  const toggleMobileSidebar = useUiStore((s) => s.toggleMobileSidebar);

  return (
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
  );
}
