import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { listenApiError, type ApiErrorEventDetail } from '@/api/core/api-error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ApiErrorSnackbar() {
  const [detail, setDetail] = useState<ApiErrorEventDetail | null>(null);

  useEffect(() => {
    return listenApiError((nextDetail) => {
      setDetail(nextDetail);
    });
  }, []);

  useEffect(() => {
    if (!detail) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDetail(null);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [detail]);

  if (!detail) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <div
        className={cn(
          'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur',
          detail.severity === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-destructive/20 bg-destructive/95 text-destructive-foreground',
        )}
      >
        <div className="min-w-0 flex-1 text-sm font-medium">{detail.message}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6 self-start rounded-md text-current hover:bg-black/10 hover:text-current"
          onClick={() => setDetail(null)}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
