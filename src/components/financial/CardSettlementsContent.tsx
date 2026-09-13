import React, { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { localApi } from '@/lib/localApi';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { FinancialInfoTip } from './FinancialInfoTip';

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: unknown) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function CardSettlementsContent() {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [settledDate, setSettledDate] = useState(today());
  const [actualAmount, setActualAmount] = useState('');
  const canReconcile = hasPermission('financial', 'reconcile');

  const settlementsQuery = useQuery({
    queryKey: ['financial-card-settlements', selectedCompanyId, selectedStoreIds],
    queryFn: async () => {
      let query = localApi.from('financial_card_settlements').select('*').eq('company_id', selectedCompanyId!);
      if (selectedStoreIds.length > 0) query = query.in('store_id', selectedStoreIds);
      const result = await query.order('expected_date', { ascending: true }).limit(100);
      if (result.error) throw result.error;
      return (result.data || []) as Array<Record<string, any>>;
    },
    enabled: !!selectedCompanyId,
  });

  const pending = useMemo(() => (settlementsQuery.data || []).filter(item => item.status !== 'settled'), [settlementsQuery.data]);
  const selected = pending.find(item => item.id === selectedId);
  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Selecione uma parcela pendente.');
      const parsedAmount = Number(String(actualAmount || '').replace(',', '.'));
      if (!settledDate || !Number.isFinite(parsedAmount) || parsedAmount < 0) throw new Error('Informe data e valor líquido válidos.');
      const result = await localApi.operations.settleCardSettlement(selected.id, { settled_date: settledDate, actual_net_amount: parsedAmount });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['financial-card-settlements'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'], refetchType: 'all' });
      toast.success(`Parcela conciliada. Diferença: ${money(result?.difference || 0)}.`);
      setSelectedId('');
      setActualAmount('');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Não foi possível conciliar a parcela.'),
  });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-primary" />Liquidações de cartão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FinancialInfoTip title="Sem duplicar recebíveis">A venda continua sendo um único lançamento a receber. Esta área apenas detalha as parcelas previstas, taxas e o líquido depositado pela operadora.</FinancialInfoTip>
        {settlementsQuery.isLoading ? <p className="py-4 text-sm text-muted-foreground">Carregando parcelas de cartão...</p> : settlementsQuery.error ? <p className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600">Não foi possível carregar as liquidações de cartão.</p> : pending.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhuma parcela de cartão pendente.</p> : <div className="space-y-2">{pending.slice(0, 8).map(item => <button type="button" key={item.id} onClick={() => { setSelectedId(item.id); setActualAmount(Number(item.net_amount || 0).toFixed(2)); setSettledDate(today()); }} className={`grid w-full gap-2 rounded-xl border p-3 text-left transition-colors sm:grid-cols-[1.4fr_1fr_1fr_auto] ${selectedId === item.id ? 'border-primary bg-primary/[0.06]' : 'border-border bg-muted/20 hover:bg-muted/40'}`}><span className="min-w-0"><strong className="block truncate text-sm text-foreground">{item.card_brand || 'Cartão'} · venda {String(item.sale_id || '').slice(0, 8)}</strong><span className="text-xs text-muted-foreground">Parcela {item.installment_number}/{item.installment_total} · previsão {item.expected_date ? new Date(item.expected_date).toLocaleDateString('pt-BR') : '—'}</span></span><span className="text-xs text-muted-foreground">Bruto<br /><strong className="text-foreground">{money(item.gross_amount)}</strong></span><span className="text-xs text-muted-foreground">Taxa / líquido<br /><strong className="text-foreground">{money(item.fee_amount)} · {money(item.net_amount)}</strong></span><Badge variant="outline" className="w-fit self-center border-amber-500/30 text-amber-700 dark:text-amber-300">Pendente</Badge></button>)}</div>}
        {selected && <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:grid-cols-[1fr_1fr_auto]"><div className="space-y-1.5"><Label>Data recebida</Label><Input type="date" value={settledDate} onChange={event => setSettledDate(event.target.value)} /></div><div className="space-y-1.5"><Label>Líquido recebido</Label><Input value={actualAmount} onChange={event => setActualAmount(event.target.value)} inputMode="decimal" /></div><div className="flex items-end"><Button disabled={!canReconcile || settleMutation.isPending} onClick={() => settleMutation.mutate()} className="w-full gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">{settleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Conciliar parcela</Button></div></div>}
        {!canReconcile && <p className="text-xs text-muted-foreground">Sua permissão atual permite visualizar, mas não conciliar liquidações.</p>}
      </CardContent>
    </Card>
  );
}
