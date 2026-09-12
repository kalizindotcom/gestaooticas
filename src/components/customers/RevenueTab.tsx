import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Calendar, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatDateTime, formatMoney, useCustomerFinancials } from '@/hooks/useCustomerData';

export function RevenueTab({ customer }: { customer: any }) {
  const { data, isLoading } = useCustomerFinancials(customer?.id, customer?.name);
  const entries = data?.entries || [];

  const chartData = useMemo(() => {
    const buckets = new Map<string, number>();
    entries.forEach((entry: any) => {
      const baseDate = entry.payment_date || entry.due_date || entry.created_at;
      if (!baseDate) return;
      const date = new Date(baseDate);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const received = entry.type === 'in' ? Number(entry.amount || 0) : Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0);
      if (received > 0) buckets.set(key, (buckets.get(key) || 0) + received);
    });
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, revenue]) => ({ month, revenue }));
  }, [entries]);

  const paid = entries.reduce((sum: number, entry: any) => sum + (entry.type === 'in' ? Number(entry.amount || 0) : Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0)), 0);
  const pending = data?.balanceDue || 0;
  const overdue = data?.overdueAmount || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi title="Receita recebida" value={formatMoney(paid)} icon={DollarSign} />
        <Kpi title="A receber" value={formatMoney(pending)} icon={Receipt} />
        <Kpi title="Vencido" value={formatMoney(overdue)} icon={TrendingUp} danger />
      </div>

      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-foreground">Receita ao longo do tempo</h3>
              <p className="text-xs text-muted-foreground">Lançamentos financeiros vinculados ao cliente</p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{chartData.length} períodos</Badge>
          </div>
          {chartData.length > 0 ? (
            <ChartContainer config={{ revenue: { label: 'Receita', color: '#E6451F' } }} className="h-[260px] w-full">
              <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} width={80} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value))} />} />
                <Area dataKey="revenue" type="monotone" fill="var(--color-revenue)" fillOpacity={0.18} stroke="var(--color-revenue)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">{isLoading ? 'Carregando...' : 'Nenhum lançamento financeiro encontrado.'}</div>
          )}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <Table>
          <TableHeader><TableRow className="bg-muted/40"><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {entries.map((entry: any) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm font-medium">{entry.description}</TableCell>
                <TableCell className="text-sm">{formatDateTime(entry.due_date)}</TableCell>
                <TableCell className="text-sm">{formatDateTime(entry.payment_date)}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{entry.status}</Badge></TableCell>
                <TableCell className="text-right font-bold">{formatMoney(entry.amount)}</TableCell>
              </TableRow>
            ))}
            {isLoading && [1, 2, 3].map(row => <TableRow key={`revenue-skeleton-${row}`}><TableCell colSpan={5} className="h-12"><div className="h-4 w-full animate-pulse rounded bg-muted" /></TableCell></TableRow>)}
            {!isLoading && entries.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhum lançamento encontrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon: Icon, danger }: any) {
  return <div className={`flex items-center justify-between rounded-xl border p-5 shadow-sm ${danger ? 'border-red-500/20 bg-red-500/5' : 'border-border/70 bg-card'}`}><div><p className="text-[10px] font-bold uppercase text-muted-foreground">{title}</p><p className={`mt-1 text-2xl font-black tabular-nums ${danger ? 'text-red-600' : 'text-foreground'}`}>{value}</p></div><Icon className={`h-8 w-8 opacity-20 ${danger ? 'text-red-600' : 'text-primary'}`} /></div>;
}
