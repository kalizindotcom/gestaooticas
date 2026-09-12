import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("relative flex flex-col items-center justify-center py-16 sm:py-20 text-center animate-fade-in", className)}>
      {/* glow decorations */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 blur-2xl" />
        <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-purple-500/10 border border-primary/20 grid place-items-center shadow-xl">
          <Icon className="h-9 w-9 text-primary/60" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="font-heading font-bold text-lg text-foreground mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
}