import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, DollarSign, Eye, PlusCircle, Printer, Wallet, Calendar, TrendingUp, CheckCircle2, Clock, AlertCircle, History, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { localApi } from '@/lib/localApi';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { formatDateTime, formatMoney, useCustomerFinancials, useRegisterCustomerPayment } from '@/hooks/useCustomerData';
import { InstallmentPrint } from './InstallmentPrint';
import { PermissionGate } from '@/components/shared/PermissionGate';

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit', label: 'Cartão de crédito' },
  { value: 'debit', label: 'Cartão de débito' },
  { value: 'cash', label: 'Dinheiro' },
] as const;

function getPaymentMethodLabel(value?: string) {
  return PAYMENT_METHODS.find(method => method.value === value)?.label || value || 'Não informado';
}

function getInstallmentStatusLabel(status?: string) {
  if (status === 'paid') return 'Pago';
  if (status === 'overdue') return 'Atrasado';
  if (status === 'partially_paid') return 'Parcial';
  return 'Pendente';
}

export function CreditTab({ customer }: { customer: any }) {
  const { selectedCompanyId, selectedStoreIds, stores } = useGlobalFilter();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useCustomerFinancials(customer?.id, customer?.name);
  const registerPayment = useRegisterCustomerPayment(customer);
  const [newCarneOpen, setNewCarneOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<any>(null);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [printData, setPrintData] = useState<any>(null);
  const [deletionTarget, setDeletionTarget] = useState<{ type: 'installment' | 'credit_book'; entry?: any; carneId?: string; parcelas?: any[] } | null>(null);
  const [deletionPending, setDeletionPending] = useState(false);
  const [carneForm, setCarneForm] = useState({ storeId: selectedStoreIds[0] || stores[0]?.id || '', total: '', parcels: '4', firstDueDate: new Date().toISOString().slice(0, 10), paymentMethod: 'crediario' });

  // Tratamento de erro
  if (error) {
    console.error('Erro ao carregar dados financeiros:', error);
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Erro ao carregar dados financeiros</p>
        <p className="text-sm text-muted-foreground mt-2">{String(error)}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const entries = (data?.entries || []).filter((entry: any) => entry.type === 'receivable');
  const openEntries = entries.filter((entry: any) => entry.status === 'pending' || entry.status === 'partially_paid' || entry.status === 'overdue');
  const paidEntries = entries.filter((entry: any) => entry.status === 'paid' || Number(entry.paid_amount || 0) > 0);
  const overdueEntries = entries.filter((entry: any) => entry.status === 'overdue');

  const openTotal = openEntries.reduce((sum: number, entry: any) => sum + Number(entry.remaining_amount ?? entry.amount ?? 0), 0);
  const paidTotal = entries.reduce((sum: number, entry: any) => sum + Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0), 0);
  const overdueTotal = overdueEntries.reduce((sum: number, entry: any) => sum + Number(entry.remaining_amount ?? entry.amount ?? 0), 0);
  const totalAmount = entries.reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
  const deletionEntries = deletionTarget?.type === 'credit_book'
    ? (deletionTarget.parcelas || [])
    : deletionTarget?.entry
      ? [deletionTarget.entry]
      : [];
  const deletionTotal = deletionEntries.reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
  const deletionPaid = deletionEntries.reduce((sum: number, entry: any) => sum + Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0), 0);

  // Agrupar parcelas por carnê
  const carneGroups = entries.filter((entry: any) => entry.origin_table === 'customers').reduce((groups: any, entry: any) => {
    const carneId = entry.origin_id || entry.id;
    if (!groups[carneId]) {
      groups[carneId] = [];
    }
    groups[carneId].push(entry);
    return groups;
  }, {});

  // Ordenar carnês por data mais recente
  const sortedCarnes = Object.entries(carneGroups).sort(([, a]: any, [, b]: any) => {
    const dateA = new Date(a[0].created_at || a[0].due_date).getTime();
    const dateB = new Date(b[0].created_at || b[0].due_date).getTime();
    return dateB - dateA;
  });

  const handlePrint = (entry: any) => {
    const carneEntries = entries.filter((e: any) =>
      e.id === entry.id || (entry.origin_table === 'customers' && e.origin_table === 'customers' && e.origin_id && entry.origin_id && e.origin_id === entry.origin_id)
    );
    const totalParcels = carneEntries.length > 0 ? carneEntries.length : 1;
    const sortedEntries = carneEntries.sort((a: any, b: any) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    const parcelIndex = sortedEntries.findIndex((e: any) => e.id === entry.id);
    const parcelNumber = parcelIndex >= 0 ? parcelIndex + 1 : 1;
    const remainingBalance = carneEntries
      .filter((e: any) => e.status === 'pending' || e.status === 'partially_paid' || e.status === 'overdue')
      .reduce((sum: number, e: any) => sum + Number(e.remaining_amount ?? e.amount ?? 0), 0);

    const data = {
      id: `REC-${String(entry.id).slice(0, 8).toUpperCase()}`,
      carneId: String(entry.origin_id || entry.id).slice(0, 8).toUpperCase(),
      parcelNumber: parcelNumber,
      totalParcels: totalParcels,
      amount: Number(entry.amount || 0),
      paymentDate: entry.payment_date ? formatDateTime(entry.payment_date) : 'Não informado',
      dueDate: formatDateTime(entry.due_date),
      paymentMethod: getPaymentMethodLabel(entry.payment_method),
      paymentNote: entry.payment_note || '',
      remainingBalance: remainingBalance,
    };
    setPrintData(data);
    setTimeout(() => {
      const el = document.getElementById('installment-print-section');
      if (el) el.style.display = 'block';
      setTimeout(() => { window.print(); setTimeout(() => { if (el) el.style.display = 'none'; }, 500); }, 50);
    }, 100);
  };

  const getCustomerStoreName = () => stores.find((store: any) => String(store.id) === String(customer?.storeId || customer?.store_id))?.name || 'Loja não informada';

  const requestInstallmentDeletion = (entry: any) => {
    setDeletionTarget({ type: 'installment', entry, carneId: String(entry.origin_id || entry.id) });
  };

  const requestCreditBookDeletion = (carneId: string, parcelas: any[]) => {
    setDeletionTarget({ type: 'credit_book', carneId, parcelas });
  };

  const handleDeleteFinancialTarget = async () => {
    if (!deletionTarget) return;
    setDeletionPending(true);
    try {
      const result = deletionTarget.type === 'installment'
        ? await localApi.operations.deleteFinancialInstallment(String(deletionTarget.entry?.id || ''))
        : await localApi.operations.deleteFinancialCreditBook(String(deletionTarget.carneId || ''));
      if (result.error) throw result.error;
      const deletedCount = Number(result.data?.deleted_count || (deletionTarget.type === 'installment' ? 1 : deletionTarget.parcelas?.length || 0));
      toast.success(deletionTarget.type === 'installment'
        ? 'Parcela excluída e registrada na auditoria.'
        : `Carnê excluído: ${deletedCount} parcela(s) removida(s) e auditada(s).`);
      setDeletionTarget(null);
      queryClient.invalidateQueries({ queryKey: ['customer-financials'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
    } catch (error: any) {
      toast.error('Não foi possível excluir: ' + (error?.message || 'tente novamente.'));
    } finally {
      setDeletionPending(false);
    }
  };

  const handlePayment = async () => {
    try {
      await registerPayment.mutateAsync({ entry: selectedEntry, amount: Number(paymentAmount || 0), paymentMethod, paymentNote: paymentComment });
      toast.success('Pagamento confirmado e financeiro atualizado.');
      setPaymentModalOpen(false);
      setSelectedEntry(null);
      setPaymentAmount('');
      setPaymentComment('');
    } catch (error: any) {
      toast.error('Erro ao receber pagamento: ' + (error.message || 'tente novamente.'));
    }
  };

  const handleCreateCarne = async () => {
    const total = Number(carneForm.total || 0);
    const parcels = Number(carneForm.parcels || 1);
    const storeId = carneForm.storeId || selectedStoreIds[0] || stores[0]?.id || '';
    if (!selectedCompanyId || !storeId || total <= 0 || parcels <= 0) {
      toast.error('Informe empresa, loja, valor e parcelas.');
      return;
    }
    const firstDue = new Date(carneForm.firstDueDate + 'T00:00:00');
    const amount = Number((total / parcels).toFixed(2));
    const carneOriginId = crypto.randomUUID();
    const payload = Array.from({ length: parcels }).map((_, index) => {
      const due = new Date(firstDue);
      due.setMonth(firstDue.getMonth() + index);
      return {
        company_id: selectedCompanyId,
        store_id: storeId,
        type: 'receivable',
        description: `Crediario ${index + 1}/${parcels} - ${customer.name}`,
        amount: index === parcels - 1 ? Number((total - amount * (parcels - 1)).toFixed(2)) : amount,
        due_date: due.toISOString().slice(0, 10),
        status: 'pending',
        paid_amount: 0,
        category: 'Crediário',
        payment_method: carneForm.paymentMethod,
        origin_table: 'customers',
        origin_id: carneOriginId,
        customer_id: customer.id,
        supplier_customer_name: customer.name,
      };
    });
    const { error } = await localApi.from('financial_entries').insert(payload);
    if (error) {
      toast.error('Erro ao gerar carne: ' + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['customer-financials'] });
    toast.success('Carne gerado com sucesso!');
    setNewCarneOpen(false);
    setCarneForm({ storeId: selectedStoreIds[0] || stores[0]?.id || '', total: '', parcels: '4', firstDueDate: new Date().toISOString().slice(0, 10), paymentMethod: 'crediario' });
  };

  const CarneCard = ({ carneId, parcelas }: { carneId: string; parcelas: any[] }) => {
    const sortedParcelas = parcelas.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const totalValue = parcelas.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const paidValue = parcelas.reduce((sum, p) => sum + Number(p.paid_amount || (p.status === 'paid' ? p.amount : 0) || 0), 0);
    const paidCount = parcelas.filter(p => Number(p.remaining_amount ?? (Number(p.amount || 0) - Number(p.paid_amount || 0))) <= 0 || p.status === 'paid').length;
    const partialCount = parcelas.filter(p => p.status === 'partially_paid' || (Number(p.paid_amount || 0) > 0 && Number(p.remaining_amount ?? (Number(p.amount || 0) - Number(p.paid_amount || 0))) > 0)).length;
    const progress = parcelas.length ? (paidCount / parcelas.length) * 100 : 0;
    const hasOverdue = parcelas.some(p => p.status === 'overdue');

    return (
      <div className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground">Carnê #{carneId.slice(0, 8).toUpperCase()}</h3>
              {hasOverdue && <Badge variant="destructive" className="text-xs">Atrasado</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{parcelas.length} parcelas · Criado em {formatDateTime(sortedParcelas[0]?.created_at || sortedParcelas[0]?.due_date)}</p>
          </div>
          <div className="flex items-start gap-2 text-left sm:text-right">
            <div>
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="text-lg font-bold text-foreground">{formatMoney(totalValue)}</p>
            </div>
            <PermissionGate module="financial" action="delete_credit_book">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir carnê completo" aria-label="Excluir carnê completo" onClick={() => requestCreditBookDeletion(carneId, sortedParcelas)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </PermissionGate>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-semibold text-foreground">{paidCount}/{parcelas.length} quitadas{partialCount > 0 ? ` · ${partialCount} parcial` : ''}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Pago: {formatMoney(paidValue)}</span>
            <span className="font-semibold text-foreground">Restante: {formatMoney(Math.max(totalValue - paidValue, 0))}</span>
          </div>
        </div>

        <div className="space-y-2">
          {sortedParcelas.map((parcela, index) => (
            <div key={parcela.id} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/40 p-3 transition-colors hover:bg-muted/80 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  parcela.status === 'paid' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                  parcela.status === 'overdue' ? 'bg-destructive/15 text-destructive' :
                  parcela.status === 'partially_paid' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                  'bg-primary/10 text-primary'
                }`}>
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{formatMoney(parcela.amount)}</p>
                  <p className="text-xs text-muted-foreground">Venc: {formatDateTime(parcela.due_date)}</p>
                  {parcela.status === 'paid' && parcela.payment_date && (
                    <p className="text-xs text-emerald-600 font-medium">Pago em {formatDateTime(parcela.payment_date)}</p>
                  )}
                </div>
              </div>
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <Badge variant="outline" className={`shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-bold leading-none ${
                  parcela.status === 'paid' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' :
                  parcela.status === 'overdue' ? 'border-destructive/30 bg-destructive/10 text-destructive' :
                  parcela.status === 'partially_paid' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' :
                  'border-primary/25 bg-primary/10 text-primary'
                }`}>
                  {getInstallmentStatusLabel(parcela.status)}
                </Badge>
                <div className="flex shrink-0 gap-1">
                  {parcela.status !== 'paid' && (
                    <PermissionGate module="financial" action="edit"><Button variant="outline" size="sm" className="h-8 gap-1.5 border-emerald-500/30 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300" title="Receber pagamento" aria-label="Receber pagamento" onClick={() => { setSelectedEntry(parcela); setPaymentAmount(String(Math.max(Number(parcela.amount || 0) - Number(parcela.paid_amount || 0), 0))); setPaymentMethod(parcela.payment_method || 'pix'); setPaymentComment(''); setPaymentModalOpen(true); }}>
                      <DollarSign className="h-3.5 w-3.5" /><span className="hidden sm:inline">Receber</span>
                    </Button></PermissionGate>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(parcela)} title="Imprimir parcela" aria-label="Imprimir parcela">
                    <Printer className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailEntry(parcela)} title="Ver detalhes" aria-label="Ver detalhes">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <PermissionGate module="financial" action="delete_installment">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => requestInstallmentDeletion(parcela)} title="Excluir parcela" aria-label="Excluir parcela">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PermissionGate>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Em aberto</p>
              <p className="text-2xl font-black tabular-nums text-foreground">{formatMoney(openTotal)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{openEntries.length} parcelas pendentes</p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Pago</p>
              <p className="text-2xl font-bold text-foreground">{formatMoney(paidTotal)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{paidEntries.filter((entry: any) => entry.status === 'paid').length} parcelas quitadas</p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Atrasado</p>
              <p className="text-2xl font-bold text-red-600">{formatMoney(overdueTotal)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{overdueEntries.length} parcelas vencidas</p>
        </div>

        <div className="flex flex-col gap-2">
          <PermissionGate module="financial" action="create">
            <Button className="h-[45%] w-full gap-2 rounded-xl bg-primary text-xs text-primary-foreground hover:bg-primary/90" onClick={() => setNewCarneOpen(true)}>
              <PlusCircle className="h-4 w-4" /> Gerar Novo Carnê
            </Button>
          </PermissionGate>
          <PermissionGate module="financial" action="print">
          <Button variant="outline" className="w-full gap-2 h-[45%] rounded-xl text-xs" onClick={() => entries[0] && handlePrint(entries[0])} disabled={!entries[0]}>
            <Printer className="h-4 w-4" /> Imprimir Última
          </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="carnes" className="w-full">
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto p-1">
          <TabsTrigger value="carnes" className="min-w-max flex-1">Carnês ({sortedCarnes.length})</TabsTrigger>
          <TabsTrigger value="todas" className="min-w-max flex-1">Todas parcelas ({entries.length})</TabsTrigger>
          <TabsTrigger value="historico" className="min-w-max flex-1">Histórico ({paidEntries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="carnes" className="space-y-4 mt-6">
          {sortedCarnes.length === 0 ? (
            <div className="bg-card border rounded-xl p-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Nenhum carnê encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Gere um novo carnê para começar</p>
            </div>
          ) : (
            sortedCarnes.map(([carneId, parcelas]: any) => (
              <CarneCard key={carneId} carneId={carneId} parcelas={parcelas} />
            ))
          )}
        </TabsContent>

        <TabsContent value="todas" className="mt-6">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: any) => (
                  <TableRow key={entry.id} className="hover:bg-muted/60 transition-colors">
                    <TableCell className="font-medium text-sm">{entry.description}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(entry.due_date)}</TableCell>
                    <TableCell className="font-bold text-foreground text-xs">{formatMoney(entry.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'paid' ? 'default' : 'secondary'} className={
                        entry.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        entry.status === 'overdue' ? 'bg-red-500/10 text-red-700 border-red-500/20' :
                        'bg-blue-500/10 text-blue-600 border-blue-500/20'
                      }>
                        {getInstallmentStatusLabel(entry.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-1 justify-end">
                      {entry.status !== 'paid' && (
                        <PermissionGate module="financial" action="edit"><Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10" title="Pagar Parcela" onClick={() => { setSelectedEntry(entry); setPaymentAmount(String(Math.max(Number(entry.amount || 0) - Number(entry.paid_amount || 0), 0))); setPaymentMethod(entry.payment_method || 'pix'); setPaymentComment(''); setPaymentModalOpen(true); }}>
                          <DollarSign className="h-4 w-4" />
                        </Button></PermissionGate>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(entry)} title="Imprimir">
                        <Printer className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailEntry(entry)} title="Ver detalhes" aria-label="Ver detalhes">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <PermissionGate module="financial" action="delete_installment">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => requestInstallmentDeletion(entry)} title="Excluir parcela" aria-label="Excluir parcela">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhuma parcela ou crediário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
                        </Table>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="historico" className="mt-6">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 p-4">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-foreground">Histórico de Pagamentos</span>
            </div>
            <div className="max-h-[calc(90vh-10rem)] space-y-4 overflow-y-auto bg-background p-5">
              {paidEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">Nenhum pagamento registrado</p>
                </div>
              ) : (
                paidEntries
                  .sort((a: any, b: any) => new Date(b.payment_date || b.updated_at).getTime() - new Date(a.payment_date || a.updated_at).getTime())
                  .map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{entry.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Pago em {formatDateTime(entry.payment_date || entry.updated_at)} · {getPaymentMethodLabel(entry.payment_method)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">{formatMoney(entry.paid_amount || entry.amount)}</p>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handlePrint(entry)}>
                          <Printer className="h-3 w-3 mr-1" /> Reimprimir
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Dialog open={newCarneOpen} onOpenChange={setNewCarneOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-hidden rounded-2xl border border-border/70 bg-background p-0">
          <div className="border-b border-border/60 bg-card p-5">
            <DialogTitle>Gerar Novo Carnê</DialogTitle>
          </div>
          <div className="max-h-[calc(90vh-10rem)] space-y-4 overflow-y-auto bg-background p-5">
            <SelectField label="Loja do carnê" value={carneForm.storeId || 'none'} onChange={(v: string) => setCarneForm({ ...carneForm, storeId: v === 'none' ? '' : v })} options={[{ id: 'none', name: 'Selecione a loja' }, ...stores.map((store: any) => ({ id: store.id, name: store.name }))]} />
            <Field label="Valor Total" type="number" value={carneForm.total} onChange={(v: string) => setCarneForm({ ...carneForm, total: v })} />
            <SelectField label="Número de Parcelas" value={carneForm.parcels} onChange={(v: string) => setCarneForm({ ...carneForm, parcels: v })} options={[1,2,3,4,6,10,12].map(n => ({ id: String(n), name: `${n}x` }))} />
            <Field label="Vencimento da 1ª Parcela" type="date" value={carneForm.firstDueDate} onChange={(v: string) => setCarneForm({ ...carneForm, firstDueDate: v })} />
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border/60 bg-card/95 p-5 backdrop-blur">
            <Button variant="ghost" onClick={() => setNewCarneOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-primary-foreground" onClick={handleCreateCarne}>Gerar Carnê</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-hidden rounded-2xl border border-border/70 bg-background p-0">
          <div className="border-b border-emerald-500/20 bg-emerald-500/5 p-5">
            <DialogTitle className="text-emerald-600">Receber Pagamento</DialogTitle>
            <p className="text-xs text-emerald-600 mt-1">{selectedEntry?.description}</p>
          </div>
          <div className="max-h-[calc(90vh-11rem)] space-y-6 overflow-y-auto bg-background p-5">
            <div className="flex justify-between items-center bg-muted/40 p-4 rounded-xl">
              <div><span className="text-sm text-muted-foreground">Saldo da parcela</span><span className="mt-1 block text-[11px] text-muted-foreground">Valor original: {formatMoney(selectedEntry?.amount)}</span></div>
              <span className="text-xl font-bold text-foreground">{formatMoney(Math.max(Number(selectedEntry?.amount || 0) - Number(selectedEntry?.paid_amount || 0), 0))}</span>
            </div>
            <Field label="Valor recebido" type="number" value={paymentAmount} onChange={(v: string) => setPaymentAmount(v)} />
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Método de pagamento</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PAYMENT_METHODS.map(method => (
                    <Button key={method.value} type="button" variant={paymentMethod === method.value ? 'default' : 'outline'} className="h-11 justify-start gap-2 text-xs" onClick={() => setPaymentMethod(method.value)}>
                      <Wallet className="h-4 w-4" /> {method.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-comment" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comentário do pagamento <span className="font-normal normal-case text-muted-foreground/70">(opcional)</span></Label>
                <Textarea id="payment-comment" value={paymentComment} onChange={event => setPaymentComment(event.target.value.slice(0, 300))} maxLength={300} placeholder="Ex.: recebido no balcão, referente à parcela..." className="min-h-[88px] resize-none rounded-xl" />
                <p className="text-right text-[11px] text-muted-foreground">{paymentComment.length}/300</p>
              </div>
          </div>
          <DialogFooter className="sticky bottom-0 border-t border-border/60 bg-card/95 p-5 backdrop-blur">
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handlePayment} disabled={registerPayment.isPending || !paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > Math.max(Number(selectedEntry?.amount || 0) - Number(selectedEntry?.paid_amount || 0), 0)}>
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden rounded-2xl border border-border/70 bg-background p-0">
          <div className="border-b border-border/60 bg-card p-5"><DialogTitle>Detalhes do lançamento</DialogTitle></div>
          <div className="max-h-[calc(90vh-9rem)] space-y-3 overflow-y-auto bg-background p-5 text-sm">
            <p><strong>Descrição:</strong> {detailEntry?.description || '-'}</p>
            <p><strong>Vencimento:</strong> {formatDateTime(detailEntry?.due_date)}</p>
            {detailEntry?.payment_date && <p><strong>Pagamento:</strong> {formatDateTime(detailEntry?.payment_date)}</p>}
            <p><strong>Valor original:</strong> {formatMoney(detailEntry?.amount)}</p>
            {Number(detailEntry?.paid_amount || 0) > 0 && <p><strong>Recebido:</strong> {formatMoney(detailEntry?.paid_amount)}</p>}
            <p><strong>Status:</strong> {getInstallmentStatusLabel(detailEntry?.status)}</p>
            {detailEntry?.payment_method && <p><strong>Método:</strong> {getPaymentMethodLabel(detailEntry.payment_method)}</p>}
            {detailEntry?.payment_note && <div className="rounded-xl border border-border/60 bg-muted/30 p-3"><p className="mb-1 text-xs font-bold text-muted-foreground">Comentário do pagamento</p><p className="whitespace-pre-wrap text-sm text-foreground">{detailEntry.payment_note}</p></div>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletionTarget} onOpenChange={(open) => { if (!open && !deletionPending) setDeletionTarget(null); }}>
        <AlertDialogContent className="max-w-lg rounded-2xl border-border/70 bg-background">
          <AlertDialogHeader>
            <div className="flex items-start gap-3 text-left">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription className="mt-1">
                  Esta ação remove o lançamento financeiro e não pode ser desfeita. Confira os dados antes de continuar.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
                <p className="mt-1 truncate font-semibold text-foreground">{customer?.name || 'Cliente não informado'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Loja</p>
                <p className="mt-1 truncate font-semibold text-foreground">{getCustomerStoreName()}</p>
              </div>
            </div>

            {deletionTarget?.type === 'installment' ? (
              <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</p>
                  <p className="mt-1 font-semibold text-foreground">Parcela do carnê</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Carnê</p>
                  <p className="mt-1 font-semibold text-foreground">#{String(deletionTarget.carneId || '').slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição da parcela</p>
                  <p className="mt-1 font-semibold text-foreground">{deletionTarget.entry?.description || 'Parcela sem descrição'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor</p>
                  <p className="mt-1 font-semibold tabular-nums text-foreground">{formatMoney(deletionTarget.entry?.amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vencimento</p>
                  <p className="mt-1 font-semibold text-foreground">{formatDateTime(deletionTarget.entry?.due_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Situação</p>
                  <p className="mt-1 font-semibold text-foreground">{getInstallmentStatusLabel(deletionTarget.entry?.status)}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</p>
                  <p className="mt-1 font-semibold text-foreground">Carnê completo</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Identificação</p>
                  <p className="mt-1 font-semibold text-foreground">#{String(deletionTarget?.carneId || '').slice(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Parcelas que serão removidas</p>
                  <p className="mt-1 font-semibold text-foreground">{deletionEntries.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor total</p>
                  <p className="mt-1 font-semibold tabular-nums text-foreground">{formatMoney(deletionTotal)}</p>
                </div>
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">Total já recebido</span>
                  <span className="font-bold tabular-nums text-destructive">{formatMoney(deletionPaid)}</span>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletionPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFinancialTarget} disabled={deletionPending} className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4" />
              {deletionPending ? 'Excluindo...' : 'Confirmar exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {printData && <InstallmentPrint customerName={customer?.name || 'Cliente'} installmentData={printData} />}
    </div>
  );
}

function Field({ label, type = 'text', value, onChange }: any) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={e => onChange(e.target.value)} /></div>;
}

function SelectField({ label, value, onChange, options }: any) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option: any) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}
