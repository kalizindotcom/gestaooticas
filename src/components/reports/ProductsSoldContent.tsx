import React, { useEffect, useState, useMemo } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { DetailModal, DetailBlock, DetailItem } from '@/components/shared/premium/DetailModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag, DollarSign, TrendingUp, Percent, Box, Tag, Package } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { FilterBar } from '@/components/shared/premium/FilterBar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useSales } from '@/hooks/useLocalData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { getScopedStoreOptions, isCompletedSale, isRecordInStoreScope } from '@/lib/reportScope';

export function ProductsSoldContent() {
  const [searchValue, setSearchValue] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedStore, setSelectedStore] = useState('all');

  const { data: sales = [], isLoading } = useSales();
  const { getFilteredStores, selectedStoreIds } = useGlobalFilter();
  const filteredStores = getScopedStoreOptions(getFilteredStores(), selectedStoreIds);

  useEffect(() => {
    if (selectedStore !== 'all' && !selectedStoreIds.some((storeId) => String(storeId) === String(selectedStore))) setSelectedStore('all');
  }, [selectedStore, selectedStoreIds]);

  // Aggregate sale_items from all sales into product rows
  const soldProducts = useMemo(() => {
    const map: Record<string, {
      id: string;
      name: string;
      sku: string;
      category: string;
      brand: string;
      qty: number;
      revenue: number;
      cost: number;
      storeName: string;
      sellerName: string;
    }> = {};

    sales.forEach((sale: any) => {
      if (!isCompletedSale(sale)) return;
      if (!isRecordInStoreScope(sale, selectedStoreIds)) return;
      if (selectedStore !== 'all' && String(sale.storeId || sale.store_id) !== String(selectedStore)) return;

      (sale.items || []).forEach((item: any) => {
        const key = item.product || 'Produto sem nome';
        if (!map[key]) {
          map[key] = {
            id: key,
            name: key,
            sku: '—',
            category: '—',
            brand: '—',
            qty: 0,
            revenue: 0,
            cost: 0,
            storeName: sale.storeName || '—',
            sellerName: sale.sellerName || '—',
          };
        }
        map[key].qty += item.qty || 0;
        map[key].revenue += item.total || 0;
      });
    });

    let rows = Object.values(map).sort((a, b) => b.revenue - a.revenue);

    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }

    return rows;
  }, [sales, selectedStore, selectedStoreIds, searchValue]);

  const totalQty = useMemo(() => soldProducts.reduce((a, b) => a + b.qty, 0), [soldProducts]);
  const totalRevenue = useMemo(() => soldProducts.reduce((a, b) => a + b.revenue, 0), [soldProducts]);
  const avgTicket = totalQty > 0 ? totalRevenue / totalQty : 0;
  const topProduct = soldProducts[0]?.name || '—';

  if (isLoading) return <LoadingSpinner message="Carregando produtos vendidos..." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <KPICard title="Total Vendido" value={totalQty} icon={ShoppingBag} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Faturamento" value={totalRevenue} format="currency" icon={DollarSign} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Ticket Médio" value={avgTicket} format="currency" icon={TrendingUp} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Top Produto" value={topProduct} icon={Percent} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
      </div>

      {/* Print-only Summary Grid */}
      <div className="print-only-grid grid-cols-4 gap-4 mb-8 border border-slate-200 p-4 rounded-xl">
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Total Vendido</span><span className="text-xl font-bold">{totalQty}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Faturamento</span><span className="text-xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR')}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Ticket Médio</span><span className="text-xl font-bold">R$ {avgTicket.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Top Produto</span><span className="text-base font-bold truncate">{topProduct}</span></div>
      </div>

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onClearFilters={() => { setSearchValue(''); setDateRange(undefined); setSelectedStore('all'); }}
        onApplyFilters={() => {}}
        searchPlaceholder="Produto, SKU, Ref..."
        className="bg-white/5 border-white/10 no-print"
      >
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">Loja</label>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="h-10 rounded-xl border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Todas as lojas" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E293B] border-white/10 text-white">
              <SelectItem value="all">Todas as lojas</SelectItem>
              {filteredStores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {soldProducts.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum produto vendido"
          description="Não há itens de venda registrados para o período e filtros selecionados."
        />
      ) : (
        <Card className="bg-white/5 border-white/10 overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/10 bg-white/5">
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-slate-400">Produto</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-center text-slate-400">Qtd</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-right text-slate-400">Valor Total</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-right text-slate-400">Ticket Médio</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-slate-400">Loja / Vendedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soldProducts.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-white/10 transition-all border-white/5 group"
                    onClick={() => setSelectedProduct(p)}
                  >
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-white group-hover:text-primary transition-colors">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium text-white">{p.qty}</TableCell>
                    <TableCell className="text-right font-bold text-[13px] text-white">
                      R$ {p.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-white/80">
                      R$ {p.qty > 0 ? (p.revenue / p.qty).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-white/80">{p.storeName}</span>
                        <span className="text-[11px] text-white/40">{p.sellerName}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      {selectedProduct && (
        <DetailModal
          open={!!selectedProduct}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
          title={selectedProduct.name}
          subtitle={`Produto vendido`}
          status="active"
          className="bg-[#1E293B] text-white dark"
        >
          <DetailBlock title="Informações Gerais" colSpan={6} className="text-white">
            <DetailItem label="Loja" value={selectedProduct.storeName} icon={Box} />
            <DetailItem label="Vendedor" value={selectedProduct.sellerName} icon={Tag} />
          </DetailBlock>
          <DetailBlock title="Financeiro" colSpan={6}>
            <DetailItem label="Qtd Vendida" value={String(selectedProduct.qty)} icon={Package} />
            <DetailItem label="Faturamento" value={`R$ ${selectedProduct.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} />
            <DetailItem label="Ticket Médio" value={selectedProduct.qty > 0 ? `R$ ${(selectedProduct.revenue / selectedProduct.qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'} icon={TrendingUp} />
          </DetailBlock>
        </DetailModal>
      )}
    </div>
  );
}