import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Package, Store as StoreIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { localApi } from '@/lib/localApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { usePermissions } from '@/contexts/PermissionsContext';

interface InventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  stores: any[];
  defaultProductId?: string;
  defaultStoreId?: string;
}

export function InventoryModal({ open, onOpenChange, products, stores, defaultProductId = '', defaultStoreId = '' }: InventoryModalProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [productId, setProductId] = useState(defaultProductId);
  const [storeId, setStoreId] = useState(defaultStoreId || stores[0]?.id || '');
  const [countedQuantity, setCountedQuantity] = useState('0');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId(defaultProductId || '');
    setStoreId(defaultStoreId || stores[0]?.id || '');
    setCountedQuantity('0');
    setReason('');
  }, [open, defaultProductId, defaultStoreId, stores]);

  const selectedProduct = products.find((product: any) => product.id === productId);
  const selectedStock = selectedProduct?.product_stock?.find((stock: any) => stock.store_id === storeId);
  const expectedQuantity = Number(selectedStock?.quantity || 0);
  const reservedQuantity = Number(selectedStock?.reserved_quantity || 0);
  useEffect(() => {
    if (open && productId && storeId) setCountedQuantity(String(expectedQuantity));
  }, [open, productId, storeId, expectedQuantity]);
  const counted = Number(countedQuantity || 0);
  const difference = counted - expectedQuantity;
  const validCount = Number.isInteger(counted) && counted >= reservedQuantity;
  const differenceLabel = useMemo(() => difference === 0 ? 'Sem diferença' : difference > 0 ? `+${difference} unidade(s)` : `${difference} unidade(s)`, [difference]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasPermission('products', 'manage_stock')) {
      toast.error('Você não possui permissão para realizar inventário.');
      return;
    }
    if (!productId || !storeId) {
      toast.error('Selecione o produto e a loja.');
      return;
    }
    if (!validCount) {
      toast.error(`A contagem precisa ser inteira e não pode ficar abaixo do reservado (${reservedQuantity}).`);
      return;
    }
    setIsSaving(true);
    try {
      const result = await localApi.operations.adjustProductStock({
        product_id: productId,
        store_id: storeId,
        operation: 'adjustment',
        target_quantity: counted,
        reason: `${reason.trim() || 'Conferência de inventário'} · Esperado: ${expectedQuantity} · Contado: ${counted} · Diferença: ${difference}`,
      });
      if (result.error) throw new Error(result.error.message || 'Não foi possível registrar o inventário.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['product_movements'] }),
      ]);
      toast.success(`Inventário registrado para ${selectedProduct?.name || 'o produto'}.`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível registrar o inventário.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary"><ClipboardCheck className="h-5 w-5" /> Inventário de estoque</DialogTitle>
          <DialogDescription>Compare o saldo esperado com a contagem física e registre a diferença de forma auditada.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FinancialInfoTip title="Dica de inventário">Faça a contagem física por loja. O sistema preserva o saldo anterior, o saldo contado, a diferença e o usuário responsável. O estoque reservado não pode ser reduzido pela contagem.</FinancialInfoTip>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label><Package className="mr-1 inline h-3.5 w-3.5" /> Produto</Label><Select value={productId || undefined} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger><SelectContent>{products.filter((product: any) => product.status !== 'inactive').map((product: any) => <SelectItem key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label><StoreIcon className="mr-1 inline h-3.5 w-3.5" /> Loja</Label><Select value={storeId || undefined} onValueChange={setStoreId}><SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger><SelectContent>{stores.map((store: any) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Esperado</p><p className="mt-1 text-2xl font-bold">{expectedQuantity}</p><p className="text-[11px] text-muted-foreground">saldo físico atual</p></div>
            <div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Reservado</p><p className="mt-1 text-2xl font-bold text-primary">{reservedQuantity}</p><p className="text-[11px] text-muted-foreground">mínimo permitido</p></div>
            <div className={`rounded-xl border p-3 ${difference === 0 ? 'border-emerald-500/20 bg-emerald-500/5' : difference > 0 ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-rose-500/20 bg-rose-500/10'}`}><p className="text-[10px] font-semibold uppercase text-muted-foreground">Diferença</p><p className={`mt-1 flex items-center gap-1 text-lg font-bold ${difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{difference > 0 ? <TrendingUp className="h-4 w-4" /> : difference < 0 ? <TrendingDown className="h-4 w-4" /> : null}{differenceLabel}</p><p className="text-[11px] text-muted-foreground">após a contagem</p></div>
          </div>
          <div className="space-y-2"><Label htmlFor="inventory-count">Contagem física</Label><Input id="inventory-count" type="number" min={reservedQuantity} step="1" value={countedQuantity} onChange={(event) => setCountedQuantity(event.target.value)} className="h-11" /><p className="text-[11px] text-muted-foreground">Informe a quantidade encontrada na loja. O valor mínimo é o total reservado.</p></div>
          <div className="space-y-2"><Label htmlFor="inventory-reason">Motivo / observação</Label><Textarea id="inventory-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: conferência mensal, ajuste após contagem física..." rows={3} maxLength={300} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button><Button type="submit" disabled={isSaving || !productId || !storeId || !validCount}>{isSaving ? 'Registrando...' : 'Registrar inventário'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
