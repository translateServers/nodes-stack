import { ArrowRight } from 'lucide-react';

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export function QuickAction({ title, description, icon: Icon, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-all duration-300 hover:border-primary/40 hover:bg-card hover:shadow-md hover:shadow-primary/5 cursor-pointer"
    >
      <div className="bg-primary/10 flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:bg-primary/15 group-hover:scale-110">
        <Icon className="text-primary size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold transition-colors group-hover:text-primary">
          {title}
        </div>
        <div className="text-muted-foreground text-xs truncate">{description}</div>
      </div>
      <ArrowRight className="text-muted-foreground/50 size-4 shrink-0 transition-all duration-300 group-hover:text-primary group-hover:translate-x-1" />
    </button>
  );
}
