import React, { useState, useMemo } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { FilterBar } from '@/components/shared/premium/FilterBar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { DollarSign, TrendingUp, FileText, Store } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useSales } from '@/hooks/useLocalData';
import { isCompletedSale } from '@/lib/reportScope';

export function StoreSalesContent() {
  const [searchValue, setSearchValue] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const { data: sales = [], isLoading } = useSales();

  // Group sales by store
  const storeSalesData = useMemo(() => {
    const map: Record<string, {
      storeId: string;
      store: string;
      salesCount: number;
      revenue: number;
      topSeller: string;
      sellerRevenue: Record<string, number>;
    }> = {};

    sales.forEach((sale: any) => {
      if (!isCompletedSale(sale)) return;
      const storeId = sale.store_id || sale.storeId || 'unknown';
      const storeName = sale.storeName || '—';
      if (!map[storeId]) {
        map[storeId] = { storeId, store: storeName, salesCount: 0, revenue: 0, topSeller: '—', sellerRevenue: {} };
      }
      map[storeId].salesCount += 1;
      map[storeId].revenue += sale.total || 0;

      const seller = sale.sellerName || '—';
      map[storeId].sellerRevenue[seller] = (map[storeId].sellerRevenue[seller] || 0) + (sale.total || 0);
    });

    // Resolve top seller per store
    return Object.values(map)
      .map(s => {
        const topSeller = Object.entries(s.sellerRevenue).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
        const avgTicket = s.salesCount > 0 ? s.revenue / s.salesCount : 0;
        return { ...s, topSeller, avgTicket };
      })
      .filter(s => !searchValue.trim() || s.store.toLowerCase().includes(searchValue.toLowerCase()))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales, searchValue]);

  const totalRevenue = useMemo(() => storeSalesData.reduce((a, b) => a + b.revenue, 0), [storeSalesData]);
  const totalSales = useMemo(() => storeSalesData.reduce((a, b) => a + b.salesCount, 0), [storeSalesData]);
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const storeCount = storeSalesData.length;

  if (isLoading) return <LoadingSpinner message="Carregando vendas por loja..." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <KPICard title="Vendas Totais" value={totalSales} icon={FileText} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Faturamento Total" value={totalRevenue} format="currency" icon={DollarSign} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Ticket Médio" value={avgTicket} format="currency" icon={TrendingUp} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Lojas Ativas" value={storeCount} icon={Store} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
      </div>

      {/* Print-only Summary Grid */}
      <div className="print-only-grid grid-cols-4 gap-4 mb-8 border border-slate-200 p-4 rounded-xl">
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Vendas Totais</span><span className="text-xl font-bold">{totalSales}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Faturamento</span><span className="text-xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR')}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Ticket Médio</span><span className="text-xl font-bold">R$ {avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Lojas</span><span className="text-xl font-bold">{storeCount}</span></div>
      </div>

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onClearFilters={() => { setSearchValue(''); setDateRange(undefined); }}
        onApplyFilters={() => {}}
        searchPlaceholder="Filtrar por loja..."
        className="bg-white/5 border-white/10 no-print"
      />

      {storeSalesData.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nenhuma venda por loja"
          description="Não há vendas registradas para o período e filtros selecionados."
        />
      ) : (
        <Card className="bg-white/5 border-white/10 overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/10 bg-white/5">
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-slate-400">Loja</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-center text-slate-400">Qtd Vendas</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-right text-slate-400">Faturamento</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-right text-slate-400">Ticket Médio</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-slate-400">Top Vendedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeSalesData.map((s) => (
                  <TableRow key={s.storeId} className="hover:bg-white/10 transition-all border-white/5 group">
                    <TableCell className="font-bold text-white group-hover:text-primary transition-colors">{s.store}</TableCell>
                    <TableCell className="text-center text-white font-medium">{s.salesCount}</TableCell>
                    <TableCell className="text-right font-bold text-white text-[13px]">
                      R$ {s.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-white/80">
                      R$ {s.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-slate-400 text-[12px]">{s.topSeller}</TableCell>
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