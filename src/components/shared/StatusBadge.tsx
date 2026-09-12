import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  label?: string;
  variant?: 'default' | 'dot' | 'pill';
  statusMap?: Record<string, { label: string; color: string }>;
  className?: string;
}

const defaultMap: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  inactive: { label: 'Inativo', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  vacation: { label: 'Férias', color: 'bg-amber-50 text-amber-700 border-amber-200/60' },

  prospect: { label: 'Prospecto', color: 'bg-blue-50 text-blue-700 border-blue-200/60' },
  vip: { label: 'VIP', color: 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm shadow-amber-100' },
  blocked: { label: 'Bloqueado', color: 'bg-red-50 text-red-700 border-red-200/60' },
  paid: { label: 'Pago', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  partially_paid: { label: 'Pago Parcial', color: 'bg-amber-50 text-amber-700 border-amber-200/60' },
  pending: { label: 'Pendente', color: 'bg-amber-50 text-amber-700 border-amber-200/60' },
  overdue: { label: 'Atrasado', color: 'bg-red-50 text-red-700 border-red-200/60' },
  completed: { label: 'Concluído', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  cancelled: { label: 'Cancelada', color: 'bg-red-50 text-red-700 border-red-200/60' },
  in_production: { label: 'Em produção', color: 'bg-blue-50 text-blue-700 border-blue-200/60' },
  ready: { label: 'Pronta', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  delivered: { label: 'Entregue', color: 'bg-indigo-50 text-indigo-700 border-indigo-200/60' },
  opened: { label: 'Em preparação', color: 'bg-slate-100 text-slate-700 border-slate-200/60' },
  analyzing: { label: 'Em Análise', color: 'bg-sky-50 text-sky-700 border-sky-200/60' },
  waiting_approval: { label: 'Aguar. Aprovação', color: 'bg-orange-50 text-orange-700 border-orange-200/60' },
  waiting_lab: { label: 'Aguardando laboratório', color: 'bg-purple-50 text-purple-700 border-purple-200/60' },
  waiting_part: { label: 'Aguar. Peça', color: 'bg-pink-50 text-pink-700 border-pink-200/60' },
  waiting_client: { label: 'Aguar. Cliente', color: 'bg-teal-50 text-teal-700 border-teal-200/60' },
};

const dotColorMap: Record<string, string> = {
  active: 'bg-emerald-500', paid: 'bg-emerald-500', completed: 'bg-emerald-500', ready: 'bg-emerald-500', delivered: 'bg-indigo-500',
  pending: 'bg-amber-500', overdue: 'bg-red-500', partially_paid: 'bg-amber-500',
  in_production: 'bg-blue-500', opened: 'bg-slate-500', analyzing: 'bg-sky-500',
  waiting_approval: 'bg-orange-500', waiting_lab: 'bg-purple-500', waiting_part: 'bg-pink-500', waiting_client: 'bg-teal-500',
  inactive: 'bg-slate-400', cancelled: 'bg-red-500',
  vip: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  blocked: 'bg-red-600',
};

export function StatusBadge({ status, label, variant = 'default', statusMap, className }: StatusBadgeProps) {
  const map = statusMap || defaultMap;
  const config = map[status] || { label: status, color: 'bg-muted text-muted-foreground border-border' };
  const displayLabel = label || config.label;

  if (variant === 'dot') {
    const dotColor = dotColorMap[status] || 'bg-muted-foreground';
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-offset-1 ring-offset-card", dotColor, dotColor.replace('bg-', 'ring-') + '/30')} />
        <span className="text-xs font-medium">{displayLabel}</span>
      </div>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border leading-none tracking-wide",
      config.color,
      className
    )}>
      {displayLabel}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const priorityMap: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'bg-slate-100 text-slate-700 border-slate-200/60' },
  medium: { label: 'Média', color: 'bg-blue-50 text-blue-700 border-blue-200/60' },
  high: { label: 'Alta', color: 'bg-orange-50 text-orange-700 border-orange-200/60' },
  urgent: { label: 'Urgente', color: 'bg-red-50 text-red-700 border-red-200/60' },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityMap[priority] || { label: priority, color: 'bg-muted text-muted-foreground border-border' };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider",
      config.color,
      className
    )}>
      {config.label}
    </span>
  );
}
