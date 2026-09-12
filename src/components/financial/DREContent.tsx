import React, { useState, useMemo, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, Percent, Target, ArrowUpRight, ArrowDownRight, Download, ChevronRight, ChevronDown } from 'lucide-react';
import { useDRE, useDREComparison } from '@/hooks/useFinancialData';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ReportGenerator } from '@/services/reportGenerator';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { usePermissions } from '@/contexts/PermissionsContext';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

const COLORS = ['#E6451F', '#F28C28', '#F59E0B', '#EF4444', '#9B3218', '#A3D33F'];
const fmt = (v: number | undefined) => `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function DRERow({ label, value, indent = 0, bold = false, positive = true, highlight = false, separator = false }: {
  label: string; value: number | undefined; indent?: number; bold?: boolean; positive?: boolean; highlight?: boolean; separator?: boolean;
}) {
  const safeValue = value ?? 0;
  const isPositive = safeValue >= 0;
  return (
    <div className={cn(
      'flex items-center justify-between py-2.5 px-4 rounded-xl transition-colors',
      highlight && 'bg-primary/[0.06] border border-primary/15',
      separator && 'border-t border-border mt-1 pt-3',
      !highlight && 'hover:bg-muted/50'
    )}>
      <span className={cn(
        'text-sm',
        bold ? 'font-bold text-foreground' : 'text-muted-foreground',
        indent === 1 && 'pl-4',
        indent === 2 && 'pl-8',
      )}>
        {!bold && indent > 0 && <span className="text-muted-foreground/50 mr-2">—</span>}
        {label}
      </span>
      <span className={cn(
        'text-sm font-bold tabular-nums',
        highlight ? (isPositive ? 'text-primary' : 'text-red-500') : (bold ? 'text-foreground' : 'text-muted-foreground')
      )}>
        {safeValue < 0 ? `(${fmt(Math.abs(safeValue))})` : fmt(safeValue)}
      </span>
    </div>
  );
}

export function DREContent({ globalDateRange }: { globalDateRange?: DateRange }) {
  const { hasPermission } = usePermissions();
  const canViewMargin = hasPermission('financial', 'view_margin');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ revenue: true, expenses: true });

  const toggleSection = (s: string) => setExpandedSections(p => ({ ...p, [s]: !p[s] }));

  const { currentStart, currentEnd, previousStart, previousEnd } = useMemo(() => {
    // When global date range is provided, use it directly
    if (globalDateRange?.from && globalDateRange?.to) {
      const from = globalDateRange.from;
      const to = globalDateRange.to;
      const rangeMs = to.getTime() - from.getTime();
      return {
        currentStart: from,
        currentEnd: to,
        previousStart: new Date(from.getTime() - rangeMs - 86400000),
        previousEnd: new Date(from.getTime() - 86400000),
      };
    }
    const now = new Date();
    if (period === 'month') return {
      currentStart: new Date(now.getFullYear(), now.getMonth(), 1),
      currentEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      previousStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      previousEnd: new Date(now.getFullYear(), now.getMonth(), 0),
    };
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      return {
        currentStart: new Date(now.getFullYear(), q * 3, 1),
        currentEnd: new Date(now.getFullYear(), (q + 1) * 3, 0),
        previousStart: new Date(now.getFullYear(), (q - 1) * 3, 1),
        previousEnd: new Date(now.getFullYear(), q * 3, 0),
      };
    }
    return {
      currentStart: new Date(now.getFullYear(), 0, 1),
      currentEnd: new Date(now.getFullYear(), 11, 31),
      previousStart: new Date(now.getFullYear() - 1, 0, 1),
      previousEnd: new Date(now.getFullYear() - 1, 11, 31),
    };
  }, [period, globalDateRange?.from?.toISOString(), globalDateRange?.to?.toISOString()]);

  const dreQuery = useDRE(currentStart, currentEnd);
  const comparisonQuery = useDREComparison(currentStart, currentEnd, previousStart, previousEnd);
  const { data: dreData, isLoading: dreLoading } = dreQuery;
  const { data: comparison, isLoading: comparisonLoading } = comparisonQuery;
  const isLoading = dreLoading || comparisonLoading;
  const queryError = dreQuery.error || comparisonQuery.error;

  const revenueBreakdown = useMemo(() => {
    if (!dreData) return [];
    return [
      { name: 'Vendas', value: dreData.revenue.sales },
      { name: 'Servicos', value: dreData.revenue.services },
      { name: 'Outros', value: dreData.revenue.other },
    ].filter(i => i.value > 0);
  }, [dreData]);

  const expenseBreakdown = useMemo(() => {
    if (!dreData) return [];
    return [
      { name: 'Operacionais', value: dreData.expenses.operational.total },
      { name: 'Administrativas', value: dreData.expenses.administrative.total },
      { name: 'Financeiras', value: dreData.expenses.financial.total },
    ].filter(i => i.value > 0);
  }, [dreData]);

  const marginData = useMemo(() => {
    if (!comparison) return [];
    return [
      { name: 'Per. Anterior', bruta: comparison.previous.grossMargin, ebitda: comparison.previous.ebitdaMargin, liquida: comparison.previous.netMargin },
      { name: 'Per. Atual', bruta: comparison.current.grossMargin, ebitda: comparison.current.ebitdaMargin, liquida: comparison.current.netMargin },
    ];
  }, [comparison]);

  if (isLoading) return <LoadingSpinner message="Calculando DRE..." />;
  if (queryError) return <ErrorMessage message={queryError instanceof Error ? queryError.message : 'Não foi possível calcular o DRE local.'} retry={() => { void Promise.all([dreQuery.refetch(), comparisonQuery.refetch()]); }} />;

  if (!dreData) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Target className="h-6 w-6 text-primary" />
      </div>
      <p className="text-muted-foreground text-sm">Nenhum dado para o período selecionado.</p>
      <p className="text-muted-foreground/70 text-xs">Registre lançamentos financeiros para ver o DRE.</p>
    </div>
  );

  const kpis = [
    { label: 'Receita Bruta', value: dreData.revenue.gross, icon: ArrowUpRight, tone: 'primary' as const, growth: comparison?.growth.revenueGrowth },
    ...(canViewMargin ? [
      { label: 'Lucro Bruto', value: dreData.grossProfit, icon: Target, tone: 'primary' as const, margin: dreData.grossMargin },
      { label: 'EBITDA', value: dreData.ebitda, icon: TrendingUp, tone: 'warning' as const, margin: dreData.ebitdaMargin },
      { label: 'Lucro Líquido', value: dreData.netProfit, icon: DollarSign, tone: dreData.netProfit >= 0 ? 'positive' as const : 'negative' as const, margin: dreData.netMargin },
    ] : []),
  ];
  const dreKpiTones = {
    primary: { card: 'bg-primary/[0.06] border-primary/15', icon: 'bg-primary/10 text-primary', value: 'text-primary' },
    positive: { card: 'bg-emerald-500/[0.06] border-emerald-500/15', icon: 'bg-emerald-500/10 text-emerald-600', value: 'text-emerald-600' },
    negative: { card: 'bg-red-500/[0.06] border-red-500/15', icon: 'bg-red-500/10 text-red-600', value: 'text-red-600' },
    warning: { card: 'bg-amber-500/[0.06] border-amber-500/15', icon: 'bg-amber-500/10 text-amber-600', value: 'text-amber-600' },
  } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <FinancialInfoTip title="Leitura do DRE">O DRE compara o período atual com o anterior. Custos, resultado e margens só aparecem para usuários com a permissão financeira de visualizar margem.</FinancialInfoTip>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Demonstrativo de Resultado</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentStart.toLocaleDateString('pt-BR')} a {currentEnd.toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!globalDateRange?.from && (
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-36 h-9 rounded-xl border-border bg-card text-foreground/80 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                <SelectItem value="month">Mensal</SelectItem>
                <SelectItem value="quarter">Trimestral</SelectItem>
                <SelectItem value="year">Anual</SelectItem>
              </SelectContent>
            </Select>
          )}
          <button
            onClick={() => ReportGenerator.generateDRE(dreData, 'pdf', {
              title: 'DRE - Demonstrativo de Resultado',
              subtitle: `${currentStart.toLocaleDateString('pt-BR')} a ${currentEnd.toLocaleDateString('pt-BR')}`,
              period: { start: currentStart, end: currentEnd },
            })}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-muted-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(kpi => {
          const tone = dreKpiTones[kpi.tone];
          return (
          <div key={kpi.label} className={cn("rounded-2xl p-4 border", tone.card)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
              <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center", kpi.label === 'Receita Bruta' ? 'bg-emerald-500/10 text-emerald-600' : tone.icon)}>
                <kpi.icon className="h-3 w-3" />
              </div>
            </div>
            <div className={cn("text-xl font-bold mb-1", tone.value)}>
              {fmt(kpi.value)}
            </div>
            {kpi.growth !== undefined && (
              <div className="flex items-center gap-1 text-[11px]">
                {kpi.growth >= 0
                  ? <TrendingUp className="h-3 w-3 text-emerald-600" />
                  : <TrendingDown className="h-3 w-3 text-red-500" />}
                <span className={kpi.growth >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                  {Math.abs(kpi.growth).toFixed(1)}%
                </span>
                <span className="text-muted-foreground/70">vs anterior</span>
              </div>
            )}
            {kpi.margin !== undefined && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Percent className="h-2.5 w-2.5" />
                <span>Margem: <strong>{kpi.margin.toFixed(1)}%</strong></span>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue pie */}
        {revenueBreakdown.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-sm font-bold text-foreground/80">Composicao da Receita</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={revenueBreakdown} cx="50%" cy="50%" outerRadius={65} innerRadius={35} dataKey="value" paddingAngle={3}>
                  {revenueBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Expense pie */}
        {expenseBreakdown.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
              </div>
              <span className="text-sm font-bold text-foreground/80">Composicao das Despesas</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={expenseBreakdown} cx="50%" cy="50%" outerRadius={65} innerRadius={35} dataKey="value" paddingAngle={3}>
                  {expenseBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Margin comparison */}
        {canViewMargin && marginData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-bold text-foreground/80">Evolucao das Margens</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={marginData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={28} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                <Bar dataKey="bruta" name="Bruta" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ebitda" name="EBITDA" fill="#F28C28" radius={[4, 4, 0, 0]} />
                <Bar dataKey="liquida" name="Liquida" fill="#E6451F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* DRE Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground/80">Demonstrativo Detalhado</span>
          <span className="text-xs text-muted-foreground/70">{currentStart.toLocaleDateString('pt-BR')} a {currentEnd.toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="p-2 space-y-0.5">
          {/* Receita */}
          <button onClick={() => toggleSection('revenue')} className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-muted transition-colors">
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              {expandedSections.revenue ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />}
              RECEITA BRUTA
            </span>
            <span className="text-sm font-bold text-emerald-600">{fmt(dreData.revenue.gross)}</span>
          </button>
          {expandedSections.revenue && (
            <div className="ml-2 space-y-0.5">
              <DRERow label="Vendas de Produtos" value={dreData.revenue.sales} indent={1} />
              <DRERow label="Prestacao de Servicos" value={dreData.revenue.services} indent={1} />
              <DRERow label="Outras Receitas" value={dreData.revenue.other} indent={1} />
            </div>
          )}

          <DRERow label="(-) Deducoes e Impostos" value={-dreData.revenue.deductions} indent={0} />
          <DRERow label="RECEITA LIQUIDA" value={dreData.revenue.net} bold highlight />
          {canViewMargin ? <><DRERow label="(-) Custo dos Produtos Vendidos" value={-dreData.costs.cogs} indent={0} />
          <DRERow label="LUCRO BRUTO" value={dreData.grossProfit} bold highlight />

          {/* Despesas */}
          <button onClick={() => toggleSection('expenses')} className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-muted transition-colors mt-1">
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              {expandedSections.expenses ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />}
              (-) DESPESAS OPERACIONAIS
            </span>
            <span className="text-sm font-bold text-red-500">({fmt(dreData.expenses.operational.total)})</span>
          </button>
          {expandedSections.expenses && (
            <div className="ml-2 space-y-0.5">
              <DRERow label="Salarios e Encargos" value={-dreData.expenses.operational.salaries} indent={1} />
              <DRERow label="Aluguel e Condominio" value={-dreData.expenses.operational.rent} indent={1} />
              <DRERow label="Utilidades (Agua, Luz)" value={-dreData.expenses.operational.utilities} indent={1} />
              <DRERow label="Marketing e Publicidade" value={-dreData.expenses.operational.marketing} indent={1} />
              <DRERow label="Outras Operacionais" value={-dreData.expenses.operational.other} indent={1} />
            </div>
          )}

          <DRERow label="EBITDA" value={dreData.ebitda} bold highlight />
          <DRERow label="(-) Depreciacao e Amortizacao" value={-dreData.expenses.depreciation} indent={0} />
          <DRERow label="EBIT (Resultado Operacional)" value={dreData.ebit} bold />
          <DRERow label="(-) Despesas Financeiras" value={-dreData.expenses.financial.total} indent={0} />
          <DRERow label="(-) Impostos sobre Lucro" value={-dreData.taxes} indent={0} />
          <DRERow label="LUCRO LIQUIDO" value={dreData.netProfit} bold highlight separator /></> : <div className="m-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">Custos, resultado e margens estão ocultos. Solicite a permissão <strong>financeiro.view_margin</strong> ao administrador.</div>}
        </div>
      </div>
    </div>
  );
}
