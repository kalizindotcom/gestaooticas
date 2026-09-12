import React from 'react';
import { Info } from 'lucide-react';

export function FinancialInfoTip({ title = 'Dica rápida', children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`financial-info-tip flex items-start gap-2.5 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3.5 py-3 text-xs ${className}`}>
      <span className="financial-info-tip-icon mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300"><Info className="h-3.5 w-3.5" /></span>
      <div className="min-w-0"><p className="financial-info-tip-title font-bold text-violet-700 dark:text-violet-300">{title}</p><p className="mt-0.5 leading-relaxed text-muted-foreground">{children}</p></div>
    </div>
  );
}
