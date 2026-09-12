import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  MinusCircle,
  PlusCircle,
  Store,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { FinancialService } from '@/services/financialService';
import { useFinancialCategories } from '@/hooks/useFinancialData';
import { useQueryClient } from '@tanstack/react-query';
import { PAYMENT_METHODS } from '@/lib/financial';

interface EntryExitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'in' | 'out';
}

const IN_REASONS = [
  { value: 'venda', label: 'Venda de Mercadoria' },
  { value: 'recebimento', label: 'Recebimento de Título' },
  { value: 'aporte', label: 'Aporte de Capital' },
  { value: 'rendimento', label: 'Rendimento de Investimento' },
  { value: 'estorno', label: 'Estorno de Despesa' },
  { value: 'outros', label: 'Outros' },
];

const OUT_REASONS = [
  { value: 'fornecedor', label: 'Pagamento de Fornecedor' },
  { value: 'aluguel', label: 'Aluguel e Condomínio' },
  { value: 'folha', label: 'Folha de Pagamento' },
  { value: 'impostos', label: 'Impostos e Taxas' },
  { value: 'manutencao', label: 'Manutenção e Reparos' },
  { value: 'marketing', label: 'Marketing e Publicidade' },
  { value: 'outros', label: 'Outros' },
];

export function EntryExitModal({ open, onOpenChange, type }: EntryExitModalProps) {
  const isEntry = type === 'in';
  const { user } = useAuth();
  const { selectedCompanyId, stores, selectedStoreIds } = useGlobalFilter();
  const { data: categories = [] } = useFinancialCategories(isEntry ? 'income' : 'expense');
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [storeId, setStoreId] = useState(selectedStoreIds[0] || '');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState('12');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const isRetroactive = date < today;
  const reasons = isEntry ? IN_REASONS : OUT_REASONS;
  const reasonLabel = isEntry ? 'entrada' : 'saída';
  const tone = isEntry
    ? {
        panel: 'border-emerald-500/20 bg-emerald-500/5',
        icon: 'bg-emerald-500/15 text-emerald-600',
        title: 'text-emerald-700 dark:text-emerald-300',
        accentText: 'text-emerald-600',
        dot: 'bg-emerald-500',
        amountPanel: 'border-emerald-500/25 from-emerald-500/10',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        input: 'border-emerald-500/25 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20',
      }
    : {
        panel: 'border-red-500/20 bg-red-500/5',
        icon: 'bg-red-500/15 text-red-600',
        title: 'text-red-700 dark:text-red-300',
        accentText: 'text-red-600',
        dot: 'bg-red-500',
        amountPanel: 'border-red-500/25 from-red-500/10',
        badge: 'bg-red-500/10 text-red-700 dark:text-red-300',
        input: 'border-red-500/25 focus-visible:border-red-500 focus-visible:ring-red-500/20',
      };
  const amountPreview = useMemo(() => {
    const parsed = parseLocalizedAmount(amount);
    return Number.isFinite(parsed) && parsed > 0 ? fmt(parsed) : 'R$ 0,00';
  }, [amount]);

  useEffect(() => {
    if (open && selectedStoreIds[0]) setStoreId(selectedStoreIds[0]);
  }, [open, selectedStoreIds]);

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setReason('');
    setPaymentMethod('pix');
    setDescription('');
    setIsRecurring(false);
    setRecurrenceFrequency('monthly');
    setRecurrenceInterval('1');
    setRecurrenceOccurrences('12');
    setApprovalRequired(false);
    setStoreId(selectedStoreIds[0] || '');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseLocalizedAmount(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }
    if (!reason) {
      toast.error('Selecione um motivo.');
      return;
    }
    if (!storeId) {
      toast.error('Selecione a loja.');
      return;
    }
    if (!selectedCompanyId) {
      toast.error('Selecione uma empresa primeiro.');
      return;
    }

    setSaving(true);
    try {
      const reasonObj = reasons.find(r => r.value === reason);
      const finalDescription = description || reasonObj?.label || (isEntry ? 'Entrada avulsa' : 'Saída avulsa');
      const categoryNameByReason: Record<string, string> = isEntry
        ? { venda: 'Vendas', recebimento: 'Recebimentos', aporte: 'Aporte de Capital', rendimento: 'Outras Receitas', estorno: 'Outras Receitas', outros: 'Outras Receitas' }
        : { fornecedor: 'Fornecedores', aluguel: 'Aluguel e Condomínio', folha: 'Folha de Pagamento', impostos: 'Impostos e Taxas', manutencao: 'Manutenção e Reparos', marketing: 'Marketing e Publicidade', outros: 'Outras Despesas' };
      const category = categories.find(item => item.name === categoryNameByReason[reason]);

      await FinancialService.createEntry({
        company_id: selectedCompanyId,
        store_id: storeId,
        type: approvalRequired ? (isEntry ? 'receivable' : 'payable') : (isEntry ? 'in' : 'out'),
        amount: numAmount,
        due_date: date,
        payment_method: paymentMethod,
        status: !isRetroactive && !approvalRequired ? 'paid' : 'pending',
        payment_date: !isRetroactive && !approvalRequired ? new Date().toISOString() : null,
        approval_status: approvalRequired ? 'pending_approval' : 'approved',
        is_recurring: isRecurring,
        recurrence_config: isRecurring ? { frequency: recurrenceFrequency, interval: Math.max(1, Number(recurrenceInterval) || 1), occurrences: Math.min(120, Math.max(1, Number(recurrenceOccurrences) || 12)) } : null,
        original_amount: numAmount,
        net_amount: numAmount,
        category_id: category?.id,
        category: category?.name || reasonObj?.label,
        cost_center: category?.cost_center,
        description: finalDescription,
        supplier_customer_name: isEntry ? '' : reasonObj?.label || '',
        origin_table: 'manual',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['financial-categories'], refetchType: 'all' }),
      ]);

      const msg = isRetroactive
        ? `${isEntry ? 'Entrada' : 'Saída'} retroativa registrada (${date}) — status pendente`
        : `${isEntry ? 'Entrada' : 'Saída'} de ${fmt(numAmount)} registrada com sucesso!`;

      toast.success(msg, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        duration: 4000,
      });

      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao registrar ${reasonLabel}: ` + (err?.message || 'tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!fixed z-[100] flex w-[calc(100%-2rem)] max-w-xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl sm:max-h-[90vh]">
        <div className="relative shrink-0 border-b border-border bg-card px-6 pb-5 pt-6 text-foreground">

          <div className="relative flex items-start gap-3 pr-10">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border shadow-sm ${isEntry ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-red-500/20 bg-red-500/10 text-red-600'}`}>
              {isEntry ? <ArrowUpRight className="h-6 w-6" strokeWidth={2.4} /> : <ArrowDownRight className="h-6 w-6" strokeWidth={2.4} />}
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Movimentação manual</p>
              <DialogTitle className="text-2xl font-heading font-black tracking-tight text-foreground">
                Registrar {isEntry ? 'entrada' : 'saída'}
              </DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Por {user?.name || 'Administrador'} · lançamento financeiro local
              </p>
            </div>
            <span className="ml-auto hidden shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground sm:inline-flex">
              {isEntry ? 'Recebimento' : 'Pagamento'}
            </span>
          </div>

          <div className="relative mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              {isEntry ? <PlusCircle className="h-3.5 w-3.5" /> : <MinusCircle className="h-3.5 w-3.5" />}
              Impacto no fluxo de caixa
            </span>
            <span className={`font-black tabular-nums ${isEntry ? 'text-emerald-600' : 'text-red-600'}`}>{amountPreview}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className={`flex items-start gap-3 rounded-2xl border p-3.5 ${tone.panel}`}>
              <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
                <Info className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className={`text-xs font-bold ${tone.title}`}>
                  {isEntry ? 'Entrada registrada como recebimento' : 'Saída registrada como pagamento'}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Preencha os dados abaixo para manter o caixa e os relatórios financeiros atualizados.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                Origem do lançamento
              </div>

              <div className="space-y-2">
                <Label htmlFor="store" className="text-xs font-bold text-foreground">Loja de origem</Label>
                <div className="relative">
                  <Store className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Select value={storeId} onValueChange={setStoreId} disabled={saving}>
                    <SelectTrigger id="store" className="h-12 rounded-xl border-border/70 bg-muted/20 pl-10 text-sm shadow-sm transition-colors hover:border-primary/50">
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent className="z-[120] rounded-xl glass">
                      {(stores as any[]).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">A movimentação ficará vinculada à loja selecionada.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                Detalhes financeiros
              </div>

              <div className={`rounded-2xl border bg-gradient-to-br to-transparent p-4 ${tone.amountPanel}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label htmlFor="amount" className="text-xs font-bold text-foreground">Valor do lançamento</Label>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${tone.badge}`}>Obrigatório</span>
                </div>
                <div className="relative">
                  <span className={`pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-black ${tone.accentText}`}>R$</span>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`h-14 rounded-xl bg-background/75 pl-10 text-2xl font-black tabular-nums shadow-sm focus-visible:ring-2 ${tone.input}`}
                    disabled={saving}
                    required
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Você pode informar o valor usando vírgula ou ponto decimal.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-xs font-bold text-foreground">Motivo / categoria</Label>
                <Select value={reason} onValueChange={setReason} disabled={saving}>
                  <SelectTrigger id="reason" className="h-12 rounded-xl border-border/70 bg-muted/20 text-sm shadow-sm transition-colors hover:border-primary/50">
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent className="z-[120] rounded-xl glass">
                    {reasons.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-xs font-bold text-foreground">Data do lançamento</Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="date"
                      type="date"
                      className={`h-12 rounded-xl border-border/70 bg-muted/20 pl-10 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 ${isRetroactive ? 'border-amber-500 bg-amber-500/10 text-amber-700 font-bold' : ''}`}
                      value={date}
                      max={today}
                      onChange={(e) => setDate(e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment" className="text-xs font-bold text-foreground">Meio de pagamento</Label>
                  <div className="relative">
                    <Wallet className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={saving}>
                      <SelectTrigger id="payment" className="h-12 rounded-xl border-border/70 bg-muted/20 pl-10 text-sm shadow-sm transition-colors hover:border-primary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[120] rounded-xl glass">
                        {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={isRecurring} onChange={event => setIsRecurring(event.target.checked)} disabled={saving} className="mt-1 h-4 w-4 accent-primary" /><span><span className="font-bold">Tornar este lançamento recorrente</span><span className="mt-0.5 block text-xs text-muted-foreground">O modelo poderá gerar os próximos vencimentos sem duplicar ocorrências.</span></span></label>
              {isRecurring && <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1.5"><Label className="text-xs">Frequência</Label><Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency} disabled={saving}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="weekly">Semanal</SelectItem><SelectItem value="daily">Diária</SelectItem><SelectItem value="yearly">Anual</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-xs">Intervalo</Label><Input type="number" min="1" max="12" value={recurrenceInterval} onChange={event => setRecurrenceInterval(event.target.value)} disabled={saving} /></div><div className="space-y-1.5"><Label className="text-xs">Ocorrências</Label><Input type="number" min="1" max="120" value={recurrenceOccurrences} onChange={event => setRecurrenceOccurrences(event.target.value)} disabled={saving} /></div></div>}
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={approvalRequired} onChange={event => setApprovalRequired(event.target.checked)} disabled={saving} className="mt-1 h-4 w-4 accent-primary" /><span><span className="font-bold">Exigir aprovação antes da baixa</span><span className="mt-0.5 block text-xs text-muted-foreground">O lançamento ficará pendente para um usuário com permissão de aprovação.</span></span></label>
            </div>

            {isRetroactive && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-700 dark:text-amber-300">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-[11px] leading-relaxed">
                  <span className="mb-0.5 block text-xs font-black uppercase tracking-wider">Lançamento retroativo</span>
                  Entrará como <span className="font-bold">pendente</span> para aprovação e ficará registrado no histórico de auditoria.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="obs" className="text-xs font-bold text-foreground">Observações</Label>
                <span className="text-[10px] font-medium text-muted-foreground">Opcional</span>
              </div>
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="obs"
                  placeholder="Adicione detalhes ou uma referência para este lançamento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[88px] resize-none rounded-xl border-border/70 bg-muted/20 pl-10 text-sm shadow-sm focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-3 border-t border-border/60 bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
              className="h-11 flex-1 rounded-xl border-border/70 bg-background font-semibold hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className={`h-11 flex-1 gap-2 rounded-xl border-0 font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 ${isEntry ? 'bg-primary hover:bg-primary/90' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</> : <>{isEntry ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />} Confirmar {isEntry ? 'Entrada' : 'Saída'}</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function parseLocalizedAmount(value: string): number {
  const normalized = value.trim().replace(/\s/g, '');
  if (!normalized) return Number.NaN;
  if (normalized.includes(',') && normalized.includes('.')) {
    return Number(normalized.replace(/\./g, '').replace(',', '.'));
  }
  return Number(normalized.replace(',', '.'));
}

function fmt(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
