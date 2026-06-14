import type * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Dialog ─────────────────────────────────────────────

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div className="bg-background relative z-50 w-full max-w-lg rounded-lg border shadow-lg">
        {children}
      </div>
    </div>
  );
}

// ── DialogHeader ───────────────────────────────────────

function DialogHeader({
  className,
  title,
  description,
  onClose,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  title?: string;
  description?: string;
  onClose?: () => void;
}) {
  return (
    <div className={cn('flex flex-col space-y-1.5 border-b px-6 py-4', className)} {...props}>
      <div className="flex items-center justify-between">
        {title && <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      {children}
    </div>
  );
}

// ── DialogBody ─────────────────────────────────────────

function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-6 py-4', className)} {...props} />;
}

// ── DialogFooter ───────────────────────────────────────

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export { Dialog, DialogHeader, DialogBody, DialogFooter };
