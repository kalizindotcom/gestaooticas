import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Wallet, Receipt, PlusCircle, MinusCircle, FileBarChart, CheckSquare,
  Lightbulb, X, Info, Clock, AlertCircle, CheckCircle2, Activity,
  TrendingUp as TrendUp, Users, CalendarClock, ArrowDownToLine,
  PiggyBank, Eye, ChevronRight, Sparkles, CircleDollarSign, SlidersHorizontal
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { FinancialStatementContent } from '@/components/financial/FinancialStatementContent';
import { AccountsPayableContent } from '@/components/financial/AccountsPayableContent';
import { AccountsReceivableContent } from '@/components/financial/AccountsReceivableContent';
import { CashierContent } from '@/components/financial/CashierContent';
import { DREContent } from '@/components/financial/DREContent';
import { BankReconciliationContent } from '@/components/financial/BankReconciliationContent';
import { FixedCostsContent } from '@/components/financial/FixedCostsContent';
import { FinancialToolsContent } from '@/components/financial/FinancialToolsContent';
import { EntryExitModal } from '@/components/financial/EntryExitModal';
import { usePermissions } from '@/contexts/PermissionsContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import {
  useFinancialEntries,
  useCashRegistersWithBalance,
  useBankAccounts,
  useFinancialCategories,
} from '@/hooks/useFinancialData';
import { cn } from '@/lib/utils';
import { PeriodPicker } from '@/components/shared/premium/PeriodPicker';
import { DateRange } from 'react-day-picker';
import { CalendarDays, Wallet2, Store as StoreFilterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getEntryPaidAmount, getEntryRemainingAmount } from '@/lib/financial';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useQuery } from '@tanstack/react-query';
import { localApi } from '@/lib/localApi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PermissionAction } from '@/types/permissions';
import { MobileFilterField, MobileFiltersButton, MobileFiltersDialog } from '@/components/shared/MobileFiltersDialog';

const MODULES: Array<{ id: string; title: string; fullTitle: string; icon: any; tip: string; permission: PermissionAction }> = [
  { id: 'statement', title: 'Extrato', fullTitle: 'Extrato Financeiro', icon: Receipt, tip: 'Use o filtro por categoria para identificar onde sua empresa mais gasta.', permission: 'view_statement' },
  { id: 'receivable', title: 'A. Receber', fullTitle: 'Contas a Receber', icon: ArrowUpRight, tip: 'Clique em qualquer conta para ver o histórico completo e baixar a parcela.', permission: 'view_receivable' },
  { id: 'payable', title: 'A. Pagar', fullTitle: 'Contas a Pagar', icon: ArrowDownRight, tip: 'Priorize pagamentos vencidos para evitar juros e multas.', permission: 'view_payable' },
  { id: 'fixed-costs', title: 'Custos Fixos', fullTitle: 'Custos Fixos', icon: CalendarClock, tip: 'Cadastre despesas recorrentes, validade e histórico de pagamentos.', permission: 'view_fixed_costs' },
  { id: 'cashier', title: 'Caixas', fullTitle: 'Gestão de Caixas', icon: Wallet, tip: 'Abra o caixa no início do turno. Sangrias e reforços ficam registrados.', permission: 'view_cashier' },
  { id: 'performance', title: 'DRE', fullTitle: 'DRE & Performance', icon: FileBarChart, tip: 'O DRE mostra se sua empresa está lucrando. Compare períodos para ver a evolução.', permission: 'view_performance' },
  { id: 'conciliation', title: 'Conciliação', fullTitle: 'Conciliação Bancária', icon: CheckSquare, tip: 'Importe o extrato do banco (OFX/CSV) e o sistema cruza automaticamente.', permission: 'view_reconciliation' },
  { id: 'tools', title: 'Operações', fullTitle: 'Operações Financeiras', icon: SlidersHorizontal, tip: 'Use as operações para gerar recorrências, aprovar despesas, criar orçamentos, transferir valores e fechar o dia.', permission: 'view_operations' },
];

const KPI_TONES = {
  primary: {
    card: 'bg-primary/[0.06] border-primary/15',
    glow: 'from-primary/25 to-orange-500/5',
    icon: 'from-primary to-orange-700',
    value: 'text-primary',
  },
  positive: {
    card: 'bg-emerald-500/[0.06] border-emerald-500/15',
    glow: 'from-emerald-500/20 to-transparent',
    icon: 'from-emerald-500 to-teal-600',
    value: 'text-emerald-600',
  },
  negative: {
    card: 'bg-red-500/[0.06] border-red-500/15',
    glow: 'from-red-500/20 to-transparent',
    icon: 'from-red-500 to-rose-600',
    value: 'text-red-600',
  },
  warning: {
    card: 'bg-amber-500/[0.06] border-amber-500/15',
    glow: 'from-amber-500/20 to-orange-500/5',
    icon: 'from-amber-500 to-orange-600',
    value: 'text-amber-600',
  },
} as const;

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);
const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};
const entryReferenceDate = (entry: { payment_date?: string | null; due_date?: string | null }) =>
  new Date(entry.payment_date || entry.due_date || 0);

export default function Financial({ initialModule = 'statement' }: { initialModule?: string }) {
  const [activeModule, setActiveModule] = useState<string>(initialModule);
  React.useEffect(() => setActiveModule(initialModule), [initialModule]);
  const [entryExitType, setEntryExitType] = useState<'in' | 'out' | null>(null);
  const [debtorsDialogOpen, setDebtorsDialogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [globalDateRange, setGlobalDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const visibleModules = MODULES.filter(module => hasPermission('financial', module.permission));
  const { selectedCompanyId, selectedStoreIds, setSelectedStoreIds, getFilteredStores } = useGlobalFilter();
  const availableStores = getFilteredStores();
  const storeFilterValue = selectedStoreIds.length === 0 || selectedStoreIds.length === availableStores.length ? 'all' : selectedStoreIds[0] || 'all';
  const canViewEntries = ['view_statement', 'view_receivable', 'view_payable', 'view_operations'].some(action => hasPermission('financial', action as PermissionAction));
  const canViewCashier = hasPermission('financial', 'view_cashier');
  const canViewBankData = hasPermission('financial', 'view_reconciliation') || hasPermission('financial', 'view_operations');
  const canViewCategories = ['view_statement', 'view_receivable', 'view_payable', 'view_fixed_costs', 'view_cashier', 'view_performance', 'view_reconciliation', 'view_operations'].some(action => hasPermission('financial', action as PermissionAction));
  const canViewOperations = hasPermission('financial', 'view_operations');

  const entriesQuery = useFinancialEntries(undefined, { enabled: canViewEntries });
  const cashQuery = useCashRegistersWithBalance({ status: 'open' }, { enabled: canViewCashier });
  const bankQuery = useBankAccounts({ enabled: canViewBankData });
  const categoriesQuery = useFinancialCategories(undefined, { enabled: canViewCategories });
  const budgetsQuery = useQuery({ queryKey: ['financial-budgets-dashboard', selectedCompanyId, selectedStoreIds], queryFn: async () => { let query = localApi.from('financial_budgets').select('*').eq('company_id', selectedCompanyId!); if (selectedStoreIds.length) query = query.in('store_id', selectedStoreIds); const result = await query.order('reference_month', { ascending: false }); if (result.error) throw result.error; return result.data || []; }, enabled: !!selectedCompanyId && canViewOperations });
  const { data: financialEntries = [], isLoading: entriesLoading } = entriesQuery;
  const { data: cashRegisters = [], isLoading: cashLoading } = cashQuery;
  const { data: bankAccounts = [], isLoading: bankLoading } = bankQuery;
  const { data: categories = [] } = categoriesQuery;
  const budgets = budgetsQuery.data || [];
  const isLoading = entriesLoading || cashLoading || bankLoading || permissionsLoading;
  const queryError = entriesQuery.error || cashQuery.error || bankQuery.error || categoriesQuery.error || budgetsQuery.error;
  const canCreate = hasPermission('financial', 'create_entry');

  // ============ KPIs PRINCIPAIS ============
  const totalReceivable = useMemo(() =>
    financialEntries.filter(e => (e.type === 'receivable' || e.type === 'in') && e.status !== 'paid' && e.status !== 'cancelled').reduce((s, e) => s + getEntryRemainingAmount(e), 0),
    [financialEntries]);
  const totalPayable = useMemo(() =>
    financialEntries.filter(e => (e.type === 'payable' || e.type === 'out') && e.status !== 'paid' && e.status !== 'cancelled').reduce((s, e) => s + getEntryRemainingAmount(e), 0),
    [financialEntries]);
  const totalOverdue = useMemo(() => {
    const today = startOfDay(new Date());
    return financialEntries
      .filter(e => e.status !== 'paid' && e.status !== 'cancelled' && (e.status === 'overdue' || ((e.status === 'pending' || e.status === 'partially_paid') && new Date(e.due_date) < today)))
      .reduce((s, e) => s + getEntryRemainingAmount(e), 0);
  }, [financialEntries]);
  const totalCashBalance = useMemo(() =>
    cashRegisters.reduce((s, c) => s + (c.current_balance ?? c.opening_balance ?? 0), 0),
    [cashRegisters]);
  const totalBankBalance = useMemo(() =>
    bankAccounts.reduce((s, b) => s + Number(b.current_balance || 0), 0),
    [bankAccounts]);
  const consolidatedBalance = totalCashBalance + totalBankBalance;

  const monthBalance = useMemo(() => {
    const start = startOfDay(globalDateRange?.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const end = endOfDay(globalDateRange?.to || new Date());
    const inc = financialEntries.filter(e => (e.type === 'receivable' || e.type === 'in') && getEntryPaidAmount(e) > 0 && entryReferenceDate(e) >= start && entryReferenceDate(e) <= end).reduce((s, e) => s + getEntryPaidAmount(e), 0);
    const exp = financialEntries.filter(e => (e.type === 'payable' || e.type === 'out') && getEntryPaidAmount(e) > 0 && entryReferenceDate(e) >= start && entryReferenceDate(e) <= end).reduce((s, e) => s + getEntryPaidAmount(e), 0);
    return inc - exp;
  }, [financialEntries, globalDateRange?.from?.toISOString(), globalDateRange?.to?.toISOString()]);

  // ============ FLUXO DE CAIXA (6 MESES) ============
  const cashFlowData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      const income = financialEntries.filter(e => (e.type === 'receivable' || e.type === 'in') && getEntryPaidAmount(e) > 0 && new Date(e.payment_date || e.due_date) >= start && new Date(e.payment_date || e.due_date) <= end).reduce((s, e) => s + getEntryPaidAmount(e), 0);
      const expenses = financialEntries.filter(e => (e.type === 'payable' || e.type === 'out') && getEntryPaidAmount(e) > 0 && new Date(e.payment_date || e.due_date) >= start && new Date(e.payment_date || e.due_date) <= end).reduce((s, e) => s + getEntryPaidAmount(e), 0);
      return { month: label.charAt(0).toUpperCase() + label.slice(1), income, expenses, balance: income - expenses };
    });
  }, [financialEntries]);

  const periodSummary = useMemo(() => {
    const start = startOfDay(globalDateRange?.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const end = endOfDay(globalDateRange?.to || new Date());
    const inEntries = financialEntries.filter(e => (e.type === 'receivable' || e.type === 'in') && e.status !== 'cancelled');
    const outEntries = financialEntries.filter(e => (e.type === 'payable' || e.type === 'out') && e.status !== 'cancelled');
    const inPaid = inEntries.filter(e => getEntryPaidAmount(e) > 0 && entryReferenceDate(e) >= start && entryReferenceDate(e) <= end).reduce((sum, e) => sum + getEntryPaidAmount(e), 0);
    const outPaid = outEntries.filter(e => getEntryPaidAmount(e) > 0 && entryReferenceDate(e) >= start && entryReferenceDate(e) <= end).reduce((sum, e) => sum + getEntryPaidAmount(e), 0);
    const pendingIn = inEntries.filter(e => ['pending', 'partially_paid', 'overdue'].includes(String(e.status))).reduce((sum, e) => sum + getEntryRemainingAmount(e), 0);
    const pendingOut = outEntries.filter(e => ['pending', 'partially_paid', 'overdue'].includes(String(e.status))).reduce((sum, e) => sum + getEntryRemainingAmount(e), 0);
    return { inPaid, outPaid, pendingIn, pendingOut, result: inPaid - outPaid };
  }, [financialEntries, globalDateRange?.from?.toISOString(), globalDateRange?.to?.toISOString()]);

  // ============ PROJEÇÃO 30 DIAS ============
  const projection30d = useMemo(() => {
    const today = startOfDay(new Date());
    const limit = endOfDay(new Date(today.getTime() + 30 * 86400000));
    const toReceive = financialEntries
      .filter(e => (e.type === 'receivable' || e.type === 'in') && ['pending', 'partially_paid'].includes(String(e.status)) && new Date(e.due_date) >= today && new Date(e.due_date) <= limit)
      .reduce((s, e) => s + getEntryRemainingAmount(e), 0);
    const toPay = financialEntries
      .filter(e => (e.type === 'payable' || e.type === 'out') && ['pending', 'partially_paid'].includes(String(e.status)) && new Date(e.due_date) >= today && new Date(e.due_date) <= limit)
      .reduce((s, e) => s + getEntryRemainingAmount(e), 0);
    return { toReceive, toPay, net: toReceive - toPay };
  }, [financialEntries]);

  const budgetAlerts = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return budgets.filter((budget: any) => budget.reference_month === currentMonth).map((budget: any) => {
      const realized = financialEntries.filter(entry => entry.store_id === budget.store_id && entry.type === 'out' && entry.status === 'paid' && String(entry.due_date || '').slice(0, 7) === currentMonth && (!budget.category_id || entry.category_id === budget.category_id) && (!budget.cost_center || entry.cost_center === budget.cost_center)).reduce((sum, entry) => sum + Number(entry.net_amount || entry.amount || 0), 0);
      const limit = Number(budget.limit_amount || 0);
      const percent = limit > 0 ? (realized / limit) * 100 : 0;
      return { ...budget, realized, limit, percent, remaining: limit - realized, status: percent >= 100 ? 'exceeded' : 'warning' };
    }).filter((budget: any) => budget.percent >= Number(budget.warning_percent || 80)).sort((a: any, b: any) => b.percent - a.percent);
  }, [budgets, financialEntries]);

  const projectionHorizons = useMemo(() => [7, 30, 60, 90].map(days => {
    const today = startOfDay(new Date());
    const limit = endOfDay(new Date(today.getTime() + days * 86400000));
    const toReceive = financialEntries.filter(e => (e.type === 'receivable' || e.type === 'in') && ['pending', 'partially_paid'].includes(String(e.status)) && new Date(e.due_date) >= today && new Date(e.due_date) <= limit).reduce((s, e) => s + getEntryRemainingAmount(e), 0);
    const toPay = financialEntries.filter(e => (e.type === 'payable' || e.type === 'out') && ['pending', 'partially_paid'].includes(String(e.status)) && new Date(e.due_date) >= today && new Date(e.due_date) <= limit).reduce((s, e) => s + getEntryRemainingAmount(e), 0);
    return { days, toReceive, toPay, net: toReceive - toPay };
  }), [financialEntries]);

  // ============ AGING (faixas de vencimento) ============
  const aging = useMemo(() => {
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const today = startOfDay(new Date());
    financialEntries.filter(e => (e.type === 'receivable' || e.type === 'in') && e.status !== 'paid' && e.status !== 'cancelled').forEach(e => {
      const days = Math.floor((today.getTime() - startOfDay(new Date(e.due_date)).getTime()) / 86400000);
      if (days < 0) return;
      if (days <= 30) buckets['0-30'] += getEntryRemainingAmount(e);
      else if (days <= 60) buckets['31-60'] += getEntryRemainingAmount(e);
      else if (days <= 90) buckets['61-90'] += getEntryRemainingAmount(e);
      else buckets['90+'] += getEntryRemainingAmount(e);
    });
    return Object.entries(buckets).map(([range, amount]) => ({ range, amount }));
  }, [financialEntries]);

  // ============ TOP DEVEDORES ============
  const allDebtors = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    financialEntries.filter(e => (e.type === 'receivable' || e.type === 'in') && e.status !== 'paid' && e.status !== 'cancelled' && e.supplier_customer_name).forEach(e => {
      const name = e.supplier_customer_name!.trim();
      if (!name) return;
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += getEntryRemainingAmount(e);
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [financialEntries]);
  const topDebtors = useMemo(() => allDebtors.slice(0, 5), [allDebtors]);

  // ============ DESPESAS POR CATEGORIA ============
  const topCategories = useMemo(() => {
    const map: Record<string, { name: string; total: number; color: string }> = {};
    financialEntries.filter(e => (e.type === 'payable' || e.type === 'out') && e.status === 'paid').forEach(e => {
      const cat = categories.find((c: any) => c.id === e.category_id);
      const categoryId = cat?.id || e.category_id || 'uncategorized';
      const categoryName = cat?.name || e.category || 'Sem categoria';
      if (!map[categoryId]) map[categoryId] = { name: categoryName, total: 0, color: cat?.color || '#64748b' };
      map[categoryId].total += getEntryPaidAmount(e);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [financialEntries, categories]);

  // ============ ALERTAS ============
  const alerts = useMemo(() => {
    const list: { type: 'warning' | 'danger' | 'info' | 'success'; msg: string }[] = [];
    const today = startOfDay(new Date());
    const in7 = endOfDay(new Date(today.getTime() + 7 * 86400000));
    const dueSoon = financialEntries.filter(e => ['pending', 'partially_paid'].includes(String(e.status)) && getEntryRemainingAmount(e) > 0 && new Date(e.due_date) <= in7 && new Date(e.due_date) >= today);
    if (dueSoon.length > 0) list.push({ type: 'warning', msg: `${dueSoon.length} conta(s) vencem nos próximos 7 dias — ${fmt(dueSoon.reduce((s, e) => s + getEntryRemainingAmount(e), 0))}` });
    const overdueCount = financialEntries.filter(e => ['overdue', 'pending', 'partially_paid'].includes(String(e.status)) && getEntryRemainingAmount(e) > 0 && new Date(e.due_date) < today).length;
    if (overdueCount > 0) list.push({ type: 'danger', msg: `${overdueCount} lançamento(s) vencidos precisam de atenção imediata.` });
    const cashOpen = cashRegisters.filter(c => c.status === 'open').length;
    if (cashOpen > 0) list.push({ type: 'info', msg: `${cashOpen} caixa(s) aberto(s) agora.` });
    if (consolidatedBalance > 0) list.push({ type: 'success', msg: `Saldo consolidado: ${fmt(consolidatedBalance)} entre caixas e bancos.` });
    return list;
  }, [financialEntries, cashRegisters, consolidatedBalance]);

  const activeModuleData = visibleModules.find(m => m.id === activeModule) || visibleModules[0] || MODULES[0];
  const activeModuleId = activeModuleData?.id || '';

  const renderContent = () => {
    switch (activeModuleId) {
      case 'statement': return <FinancialStatementContent globalDateRange={globalDateRange} />;
      case 'payable': return <AccountsPayableContent globalDateRange={globalDateRange} />;
      case 'fixed-costs': return <FixedCostsContent />;
      case 'receivable': return <AccountsReceivableContent globalDateRange={globalDateRange} />;
      case 'cashier': return <CashierContent globalDateRange={globalDateRange} />;
      case 'performance': return <DREContent globalDateRange={globalDateRange} />;
      case 'conciliation': return <BankReconciliationContent />;
      case 'tools': return <FinancialToolsContent />;
      default: return <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma área financeira foi liberada para este usuário.</div>;
    }
  };

  if (isLoading) return <LoadingSpinner message="Carregando dados financeiros..." />;
  if (!hasPermission('financial', 'view')) return <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"><h2 className="font-heading text-lg font-black text-foreground">Acesso restrito</h2><p className="mt-2 text-sm text-muted-foreground">Você não possui a permissão para visualizar o módulo Financeiro.</p></div>;
  if (queryError) {
    const message = queryError instanceof Error ? queryError.message : 'Não foi possível carregar os dados financeiros locais.';
    return <ErrorMessage message={message} retry={() => { void Promise.all([entriesQuery.refetch(), cashQuery.refetch(), bankQuery.refetch(), categoriesQuery.refetch()]); }} />;
  }

  const kpis = [
    { label: 'A Receber', value: totalReceivable, icon: ArrowUpRight, tone: 'positive', tip: 'Soma de todas as contas a receber ainda não pagas. Inclui crediário e vendas parceladas.' },
    { label: 'A Pagar', value: totalPayable, icon: ArrowDownRight, tone: 'negative', tip: 'Total de obrigações financeiras em aberto com fornecedores e despesas fixas.' },
    { label: 'Saldo Consolidado', value: consolidatedBalance, icon: PiggyBank, tone: 'primary', tip: 'Caixas abertos + contas bancárias. Visão consolidada do dinheiro disponível.' },
    { label: 'Inadimplência', value: totalOverdue, icon: AlertTriangle, tone: 'warning', tip: 'Valor total de contas vencidas. Quanto menor, melhor a saúde financeira.' },
    { label: 'Resultado do Mês', value: monthBalance, icon: monthBalance >= 0 ? TrendingUp : TrendingDown, tone: monthBalance >= 0 ? 'positive' : 'negative', tip: 'Diferença entre entradas e saídas do mês atual. Positivo = lucro operacional.' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ============ HERO HEADER ============ */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm animate-fade-in-up">
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Wallet2 className="h-4 w-4" strokeWidth={2.2} />
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Central Financeira</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Dados locais ao vivo
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-foreground">Financeiro</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Visão consolidada de caixa, contas e fluxo.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            {canCreate && (
              <div className="flex items-center gap-2">
                <Button onClick={() => setEntryExitType('in')} className="h-11 gap-2 rounded-xl border-0 bg-primary px-4 font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover-lift">
                  <PlusCircle className="h-4 w-4" /> Entrada
                </Button>
                <Button onClick={() => setEntryExitType('out')} className="h-11 gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 font-bold text-red-700 hover:bg-red-500/20 dark:text-red-300 hover-lift">
                  <MinusCircle className="h-4 w-4" /> Saída
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ ALERTAS ============ */}
      {!bannerDismissed && alerts.length > 0 && (
        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {alerts.slice(0, 2).map((alert, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium border backdrop-blur-sm animate-fade-in",
                alert.type === 'danger' && "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
                alert.type === 'warning' && "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
                alert.type === 'info' && "bg-primary/10 border-primary/30 text-primary",
                alert.type === 'success' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {alert.type === 'danger' && <AlertCircle className="h-4 w-4 shrink-0" />}
              {alert.type === 'warning' && <Clock className="h-4 w-4 shrink-0" />}
              {alert.type === 'info' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {alert.type === 'success' && <Sparkles className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{alert.msg}</span>
              {i === alerts.length - 1 && (
                <button onClick={() => setBannerDismissed(true)} className="opacity-40 hover:opacity-80 transition-opacity p-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ============ KPIs PRINCIPAIS ============ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {kpis.map((kpi, i) => {
          const tone = KPI_TONES[kpi.tone];
          return (
          <TooltipProvider key={kpi.label}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn("group relative rounded-2xl border p-4 hover-lift cursor-default animate-fade-in-up overflow-hidden", tone.card)}
                  style={{ animationDelay: `${150 + i * 80}ms` }}
                >
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="relative">
                        <div className={cn("relative h-9 w-9 rounded-xl grid place-items-center shadow-sm bg-gradient-to-br", kpi.label === 'A Receber' ? 'from-emerald-500 to-teal-600' : kpi.label === 'A Pagar' ? 'from-red-500 to-rose-600' : tone.icon)}>
                          <kpi.icon className="h-4 w-4 text-primary-foreground" strokeWidth={2.2} />
                        </div>
                      </div>
                      <Info className="h-3 w-3 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </div>
                    <div className={cn("text-2xl font-heading font-black tabular-nums tracking-tight", tone.value)}>
                      {fmtShort(Math.abs(kpi.value))}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mt-1">
                      {kpi.label}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] glass border-gradient text-xs">
                <p className="font-bold mb-0.5">{kpi.label}</p>
                <p className="text-muted-foreground text-[11px] mb-1">{kpi.tip}</p>
                <p className="font-bold text-foreground">{fmt(kpi.value)}</p>
              </TooltipContent>
            </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {/* ============ FILTROS GLOBAIS ============ */}
      <div className="hidden w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm sm:flex">
        <div className="flex shrink-0 items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-foreground"><StoreFilterIcon className="h-4 w-4 text-primary" />Filtros</div>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[250px] sm:max-w-[460px]">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Loja</span>
          <Select value={storeFilterValue} onValueChange={(value) => value === 'all' ? setSelectedStoreIds(availableStores.map(store => store.id)) : setSelectedStoreIds([value])}>
            <SelectTrigger className="h-8 min-w-0 flex-1 border-border/70 bg-background px-2.5 text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl"><SelectItem value="all">Todas as lojas</SelectItem>{availableStores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Período</span>
          <div className="w-auto"><PeriodPicker dateRange={globalDateRange} setDateRange={setGlobalDateRange} /></div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:hidden">
        <MobileFiltersButton activeCount={(selectedStoreIds.length > 0 ? 1 : 0) + (globalDateRange?.from ? 1 : 0)} onClick={() => setMobileFiltersOpen(true)} className="flex-1" />
        <div className="min-w-0 flex-1 truncate rounded-xl border border-border bg-card px-3 py-2.5 text-center text-[11px] font-bold text-muted-foreground">{activeModuleData.title}</div>
      </div>

      <MobileFiltersDialog
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        title="Filtros financeiros"
        description="Escolha a loja e o período da visão consolidada."
        activeCount={(selectedStoreIds.length > 0 ? 1 : 0) + (globalDateRange?.from ? 1 : 0)}
        onClear={() => { setSelectedStoreIds(availableStores.map(store => store.id)); setGlobalDateRange({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date() }); }}
      >
        <div className="space-y-4">
          <MobileFilterField label="Loja">
            <Select value={storeFilterValue} onValueChange={(value) => value === 'all' ? setSelectedStoreIds(availableStores.map(store => store.id)) : setSelectedStoreIds([value])}>
              <SelectTrigger className="h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{availableStores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent>
            </Select>
          </MobileFilterField>
          <MobileFilterField label="Período">
            <PeriodPicker dateRange={globalDateRange} setDateRange={setGlobalDateRange} />
          </MobileFilterField>
        </div>
      </MobileFiltersDialog>

      {/* ============ GRÁFICO + PROJEÇÃO + AGING ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Cash flow chart + period summary */}
        <div className="lg:col-span-2 space-y-4 animate-fade-in-up" style={{ animationDelay: '550ms' }}>
          <div className="relative bg-card border border-border/60 rounded-2xl p-5 hover-lift overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-primary/30" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-heading font-bold tracking-tight flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-orange-700 grid place-items-center shadow-md shadow-primary/20">
                    <Activity className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  Fluxo de Caixa
                </h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Últimos 6 meses</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Receitas
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                  Despesas
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  Saldo
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={cashFlowData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={36} />
                <RechartsTooltip
                  formatter={(v: number, name: string) => [fmt(v), name === 'income' ? 'Receitas' : name === 'expenses' ? 'Despesas' : 'Saldo']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)',
                  }}
                  labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Area type="monotone" dataKey="income" name="Receitas" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" />
                <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#ef4444" strokeWidth={2.5} fill="url(#expGrad)" />
                <Area type="monotone" dataKey="balance" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover-lift">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-heading font-bold tracking-tight">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><Wallet className="h-3.5 w-3.5" /></span>
                  Resumo do período
                </h3>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Movimentação efetivamente paga/recebida</p>
              </div>
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-black tabular-nums', periodSummary.result >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600')}>
                {periodSummary.result >= 0 ? '+' : ''}{fmtShort(periodSummary.result)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Recebido</p>
                <p className="mt-1 text-sm font-black tabular-nums text-emerald-600">{fmtShort(periodSummary.inPaid)}</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">Pago</p>
                <p className="mt-1 text-sm font-black tabular-nums text-red-600">{fmtShort(periodSummary.outPaid)}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Em aberto</p>
                <p className="mt-1 text-sm font-black tabular-nums text-foreground">{fmtShort(periodSummary.pendingIn + periodSummary.pendingOut)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Projeção 30 dias + Aging */}
        <div className="space-y-4">
          <div className="relative bg-card border border-border/60 rounded-2xl p-5 hover-lift overflow-hidden animate-fade-in-up" style={{ animationDelay: '650ms' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center shadow-md shadow-emerald-500/20">
                <CalendarClock className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold tracking-tight">Projeção de caixa</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Projeção</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {projectionHorizons.map(horizon => (
                <div key={horizon.days} className="rounded-xl border border-border bg-muted/20 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-foreground">{horizon.days} dias</span><span className={cn('text-[10px] font-black', horizon.net >= 0 ? 'text-emerald-600' : 'text-red-600')}>{horizon.net >= 0 ? '+' : ''}{fmtShort(horizon.net)}</span></div>
                  <div className="flex items-center justify-between text-[10px]"><span className="text-emerald-600">Receber</span><strong>{fmtShort(horizon.toReceive)}</strong></div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px]"><span className="text-red-600">Pagar</span><strong>{fmtShort(horizon.toPay)}</strong></div>
                </div>
              ))}
            </div>
          </div>

          {/* Aging */}
          <div className="relative bg-card border border-border/60 rounded-2xl p-5 hover-lift overflow-hidden animate-fade-in-up" style={{ animationDelay: '700ms' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center shadow-md shadow-amber-500/20">
                <Clock className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-heading font-bold tracking-tight">Aging de Recebíveis</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Por dias em atraso</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {aging.map((bucket, i) => {
                const colors = ['#10b981', '#84cc16', '#f59e0b', '#ef4444'];
                const isHigh = bucket.range === '90+' && bucket.amount > 0;
                return (
                  <div key={bucket.range} className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: `${750 + i * 50}ms` }}>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-12">{bucket.range}d</span>
                    <div className="flex-1 h-7 rounded-lg bg-muted/30 relative overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700"
                        style={{
                          background: `linear-gradient(90deg, ${colors[i]}40, ${colors[i]})`,
                          width: `${Math.min((bucket.amount / Math.max(...aging.map(a => a.amount), 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className={cn(
                      "text-xs font-black tabular-nums w-16 text-right",
                      isHigh ? "text-red-600" : "text-foreground"
                    )}>
                      {fmtShort(bucket.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============ TOP DEVEDORES + TOP CATEGORIAS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top devedores */}
        <div className="animate-fade-in-up" style={{ animationDelay: '800ms' }}>
          <div className="relative bg-card border border-border/60 rounded-2xl p-5 hover-lift overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 grid place-items-center shadow-md shadow-red-500/20">
                  <Users className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-bold tracking-tight">Top Devedores</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Clientes com pendências</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDebtorsDialogOpen(true)} className="text-[10px] h-7 font-bold text-primary hover:text-primary">
                Ver todos <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
            <div className="space-y-2">
              {topDebtors.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum devedor no momento.</p>
              ) : (
                topDebtors.map((debtor, i) => (
                  <div
                    key={debtor.name}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${850 + i * 50}ms` }}
                  >
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-orange-700 blur-sm opacity-30" />
                      <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 border border-primary/20 grid place-items-center font-bold text-[11px] text-primary">
                        {debtor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{debtor.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        {debtor.count} {debtor.count === 1 ? 'parcela' : 'parcelas'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-red-600 tabular-nums">{fmt(debtor.total)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Top categorias de despesa */}
        <div className="animate-fade-in-up" style={{ animationDelay: '850ms' }}>
          <div className="relative bg-card border border-border/60 rounded-2xl p-5 hover-lift overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-primary/30" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-orange-700 grid place-items-center shadow-md shadow-primary/20">
                  <CircleDollarSign className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-bold tracking-tight">Top Categorias de Despesa</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Onde o dinheiro vai</p>
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {topCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem dados ainda.</p>
              ) : (
                topCategories.map((cat, i) => {
                  const total = topCategories.reduce((s, c) => s + c.total, 0);
                  const pct = (cat.total / total) * 100;
                  return (
                    <div
                      key={cat.name}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${900 + i * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{cat.name}</span>
                        <span className="text-xs font-black tabular-nums text-muted-foreground">
                          {fmt(cat.total)} <span className="text-[10px] text-muted-foreground/60">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            background: `linear-gradient(90deg, ${cat.color}80, ${cat.color})`,
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="xl:col-span-2 animate-fade-in-up" style={{ animationDelay: '950ms' }}>
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 hover-lift">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-sm font-heading font-bold tracking-tight">Alertas de orçamento</h3><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Acompanhamento do mês atual</p></div><PiggyBank className="h-4 w-4 text-primary" /></div>
            {budgetAlerts.length === 0 ? <p className="py-3 text-xs text-muted-foreground">Nenhum orçamento atingiu o limite de alerta neste mês.</p> : <div className="grid gap-3 md:grid-cols-2">{budgetAlerts.slice(0, 6).map((budget: any) => <div key={budget.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-bold">{budget.category_id ? 'Categoria monitorada' : budget.cost_center ? `Centro: ${budget.cost_center}` : 'Orçamento geral'}</span><strong className={cn('text-xs', budget.status === 'exceeded' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>{budget.status === 'exceeded' ? 'Excedido' : 'Atenção'} · {budget.percent.toFixed(0)}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', budget.percent >= 100 ? 'bg-red-500' : 'bg-amber-500')} style={{ width: `${Math.min(100, budget.percent)}%` }} /></div><div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground"><span>{fmt(budget.realized)} realizados</span><span>limite {fmt(budget.limit)}</span></div></div>)}</div>}
          </div>
        </div>
      </div>

      {/* ============ ABAS DE MÓDULOS ============ */}
      <div className="animate-fade-in-up" style={{ animationDelay: '1000ms' }}>
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl p-1.5 hover-lift">
          <div className="flex gap-1 overflow-x-auto overscroll-x-contain no-scrollbar sm:flex-wrap">
            {visibleModules.map(m => {
              const isActive = activeModuleId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                                      className={cn(
                    "group relative flex min-w-[112px] shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all overflow-hidden sm:min-w-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}

                >
                  <m.icon className={cn("h-3.5 w-3.5", m.id === 'receivable' ? (isActive ? 'text-emerald-200' : 'text-emerald-600') : m.id === 'payable' ? (isActive ? 'text-red-200' : 'text-red-600') : '')} />
                  <span>{m.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ CONTEÚDO DA ABA ============ */}
      <div className="space-y-4">
        {/* Tip strip */}
        <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-3 backdrop-blur-sm animate-fade-in">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Lightbulb className="h-3.5 w-3.5" />
          </div>
          <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-primary">Dica</span>
          <span className="text-xs leading-relaxed text-foreground/80">{activeModuleData.tip}</span>
        </div>

        {/* Module content */}
        <div key={activeModule} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {renderContent()}
        </div>
      </div>

      <Dialog open={debtorsDialogOpen} onOpenChange={setDebtorsDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden rounded-2xl border-border bg-card p-0">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-lg font-heading font-black"><Users className="h-5 w-5 text-primary" />Todos os devedores</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Clientes com contas a receber pendentes no escopo atual de loja e período.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-6">
            {allDebtors.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum devedor no momento.</div> : <div className="space-y-2">{allDebtors.map((debtor, index) => <div key={debtor.name} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-xs font-black text-primary">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground">{debtor.name}</p><p className="text-xs text-muted-foreground">{debtor.count} {debtor.count === 1 ? 'parcela pendente' : 'parcelas pendentes'}</p></div><strong className="shrink-0 text-sm font-black tabular-nums text-red-600">{fmt(debtor.total)}</strong></div>)}</div>}
          </div>
        </DialogContent>
      </Dialog>

      <EntryExitModal
        open={entryExitType !== null}
        onOpenChange={(open) => {
          if (!open) setEntryExitType(null);
        }}
        type={entryExitType || 'in'}
      />
    </div>
  );
}
