import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinancialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onPrint?: () => void;
  onExport?: () => void;
  className?: string;
}

export function FinancialModal({
  open,
  onOpenChange,
  title,
  children,
  onPrint,
  onExport,
  className
}: FinancialModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-[640px] p-0 gap-0", className)}>
        <DialogHeader className="p-6 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle>{title}</DialogTitle>
          <div className="flex items-center gap-2">
            {onPrint && (
              <Button variant="outline" size="sm" onClick={onPrint}>
                <Printer className="h-4 w-4 mr-2" /> Imprimir
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}