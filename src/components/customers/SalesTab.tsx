import { useEffect, useMemo, useState } from 'react';
import { Calendar, CreditCard, DollarSign, Eye, Filter, Package, Plus, Search, ShoppingBag, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEmployees, useProducts } from '@/hooks/useLocalData';
import { formatDateTime, formatMoney, useCreateCustomerSale, useCustomerSales } from '@/hooks/useCustomerData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { PermissionGate } from '@/components/shared/PermissionGate';

interface SalesTabProps {
  customer: any;
  autoOpenNew?: boolean;
}

export function SalesTab({ customer, autoOpenNew }: SalesTabProps) {
  const { stores, selectedStoreIds } = useGlobalFilter();
  const { data: sales = [], isLoading } = useCustomerSales(customer?.id);
  const { data: employees = [] } = useEmployees();
  const { data: products = [] } = useProducts();
  const createSale = useCreateCustomerSale(customer);

  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState({
    sellerId: '',
    storeId: selectedStoreIds[0] || '',
    paymentMethod: 'pix',
    dueDate: new Date().toISOString().slice(0, 10),
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saleItems, setSaleItems] = useState<any[]>([]);

  useEffect(() => {
    if (autoOpenNew) setNewSaleOpen(true);
  }, [autoOpenNew]);

  useEffect(() => {
    if (!form.storeId && selectedStoreIds[0]) setForm(prev => ({ ...prev, storeId: selectedStoreIds[0] }));
  }, [selectedStoreIds, form.storeId]);

  const filteredSales = useMemo(() => {
    const term = search.toLowerCase();
    return sales.filter((sale: any) => !term || String(sale.id || '').toLowerCase().includes(term) || String(sale.sellerName || '').toLowerCase().includes(term) || String(sale.storeName || '').toLowerCase().includes(term));
  }, [sales, search]);

  const availableProducts = useMemo(() => {
    const term = productSearch.toLowerCase();
    return products.filter((product: any) => {
      const matches = !term || product.name?.toLowerCase().includes(term) || product.brand?.toLowerCase().includes(term) || product.sku?.toLowerCase().includes(term);
      const stock = getProductStock(product, form.storeId);
      return matches && stock > 0;
    });
  }, [products, productSearch, form.storeId]);

  const total = saleItems.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0);

  const addProduct = (product: any) => {
    const stock = getProductStock(product, form.storeId);
    setSaleItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error('Estoque insuficiente para aumentar a quantidade.');
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, sku: product.sku, brand: product.brand, price: Number(product.price || 0), quantity: 1, stock }];
    });
    setIsProductModalOpen(false);
      toast.success(`${product.name} adicionado à venda`);
  };

  const updateItemQuantity = (id: string, quantity: number) => {
    setSaleItems(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stock || quantity)) } : item));
  };

  const handleSubmit = async () => {
    if (!form.storeId) {
      toast.error('Selecione a loja da venda.');
      return;
    }
    if (saleItems.length === 0) {
      toast.error('Adicione ao menos um produto.');
      return;
    }
    try {
      await createSale.mutateAsync({ ...form, items: saleItems });
      toast.success('Venda registrada com sucesso!', { description: 'Estoque e financeiro foram atualizados.' });
      setNewSaleOpen(false);
      setSaleItems([]);
      setForm(prev => ({ ...prev, paymentMethod: 'pix', notes: '' }));
    } catch (error: any) {
      toast.error('Erro ao registrar venda: ' + (error.message || 'verifique os dados.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar venda..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10" />
          </div>
          <Button variant="outline" className="gap-2 border-border/70 h-10" onClick={() => setSearch('')}><Filter className="h-4 w-4" /> Limpar</Button>
        </div>
        <PermissionGate module="sales" action="create">
          <Button className="gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" onClick={() => setNewSaleOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Venda
          </Button>
        </PermissionGate>
      </div>

      <div className="space-y-2 sm:hidden">
        {filteredSales.map((sale: any) => (
          <button key={sale.id} type="button" onClick={() => setSelectedSale(sale)} className="w-full rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm active:bg-muted/50">
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-primary">#{String(sale.id).slice(0, 8).toUpperCase()}</p><p className="mt-1 font-semibold text-foreground">{formatDateTime(sale.date)}</p></div><StatusBadge status={sale.status} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs"><div><p className="text-muted-foreground">Loja</p><p className="font-semibold break-words">{sale.storeName || '-'}</p></div><div><p className="text-muted-foreground">Vendedor</p><p className="font-semibold break-words">{sale.sellerName || '-'}</p></div><div><p className="text-muted-foreground">Total</p><p className="font-bold text-primary">{formatMoney(sale.total)}</p></div><div className="text-right"><span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70"><Eye className="h-4 w-4" /></span></div></div>
          </button>
        ))}
        {isLoading && [1, 2, 3].map(row => <div key={`sale-mobile-skeleton-${row}`} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        {!isLoading && filteredSales.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</div>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-bold text-[10px] uppercase tracking-wider">Nº venda</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-wider">Data</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-wider">Loja</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-wider">Vendedor</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-wider text-right">Total</TableHead>
              <TableHead className="font-bold text-[10px] uppercase tracking-wider">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.map((sale: any) => (
              <TableRow key={sale.id} className="hover:bg-muted/60 transition-colors cursor-pointer group" onClick={() => setSelectedSale(sale)}>
                <TableCell className="font-mono font-bold text-foreground">#{String(sale.id).slice(0, 8).toUpperCase()}</TableCell>
                <TableCell className="text-sm font-medium">{formatDateTime(sale.date)}</TableCell>
                <TableCell className="text-sm">{sale.storeName || '-'}</TableCell>
                <TableCell className="text-sm">{sale.sellerName}</TableCell>
                <TableCell className="text-right font-bold text-foreground">{formatMoney(sale.total)}</TableCell>
                <TableCell><StatusBadge status={sale.status} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" aria-label="Ver detalhes da venda" className="h-10 w-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><Eye className="h-4 w-4 text-muted-foreground" /></Button></TableCell>
              </TableRow>
            ))}
            {isLoading && [1, 2, 3].map(row => <TableRow key={`sale-skeleton-${row}`}><TableCell colSpan={7} className="h-12"><div className="h-4 w-full animate-pulse rounded bg-muted" /></TableCell></TableRow>)}
            {!isLoading && filteredSales.length === 0 && (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Nenhuma venda encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border border-border/70 bg-background p-0">
          <div className="flex items-center justify-between border-b border-border/60 bg-card p-5">
            <DialogTitle>Detalhes da Venda #{selectedSale?.id ? String(selectedSale.id).slice(0, 8).toUpperCase() : ''}</DialogTitle>
            {selectedSale && <StatusBadge status={selectedSale.status} />}
          </div>
          <div className="max-h-[calc(90vh-8rem)] space-y-8 overflow-y-auto bg-background p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <InfoLine icon={Calendar} label="Data" value={formatDateTime(selectedSale?.date)} />
              <InfoLine icon={User} label="Vendedor" value={selectedSale?.sellerName || '-'} />
              <InfoLine icon={ShoppingBag} label="Loja" value={selectedSale?.storeName || '-'} />
              <InfoLine icon={DollarSign} label="Valor Total" value={formatMoney(selectedSale?.total)} strong />
            </div>
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Unitário</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSale?.items?.map((item: any) => (
                    <TableRow key={item.id || item.product}>
                      <TableCell className="text-xs font-semibold">{item.product}</TableCell>
                      <TableCell className="text-center text-xs">{item.qty}</TableCell>
                      <TableCell className="text-right text-xs">{formatMoney(item.price)}</TableCell>
                      <TableCell className="text-right text-xs font-bold">{formatMoney(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newSaleOpen} onOpenChange={setNewSaleOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden rounded-2xl border border-border/70 bg-background p-0 shadow-2xl">
          <div className="relative overflow-hidden border-b border-border/60 bg-card p-6">
            <DialogTitle className="text-2xl font-bold mb-1">Nova Venda para {customer?.name}</DialogTitle>
            <p className="text-muted-foreground text-sm">Registre uma venda real vinculada ao cadastro do cliente.</p>
            <ShoppingBag className="h-20 w-20 absolute right-8 top-1/2 -translate-y-1/2 opacity-5 text-primary" />
          </div>
          <div className="max-h-[calc(90vh-8rem)] space-y-8 overflow-y-auto bg-background p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <SelectField label="Vendedor" value={form.sellerId || 'none'} onChange={v => setForm({ ...form, sellerId: v === 'none' ? '' : v })} options={[{ id: 'none', name: 'Não informado' }, ...employees.map((e: any) => ({ id: e.id, name: e.name }))]} />
              <SelectField label="Unidade" value={form.storeId} onChange={v => setForm({ ...form, storeId: v })} options={stores.filter((s: any) => selectedStoreIds.length === 0 || selectedStoreIds.includes(s.id)).map((s: any) => ({ id: s.id, name: s.name }))} />
              <SelectField label="Método de pagamento" value={form.paymentMethod} onChange={v => setForm({ ...form, paymentMethod: v })} options={[{ id: 'pix', name: 'PIX' }, { id: 'cash', name: 'Dinheiro' }, { id: 'debit', name: 'Cartão de débito' }, { id: 'credit', name: 'Crediário / a receber' }, { id: 'installments', name: 'Parcelado' }]} />
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Vencimento financeiro</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary/80 border-l-2 border-primary/40 pl-3">Itens da Venda</h4>
                <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1.5" onClick={() => setIsProductModalOpen(true)} disabled={!form.storeId}>
                  <Plus className="h-3 w-3" /> Adicionar Produto
                </Button>
              </div>
              {saleItems.length > 0 ? (
                <div className="space-y-3">
                  {saleItems.map(item => (
                    <div key={item.id} className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/5 p-3 sm:grid-cols-[minmax(0,1fr)_100px_120px_44px] sm:items-center">
                      <div>
                        <span className="text-sm font-semibold">{item.name}</span>
                        <span className="block text-xs text-muted-foreground">SKU: {item.sku || '-'} | Estoque: {item.stock}</span>
                      </div>
                      <Input type="number" min={1} max={item.stock} value={item.quantity} onChange={e => updateItemQuantity(item.id, Number(e.target.value))} className="h-11 sm:h-9" />
                      <div className="text-right text-sm font-bold">{formatMoney(item.price * item.quantity)}</div>
                      <Button variant="ghost" size="icon" className="h-11 w-11 justify-self-end text-destructive sm:h-10 sm:w-10" onClick={() => setSaleItems(prev => prev.filter(current => current.id !== item.id))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/40 p-10 rounded-2xl border-2 border-dashed border-border/70 text-center text-muted-foreground">Nenhum item adicionado.</div>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="min-h-[90px] rounded-xl resize-none" placeholder="Detalhes adicionais sobre a venda..." />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 flex flex-col gap-4 border-t border-border/60 bg-card/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <span className="text-[11px] font-bold uppercase text-muted-foreground/80">Total Geral</span>
              <span className="block text-xl font-bold text-primary">{formatMoney(total)}</span>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3">
              <Button variant="outline" onClick={() => { setNewSaleOpen(false); setSaleItems([]); }} className="h-11 w-full rounded-xl px-3 sm:px-8">Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saleItems.length === 0 || createSale.isPending} className="h-11 w-full rounded-xl bg-primary text-primary-foreground font-bold">
                {createSale.isPending ? 'Salvando...' : 'Concluir Venda'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden rounded-2xl border border-border/70 bg-background p-0 sm:max-w-[650px]">
          <div className="border-b border-border/60 bg-card px-6 py-5">
            <DialogTitle className="text-xl font-bold mb-1">Selecionar Produto</DialogTitle>
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Estoque da loja selecionada</p>
          </div>
          <div className="max-h-[calc(90vh-10rem)] space-y-3 overflow-y-auto bg-background p-5">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-10 h-11 rounded-xl" placeholder="Buscar por nome, marca ou SKU..." />
            </div>
            {availableProducts.map((product: any) => (
              <div key={product.id} className="flex items-center justify-between p-4 rounded-2xl border hover:bg-muted/60 transition-all cursor-pointer group" onClick={() => addProduct(product)}>
                <div>
                  <span className="text-sm font-bold group-hover:text-primary transition-colors">{product.name}</span>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="outline" className="text-[10px] h-5 rounded-full px-2">{product.brand || 'Sem marca'}</Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">{product.sku || '-'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-primary block">{formatMoney(product.price)}</span>
                  <span className="text-[11px] text-muted-foreground">Estoque: {getProductStock(product, form.storeId)} un</span>
                </div>
              </div>
            ))}
            {availableProducts.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Nenhum produto com estoque para esta loja.</div>}
          </div>
          <DialogFooter className="border-t border-border/60 bg-card p-5"><Button variant="outline" onClick={() => setIsProductModalOpen(false)} className="w-full h-11 rounded-xl">Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getProductStock(product: any, storeId?: string) {
  if (!storeId) return 0;
  const row = (product.product_stock || []).find((stock: any) => stock.store_id === storeId);
  return Number(row?.quantity || 0);
}

function InfoLine({ icon: Icon, label, value, strong }: any) {
  return <div className="flex justify-between items-center"><span className="text-xs text-muted-foreground flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span><span className={`text-sm ${strong ? 'font-bold text-foreground' : 'font-semibold'}`}>{value}</span></div>;
}

function SelectField({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{options.map((option: any) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
