import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Edit3, History, MoreHorizontal, PauseCircle, PlayCircle, Plus, ReceiptText, Store, TrendingUp, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useFinancialCategories, useCreateFixedCost, useUpdateFixedCost, useFixedCosts, useFixedCostPayments, useRecordFixedCostPayment } from '@/hooks/useFinancialData';
import { PAYMENT_METHODS, getPaymentMethodLabel, normalizePaymentMethod } from '@/lib/financial';
import type { FixedCost } from '@/services/financialService';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { localApi } from '@/lib/localApi';
import { useQueryClient } from '@tanstack/react-query';

const FREQUENCIES = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'daily', label: 'Diário' },
  { value: 'yearly', label: 'Anual' },
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const parseAmount = (value: string) => {
  const normalized = value.trim().replace(/\s/g, '');
  if (normalized.includes(',') && normalized.includes('.')) return Number(normalized.replace(/\./g, '').replace(',', '.'));
  return Number(normalized.replace(',', '.'));
};
const dateLabel = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data';

type CostForm = {
  name: string;
  description: string;
  amount: string;
  frequency: FixedCost['frequency'];
  interval: string;
  valid_from: string;
  valid_until: string;
  store_id: string;
  payment_method: string;
  category_id: string;
  cost_center: string;
  notes: string;
  supplier_name: string;
  contract_number: string;
  annual_adjustment_percent: string;
  responsible_name: string;
  renewal_date: string;
};

const emptyForm = (storeId = ''): CostForm => ({
  name: '', description: '', amount: '', frequency: 'monthly', interval: '1', valid_from: today(), valid_until: '', store_id: storeId,
  payment_method: 'pix', category_id: '', cost_center: 'Operacional', notes: '', supplier_name: '', contract_number: '', annual_adjustment_percent: '', responsible_name: '', renewal_date: '',
});

export function FixedCostsContent() {
  const { stores, selectedStoreIds } = useGlobalFilter();
  const { hasPermission } = usePermissions();
  const { data: costs = [], isLoading, error } = useFixedCosts();
  const { data: categories = [] } = useFinancialCategories('expense');
  const createMutation = useCreateFixedCost();
  const updateMutation = useUpdateFixedCost();
  const paymentMutation = useRecordFixedCostPayment();
  const queryClient = useQueryClient();
  const canManage = hasPermission('financial', 'manage_fixed_costs');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<FixedCost | null>(null);
  const [historyCost, setHistoryCost] = useState<FixedCost | null>(null);
  const [paymentCost, setPaymentCost] = useState<FixedCost | null>(null);
  const [adjustmentCost, setAdjustmentCost] = useState<FixedCost | null>(null);
  const [adjustmentPercent, setAdjustmentPercent] = useState('');
  const [form, setForm] = useState<CostForm>(emptyForm(selectedStoreIds[0] || stores[0]?.id || ''));
  const [payment, setPayment] = useState({ amount: '', payment_date: today(), payment_method: 'pix', note: '' });

  const storeMap = useMemo(() => new Map(stores.map(store => [store.id, store.name])), [stores]);
  const activeCosts = costs.filter(cost => cost.status === 'active');
  const monthlyEstimate = activeCosts.reduce((sum, cost) => {
    if (cost.frequency === 'yearly') return sum + cost.amount / (12 * Math.max(cost.interval, 1));
    if (cost.frequency === 'weekly') return sum + cost.amount * (52 / 12) / Math.max(cost.interval, 1);
    if (cost.frequency === 'daily') return sum + cost.amount * 30 / Math.max(cost.interval, 1);
    return sum + cost.amount / Math.max(cost.interval, 1);
  }, 0);
  const dueSoon = activeCosts.filter(cost => {
    if (!cost.next_due_date) return false;
    const due = new Date(`${cost.next_due_date.slice(0, 10)}T12:00:00`);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return due >= start && due <= new Date(start.getTime() + 7 * 86400000);
  }).length;

  const openCreate = () => {
    setEditingCost(null);
    setForm(emptyForm(selectedStoreIds[0] || stores[0]?.id || ''));
    setFormOpen(true);
  };
  const openEdit = (cost: FixedCost) => {
    setEditingCost(cost);
    setForm({
      name: cost.name, description: cost.description || '', amount: String(cost.amount).replace('.', ','), frequency: cost.frequency,
      interval: String(cost.interval || 1), valid_from: cost.valid_from?.slice(0, 10) || today(), valid_until: cost.valid_until?.slice(0, 10) || '',
      store_id: cost.store_id, payment_method: cost.payment_method || 'pix', category_id: cost.category_id || '', cost_center: cost.cost_center || 'Operacional', notes: cost.notes || '', supplier_name: cost.supplier_name || '', contract_number: cost.contract_number || '', annual_adjustment_percent: cost.annual_adjustment_percent ? String(cost.annual_adjustment_percent) : '', responsible_name: cost.responsible_name || '', renewal_date: cost.renewal_date?.slice(0, 10) || '',
    });
    setFormOpen(true);
  };
  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseAmount(form.amount);
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0 || !form.store_id || !form.valid_from) {
      toast.error('Preencha nome, loja, valor e início da validade.');
      return;
    }
    const payload = {
      name: form.name.trim(), description: form.description.trim(), amount, frequency: form.frequency, interval: Math.max(1, Number(form.interval) || 1),
      valid_from: form.valid_from, valid_until: form.valid_until || null, store_id: form.store_id, payment_method: normalizePaymentMethod(form.payment_method),
      category_id: form.category_id || null, cost_center: form.cost_center.trim() || 'Operacional', notes: form.notes.trim() || null, supplier_name: form.supplier_name.trim() || null, contract_number: form.contract_number.trim() || null, annual_adjustment_percent: Number(form.annual_adjustment_percent || 0) || 0, responsible_name: form.responsible_name.trim() || null, renewal_date: form.renewal_date || null,
    };
    try {
      if (editingCost) await updateMutation.mutateAsync({ id: editingCost.id, updates: payload });
      else await createMutation.mutateAsync(payload);
      toast.success(editingCost ? 'Custo fixo atualizado.' : 'Custo fixo cadastrado.');
      setFormOpen(false);
    } catch (submitError: any) {
      toast.error(submitError?.message || 'Não foi possível salvar o custo fixo.');
    }
  };
  const toggleStatus = async (cost: FixedCost) => {
    try {
      await updateMutation.mutateAsync({ id: cost.id, updates: { status: cost.status === 'active' ? 'inactive' : 'active' } });
      toast.success(cost.status === 'active' ? 'Custo fixo pausado.' : 'Custo fixo reativado.');
    } catch (statusError: any) {
      toast.error(statusError?.message || 'Não foi possível alterar o status.');
    }
  };
  const openPayment = (cost: FixedCost) => {
    setPaymentCost(cost);
    setPayment({ amount: String(cost.amount).replace('.', ','), payment_date: today(), payment_method: cost.payment_method || 'pix', note: '' });
  };
  const openAdjustment = (cost: FixedCost) => {
    setAdjustmentCost(cost);
    setAdjustmentPercent(String(cost.annual_adjustment_percent || '').replace('.', ','));
  };
  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adjustmentCost) return;
    const percent = parseAmount(adjustmentPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 1000) { toast.error('Informe um reajuste entre 0 e 1000%.'); return; }
    try {
      await localApi.operations.adjustFixedCost(adjustmentCost.id, percent);
      await queryClient.invalidateQueries({ queryKey: ['fixed-costs'], refetchType: 'all' });
      toast.success(`Valor atualizado para ${money(adjustmentCost.amount * (1 + percent / 100))}.`);
      setAdjustmentCost(null);
      setAdjustmentPercent('');
    } catch (adjustmentError: any) {
      toast.error(adjustmentError?.message || 'Não foi possível aplicar o reajuste.');
    }
  };
  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentCost) return;
    const amount = parseAmount(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !payment.payment_date) {
      toast.error('Informe um valor e uma data de pagamento válidos.');
      return;
    }
    try {
      await paymentMutation.mutateAsync({ id: paymentCost.id, amount, payment_date: payment.payment_date, payment_method: normalizePaymentMethod(payment.payment_method), note: payment.note.trim() || undefined });
      toast.success(`Pagamento de ${money(amount)} registrado.`);
      setPaymentCost(null);
    } catch (paymentError: any) {
      toast.error(paymentError?.message || 'Não foi possível registrar o pagamento.');
    }
  };

  if (error) return <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-700 dark:text-red-300">Não foi possível carregar os custos fixos.</div>;

  return (
    <div className="space-y-5">
      <FinancialInfoTip title="Como controlar custos fixos">Use a validade para diferenciar contratos ativos, pausados e expirados. O pagamento atualiza a contagem, cria a obrigação correspondente e agenda a próxima ocorrência.</FinancialInfoTip>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary"><ReceiptText className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Planejamento financeiro</span></div>
          <h2 className="text-xl font-heading font-black tracking-tight">Custos Fixos</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Cadastre despesas recorrentes, acompanhe a validade e registre quantas vezes cada custo já foi pago.</p>
        </div>
        {canManage && <Button onClick={openCreate} className="h-10 shrink-0 gap-2 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Novo custo fixo</Button>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-primary">Custos ativos</p><p className="mt-1 text-2xl font-heading font-black">{activeCosts.length}</p><p className="text-xs text-muted-foreground">de {costs.length} cadastrados</p></CardContent></Card>
        <Card className="border-red-500/20 bg-red-500/5"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-red-700 dark:text-red-300">Estimativa mensal</p><p className="mt-1 text-2xl font-heading font-black text-red-600">{money(monthlyEstimate)}</p><p className="text-xs text-muted-foreground">considerando a recorrência</p></CardContent></Card>
        <Card className="border-amber-500/20 bg-amber-500/5"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Próximos 7 dias</p><p className="mt-1 text-2xl font-heading font-black text-amber-600">{dueSoon}</p><p className="text-xs text-muted-foreground">custos com vencimento próximo</p></CardContent></Card>
      </div>

      {isLoading ? <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Carregando custos fixos...</div> : costs.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><WalletCards className="mx-auto h-8 w-8 text-primary/50" /><h3 className="mt-3 font-bold">Nenhum custo fixo cadastrado</h3><p className="mt-1 text-sm text-muted-foreground">Comece registrando aluguel, folha, internet, sistemas ou outras despesas recorrentes.</p>{canManage && <Button onClick={openCreate} variant="outline" className="mt-4 rounded-xl">Cadastrar primeiro custo</Button>}</div> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {costs.map(cost => {
          const expired = cost.valid_until && new Date(`${cost.valid_until.slice(0, 10)}T12:00:00`) < new Date();
          const status = cost.status !== 'active' ? 'Pausado' : expired ? 'Expirado' : 'Ativo';
          return <Card key={cost.id} className="border-border bg-card shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><CardTitle className="truncate text-base font-heading font-black">{cost.name}</CardTitle><Badge className={status === 'Ativo' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted text-muted-foreground'}>{status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{cost.description || 'Sem descrição adicional'}</p></div><div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon" title="Histórico de pagamentos" onClick={() => setHistoryCost(cost)} className="h-8 w-8 rounded-lg"><History className="h-4 w-4" /></Button>{canManage && <Button variant="ghost" size="icon" title="Mais ações" onClick={() => openEdit(cost)} className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>}</div></div></CardHeader>
            <CardContent className="space-y-3 pt-0"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor previsto</p><p className="mt-0.5 text-2xl font-heading font-black text-foreground">{money(cost.amount)}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vezes pagas</p><p className="mt-0.5 text-lg font-black text-primary">{cost.payment_count || 0}</p></div></div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl border border-border bg-muted/30 p-2.5"><p className="text-muted-foreground">Loja</p><p className="mt-0.5 flex items-center gap-1 font-bold"><Store className="h-3 w-3 text-primary" />{storeMap.get(cost.store_id) || '—'}</p></div><div className="rounded-xl border border-border bg-muted/30 p-2.5"><p className="text-muted-foreground">Recorrência</p><p className="mt-0.5 flex items-center gap-1 font-bold"><CalendarDays className="h-3 w-3 text-primary" />{cost.interval > 1 ? `${cost.interval} ` : ''}{FREQUENCIES.find(item => item.value === cost.frequency)?.label || cost.frequency}</p></div><div className="rounded-xl border border-border bg-muted/30 p-2.5"><p className="text-muted-foreground">Validade</p><p className="mt-0.5 font-bold">{dateLabel(cost.valid_from)} — {dateLabel(cost.valid_until)}</p></div><div className="rounded-xl border border-border bg-muted/30 p-2.5"><p className="text-muted-foreground">Último pagamento</p><p className="mt-0.5 font-bold">{dateLabel(cost.last_paid_at)}</p></div></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><span className="text-xs text-muted-foreground">Próximo: <strong className="text-foreground">{dateLabel(cost.next_due_date)}</strong></span>{canManage && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => toggleStatus(cost)} className="h-8 rounded-lg text-xs">{cost.status === 'active' ? <><PauseCircle className="mr-1.5 h-3.5 w-3.5" />Pausar</> : <><PlayCircle className="mr-1.5 h-3.5 w-3.5" />Reativar</>}</Button><Button variant="outline" size="sm" onClick={() => openAdjustment(cost)} className="h-8 rounded-lg text-xs"><TrendingUp className="mr-1.5 h-3.5 w-3.5" />Reajustar</Button><Button size="sm" onClick={() => openPayment(cost)} className="h-8 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Registrar pagamento</Button></div>}</div></CardContent>
          </Card>;
        })}
      </div>}

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>{editingCost ? 'Editar custo fixo' : 'Novo custo fixo'}</DialogTitle></DialogHeader><form onSubmit={submitForm} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>O que é o custo?</Label><Input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Ex.: Aluguel da loja, internet, sistema" required /></div><div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} placeholder="Detalhes, fornecedor ou referência" className="min-h-20 resize-none" /></div><div className="space-y-2"><Label>Valor previsto</Label><Input value={form.amount} onChange={event => setForm(prev => ({ ...prev, amount: event.target.value }))} inputMode="decimal" placeholder="0,00" required /></div><div className="space-y-2"><Label>Loja</Label><Select value={form.store_id} onValueChange={value => setForm(prev => ({ ...prev, store_id: value }))}><SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger><SelectContent>{stores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Recorrência</Label><Select value={form.frequency} onValueChange={value => setForm(prev => ({ ...prev, frequency: value as CostForm['frequency'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FREQUENCIES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Intervalo</Label><Input type="number" min="1" max="120" value={form.interval} onChange={event => setForm(prev => ({ ...prev, interval: event.target.value }))} /></div><div className="space-y-2"><Label>Início da validade</Label><Input type="date" value={form.valid_from} onChange={event => setForm(prev => ({ ...prev, valid_from: event.target.value }))} required /></div><div className="space-y-2"><Label>Fim da validade <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input type="date" min={form.valid_from} value={form.valid_until} onChange={event => setForm(prev => ({ ...prev, valid_until: event.target.value }))} /></div><div className="space-y-2"><Label>Meio de pagamento padrão</Label><Select value={form.payment_method} onValueChange={value => setForm(prev => ({ ...prev, payment_method: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Categoria</Label><Select value={form.category_id || 'none'} onValueChange={value => setForm(prev => ({ ...prev, category_id: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger><SelectContent><SelectItem value="none">Sem categoria</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Centro de custo</Label><Input value={form.cost_center} onChange={event => setForm(prev => ({ ...prev, cost_center: event.target.value }))} placeholder="Operacional" /></div><div className="space-y-2"><Label>Fornecedor</Label><Input value={form.supplier_name} onChange={event => setForm(prev => ({ ...prev, supplier_name: event.target.value }))} placeholder="Nome do fornecedor" /></div><div className="space-y-2"><Label>Nº do contrato</Label><Input value={form.contract_number} onChange={event => setForm(prev => ({ ...prev, contract_number: event.target.value }))} placeholder="Contrato ou referência" /></div><div className="space-y-2"><Label>Responsável</Label><Input value={form.responsible_name} onChange={event => setForm(prev => ({ ...prev, responsible_name: event.target.value }))} placeholder="Responsável interno" /></div><div className="space-y-2"><Label>Renovação</Label><Input type="date" value={form.renewal_date} onChange={event => setForm(prev => ({ ...prev, renewal_date: event.target.value }))} /></div><div className="space-y-2"><Label>Reajuste anual (%)</Label><Input type="number" min="0" step="0.01" value={form.annual_adjustment_percent} onChange={event => setForm(prev => ({ ...prev, annual_adjustment_percent: event.target.value }))} placeholder="0" /></div><div className="space-y-2 sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Observações internas" className="min-h-20 resize-none" /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar custo'}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!adjustmentCost} onOpenChange={open => !open && setAdjustmentCost(null)}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle>Aplicar reajuste anual</DialogTitle></DialogHeader><form onSubmit={submitAdjustment} className="space-y-4"><FinancialInfoTip title="Reajuste auditado">O valor atual será recalculado, a data do reajuste será registrada e o histórico manterá valor anterior, percentual e novo valor.</FinancialInfoTip>{adjustmentCost && <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm"><p className="font-bold">{adjustmentCost.name}</p><p className="mt-1 text-muted-foreground">Atual: {money(adjustmentCost.amount)} · Próximo: {money(adjustmentCost.amount * (1 + (parseAmount(adjustmentPercent) || 0) / 100))}</p></div>}<div className="space-y-2"><Label>Percentual de reajuste (%)</Label><Input value={adjustmentPercent} onChange={event => setAdjustmentPercent(event.target.value)} inputMode="decimal" placeholder="Ex.: 5,00" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setAdjustmentCost(null)}>Cancelar</Button><Button type="submit" disabled={!canManage} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><TrendingUp className="h-4 w-4" />Aplicar reajuste</Button></DialogFooter></form></DialogContent></Dialog>
      <FixedCostHistoryDialog cost={historyCost} onClose={() => setHistoryCost(null)} storeName={historyCost ? storeMap.get(historyCost.store_id) : undefined} />
      <Dialog open={!!paymentCost} onOpenChange={open => !open && setPaymentCost(null)}><DialogContent className="max-w-lg rounded-2xl"><DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader><form onSubmit={submitPayment} className="space-y-4"><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><p className="font-bold">{paymentCost?.name}</p><p className="mt-1 text-muted-foreground">Este pagamento ficará registrado no histórico e em Contas a Pagar.</p></div><div className="space-y-2"><Label>Valor pago</Label><Input value={payment.amount} onChange={event => setPayment(prev => ({ ...prev, amount: event.target.value }))} inputMode="decimal" required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Data do pagamento</Label><Input type="date" value={payment.payment_date} onChange={event => setPayment(prev => ({ ...prev, payment_date: event.target.value }))} required /></div><div className="space-y-2"><Label>Meio de pagamento</Label><Select value={payment.payment_method} onValueChange={value => setPayment(prev => ({ ...prev, payment_method: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>Comentário</Label><Textarea value={payment.note} onChange={event => setPayment(prev => ({ ...prev, note: event.target.value }))} placeholder="Referência, comprovante ou observação" className="min-h-20 resize-none" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setPaymentCost(null)}>Cancelar</Button><Button type="submit" disabled={paymentMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{paymentMutation.isPending ? 'Registrando...' : 'Confirmar pagamento'}</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}

function FixedCostHistoryDialog({ cost, onClose, storeName }: { cost: FixedCost | null; onClose: () => void; storeName?: string }) {
  const { data: payments = [], isLoading } = useFixedCostPayments(cost?.id);
  return <Dialog open={!!cost} onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Histórico de pagamentos</DialogTitle></DialogHeader>{cost && <div className="space-y-4"><div className="rounded-xl border border-border bg-muted/30 p-3"><p className="font-bold">{cost.name}</p><p className="mt-1 text-xs text-muted-foreground">{storeName || 'Loja'} · {cost.payment_count || 0} pagamento(s) registrado(s)</p></div>{isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Carregando histórico...</p> : payments.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p> : <div className="space-y-2">{payments.map(payment => <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-bold">{dateLabel(payment.payment_date)}</p><p className="mt-0.5 text-xs text-muted-foreground">{getPaymentMethodLabel(payment.payment_method)}{payment.note ? ` · ${payment.note}` : ''}</p></div><p className="text-sm font-black text-red-600">{money(payment.amount)}</p></div>)}</div>}</div>}</DialogContent></Dialog>;
}
