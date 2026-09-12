import { useState } from 'react';
import { CalendarDays, ChevronDown, Clock3, Eye, FileCheck, FlaskConical, MessageSquareText, Package, Pencil, Printer, Trash2, User, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, PriorityBadge } from '@/components/shared/StatusBadge';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { ServiceOrderPrint, type ServiceOrderPrintVariant } from '@/components/ServiceOrderPrint';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDateTime, formatMoney } from '@/hooks/useCustomerData';
import { SERVICE_ORDER_STATUS_OPTIONS, serviceOrderStatusLabel } from '@/lib/serviceOrderStatus';

interface ServiceOrderViewerProps {
  order: any | null;
  company?: any;
  store?: any;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
  onPrepareFiscal?: () => void;
  isPreparingFiscal?: boolean;
}

const valueOrDash = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  return String(value);
};

const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro', pix: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito',
  bank_transfer: 'Transferência', boleto: 'Boleto', credit: 'Crediário', installments: 'Parcelado', crediario: 'Crediário',
};

const financialStatusLabels: Record<string, string> = {
  paid: 'Pago', partial: 'Parcial', partially_paid: 'Parcial', pending: 'Pendente', overdue: 'Em atraso', cancelled: 'Cancelado',
};

const printOptions: Array<{ variant: ServiceOrderPrintVariant; title: string; description: string; icon: typeof User }> = [
  { variant: 'cliente', title: 'Imprimir via do cliente', description: 'Comprovante com prazo, valores e orientações de retirada.', icon: User },
  { variant: 'laboratorio', title: 'Imprimir via do laboratório', description: 'Ficha técnica com receita, medidas e dados de produção.', icon: FlaskConical },
];

function DetailItem({ label, value, icon: Icon, tone = 'default' }: { label: string; value: unknown; icon?: any; tone?: 'default' | 'primary' | 'danger' }) {
  return <div className="min-w-0 space-y-1.5"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5 text-primary/80" />}{label}</p><p className={cn('break-words text-sm font-semibold', tone === 'primary' && 'text-primary', tone === 'danger' && 'text-destructive')}>{valueOrDash(value)}</p></div>;
}

function SectionCard({ title, icon: Icon, children, className }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return <Card className={cn('border-border/70 bg-card shadow-sm', className)}><CardContent className="p-3.5 sm:p-4"><div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3></div>{children}</CardContent></Card>;
}

function PrescriptionPanel({ order }: { order: any }) {
  const prescription = order?.prescription;
  if (!prescription) return <SectionCard title="Receita óptica" icon={Eye}><div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">Nenhuma receita óptica foi informada nesta O.S.</div></SectionCard>;
  const right = prescription.rightEye || {};
  const left = prescription.leftEye || {};
  const rows = [
    ['Esférico', right.sph, left.sph], ['Cilíndrico', right.cyl, left.cyl], ['Eixo', right.axis, left.axis], ['Adição', right.add, left.add],
  ];
  const measurements = [
    ['Distância pupilar', prescription.pupillaryDistance], ['Diagonal maior', prescription.largestDiagonal], ['Altura vertical', prescription.verticalHeight],
    ['Aro', prescription.frameSize], ['Ponte', prescription.bridgeSize], ['Aro + ponte', prescription.frameAndBridge], ['Centro óptico', prescription.opticalCenterHeight],
  ];
  return <SectionCard title="Receita óptica" icon={Eye}>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Emissão: <strong className="text-foreground">{valueOrDash(order.prescriptionDate)}</strong></span><span className="text-border">•</span><span>Validade: <strong className="text-foreground">{valueOrDash(order.prescriptionValidUntil)}</strong></span>{order.prescriptionProfessionalName && <><span className="text-border">•</span><span>Profissional: <strong className="text-foreground">{order.prescriptionProfessionalName}</strong></span></>}</div>
    <div className="overflow-x-auto rounded-xl border border-border/70"><div className="min-w-0 sm:min-w-[430px]"><div className="grid grid-cols-[1.2fr_1fr_1fr] bg-muted/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>Medida</span><span className="text-center">OD</span><span className="text-center">OE</span></div>{rows.map(([label, od, oe]) => <div key={label} className="grid grid-cols-[1.2fr_1fr_1fr] items-center border-t border-border/60 px-3 py-2.5 text-sm"><span className="font-medium text-muted-foreground">{label}</span><span className="text-center font-mono font-semibold text-foreground">{valueOrDash(od)}</span><span className="text-center font-mono font-semibold text-foreground">{valueOrDash(oe)}</span></div>)}</div></div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{measurements.map(([label, value]) => <div key={label} className="rounded-lg bg-muted/30 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold text-foreground">{valueOrDash(value)}</p></div>)}</div>
  </SectionCard>;
}

function Timeline({ order }: { order: any }) {
  const timeline = Array.isArray(order?.timeline) ? order.timeline : [];
  return <SectionCard title="Histórico operacional" icon={Clock3}><div className="space-y-0">{timeline.length === 0 ? <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">Nenhum evento registrado para esta O.S.</div> : timeline.map((event: any, index: number) => <div key={`${event.date || 'event'}-${index}`} className="relative flex gap-3 pb-5 last:pb-0"><div className="relative flex w-4 justify-center"><span className="z-10 mt-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/10" />{index < timeline.length - 1 && <span className="absolute top-4 h-full w-px bg-border" />}</div><div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-muted/20 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-semibold text-foreground">{valueOrDash(event.action)}</p><time className="text-[10px] font-medium text-muted-foreground">{event.date ? formatDateTime(event.date) : '—'}</time></div><p className="mt-1 text-xs text-muted-foreground">Responsável: <span className="font-medium text-foreground">{valueOrDash(event.user || event.userName || 'Sistema')}</span></p>{event.status && <StatusBadge status={event.status} variant="dot" className="mt-2 text-[10px]" />}</div></div>)}</div></SectionCard>;
}

export function ServiceOrderViewer({ order, company, store, onOpenChange, onEdit, onDelete, onStatusChange, onPrepareFiscal, isPreparingFiscal = false }: ServiceOrderViewerProps) {
  const total = Number(order?.total || 0);
  const paid = Number(order?.paidAmount ?? order?.paid_amount ?? 0);
  const balance = Math.max(Number(order?.balance ?? total - paid), 0);
  const paymentMethod = paymentLabels[String(order?.paymentMethod || order?.payment_method || '').toLowerCase()] || valueOrDash(order?.paymentMethod || order?.payment_method);
  const titleId = order ? `os-viewer-${order.id}` : undefined;
  const [printVariant, setPrintVariant] = useState<ServiceOrderPrintVariant | null>(null);
  const handlePrint = (variant: ServiceOrderPrintVariant) => {
    setPrintVariant(variant);
    window.setTimeout(() => {
      const element = document.getElementById('os-print-section');
      if (!element) return;
      element.style.display = 'block';
      window.print();
      window.setTimeout(() => {
        element.style.display = 'none';
        setPrintVariant(null);
      }, 600);
    }, 120);
  };
  return <Dialog open={Boolean(order)} onOpenChange={onOpenChange}><DialogContent aria-describedby={`${titleId}-description`} className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-hidden rounded-2xl border-border/70 bg-background p-0 shadow-2xl sm:w-[calc(100vw-2rem)]">
    {order && printVariant && <ServiceOrderPrint os={order} company={company} store={store} variant={printVariant} />}
    {order && <div className="flex max-h-[94vh] flex-col">
      <header className="border-b border-border/70 bg-card px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-12">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-primary">O.S. #{order ? String(order.id).slice(0, 8).toUpperCase() : ''}</span>{order && <StatusBadge status={order.status} />}{order && <PriorityBadge priority={order.priority} />}</div><DialogTitle id={titleId} className="mt-1.5 truncate text-lg font-bold sm:text-xl">{order?.customerName || 'Ordem de Serviço'}</DialogTitle><DialogDescription id={`${titleId}-description`} className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{valueOrDash(store?.name || order?.storeName)}</span><span className="text-border">•</span><span>Aberta em {order?.date ? formatDateTime(order.date) : '—'}</span></DialogDescription></div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end"><PermissionGate module="service_orders" action="edit">{onEdit && <Button size="sm" onClick={onEdit} className="h-9 gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</Button>}</PermissionGate><PermissionGate module="fiscal" action="create">{onPrepareFiscal && order.status !== 'cancelled' && <Button size="sm" variant="outline" onClick={onPrepareFiscal} disabled={isPreparingFiscal} className="h-9 gap-2"><FileCheck className="h-3.5 w-3.5" /> {isPreparingFiscal ? 'Preparando...' : 'Preparar NFS-e'}</Button>}</PermissionGate><PermissionGate module="service_orders" action="print"><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-9 gap-2"><Printer className="h-3.5 w-3.5" /><span>Imprimir</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72"><DropdownMenuLabel>Escolha a via de impressão</DropdownMenuLabel><DropdownMenuSeparator />{printOptions.map(({ variant, title, description, icon: Icon }) => <DropdownMenuItem key={variant} onSelect={() => handlePrint(variant)} className="items-start gap-3 p-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block whitespace-normal text-xs leading-relaxed text-muted-foreground">{description}</span></span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></PermissionGate>{onStatusChange && <PermissionGate module="service_orders" action="edit"><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-9 gap-2"><span className="hidden sm:inline">Alterar etapa</span><span className="sm:hidden">Etapa</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-[320px] sm:w-80"><DropdownMenuLabel>Etapa atual: {serviceOrderStatusLabel(order.status)}</DropdownMenuLabel><DropdownMenuSeparator />{SERVICE_ORDER_STATUS_OPTIONS.map((status) => <DropdownMenuItem key={status.id} disabled={status.id === order.status} onSelect={() => onStatusChange(status.id)} className="items-start gap-3 p-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary/70" /><span className="min-w-0"><span className="block text-sm font-semibold">{status.label}{status.id === order.status ? ' (atual)' : ''}</span><span className="mt-0.5 block whitespace-normal text-xs leading-relaxed text-muted-foreground">{status.description}</span></span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></PermissionGate>}<PermissionGate module="service_orders" action="delete">{onDelete && <Button size="sm" variant="ghost" onClick={onDelete} className="h-9 gap-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>}</PermissionGate></div>
        </div>
      </header>
      <div className="custom-scrollbar flex-1 space-y-3.5 overflow-y-auto p-4 sm:space-y-4 sm:p-5 lg:p-6">
        <section className="grid grid-cols-1 gap-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-sm sm:grid-cols-2 sm:p-4 xl:grid-cols-4"><DetailItem label="Cliente" value={order.customerName} icon={User} /><DetailItem label="Responsável" value={order.technicianName || order.technician?.name || 'Não atribuído'} icon={User} /><DetailItem label="Prazo estimado" value={order.estimatedDeadline || order.deliveryDate} icon={CalendarDays} /><DetailItem label="Saldo pendente" value={formatMoney(balance)} icon={WalletCards} tone={balance > 0 ? 'danger' : 'primary'} /></section>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.05fr_.95fr] lg:gap-4"><SectionCard title="Dados técnicos" icon={Package}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><DetailItem label="Produto cadastrado" value={order.product || order.productName} /><DetailItem label="Quantidade" value={order.productQuantity ? `${order.productQuantity} unidade(s)` : 'Não informada'} /><DetailItem label="Lentes" value={order.lens} /><DetailItem label="Laboratório" value={order.lab || order.laboratoryName || 'Próprio / não informado'} icon={FlaskConical} /><DetailItem label="Tipo de serviço" value={order.serviceType} /><DetailItem label="Previsão de entrega" value={order.deliveryDate || order.estimatedDeadline} icon={CalendarDays} /></div>{order.description && <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição do serviço</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{order.description}</p></div>}</SectionCard><SectionCard title="Resumo financeiro" icon={WalletCards}><div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3"><div className="rounded-lg bg-muted/30 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</p><p className="mt-1 text-base font-bold text-foreground sm:text-lg">{formatMoney(total)}</p></div><div className="rounded-lg bg-emerald-500/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Pago</p><p className="mt-1 text-base font-bold text-emerald-700 dark:text-emerald-300 sm:text-lg">{formatMoney(paid)}</p></div><div className="rounded-lg bg-destructive/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Saldo</p><p className="mt-1 text-base font-bold text-destructive sm:text-lg">{formatMoney(balance)}</p></div></div><Separator className="my-4" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><DetailItem label="Status financeiro" value={financialStatusLabels[String(order.financialStatus || '').toLowerCase()] || order.financialStatus || (balance <= 0 ? 'Pago' : paid > 0 ? 'Parcial' : 'Pendente')} /><DetailItem label="Forma de pagamento" value={paymentMethod} /><DetailItem label="Vencimento" value={order.dueDate} icon={CalendarDays} /><DetailItem label="Comentário" value={order.paymentNote || order.payment_note} /></div></SectionCard></div>
        <PrescriptionPanel order={order} />
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.05fr_.95fr] lg:gap-4"><Timeline order={order} /><SectionCard title="Observações e notas" icon={MessageSquareText}><div className="space-y-3"><div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observações do serviço</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{valueOrDash(order.description)}</p></div><div className="rounded-lg border border-border/60 bg-muted/20 p-3"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notas internas</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{valueOrDash(order.internalNotes || order.internal_notes)}</p></div></div></SectionCard></div>
      </div>
    </div>}
  </DialogContent></Dialog>;
}
