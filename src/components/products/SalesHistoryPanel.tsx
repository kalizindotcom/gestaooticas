import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, CheckCircle2, Clock3, CreditCard, Eye, FileText, Package, Search, Store, Tag, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SaleHistoryRow = {
  id: string;
  saleId: string;
  dateTime?: string | null;
  productId?: string;
  productName: string;
  sku: string;
  barcode: string;
  brand: string;
  category: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
  saleTotal: number;
  discount: number;
  customerName: string;
  customerDocument: string;
  storeName: string;
  sellerName: string;
  paymentMethod: string;
  status: string;
  serviceOrderId?: string | null;
  notes?: string;
};

type Props = {
  rows: SaleHistoryRow[];
  summary: { sales: number; units: number; revenue: number; discounts: number };
  stores: any[];
  search: string;
  storeFilter: string;
  statusFilter: string;
  paymentFilter: string;
  onSearchChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPaymentChange: (value: string) => void;
  onClear: () => void;
  selectedSale: SaleHistoryRow | null;
  onSelectSale: (sale: SaleHistoryRow | null) => void;
};

const currency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const paymentLabel = (value?: string) => ({
  pix: 'PIX', cash: 'Dinheiro', credit: 'Cartão de crédito', debit: 'Cartão de débito', check: 'Cheque', transfer: 'Transferência',
}[String(value || '').toLowerCase()] || value || 'Não informado');
const statusLabel = (value?: string) => ({ completed: 'Concluída', paid: 'Concluída', pending: 'Pendente', cancelled: 'Cancelada', canceled: 'Cancelada' }[String(value || '').toLowerCase()] || value || 'Não informado');
const dateParts = (value?: string | null) => {
  if (!value) return { date: '—', time: '—' };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: '—', time: '—' };
  return { date: parsed.toLocaleDateString('pt-BR'), time: parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
};

function Summary({ label, value, helper, tone = 'neutral' }: { label: string; value: string; helper: string; tone?: 'neutral' | 'orange' | 'green' }) {
  return <div className={cn('rounded-2xl border px-4 py-3', tone === 'orange' ? 'border-primary/20 bg-primary/[0.05]' : tone === 'green' ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-border/70 bg-card')}><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className={cn('mt-1 text-lg font-black', tone === 'orange' ? 'text-primary' : tone === 'green' ? 'text-emerald-600' : 'text-foreground')}>{value}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{helper}</p></div>;
}

export function SalesHistoryPanel({ rows, summary, stores, search, storeFilter, statusFilter, paymentFilter, onSearchChange, onStoreChange, onStatusChange, onPaymentChange, onClear, selectedSale, onSelectSale }: Props) {
  const hasFilters = Boolean(search || storeFilter !== 'all' || statusFilter !== 'all' || paymentFilter !== 'all');
  const selectedDate = dateParts(selectedSale?.dateTime);

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Summary label="Vendas" value={String(summary.sales)} helper="vendas no filtro" tone="orange" />
      <Summary label="Unidades" value={String(summary.units)} helper="itens comercializados" />
      <Summary label="Receita dos itens" value={currency(summary.revenue)} helper="soma dos produtos" tone="green" />
      <Summary label="Descontos" value={currency(summary.discounts)} helper="concedidos no período" />
    </div>

    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div><h3 className="text-sm font-bold text-foreground">Vendas realizadas</h3><p className="text-xs text-muted-foreground">Cada linha representa um produto vendido. Clique para ver a venda completa.</p></div>
          <span className="text-xs font-semibold text-muted-foreground">{rows.length} item(ns) · {summary.sales} venda(s)</span>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1.5fr)_180px_160px_180px_auto]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Produto, SKU, cliente, vendedor ou venda..." className="h-9 pl-9" />{search && <button type="button" aria-label="Limpar busca" onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}</div>
          <Select value={storeFilter} onValueChange={onStoreChange}><SelectTrigger className="h-9"><SelectValue placeholder="Todas as lojas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{stores.map((store: any) => <SelectItem key={store.id} value={store.name}>{store.name}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={onStatusChange}><SelectTrigger className="h-9"><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="completed">Concluídas</SelectItem><SelectItem value="pending">Pendentes</SelectItem><SelectItem value="cancelled">Canceladas</SelectItem></SelectContent></Select>
          <Select value={paymentFilter} onValueChange={onPaymentChange}><SelectTrigger className="h-9"><SelectValue placeholder="Todos os pagamentos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os pagamentos</SelectItem>{Array.from(new Set(rows.map((row) => row.paymentMethod).filter(Boolean))).map((method) => <SelectItem key={method} value={method}>{paymentLabel(method)}</SelectItem>)}</SelectContent></Select>
          <Button type="button" variant="outline" onClick={onClear} disabled={!hasFilters} className="h-9 gap-1.5"><X className="h-3.5 w-3.5" /> Limpar</Button>
        </div>
      </CardContent>
      <div className="overflow-x-auto border-t border-border/60">
        {rows.length === 0 ? <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground"><Package className="h-9 w-9 opacity-30" /><p className="text-sm font-semibold">Nenhuma venda encontrada</p><p className="max-w-sm text-xs">Ajuste a busca ou os filtros para consultar o histórico comercial.</p></div> : <Table className="min-w-[1180px]">
          <TableHeader><TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30"><TableHead className="w-[160px] pl-5">Data e hora</TableHead><TableHead className="w-[300px]">Produto vendido</TableHead><TableHead className="w-[210px]">Cliente / venda</TableHead><TableHead className="w-[170px]">Loja / vendedor</TableHead><TableHead className="w-[130px]">Pagamento</TableHead><TableHead className="w-[130px] text-right">Valor</TableHead><TableHead className="w-[120px]">Status</TableHead><TableHead className="w-[70px] pr-5 text-right">Ver</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row) => { const date = dateParts(row.dateTime); return <TableRow key={row.id} className="cursor-pointer border-border/50 hover:bg-primary/[0.04]" onClick={() => onSelectSale(row)}>
            <TableCell className="pl-5 align-middle"><div className="flex flex-col gap-0.5"><span className="text-xs font-bold text-foreground">{date.date}</span><span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" /> {date.time}</span></div></TableCell>
            <TableCell className="align-middle"><div className="flex min-w-0 items-center gap-3"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40">{row.imageUrl ? <img src={row.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-muted-foreground"><Package className="h-4 w-4" /></div>}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{row.productName}</p><p className="truncate text-[11px] text-muted-foreground">SKU: {row.sku} · Código: {row.barcode}</p><p className="truncate text-[11px] text-muted-foreground">{row.brand} · {row.category}</p></div></div></TableCell>
            <TableCell className="align-middle"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{row.customerName}</p><p className="truncate font-mono text-[10px] text-primary">Venda #{String(row.saleId).slice(0, 8).toUpperCase()}</p><p className="truncate text-[11px] text-muted-foreground">Qtd. {row.quantity} · Unit. {currency(row.unitPrice)}</p></div></TableCell>
            <TableCell className="align-middle"><p className="truncate text-xs font-semibold text-foreground">{row.storeName}</p><p className="truncate text-[11px] text-muted-foreground">{row.sellerName}</p></TableCell>
            <TableCell className="align-middle"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CreditCard className="h-3.5 w-3.5" />{paymentLabel(row.paymentMethod)}</span></TableCell>
            <TableCell className="text-right align-middle"><p className="text-sm font-black text-primary">{currency(row.itemTotal)}</p>{row.discount > 0 && <p className="text-[10px] font-semibold text-emerald-600">Desc. {currency(row.discount)}</p>}</TableCell>
            <TableCell className="align-middle"><Badge variant="outline" className={cn('rounded-full text-[10px]', row.status === 'cancelled' ? 'border-muted-foreground/30 text-muted-foreground' : row.status === 'pending' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>{statusLabel(row.status)}</Badge></TableCell>
            <TableCell className="pr-5 text-right align-middle"><Button type="button" variant="ghost" size="icon" aria-label="Visualizar venda" onClick={(event) => { event.stopPropagation(); onSelectSale(row); }} className="h-8 w-8"><Eye className="h-4 w-4" /></Button></TableCell>
          </TableRow>; })}</TableBody>
        </Table>}
      </div>
    </Card>

    <Dialog open={!!selectedSale} onOpenChange={(open) => !open && onSelectSale(null)}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-border/80 bg-background p-0 shadow-2xl sm:rounded-3xl">
        <DialogHeader className="shrink-0 border-b border-border/70 bg-card px-5 py-4 sm:px-6"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{selectedSale?.imageUrl ? <img src={selectedSale.imageUrl} alt="" className="h-full w-full rounded-xl object-cover" /> : <Package className="h-5 w-5" />}</div><div className="min-w-0"><DialogTitle className="truncate text-base">Detalhes da venda</DialogTitle><DialogDescription className="mt-0.5 truncate">Venda #{String(selectedSale?.saleId || '').slice(0, 8).toUpperCase()} · {selectedDate.date} às {selectedDate.time}</DialogDescription></div></div>{selectedSale && <Badge variant="outline" className="shrink-0 rounded-full">{statusLabel(selectedSale.status)}</Badge>}</div></DialogHeader>
        {selectedSale && <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"><div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Summary label="Valor do item" value={currency(selectedSale.itemTotal)} helper={`${selectedSale.quantity} unidade(s) · ${currency(selectedSale.unitPrice)} cada`} tone="orange" /><Summary label="Total da venda" value={currency(selectedSale.saleTotal)} helper={selectedSale.discount > 0 ? `Desconto: ${currency(selectedSale.discount)}` : 'Sem desconto informado'} /><Summary label="Pagamento" value={paymentLabel(selectedSale.paymentMethod)} helper={selectedSale.serviceOrderId ? 'O.S. vinculada' : 'Venda comercial'} /></div>
          <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-border/70 bg-card p-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><User className="h-4 w-4" /> Para quem foi</h3><p className="text-sm font-bold text-foreground">{selectedSale.customerName}</p><p className="mt-1 text-xs text-muted-foreground">{selectedSale.customerDocument !== '—' ? selectedSale.customerDocument : 'Cliente avulso ou documento não informado'}</p><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Store className="h-3.5 w-3.5" /> {selectedSale.storeName}</p><p className="mt-1 text-xs text-muted-foreground">Vendedor: <span className="font-semibold text-foreground">{selectedSale.sellerName}</span></p></div><div className="rounded-2xl border border-border/70 bg-card p-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><Calendar className="h-4 w-4" /> Quando foi</h3><p className="text-sm font-bold text-foreground">{selectedDate.date}</p><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {selectedDate.time}</p><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CreditCard className="h-3.5 w-3.5" /> {paymentLabel(selectedSale.paymentMethod)}</p>{selectedSale.serviceOrderId && <p className="mt-1 text-xs text-muted-foreground">O.S.: <span className="font-mono text-foreground">{selectedSale.serviceOrderId}</span></p>}</div></div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><Package className="h-4 w-4" /> Produto detalhado</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><Label className="text-[10px] text-muted-foreground">Produto</Label><p className="mt-1 text-sm font-bold text-foreground">{selectedSale.productName}</p></div><div><Label className="text-[10px] text-muted-foreground">SKU / referência</Label><p className="mt-1 font-mono text-xs font-semibold text-foreground">{selectedSale.sku}</p></div><div><Label className="text-[10px] text-muted-foreground">Código de barras</Label><p className="mt-1 font-mono text-xs font-semibold text-foreground">{selectedSale.barcode}</p></div><div><Label className="text-[10px] text-muted-foreground">Marca / categoria</Label><p className="mt-1 text-xs font-semibold text-foreground">{selectedSale.brand} · {selectedSale.category}</p></div></div></div>
          {selectedSale.notes && <div className="rounded-2xl border border-border/70 bg-card p-4"><h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><FileText className="h-4 w-4" /> Observações</h3><p className="text-sm leading-relaxed text-muted-foreground">{selectedSale.notes}</p></div>}
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />Registro comercial vinculado ao estoque e ao Financeiro. Os dados exibidos refletem o histórico salvo da venda.</div><Separator /><div className="flex justify-end"><Button type="button" variant="outline" onClick={() => onSelectSale(null)}>Fechar</Button></div>
        </div></div>}
      </DialogContent>
    </Dialog>
  </div>;
}
