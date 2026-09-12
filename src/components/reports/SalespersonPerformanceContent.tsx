import React, { useState, useMemo } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Star, Trophy } from 'lucide-react';
import { FilterBar } from '@/components/shared/premium/FilterBar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useSales } from '@/hooks/useLocalData';
import { isCompletedSale } from '@/lib/reportScope';

export function SalespersonPerformanceContent() {
  const [searchValue, setSearchValue] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const { data: sales = [], isLoading } = useSales();

  // Group sales by seller
  const performanceData = useMemo(() => {
    const map: Record<string, { sellerId: string; name: string; sales: number; revenue: number }> = {};

    sales.forEach((sale: any) => {
      if (!isCompletedSale(sale)) return;
      const sellerId = sale.seller_id || sale.sellerId || 'unknown';
      const sellerName = sale.sellerName || '—';
      if (!map[sellerId]) {
        map[sellerId] = { sellerId, name: sellerName, sales: 0, revenue: 0 };
      }
      map[sellerId].sales += 1;
      map[sellerId].revenue += sale.total || 0;
    });

    return Object.values(map)
      .map((v, idx) => ({
        ...v,
        avgTicket: v.sales > 0 ? v.revenue / v.sales : 0,
        ranking: 0, // assigned after sort
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .map((v, idx) => ({ ...v, ranking: idx + 1 }))
      .filter(v => !searchValue.trim() || v.name.toLowerCase().includes(searchValue.toLowerCase()));
  }, [sales, searchValue]);

  const topSeller = performanceData[0]?.name || '—';
  const totalSellers = performanceData.length;
  const totalRevenue = useMemo(() => performanceData.reduce((a, b) => a + b.revenue, 0), [performanceData]);
  const totalSalesCount = useMemo(() => performanceData.reduce((a, b) => a + b.sales, 0), [performanceData]);
  const avgTicketGlobal = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

  if (isLoading) return <LoadingSpinner message="Carregando desempenho por vendedor..." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <KPICard title="Top Vendedor" value={topSeller} icon={Trophy} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Total Vendedores" value={totalSellers} icon={Users} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Ticket Médio" value={avgTicketGlobal} format="currency" icon={Star} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Total Vendas" value={totalSalesCount} icon={Trophy} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
      </div>

      {/* Print-only Summary Grid */}
      <div className="print-only-grid grid-cols-4 gap-4 mb-8 border border-slate-200 p-4 rounded-xl">
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Top Vendedor</span><span className="text-lg font-bold">{topSeller}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Total Vendedores</span><span className="text-xl font-bold">{totalSellers}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Ticket Médio</span><span className="text-xl font-bold">R$ {avgTicketGlobal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Total Vendas</span><span className="text-xl font-bold">{totalSalesCount}</span></div>
      </div>

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onClearFilters={() => setSearchValue('')}
        onApplyFilters={() => {}}
        searchPlaceholder="Vendedor..."
        className="bg-white/5 border-white/10 no-print"
      />

      {performanceData.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum vendedor encontrado"
          description="Não há vendas registradas para o período e filtros selecionados."
        />
      ) : (
        <Card className="bg-white/5 border-white/10 overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/10 bg-white/5">
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-slate-400">Vendedor</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-center text-slate-400">Qtd Vendas</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-right text-slate-400">Faturamento</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-right text-slate-400">Ticket Médio</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-center text-slate-400">Ranking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceData.map((v) => (
                  <TableRow key={v.sellerId} className="hover:bg-white/10 transition-all border-white/5 group">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary group-hover:scale-110 transition-transform">
                          {v.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-[13px] font-semibold text-white group-hover:text-primary transition-colors">{v.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-white font-medium">{v.sales}</TableCell>
                    <TableCell className="text-right font-bold text-white text-[13px]">
                      R$ {v.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-white/80">
                      R$ {v.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[10px] font-bold",
                        v.ranking === 1 ? "bg-amber-500/20 text-amber-400 border-amber-500/20" :
                        v.ranking === 2 ? "bg-slate-300/20 text-slate-300 border-slate-300/20" :
                        v.ranking === 3 ? "bg-orange-800/20 text-orange-400 border-orange-800/20" :
                        "bg-white/5 text-white/40 border-white/5"
                      )}>
                        #{v.ranking}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}