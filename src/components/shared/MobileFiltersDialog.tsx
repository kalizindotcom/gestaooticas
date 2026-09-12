import type { ReactNode } from 'react';
import { Filter, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface MobileFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  activeCount?: number;
  onClear?: () => void;
  onApply?: () => void;
  children: ReactNode;
  className?: string;
}

export function MobileFiltersDialog({
  open,
  onOpenChange,
  title = 'Filtros',
  description = 'Ajuste os critérios sem perder espaço na tela.',
  activeCount = 0,
  onClear,
  onApply,
  children,
  className,
}: MobileFiltersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('!flex max-h-[min(92dvh,760px)] w-[calc(100vw-1.25rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-full', className)}>
        <DialogHeader className="shrink-0 border-b border-border/70 bg-card px-4 py-4 text-left sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base font-black">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary"><SlidersHorizontal className="h-4 w-4" /></span>
            {title}
            {activeCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">{activeCount} ativo{activeCount === 1 ? '' : 's'}</span>}
          </DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        <DialogFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t border-border/70 bg-card px-4 py-3 sm:px-5">
          <Button type="button" variant="ghost" className="h-10 gap-2 px-2 text-xs text-muted-foreground" onClick={() => { onClear?.(); }}>
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </Button>
          <Button type="button" className="h-10 gap-2 rounded-xl px-5 text-xs font-bold" onClick={() => { onApply?.(); onOpenChange(false); }}>
            <Filter className="h-3.5 w-3.5" /> Aplicar filtros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MobileFiltersButton({ activeCount = 0, onClick, className }: { activeCount?: number; onClick: () => void; className?: string }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className={cn('h-10 w-full justify-center gap-2 rounded-xl border-primary/25 bg-primary/[0.04] text-xs font-bold sm:w-auto', className)}>
      <Filter className="h-3.5 w-3.5 text-primary" /> Filtros
      {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{activeCount}</span>}
    </Button>
  );
}

export function MobileFilterField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>{children}</div>;
}

export function MobileFiltersIcon() {
  return <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><Filter className="h-3.5 w-3.5" /></span>;
}
