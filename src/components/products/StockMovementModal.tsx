import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, Package, RefreshCw, Store as StoreIcon, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { localApi } from '@/lib/localApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/contexts/PermissionsContext';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

interface StockMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  stores: any[];
  defaultProductId?: string;
  defaultStoreId?: string;
  onCompleted?: () => void;
}

const operationLabels = {
  in: 'Entrada',
  out: 'Saída',
  adjustment: 'Ajuste de saldo',
  reserve: 'Reservar',
  release: 'Liberar reserva',
} as const;

export function StockMovementModal({ open, onOpenChange, products, stores, defaultProductId = '', defaultStoreId = '', onCompleted }: StockMovementModalProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canViewCost = hasPermission('products', 'view_cost');
  const [productId, setProductId] = useState(defaultProductId);
  const [storeId, setStoreId] = useState(defaultStoreId || stores[0]?.id || '');
  const [operation, setOperation] = useState<'in' | 'out' | 'adjustment' | 'reserve' | 'release'>('in');
  const [quantity, setQuantity] = useState('1');
  const [targetQuantity, setTargetQuantity] = useState('0');
  const [unitCost, setUnitCost] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedProduct = products.find((product: any) => product.id === productId);
  const selectedStock = selectedProduct?.product_stock?.find((stock: any) => stock.store_id === storeId);
  const currentStock = Number(selectedStock?.quantity || 0);
  const currentReserved = Number(selectedStock?.reserved_quantity || 0);
  const availableStock = Math.max(currentStock - currentReserved, 0);
  const previewStock = useMemo(() => {
    if (operation === 'reserve' || operation === 'release') return currentStock;
    if (operation === 'adjustment') return Math.max(Number(targetQuantity || 0), 0);
    return Math.max(currentStock + (operation === 'in' ? Number(quantity || 0) : -Number(quantity || 0)), 0);
  }, [currentStock, operation, quantity, targetQuantity]);

  const resetForOpen = () => {
    setProductId(defaultProductId || '');
    setStoreId(defaultStoreId || stores[0]?.id || '');
    setOperation('in');
    setQuantity('1');
    setTargetQuantity('0');
    setUnitCost('');
    setDocumentNumber('');
    setSupplierName('');
    setReason('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) resetForOpen();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!productId || !storeId) {
      toast.error('Selecione o produto e a loja.');
      return;
    }
    const amount = Number(operation === 'adjustment' ? targetQuantity : quantity);
    if (!Number.isInteger(amount) || amount < 0 || (operation !== 'adjustment' && amount === 0)) {
      toast.error('Informe uma quantidade inteira válida.');
      return;
    }
    if (operation === 'out' && amount > availableStock) {
      toast.error(`Estoque disponível insuficiente. Disponível: ${availableStock}.`);
      return;
    }
    if (operation === 'adjustment' && amount < currentReserved) {
      toast.error(`O novo saldo não pode ficar abaixo do reservado (${currentReserved}).`);
      return;
    }
    if (operation === 'reserve' && amount > availableStock) {
      toast.error(`Não há saldo disponível para reservar. Disponível: ${availableStock}.`);
      return;
    }
    if (operation === 'release' && amount > currentReserved) {
      toast.error(`A reserva atual é de ${currentReserved} unidade(s).`);
      return;
    }
    setIsSaving(true);
    try {
      if (operation === 'reserve' || operation === 'release') {
        const result = await localApi.operations.reserveProductStock({ product_id: productId, store_id: storeId, operation, quantity: amount, description: reason.trim() || undefined });
        if (result.error) throw new Error(result.error.message || 'Não foi possível atualizar a reserva.');
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['products'] }), queryClient.invalidateQueries({ queryKey: ['product_movements'] })]);
        toast.success(`${operationLabels[operation]} registrada para ${selectedProduct?.name || 'o produto'}.`);
        onCompleted?.();
        onOpenChange(false);
        return;
      }
      const result = await localApi.operations.adjustProductStock({
        product_id: productId,
        store_id: storeId,
        operation,
        quantity: operation === 'adjustment' ? undefined : amount,
        target_quantity: operation === 'adjustment' ? amount : undefined,
        unit_cost: canViewCost && unitCost ? Number(unitCost) : undefined,
        document_number: documentNumber.trim() || undefined,
        supplier_name: supplierName.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      if (result.error) throw new Error(result.error.message || 'Não foi possível movimentar o estoque.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['product_movements'] }),
      ]);
      toast.success(`${operationLabels[operation]} registrada para ${selectedProduct?.name || 'o produto'}.`);
      onCompleted?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir a operação de estoque.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary"><ClipboardList className="h-5 w-5" /> Movimentar estoque</DialogTitle>
          <DialogDescription>Registre uma entrada, saída ou ajuste. O saldo antes e depois ficará no histórico.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FinancialInfoTip title="Dica de movimentação">Entradas aumentam o saldo, saídas reduzem o saldo, reservas comprometem o disponível sem alterar o físico e ajustes definem o novo saldo. Informe documento e motivo para manter o histórico auditável.</FinancialInfoTip>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Produto <span className="text-primary">*</span></Label><Select value={productId || undefined} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger><SelectContent>{products.filter((product: any) => product.status !== 'inactive').map((product: any) => <SelectItem key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Loja <span className="text-primary">*</span></Label><Select value={storeId || undefined} onValueChange={setStoreId}><SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger><SelectContent>{stores.map((store: any) => <SelectItem key={store.id} value={store.id}><span className="flex items-center gap-2"><StoreIcon className="h-3.5 w-3.5" />{store.name}</span></SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Operação</Label><Select value={operation} onValueChange={(value: 'in' | 'out' | 'adjustment' | 'reserve' | 'release') => setOperation(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in"><span className="flex items-center gap-2"><ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" /> Entrada</span></SelectItem><SelectItem value="out"><span className="flex items-center gap-2"><ArrowUpFromLine className="h-3.5 w-3.5 text-rose-600" /> Saída</span></SelectItem><SelectItem value="adjustment"><span className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 text-amber-600" /> Ajuste de saldo</span></SelectItem><SelectItem value="reserve"><span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-primary" /> Reservar estoque</span></SelectItem><SelectItem value="release"><span className="flex items-center gap-2"><UnlockKeyhole className="h-3.5 w-3.5 text-primary" /> Liberar reserva</span></SelectItem></SelectContent></Select></div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs text-muted-foreground">Saldo atual</p><p className="flex items-center gap-2 text-xl font-bold"><Package className="h-4 w-4 text-primary" />{currentStock} un.</p><p className="text-xs text-muted-foreground">Disponível: {availableStock} · Reservado: {currentReserved}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Após salvar</p><p className="text-xl font-bold text-primary">{previewStock} un.</p></div></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>{operation === 'adjustment' ? 'Novo saldo' : operation === 'reserve' || operation === 'release' ? 'Quantidade da reserva' : 'Quantidade'}</Label><Input type="number" min="0" step="1" value={operation === 'adjustment' ? targetQuantity : quantity} onChange={(event) => operation === 'adjustment' ? setTargetQuantity(event.target.value) : setQuantity(event.target.value)} /></div>
            {canViewCost && <div className="space-y-2"><Label>Custo unitário (opcional)</Label><Input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="0,00" /></div>}
            <div className="space-y-2"><Label>Documento / nota</Label><Input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="NF, pedido ou referência" /></div>
            <div className="space-y-2"><Label>Fornecedor</Label><Input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Opcional" /></div>
          </div>
          <div className="space-y-2"><Label>Motivo / observação</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo da movimentação..." maxLength={300} rows={3} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button><Button type="submit" className="gap-2" disabled={isSaving}>{isSaving ? 'Salvando...' : `Registrar ${operationLabels[operation].toLowerCase()}`}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
