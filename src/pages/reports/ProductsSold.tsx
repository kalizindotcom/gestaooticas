import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterBar } from '@/components/shared/premium/FilterBar';
import { KPICard } from '@/components/shared/KPICard';
import { DetailModal, DetailBlock, DetailItem } from '@/components/shared/premium/DetailModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag, DollarSign, TrendingUp, Percent, Store, User, Box, Tag, Package } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { useProducts, useSales, useStores } from '@/hooks/useLocalData';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';

type ReportRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  supplier: string;
  qty: number;
  revenue: number;
  cost: number;
  margin: number;
  store: string;
  storeId: string;
  seller: string;
};

const currency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function ProductsSold() {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const { data: sales = [], isLoading: loadingSales } = useSales();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: stores = [] } = useStores();
  const scopedStores = useMemo(() => stores.filter((store: any) => selectedStoreIds.some((storeId) => String(storeId) === String(store.id))), [stores, selectedStoreIds]);
  const [searchValue, setSearchValue] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSeller, setSelectedSeller] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<ReportRow | null>(null);

  useEffect(() => {
    if (selectedStore !== 'all' && !selectedStoreIds.some((storeId) => String(storeId) === String(selectedStore))) setSelectedStore('all');
  }, [selectedStore, selectedStoreIds]);

  const productByName = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach((product: any) => map.set(String(product.name || '').toLowerCase(), product));
    return map;
  }, [products]);

  const rows = useMemo<ReportRow[]>(() => {
    const grouped = new Map<string, ReportRow>();
    for (const sale of sales as any[]) {
      if (sale.status !== 'completed') continue;
      const saleDate = sale.date ? new Date(sale.date) : null;
      if (dateRange?.from && saleDate && saleDate < dateRange.from) continue;
      if (dateRange?.to && saleDate && saleDate > new Date(dateRange.to.getTime() + 86400000 - 1)) continue;
      if (selectedStore !== 'all' && String(sale.storeId) !== String(selectedStore)) continue;
      if (selectedSeller !== 'all' && sale.sellerId !== selectedSeller) continue;
      for (const item of sale.items || []) {
        const name = String(item.product || 'Produto sem nome');
        const product = productByName.get(name.toLowerCase());
        const brand = String(product?.brand || 'Sem marca');
        if (selectedBrand !== 'all' && brand !== selectedBrand) continue;
        const quantity = Number(item.qty || 0);
        const revenue = Number(item.total ?? quantity * Number(item.price || 0));
        const cost = quantity * Number(product?.cost || 0);
        const key = `${name}|${sale.storeId || ''}|${sale.sellerId || ''}`;
        const current = grouped.get(key);
        if (current) {
          current.qty += quantity;
          current.revenue += revenue;
          current.cost += cost;
          current.margin = current.revenue > 0 ? Number((((current.revenue - current.cost) / current.revenue) * 100).toFixed(1)) : 0;
        } else {
          grouped.set(key, {
            id: key,
            name,
            sku: String(product?.sku || '—'),
            category: String(product?.category || '—'),
            brand,
            supplier: String(product?.supplier || '—'),
            qty: quantity,
            revenue,
            cost,
            margin: revenue > 0 ? Number((((revenue - cost) / revenue) * 100).toFixed(1)) : 0,
            store: String(sale.storeName || '—'),
            storeId: String(sale.storeId || ''),
            seller: String(sale.sellerName || '—'),
          });
        }
      }
    }
    return Array.from(grouped.values()).filter((row) => {
      if (!searchValue) return true;
      const query = searchValue.toLowerCase();
      return [row.name, row.sku, row.brand, row.category, row.supplier].some((value) => value.toLowerCase().includes(query));
    });
  }, [dateRange, productByName, sales, searchValue, selectedBrand, selectedSeller, selectedStore]);

  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const avgMargin = totalRevenue > 0 ? Number((((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)) : 0;
  const brands = Array.from(new Set(rows.map((row) => row.brand).filter(Boolean))).sort();
  const sellers = Array.from(new Set((sales as any[]).map((sale) => ({ id: sale.sellerId, name: sale.sellerName })).filter((seller) => seller.id && seller.name !== '—'))).sort((a, b) => a.name.localeCompare(b.name));
  const isLoading = loadingSales || loadingProducts;

  if (isLoading) return <LoadingSpinner message="Carregando produtos vendidos..." />;

  return (
    <div className="space-y-8">
      <PageHeader title="Produtos Vendidos" description="Análise real de itens vendidos, receita, custo e margem por loja" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Unidades Vendidas" value={totalQty} icon={ShoppingBag} />
        <KPICard title="Faturamento" value={totalRevenue} format="currency" icon={DollarSign} />
        <KPICard title="Custo Total" value={totalCost} format="currency" icon={TrendingUp} />
        <KPICard title="Margem Média" value={avgMargin} format="percent" icon={Percent} />
      </div>

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onClearFilters={() => { setSearchValue(''); setDateRange(undefined); setSelectedStore('all'); setSelectedBrand('all'); setSelectedSeller('all'); }}
        onApplyFilters={() => {}}
        searchPlaceholder="Produto, SKU, marca ou fornecedor..."
      >
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">Loja</label>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="h-10 rounded-xl border-border/50"><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{scopedStores.map((store: any) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">Marca</label>
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="h-10 rounded-xl border-border/50"><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as marcas</SelectItem>{brands.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">Vendedor</label>
          <Select value={selectedSeller} onValueChange={setSelectedSeller}>
            <SelectTrigger className="h-10 rounded-xl border-border/50"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{sellers.map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </FilterBar>

      <Card className="premium-shadow border-border/60 overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? <EmptyState icon={ShoppingBag} title="Nenhuma venda encontrada" description={selectedCompanyId ? 'Ajuste o período ou registre uma venda concluída.' : 'Selecione uma empresa para visualizar os dados.'} /> : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent border-border/60 bg-muted/20">
                <TableHead>Produto / Referência</TableHead><TableHead>Marca</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Margem</TableHead><TableHead>Loja / Vendedor</TableHead>
              </TableRow></TableHeader>
              <TableBody>{rows.map((row) => <TableRow key={row.id} className="cursor-pointer hover:bg-accent/30 transition-all border-border/40 group" onClick={() => setSelectedProduct(row)}>
                <TableCell className="py-4"><div className="flex flex-col"><span className="text-[13px] font-semibold group-hover:text-primary transition-colors">{row.name}</span><span className="text-[11px] text-muted-foreground font-mono">{row.sku}</span></div></TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] font-bold border-border/60">{row.brand}</Badge></TableCell>
                <TableCell className="text-center font-medium">{row.qty}</TableCell>
                <TableCell className="text-right font-heading font-bold text-[13px]">{currency(row.revenue)}</TableCell>
                <TableCell className="text-right text-muted-foreground text-[12px]">{currency(row.cost)}</TableCell>
                <TableCell className="text-right"><div className="flex flex-col items-end"><span className="text-[13px] font-bold text-emerald-600">{row.margin}%</span><div className="w-12 h-1 bg-muted rounded-full overflow-hidden"><div className="bg-emerald-500 h-full" style={{ width: `${Math.max(0, Math.min(100, row.margin))}%` }} /></div></div></TableCell>
                <TableCell><div className="flex flex-col"><span className="text-[12px] font-medium">{row.store}</span><span className="text-[11px] text-muted-foreground">{row.seller}</span></div></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedProduct && <DetailModal open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)} title={selectedProduct.name} subtitle={`Referência: ${selectedProduct.sku}`} status="active">
        <DetailBlock title="Informações Gerais" colSpan={4}><DetailItem label="Marca / Grife" value={selectedProduct.brand} icon={Tag} /><DetailItem label="Categoria" value={selectedProduct.category} icon={Box} /><DetailItem label="Fornecedor" value={selectedProduct.supplier} icon={Package} /></DetailBlock>
        <DetailBlock title="Performance Financeira" colSpan={4}><DetailItem label="Faturamento Gerado" value={currency(selectedProduct.revenue)} icon={DollarSign} /><DetailItem label="Custo da Mercadoria" value={currency(selectedProduct.cost)} icon={TrendingUp} /><DetailItem label="Margem de Lucro" value={<span className="text-emerald-600 font-bold">{selectedProduct.margin}%</span>} icon={Percent} /></DetailBlock>
        <DetailBlock title="Distribuição" colSpan={4}><DetailItem label="Quantidade Total" value={`${selectedProduct.qty} unidades`} icon={ShoppingBag} /><DetailItem label="Loja" value={selectedProduct.store} icon={Store} /><DetailItem label="Vendedor" value={selectedProduct.seller} icon={User} /></DetailBlock>
      </DetailModal>}
    </div>
  );
}
