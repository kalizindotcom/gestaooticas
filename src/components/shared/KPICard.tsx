import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  format?: 'number' | 'currency' | 'percent';
  className?: string;
  accent?: string;
}

export function KPICard({ title, value, change, changeLabel, icon: Icon, format, className, accent }: KPICardProps) {
  const formattedValue = format === 'currency'
    ? `R$ ${Number(value).toLocaleString('pt-BR')}`
    : format === 'percent'
    ? `${value}%`
    : typeof value === 'number' ? value.toLocaleString('pt-BR') : value;

  const TrendIcon = change && change > 0 ? TrendingUp : change && change < 0 ? TrendingDown : Minus;
  const trendColor = change && change > 0 ? 'text-emerald-600' : change && change < 0 ? 'text-red-600' : 'text-muted-foreground';
  const trendBg = change && change > 0 ? 'bg-emerald-500/10' : change && change < 0 ? 'bg-red-500/10' : 'bg-muted';

  return (
    <div className={cn(
      "group relative bg-card rounded-2xl border border-border/60 p-5 transition-all duration-500 overflow-hidden hover-lift hover:border-primary/30",
      "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-primary/[0.03] before:via-transparent before:to-orange-500/[0.03] before:opacity-0 hover:before:opacity-100 before:transition-opacity",
      className
    )}>
      {/* glow on hover */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-orange-700 blur-md opacity-30 group-hover:opacity-60 transition-opacity" />
            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-700 grid place-items-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
              <Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
            </div>
          </div>
          {change !== undefined && (
            <div className={cn("flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full", trendColor, trendBg)}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="text-[28px] font-heading font-black text-foreground leading-none mb-1.5 tabular-nums tracking-tight">
          {formattedValue}
        </p>
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-[0.1em]">
          {title}
        </p>
        {changeLabel && <p className="text-[10px] text-muted-foreground/60 mt-1">{changeLabel}</p>}
      </div>
    </div>
  );
}