import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogClose 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer, Download, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '../StatusBadge';

interface DetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  status?: string;
  statusLabel?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onEdit?: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  className?: string;
}

export function DetailModal({
  open,
  onOpenChange,
  title,
  status,
  statusLabel,
  subtitle,
  children,
  actions,
  onEdit,
  onPrint,
  onExport,
  className
}: DetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-0 premium-shadow-lg", className)}>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-6 py-5 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-heading font-bold tracking-tight">{title}</DialogTitle>
              {status && <StatusBadge status={status} label={statusLabel} />}
            </div>
            {subtitle && <DialogDescription className="text-[13px] text-muted-foreground">{subtitle}</DialogDescription>}
          </div>
          
          <div className="flex items-center gap-2">
            {onPrint && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50" onClick={onPrint}>
                <Printer className="h-4 w-4" />
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50" onClick={onExport}>
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50 text-primary hover:bg-primary/5" onClick={onEdit}>
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {children}
          </div>
        </div>

        {(actions || onEdit) && (
          <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border/40 px-8 py-5 flex items-center justify-end gap-3 rounded-b-3xl">
            {actions}
            <DialogClose asChild>
              <Button variant="outline" className="h-10 px-6 rounded-xl border-border/60">Fechar</Button>
            </DialogClose>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DetailBlock({ title, children, className, colSpan = 6 }: { title: string, children: React.ReactNode, className?: string, colSpan?: number }) {
  const colSpanClass = {
    3: "md:col-span-3",
    4: "md:col-span-4",
    6: "md:col-span-6",
    8: "md:col-span-8",
    9: "md:col-span-9",
    12: "md:col-span-12",
  }[colSpan] || "md:col-span-6";

  return (
    <div className={cn(colSpanClass, "space-y-4", className)}>
      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-primary/80 px-1 border-l-2 border-primary/40 ml-1">
        {title}
      </h3>
      <div className="bg-muted/30 rounded-2xl p-5 border border-border/40 space-y-4">
        {children}
      </div>
    </div>
  );
}

export function DetailItem({ label, value, icon: Icon, className }: { label: string, value: React.ReactNode, icon?: any, className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[11px] font-medium text-muted-foreground/90 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 opacity-90" />}
        {label}
      </p>
      <div className="text-[14px] font-semibold text-foreground/90 break-words">{value || "—"}</div>
    </div>
  );
}