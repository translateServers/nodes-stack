import type * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'bg-card text-card-foreground border-border',
      destructive:
        'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'h5'>) {
  return (
    <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />;
}

function InlineAlert({
  className,
  variant = 'default',
  title,
  children,
}: {
  className?: string;
  variant?: VariantProps<typeof alertVariants>['variant'];
  title?: string;
  children: React.ReactNode;
}) {
  const Icon = variant === 'destructive' ? AlertCircle : CircleAlert;

  return (
    <Alert variant={variant} className={cn('flex items-start gap-3', className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        <AlertDescription>{children}</AlertDescription>
      </div>
    </Alert>
  );
}

export { Alert, AlertDescription, AlertTitle, InlineAlert };
