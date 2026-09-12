import React from 'react';
import {
  Dialog, DialogContent, DialogTitle, DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onPrint?: () => void;
  onExport?: () => void;
  className?: string;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character] || character));
}

export function ReportModal({
  open,
  onOpenChange,
  title,
  children,
  onPrint,
  onExport,
  className
}: ReportModalProps) {
  const handlePrint = () => {
    const source = document.getElementById('print-section');
    if (!source) {
      onPrint?.();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      onPrint?.();
      return;
    }

    printWindow.opener = null;
    const printable = source.cloneNode(true) as HTMLElement;
    printable.removeAttribute('id');
    printable.id = 'print-root';
    printable.classList.remove('min-h-full');
    printable.querySelectorAll('.print-header').forEach(element => element.classList.remove('hidden'));
    printable.querySelectorAll('.no-print, [class*="no-print"]').forEach(element => element.remove());

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('');
    const safeTitle = escapeHtml(title);

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} · Gestão Óticas H2K</title>
  ${styles}
  <style>
    @page { size: A4; margin: 10mm; }
    :root { color-scheme: light; }
    *, *::before, *::after { box-sizing: border-box !important; }
    html, body { margin: 0 !important; padding: 0 !important; min-height: 100% !important; background: #ffffff !important; color: #111827 !important; font-family: Arial, Helvetica, sans-serif !important; }
    body { padding: 10mm !important; }
    #print-root { display: block !important; visibility: visible !important; position: static !important; width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #ffffff !important; color: #111827 !important; opacity: 1 !important; }
    #print-root, #print-root * { visibility: visible !important; opacity: 1 !important; color: #111827 !important; box-shadow: none !important; text-shadow: none !important; }
    #print-root .print-header, #print-root .print-header.hidden { display: flex !important; visibility: visible !important; }
    #print-root .no-print, #print-root [class*="no-print"] { display: none !important; }
    #print-root .hidden:not(.print-header) { display: block !important; visibility: visible !important; }
    #print-root table { display: table !important; width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; }
    #print-root thead { display: table-header-group !important; }
    #print-root tbody { display: table-row-group !important; }
    #print-root tr { display: table-row !important; break-inside: avoid !important; }
    #print-root th, #print-root td { display: table-cell !important; border-bottom: 1px solid #d1d5db !important; padding: 7px 9px !important; font-size: 10px !important; line-height: 1.35 !important; text-align: left !important; vertical-align: top !important; }
    #print-root th { background: #f3f4f6 !important; color: #374151 !important; font-weight: 700 !important; }
    #print-root td { color: #111827 !important; }
    #print-root .card, #print-root [class*="bg-card"], #print-root [class*="bg-muted"], #print-root [class*="bg-primary"], #print-root [class*="bg-white"], #print-root [class*="bg-slate"] { background: #ffffff !important; border-color: #d1d5db !important; }
    #print-root .recharts-wrapper, #print-root .recharts-responsive-container, #print-root .recharts-surface { display: none !important; }
    #print-root .print-header { margin-bottom: 8mm !important; padding-bottom: 4mm !important; border-bottom: 2px solid #111827 !important; }
    #print-root .print-header h1 { color: #111827 !important; font-size: 20px !important; }
    #print-root .print-header p, #print-root .print-header span { color: #4b5563 !important; }
    #print-root button, #print-root input, #print-root select, #print-root textarea { display: none !important; }
    #print-root [class*="animate-"] { animation: none !important; transform: none !important; }
    @media print {
      html, body { width: auto !important; background: #ffffff !important; }
      #print-root { display: block !important; }
      .no-print, [class*="no-print"] { display: none !important; }
    }
  </style>
</head>
<body>
  ${printable.outerHTML}
  <script>
    document.documentElement.setAttribute('data-print-ready', 'true');
  </script>
</body>
</html>`);
    printWindow.document.close();

    let printed = false;
    const printWhenReady = async () => {
      if (printed || printWindow.closed) return;
      printed = true;
      try {
        if (printWindow.document.fonts?.ready) await printWindow.document.fonts.ready;
      } catch { /* fontes não devem bloquear a impressão */ }
      await new Promise<void>(resolve => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => resolve())));
      window.setTimeout(() => {
        if (printWindow.closed) return;
        printWindow.focus();
        printWindow.print();
      }, 350);
    };

    printWindow.addEventListener('load', () => { void printWhenReady(); }, { once: true });
    window.setTimeout(() => { void printWhenReady(); }, 900);
    printWindow.addEventListener('afterprint', () => window.setTimeout(() => printWindow.close(), 250), { once: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-[95vw] lg:max-w-[85vw] max-h-[95vh] overflow-y-auto p-0 rounded-3xl border border-border/60 shadow-2xl transition-all duration-300",
        "reports-modal bg-card text-card-foreground",
        className
      )}>
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border/60 bg-card/95 px-4 py-2.5 shadow-sm backdrop-blur-md no-print">
          <DialogTitle className="text-base font-heading font-bold tracking-tight text-foreground flex items-center gap-2">
            <div className="h-2 w-8 bg-primary rounded-full" />
            <span className="sr-only">Relatório gerencial</span>
            {title}
          </DialogTitle>

          <div className="flex items-center gap-2">
            {onPrint && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg border-border/60 bg-muted/30 hover:bg-primary/10 text-foreground gap-1.5 font-bold text-[11px]"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            )}
            {onExport && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg border-border/60 bg-muted/30 hover:bg-primary/10 text-foreground gap-1.5 font-bold text-[11px]"
                onClick={onExport}
              >
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar relatório" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted ml-1">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        <div id="print-section" className="p-5 sm:p-8 min-h-full">
          <div className="print-header hidden mb-10 pb-6 border-b-2 border-slate-900 items-end justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center">
                  <Printer className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 leading-none">{title}</h1>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Relatório gerencial • Gestão Óticas H2K</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
                <span>Data de Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>•</span>
                <span>Emitido pelo usuário autenticado</span>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="bg-slate-100 px-3 py-1 rounded-full mb-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Sistema local • Gestão Óticas H2K</span>
              </div>
              <p className="text-[9px] text-slate-400 font-mono italic max-w-[200px]">Este documento é para uso interno e contém informações confidenciais.</p>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
