import { Plus, Store as StoreIcon, MapPin, Clock, User, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StoreForm } from '@/components/stores/StoreForm';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useState } from 'react';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

export default function Stores() {
  const { stores, companies, loading, selectedStoreIds, setSelectedStoreIds } = useGlobalFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any | null>(null);

  const handleOpenNew = () => {
    setEditingStore(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, store: any) => {
    e.stopPropagation();
    setEditingStore(store);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <PageHeader
          title="Lojas"
          description="Gerencie as unidades de atendimento"
          actions={
            <Button
              size="lg"
              className="gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 hover-lift rounded-xl"
              onClick={handleOpenNew}
            >
              <Plus className="h-4 w-4" />
              Nova Loja
            </Button>
          }
        />
      </div>

      <FinancialInfoTip className="px-3 py-2.5" title="Dica das lojas">Selecione uma unidade para trabalhar no contexto correto. Cada loja concentra estoque, caixa, vendas e indicadores próprios.</FinancialInfoTip>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[720px] gap-0 overflow-hidden rounded-3xl border-border/70 bg-card/95 p-0 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-primary/[0.08] via-primary/[0.03] to-transparent px-6 py-5 text-left">
            <div className="flex items-start gap-3 pr-8">
              <div className="relative mt-0.5 shrink-0">
                <div className="absolute inset-0 rounded-xl bg-primary/30 blur-md" />
                <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/20">
                  <StoreIcon className="h-4.5 w-4.5" strokeWidth={2.3} />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Cadastro operacional</p>
                <DialogTitle className="mt-1 font-heading text-xl font-bold tracking-tight">
                  {editingStore ? 'Editar loja' : 'Nova loja'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {editingStore ? 'Atualize os dados e mantenha esta unidade organizada.' : 'Cadastre uma unidade para acompanhar sua operação por loja.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <StoreForm
            onSuccess={() => setIsDialogOpen(false)}
            initialData={editingStore || undefined}
          />
        </DialogContent>
      </Dialog>

      {loading ? (
        <LoadingSpinner message="Carregando lojas..." />
      ) : stores.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="Nenhuma loja cadastrada"
          description="Adicione lojas para organizar suas operações por unidade"
          action={
            <Button
              onClick={handleOpenNew}
              className="gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 hover-lift rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Loja
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store, i) => {
            const company = companies.find(c => c.id === store.company_id);
            const isSelected = selectedStoreIds.includes(store.id);
            return (
              <Card
                key={store.id}
                onClick={() => setSelectedStoreIds([store.id])}
                className={cn(
                  "group relative overflow-hidden cursor-pointer border-border/60 hover-lift animate-fade-in-up transition-all",
                  isSelected && "border-primary/40 ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                )}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* gradient top decoration */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-orange-500 to-primary transition-all" />
                <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary blur-2xl opacity-20 transition-opacity" />

                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  {isSelected && (
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-white shadow-md shadow-primary/30 animate-scale-in">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => handleEdit(e, store)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <CardContent className="p-5 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          className="absolute inset-0 rounded-xl bg-primary blur-md opacity-50"
                        />
                        <div
                          className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-orange-700 grid place-items-center shadow-lg group-hover:scale-110 transition-transform duration-500"
                        >
                          <StoreIcon className="h-5 w-5 text-white" strokeWidth={2.2} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[13px] font-heading font-bold tracking-tight">{store.name}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {company?.trade_name || 'N/A'} · <span className="font-mono font-bold">{store.code}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={store.status as any} />
                      {isSelected && (
                        <span className="text-[9px] font-black text-primary uppercase tracking-wider animate-fade-in">
                          Selecionada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 hover:text-foreground transition-colors">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{store.address || 'Endereço não informado'}, {store.city || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-foreground transition-colors">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{store.hours || 'Horário não informado'}</span>
                    </div>
                    <div className="flex items-center gap-2 hover:text-foreground transition-colors">
                      <User className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{store.manager || 'Gerente não informado'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}