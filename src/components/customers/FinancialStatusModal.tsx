import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Calendar, CreditCard, Download, Printer, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatMoney, useCustomerFinancials } from '@/hooks/useCustomerData';

function getFinancialStatusLabel(status?: string) {
  if (status === 'paid') return 'Pago';
  if (status === 'overdue') return 'Atrasado';
  if (status === 'partially_paid') return 'Parcial';
  if (status === 'in') return 'Recebido';
  return 'Pendente';
}

interface FinancialStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
}

const PrintLayout = ({ customer, entries, totals }: { customer: any; entries: any[]; totals: any }) => (
  <div id="print-section" className="hidden print:block p-8 bg-white text-black font-sans w-full mx-auto">
    <style dangerouslySetInnerHTML={{ __html: `@media print { body * { visibility: hidden !important; } #print-section, #print-section * { visibility: visible !important; } #print-section { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 20px !important; } }` }} />
    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8"><div><h1 className="text-2xl font-black uppercase">Extrato Financeiro do Cliente</h1><p className="text-lg font-bold text-slate-700">{customer?.name}</p></div><div className="text-right"><p className="font-bold text-lg">Sertão ótica & Nordestina</p><p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Emitido em {new Date().toLocaleString('pt-BR')}</p></div></div>
    <div className="grid grid-cols-3 gap-6 mb-8"><Box label="Total gasto" value={formatMoney(totals.totalSpent)} /><Box label="Saldo devedor" value={formatMoney(totals.balanceDue)} /><Box label="Valor vencido" value={formatMoney(totals.overdueAmount)} danger /></div>
    <table className="w-full text-left border-collapse"><thead><tr className="border-b-2 border-slate-200"><th className="py-3 text-[10px] uppercase">Descrição</th><th className="py-3 text-[10px] uppercase">Vencimento</th><th className="py-3 text-[10px] uppercase">Status</th><th className="py-3 text-[10px] uppercase text-right">Valor</th></tr></thead><tbody>{entries.map((item: any) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 text-xs">{item.description}</td><td className="py-3 text-xs">{formatDateTime(item.due_date)}</td><td className="py-3 text-xs">{getFinancialStatusLabel(item.status)}</td><td className="py-3 text-xs text-right font-bold">{formatMoney(item.amount)}</td></tr>)}</tbody></table>
  </div>
);

export function FinancialStatusModal({ isOpen, onClose, customer }: FinancialStatusModalProps) {
  const { data, isLoading } = useCustomerFinancials(customer?.id, customer?.name);
  const [printOpen, setPrintOpen] = useState(false);
  const entries = data?.entries || [];

  const handlePrint = () => {
    setPrintOpen(true);
    const closePrint = () => setPrintOpen(false);
    window.addEventListener('afterprint', closePrint, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(closePrint, 800);
    }, 100);
  };

  const handleExportCsv = () => {
    const header = ['descricao', 'vencimento', 'pagamento', 'status', 'valor', 'comentario'];
    const rows = entries.map((entry: any) => [entry.description, entry.due_date || '', entry.payment_date || '', getFinancialStatusLabel(entry.status), Number(entry.amount || 0).toFixed(2), entry.payment_note || '']);
    const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeCustomerName = String(customer?.name || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'cliente';
    link.download = `extrato-${safeCustomerName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Extrato exportado em CSV.');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden border border-border/70 bg-background p-0 print:hidden">
          <DialogHeader className="sticky top-0 z-10 border-b border-border/60 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-4 w-4" /></div><div className="min-w-0"><DialogTitle className="truncate text-base font-black text-foreground">Status financeiro</DialogTitle><p className="truncate text-xs font-medium text-muted-foreground">{customer?.name}</p></div></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg text-xs" onClick={handlePrint}><Printer className="h-3.5 w-3.5" /> Imprimir</Button><Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg text-xs" onClick={handleExportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button></div></div>
          </DialogHeader>
          <div className="custom-scrollbar max-h-[calc(92vh-9rem)] space-y-5 overflow-y-auto bg-background p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Total gasto" value={formatMoney(data?.totalSpent)} icon={Receipt} /><Metric title="Saldo devedor" value={formatMoney(data?.balanceDue)} icon={CreditCard} /><Metric title="Valor vencido" value={formatMoney(data?.overdueAmount)} icon={AlertTriangle} danger /><Metric title="Próximo vencimento" value={data?.nextDue ? formatDateTime(data.nextDue) : 'Nenhum'} icon={Calendar} /></div>
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="overflow-x-auto">
              <Table className="min-w-[680px]"><TableHeader><TableRow className="bg-muted/40"><TableHead className="whitespace-nowrap">Descrição</TableHead><TableHead className="whitespace-nowrap">Vencimento</TableHead><TableHead className="whitespace-nowrap">Pagamento</TableHead><TableHead className="whitespace-nowrap">Status</TableHead><TableHead className="whitespace-nowrap text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{entries.map((item: any) => <TableRow key={item.id}><TableCell className="max-w-[300px] whitespace-normal break-words text-xs font-medium">{item.description}</TableCell><TableCell className="whitespace-nowrap text-xs">{formatDateTime(item.due_date)}</TableCell><TableCell className="whitespace-nowrap text-xs">{formatDateTime(item.payment_date)}</TableCell><TableCell><Badge variant="outline" className={`whitespace-nowrap text-[10px] font-bold ${item.status === 'paid' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : item.status === 'overdue' ? 'border-destructive/30 bg-destructive/10 text-destructive' : item.status === 'partially_paid' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-primary/25 bg-primary/10 text-primary'}`}>{getFinancialStatusLabel(item.status)}</Badge></TableCell><TableCell className="whitespace-nowrap text-right text-xs font-bold">{formatMoney(item.amount)}</TableCell></TableRow>)}{isLoading && [1, 2, 3].map(row => <TableRow key={`financial-skeleton-${row}`}><TableCell colSpan={5} className="h-12"><div className="h-4 w-full animate-pulse rounded bg-muted" /></TableCell></TableRow>)}{!isLoading && entries.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhum lançamento financeiro encontrado.</TableCell></TableRow>}</TableBody></Table>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 bg-card p-4"><Button variant="outline" onClick={onClose} className="h-8 rounded-lg text-xs font-bold">Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {printOpen && createPortal(<PrintLayout customer={customer} entries={entries} totals={data || {}} />, document.body)}
    </>
  );
}

function Metric({ title, value, icon: Icon, danger }: any) {
  return <div className={`rounded-xl border p-4 shadow-sm ${danger ? 'border-red-500/20 bg-red-500/5' : 'border-border/70 bg-card'}`}><div className="mb-2 flex items-center justify-between"><div className={`grid h-8 w-8 place-items-center rounded-lg ${danger ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary'}`}><Icon className="h-4 w-4" /></div></div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p><p className={`text-xl font-black tabular-nums ${danger ? 'text-red-600' : 'text-foreground'}`}>{value}</p></div>;
}

function Box({ label, value, danger }: any) {
  return <div className="border border-slate-200 p-4 rounded-xl"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p><p className={`text-xl font-bold ${danger ? 'text-red-600' : 'text-slate-900'}`}>{value}</p></div>;
}