import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'border-primary size-6 animate-spin rounded-full border-2 border-t-transparent',
        className,
      )}
    />
  );
}
