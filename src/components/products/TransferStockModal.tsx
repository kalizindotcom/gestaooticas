import { useState } from 'react';
import {
  ArrowRightLeft,
  Store as StoreIcon,
  Package as PackageIcon,
  AlertTriangle,
  Info,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { localApi } from '@/lib/localApi';
import { useQueryClient } from '@tanstack/react-query';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

interface StoreRef { id: string; name: string; }
interface ProductRef { id: string; name: string; sku?: string; product_stock?: { store_id: string; quantity: number; reserved_quantity?: number }[]; }

interface TransferStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductRef[];
  stores: StoreRef[];
}

export function TransferStockModal({ open, onOpenChange, products, stores }: TransferStockModalProps) {
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [sourceStoreId, setSourceStoreId] = useState('');
  const [targetStoreId, setTargetStoreId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const sourceStore = stores.find(s => s.id === sourceStoreId);
  const targetStore = stores.find(s => s.id === targetStoreId);

  const sourceStockRecord = selectedProduct?.product_stock?.find(s => s.store_id === sourceStoreId);
  const sourcePhysicalStock = Number(sourceStockRecord?.quantity || 0);
  const sourceReservedStock = Number(sourceStockRecord?.reserved_quantity || 0);
  const sourceStock = Math.max(sourcePhysicalStock - sourceReservedStock, 0);

  const resetForm = () => {
    setSelectedProductId(''); setSourceStoreId(''); setTargetStoreId('');
    setQuantity(''); setDescription('');
  };

  const closeModal = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !sourceStoreId || !targetStoreId || !quantity) {
      toast.error('Preencha todos os campos obrigatórios.'); return;
    }
    if (sourceStoreId === targetStoreId) {
      toast.error('Origem e destino não podem ser iguais.'); return;
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) { toast.error('Quantidade inválida.'); return; }
    if (qty > sourceStock) { toast.error(`Estoque disponível insuficiente na origem. Disponível: ${sourceStock}.`); return; }

    setIsLoading(true);
    try {
      const result = await localApi.operations.transferProductStock({
        product_id: selectedProductId,
        source_store_id: sourceStoreId,
        target_store_id: targetStoreId,
        quantity: qty,
        description: description.trim() || undefined,
      });
      if (result.error) throw new Error(result.error.message || 'Não foi possível registrar a transferência.');

      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['product_movements'] });

      toast.success(`${qty} unidades de ${selectedProduct?.name} transferidas para ${targetStore?.name}.`);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error('Erro na transferência: ' + (err?.message || 'tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-[32px]">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 border-b border-primary/5">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold text-primary flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ArrowRightLeft className="h-6 w-6" />
              </div>
              Transferência de Estoque
            </DialogTitle>
            <DialogDescription className="sr-only">Transfira estoque de um produto entre lojas.</DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleTransfer} className="p-8 space-y-6">
          <FinancialInfoTip title="Dica de transferência">Escolha a loja de origem e destino. O sistema valida o saldo disponível e registra a saída e a entrada no histórico das duas lojas.</FinancialInfoTip>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PackageIcon className="h-3.5 w-3.5" /> Produto
              </Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="h-12 border-border/50 bg-muted/20 rounded-2xl">
                  <SelectValue placeholder="Selecione um produto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <StoreIcon className="h-3.5 w-3.5" /> Loja de Origem
                </Label>
                <Select value={sourceStoreId} onValueChange={setSourceStoreId}>
                  <SelectTrigger className="h-12 border-border/50 bg-muted/20 rounded-2xl">
                    <SelectValue placeholder="Selecione a origem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' - ')[1] || s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                        {selectedProductId && sourceStoreId && (
                  <div className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold inline-flex flex-wrap items-center gap-1.5', sourceStock > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600')}>
                    Disponível: {sourceStock} · Físico: {sourcePhysicalStock}{sourceReservedStock > 0 ? ` · Reservado: ${sourceReservedStock}` : ''}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <StoreIcon className="h-3.5 w-3.5" /> Loja de Destino
                </Label>
                <Select value={targetStoreId} onValueChange={setTargetStoreId}>
                  <SelectTrigger className="h-12 border-border/50 bg-muted/20 rounded-2xl">
                    <SelectValue placeholder="Selecione o destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' - ')[1] || s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

              <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-center space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Origem</p>
                  <p className="font-bold text-sm truncate max-w-[150px] mx-auto">{sourceStore ? (sourceStore.name.split(' - ')[1] || sourceStore.name) : 'Não selecionada'}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ChevronRight className="h-6 w-6" />
                </div>
                <div className="flex-1 text-center space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Destino</p>
                  <p className="font-bold text-sm truncate max-w-[150px] mx-auto">{targetStore ? (targetStore.name.split(' - ')[1] || targetStore.name) : 'Não selecionada'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quantidade</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className="h-12 border-border/50 bg-muted/20 rounded-2xl" min="1" max={sourceStock} />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Motivo / Observação</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Reposição de estoque" maxLength={300} className="h-12 border-border/50 bg-muted/20 rounded-2xl" />
              </div>
            </div>

            {sourceStock < parseInt(quantity || '0') && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-600">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-bold">Estoque insuficiente</p>
                  <p className="text-xs opacity-90">Quantidade solicitada maior que o estoque disponível na origem.</p>
                </div>
              </div>
            )}

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 flex gap-3 text-primary">
              <Info className="h-5 w-5 shrink-0" />
              <p className="text-[11px] leading-relaxed">
                Esta operação subtrai da origem e adiciona ao destino. Uma movimentação de <strong>"Transferência"</strong> será registrada no histórico de ambas as lojas.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl border-border/60 font-bold" onClick={() => closeModal(false)}>Cancelar</Button>
              <Button type="submit" className="flex-[2] h-11 rounded-xl bg-primary text-primary-foreground border-0 shadow-lg shadow-primary/20 font-bold" disabled={isLoading || !selectedProductId || !sourceStoreId || !targetStoreId || !quantity || sourceStock < parseInt(quantity || '0')}>
              {isLoading ? 'Transferindo...' : 'Confirmar Transferência'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}