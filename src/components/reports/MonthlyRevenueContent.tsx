import React, { useMemo } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useSales } from '@/hooks/useLocalData';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthlyRevenueContent() {
  const { data: sales = [], isLoading } = useSales();

  // Group sales by month
  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach((sale: any) => {
      const d = sale.date ? new Date(sale.date) : sale.created_at ? new Date(sale.created_at) : null;
      if (!d || isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      map[key] = (map[key] || 0) + (sale.total || 0);
    });

    // Build sorted list of months that have data
    return Object.entries(map)
      .map(([key, revenue]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, revenue, label: `${MONTHS[month]}/${String(year).slice(2)}` };
      })
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }, [sales]);

  const currentMonthRevenue = revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0;
  const lastMonthRevenue = revenueByMonth[revenueByMonth.length - 2]?.revenue ?? 0;
  const growth = lastMonthRevenue > 0 ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
  const totalRevenue = useMemo(() => revenueByMonth.reduce((a, b) => a + b.revenue, 0), [revenueByMonth]);

  const chartData = revenueByMonth.map(m => ({ month: m.label, revenue: m.revenue }));

  if (isLoading) return <LoadingSpinner message="Carregando faturamento mensal..." />;

  if (revenueByMonth.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Nenhum dado de faturamento"
        description="Não há vendas registradas para calcular o faturamento mensal."
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <KPICard title="Faturamento Atual" value={currentMonthRevenue} format="currency" icon={DollarSign} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Crescimento Mensal" value={Number(growth.toFixed(1))} format="percent" icon={TrendingUp} change={growth} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Total Acumulado" value={totalRevenue} format="currency" icon={Calendar} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Meses com Dados" value={revenueByMonth.length} icon={Calendar} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
      </div>

      {/* Print-only Summary Grid */}
      <div className="print-only-grid grid-cols-4 gap-4 mb-8 border border-slate-200 p-4 rounded-xl">
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Faturamento</span><span className="text-xl font-bold">R$ {currentMonthRevenue.toLocaleString('pt-BR')}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Crescimento</span><span className="text-xl font-bold">{growth.toFixed(1)}%</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Total Acumulado</span><span className="text-xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR')}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Meses</span><span className="text-xl font-bold">{revenueByMonth.length}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/5 border-white/10 rounded-2xl overflow-hidden no-print">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg font-heading">Evolução do Faturamento</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#ffffff60' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#ffffff60' }} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #ffffff20', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`}
                />
                <Area type="monotone" dataKey="revenue" name="Faturamento" stroke="#3b82f6" strokeWidth={3} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Print-only Full Evolution Table */}
        <div className="print-only mb-8">
          <h3 className="text-lg font-bold mb-4">Evolução de Faturamento</h3>
          <Table className="border border-slate-200 rounded-xl overflow-hidden">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueByMonth.slice(-12).map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-bold">{item.label}</TableCell>
                  <TableCell className="text-right">R$ {item.revenue.toLocaleString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Card className="bg-white/5 border-white/10 rounded-2xl overflow-hidden print:border-slate-200">
          <CardHeader>
            <CardTitle className="text-white text-lg font-heading">Detalhamento Mensal</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/10 bg-white/5">
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mês</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Faturamento</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Var. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueByMonth.slice(-6).reverse().map((item, idx, arr) => {
                  const prev = arr[idx + 1]?.revenue ?? 0;
                  const varPct = prev > 0 ? ((item.revenue - prev) / prev) * 100 : null;
                  return (
                    <TableRow key={idx} className="hover:bg-white/10 border-white/5 transition-colors">
                      <TableCell className="text-white font-medium">{item.label}</TableCell>
                      <TableCell className="text-white text-right font-bold">R$ {(item.revenue / 1000).toFixed(0)}k</TableCell>
                      <TableCell className="text-right">
                        {varPct !== null ? (
                          <span className={cn("font-bold", varPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {varPct >= 0 ? '+' : ''}{varPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}