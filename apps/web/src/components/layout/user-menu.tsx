import { LogOut, Settings, User } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store';
import { useLogout } from '@/api';

export function UserMenu() {
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
