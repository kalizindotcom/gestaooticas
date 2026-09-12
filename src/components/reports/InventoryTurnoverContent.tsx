import React, { useState, useMemo } from 'react';
import { KPICard } from '@/components/shared/KPICard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, RefreshCw, AlertCircle, TrendingDown } from 'lucide-react';
import { FilterBar } from '@/components/shared/premium/FilterBar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useLocalData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { getScopedStockRecords } from '@/lib/reportScope';

export function InventoryTurnoverContent() {
  const [searchValue, setSearchValue] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: products = [], isLoading } = useProducts();
  const { selectedStoreIds } = useGlobalFilter();
  const selectedStoreIdSet = useMemo(() => new Set(selectedStoreIds.map(String)), [selectedStoreIds]);

  // Build inventory rows from products + product_stock
  const inventoryData = useMemo(() => {
    return products
      .map((p: any) => {
        // product_stock is an array of stock records per store
        const stockRecords: any[] = getScopedStockRecords(p, selectedStoreIds);
        const totalStock = stockRecords.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
        return {
          id: p.id,
          product: p.name,
          category: p.category || '—',
          sku: p.sku || '—',
          stock: totalStock,
          status: totalStock === 0 ? 'zero' : totalStock <= 5 ? 'low' : totalStock <= 20 ? 'medium' : 'high',
        };
      })
      .filter((p: any) => {
        if (categoryFilter !== 'all' && p.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
        if (searchValue.trim() && !p.product.toLowerCase().includes(searchValue.toLowerCase()) && !p.sku.toLowerCase().includes(searchValue.toLowerCase())) return false;
        return true;
      })
      .sort((a: any, b: any) => a.stock - b.stock);
  }, [products, categoryFilter, searchValue, selectedStoreIdSet]);

  // KPIs
  const totalProducts = inventoryData.length;
  const zeroStockCount = useMemo(() => inventoryData.filter((p: any) => p.stock === 0).length, [inventoryData]);
  const lowStockCount = useMemo(() => inventoryData.filter((p: any) => p.stock > 0 && p.stock <= 5).length, [inventoryData]);
  const avgStock = totalProducts > 0
    ? (inventoryData.reduce((a: number, b: any) => a + b.stock, 0) / totalProducts).toFixed(1)
    : '0';

  // Unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(products.map((p: any) => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  const statusLabel = (status: string) => {
    if (status === 'zero') return 'Sem Estoque';
    if (status === 'low') return 'Estoque Baixo';
    if (status === 'medium') return 'Estoque Médio';
    return 'Estoque Alto';
  };

  const statusClass = (status: string) => {
    if (status === 'zero') return 'bg-rose-500/20 text-rose-400 border-rose-500/20';
    if (status === 'low') return 'bg-amber-500/20 text-amber-400 border-amber-500/20';
    if (status === 'medium') return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
  };

  if (isLoading) return <LoadingSpinner message="Carregando estoque de produtos..." />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <KPICard title="Total Produtos" value={totalProducts} icon={RefreshCw} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Sem Estoque" value={zeroStockCount} icon={AlertCircle} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Estoque Baixo" value={lowStockCount} icon={TrendingDown} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
        <KPICard title="Média por Produto" value={avgStock} icon={Package} className="bg-white/5 border-white/10 text-white shadow-xl shadow-black/20" />
      </div>

      {/* Print-only Summary Grid */}
      <div className="print-only-grid grid-cols-4 gap-4 mb-8 border border-slate-200 p-4 rounded-xl">
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Total Produtos</span><span className="text-xl font-bold">{totalProducts}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Sem Estoque</span><span className="text-xl font-bold">{zeroStockCount}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Estoque Baixo</span><span className="text-xl font-bold">{lowStockCount}</span></div>
        <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold">Média por Produto</span><span className="text-xl font-bold">{avgStock}</span></div>
      </div>

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onClearFilters={() => { setSearchValue(''); setCategoryFilter('all'); }}
        onApplyFilters={() => {}}
        searchPlaceholder="Produto, SKU..."
        className="bg-white/5 border-white/10 no-print"
      >
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">Categoria</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 rounded-xl border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E293B] border-white/10 text-white">
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">Status</label>
          <Select defaultValue="all">
            <SelectTrigger className="h-10 rounded-xl border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E293B] border-white/10 text-white">
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="high">Estoque Alto</SelectItem>
              <SelectItem value="medium">Estoque Médio</SelectItem>
              <SelectItem value="low">Estoque Baixo</SelectItem>
              <SelectItem value="zero">Sem Estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {inventoryData.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description="Não há produtos cadastrados para os filtros selecionados."
        />
      ) : (
        <Card className="bg-white/5 border-white/10 overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/10 bg-white/5">
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-slate-400">Produto / Categoria</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-slate-400">SKU</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-center text-slate-400">Estoque Total</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-center text-slate-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryData.map((item: any) => (
                  <TableRow key={item.id} className="hover:bg-white/10 transition-all border-white/5 group">
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-white group-hover:text-primary transition-colors">{item.product}</span>
                        <span className="text-[11px] text-white/40">{item.category}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/60 font-mono text-[12px]">{item.sku}</TableCell>
                    <TableCell className="text-center text-white font-medium">{item.stock}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("text-[10px] font-bold", statusClass(item.status))}>
                        {statusLabel(item.status)}
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