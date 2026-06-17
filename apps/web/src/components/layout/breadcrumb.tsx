import { ChevronRight } from 'lucide-react';
import { useLocation } from '@tanstack/react-router';
import { pathLabels } from '@/config/navigation';

export function Breadcrumb() {
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
