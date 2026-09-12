import { useState } from 'react';
import { CheckCircle2, ClipboardList, FileText, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ServiceOrderPrint, type ServiceOrderPrintVariant } from '@/components/ServiceOrderPrint';

interface ServiceOrderCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  os: any | null;
  company?: any;
  store?: any;
}

const actions: Array<{ variant: ServiceOrderPrintVariant; title: string; description: string; icon: typeof FileText }> = [
  { variant: 'empresa', title: 'Imprimir ordem de serviço', description: 'Via operacional completa para a equipe da ótica.', icon: ClipboardList },
  { variant: 'cliente', title: 'Imprimir guia do cliente', description: 'Comprovante com prazo, valores e orientações de retirada.', icon: FileText },
  { variant: 'laboratorio', title: 'Imprimir guia do laboratório', description: 'Guia técnica com receita, medidas e dados do serviço.', icon: Printer },
];

export function ServiceOrderCompletionDialog({ open, onOpenChange, os, company, store }: ServiceOrderCompletionDialogProps) {
  const [printVariant, setPrintVariant] = useState<ServiceOrderPrintVariant | null>(null);

  const handlePrint = (variant: ServiceOrderPrintVariant) => {
    setPrintVariant(variant);
    window.setTimeout(() => {
      const element = document.getElementById('os-print-section');
      if (!element) {
        toast.error('Não foi possível preparar a impressão.');
        return;
      }
      element.style.display = 'block';
      window.print();
      window.setTimeout(() => {
        element.style.display = 'none';
        setPrintVariant(null);
      }, 600);
    }, 120);
  };

  if (!os) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl rounded-2xl border-border/70 bg-background p-0">
          <DialogHeader className="border-b border-border/70 bg-card px-4 py-3.5 sm:px-5">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-4.5 w-4.5" /></div>
              <div>
                <DialogTitle className="text-base font-bold sm:text-lg">O.S. aberta com sucesso</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">A ordem <strong className="text-foreground">#{String(os.id || '').slice(0, 8).toUpperCase()}</strong> está pronta. Escolha a guia que deseja imprimir agora.</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3.5 p-4 sm:p-5">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">{os.customerName || os.customer_name || 'Cliente não informado'}</p><p className="text-xs text-muted-foreground">{os.serviceType || os.service_type || 'Serviço'}{store?.name ? ` · ${store.name}` : ''}</p></div><p className="text-base font-black text-primary">R$ {Number(os.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            </div>
            <div className="grid gap-2">
              {actions.map(({ variant, title, description, icon: Icon }) => <button type="button" key={variant} onClick={() => handlePrint(variant)} className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105"><Icon className="h-4.5 w-4.5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{title}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span></span><Printer className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" /></button>)}
            </div>
          </div>
          <DialogFooter className="border-t border-border/70 bg-card/95 p-3.5 sm:p-4"><Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 gap-2"><X className="h-4 w-4" /> Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {printVariant && <ServiceOrderPrint os={os} company={company} store={store} variant={printVariant} />}
    </>
  );
}
