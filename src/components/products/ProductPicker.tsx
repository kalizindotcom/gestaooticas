import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Package, Search, X } from 'lucide-react';
import { useProducts } from '@/hooks/useLocalData';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ProductPickerProps {
  productId: string;
  productName: string;
  quantity: number;
  storeId: string;
  onChange: (patch: { productId: string; product: string; productQuantity: number }) => void;
  onApplyPrice?: (price: number, quantity: number) => void;
}

function money(value: unknown) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export function ProductPicker({ productId, productName, quantity, storeId, onChange, onApplyPrice }: ProductPickerProps) {
  const { data: products = [], isLoading } = useProducts();
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const canViewStock = hasPermission('products', 'view_stock');
  const selected = products.find((product: any) => product.id === productId);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((product: any) => product.status !== 'inactive')
      .filter((product: any) => !term || [product.name, product.sku, product.barcode, product.category, product.brand].some((value) => String(value || '').toLowerCase().includes(term)))
      .slice(0, 80);
  }, [products, search]);
  const selectedStock = selected?.product_stock?.find((stock: any) => stock.store_id === storeId);
  const selectedPhysicalStock = selected
    ? selectedStock
      ? Number(selectedStock.quantity || 0)
      : (selected.product_stock?.reduce((sum: number, stock: any) => sum + Number(stock.quantity || 0), 0) ?? 0)
    : 0;
  const selectedReservedStock = selected
    ? selectedStock
      ? Number(selectedStock.reserved_quantity || 0)
      : (selected.product_stock?.reduce((sum: number, stock: any) => sum + Number(stock.reserved_quantity || 0), 0) ?? 0)
    : 0;
  const availableStock = Math.max(selectedPhysicalStock - selectedReservedStock, 0);
  const currentQuantity = Math.max(Number(quantity || 1), 1);

  const stockAvailableForProduct = (product: any) => {
    const stock = product?.product_stock?.find((item: any) => item.store_id === storeId);
    const physical = stock ? Number(stock.quantity || 0) : (product?.product_stock?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) ?? 0);
    const reserved = stock ? Number(stock.reserved_quantity || 0) : (product?.product_stock?.reduce((sum: number, item: any) => sum + Number(item.reserved_quantity || 0), 0) ?? 0);
    return Math.max(physical - reserved, 0);
  };

  const choose = (product: any) => {
    const productAvailable = stockAvailableForProduct(product);
    const safeQuantity = canViewStock && product.product_type !== 'service'
      ? Math.min(currentQuantity, Math.max(productAvailable, 1))
      : currentQuantity;
    onChange({ productId: product.id, product: product.name, productQuantity: safeQuantity });
    setOpen(false);
    setSearch('');
  };

  const clear = () => onChange({ productId: '', product: '', productQuantity: 1 });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Produto cadastrado</Label>
        {productId && <button type="button" className="text-[11px] font-semibold text-muted-foreground hover:text-primary" onClick={clear}>Limpar seleção</button>}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-11 w-full justify-between rounded-lg border-border bg-background px-3 text-left font-normal hover:border-primary/60">
            <span className={cn('flex min-w-0 items-center gap-2 truncate', !selected && !productName && 'text-muted-foreground')}>
              <Package className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{selected?.name || productName || 'Navegar e selecionar produto'}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-2" align="start">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, SKU, código, marca..." className="h-10 pl-9" />
          </div>
          <div className="max-h-64 overflow-y-auto pr-1">
            {isLoading && <p className="px-3 py-5 text-center text-sm text-muted-foreground">Carregando produtos...</p>}
            {!isLoading && filtered.length === 0 && <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
            {!isLoading && filtered.map((product: any) => {
              const selectedStoreStock = product.product_stock?.find((item: any) => item.store_id === storeId);
              const physicalStock = selectedStoreStock
                ? Number(selectedStoreStock.quantity || 0)
                : (product.product_stock?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) ?? 0);
              const reservedStock = selectedStoreStock
                ? Number(selectedStoreStock.reserved_quantity || 0)
                : (product.product_stock?.reduce((sum: number, item: any) => sum + Number(item.reserved_quantity || 0), 0) ?? 0);
              const stock = Math.max(physicalStock - reservedStock, 0);
              return (
                <button type="button" key={product.id} onClick={() => choose(product)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-primary/10">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{product.sku || 'Sem SKU'} {product.category ? `· ${product.category}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-primary">{money(product.price)}</p>
                    {canViewStock && <p className={cn('text-[10px]', stock > 0 ? 'text-muted-foreground' : 'text-destructive')}>{stock} disponível{stock === 1 ? '' : 'is'}</p>}
                  </div>
                  {product.id === productId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Venda: <strong className="text-foreground">{money(selected.price)}</strong></span>
          {canViewStock && <span className={cn('font-semibold', availableStock > 0 ? 'text-emerald-600' : 'text-destructive')}>{availableStock} disponível{availableStock === 1 ? '' : 'is'} nesta loja{selectedReservedStock > 0 ? ` · ${selectedReservedStock} reservado(s)` : ''}</span>}
          {onApplyPrice && <button type="button" className="font-bold text-primary hover:underline" onClick={() => onApplyPrice(Number(selected.price || 0), currentQuantity)}>Aplicar ao total</button>}
        </div>
      )}
      {productId && (
        <div className="flex items-center gap-2">
          <Label htmlFor="os-product-quantity" className="text-xs text-muted-foreground">Quantidade</Label>
          <Input id="os-product-quantity" type="number" min="1" step="1" value={currentQuantity} onChange={(event) => { const requested = Math.max(Number(event.target.value || 1), 1); const safe = canViewStock && selected?.product_type !== 'service' ? Math.min(requested, Math.max(availableStock, 1)) : requested; onChange({ productId, product: selected?.name || productName, productQuantity: safe }); }} className="h-8 w-20" />
          <button type="button" aria-label="Remover produto" className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={clear}><X className="h-4 w-4" /></button>
        </div>
      )}
      {!productId && <p className="text-[11px] text-muted-foreground">Pesquise no catálogo ou continue com uma descrição manual.</p>}
    </div>
  );
}
