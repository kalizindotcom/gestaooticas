import { useMemo } from 'react';
import { Calendar, CreditCard, History, Receipt, User, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatMoney, useCustomerAppointments, useCustomerFinancials, useCustomerSales, useCustomerServiceOrders } from '@/hooks/useCustomerData';

export function HistoryTab({ customer }: { customer: any }) {
  const { data: sales = [], isLoading: salesLoading } = useCustomerSales(customer?.id);
  const { data: serviceOrders = [], isLoading: ordersLoading } = useCustomerServiceOrders(customer?.id);
  const { data: appointments = [], isLoading: appointmentsLoading } = useCustomerAppointments(customer?.id);
  const { data: financials, isLoading: financialsLoading } = useCustomerFinancials(customer?.id, customer?.name);
  const isLoading = salesLoading || ordersLoading || appointmentsLoading || financialsLoading;

  const timeline = useMemo(() => {
    const items: any[] = [];
    sales.forEach((sale: any) => items.push({ id: `sale-${sale.id}`, date: sale.date, action: 'Venda registrada', detail: `${sale.items?.length || 0} itens`, value: formatMoney(sale.total), icon: Receipt, color: 'text-emerald-500', bg: 'bg-emerald-50' }));
    serviceOrders.forEach((os: any) => items.push({ id: `os-${os.id}`, date: os.created_at || os.date, action: 'Ordem de serviço', detail: os.serviceType || os.description || 'O.S.', value: os.status, icon: Wrench, color: 'text-primary', bg: 'bg-primary/10' }));
    appointments.forEach((apt: any) => items.push({ id: `apt-${apt.id}`, date: `${apt.date}T${apt.time || '00:00'}`, action: 'Agendamento', detail: `${apt.type || 'Atendimento'} com ${apt.professional || 'profissional'}`, value: apt.status, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-500/10' }));
    (financials?.entries || []).forEach((entry: any) => {
      const received = entry.type === 'in' ? Number(entry.amount || 0) : Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0);
      const fullyPaid = entry.type === 'in' || entry.status === 'paid' || received >= Number(entry.amount || 0);
      const paymentNote = String(entry.payment_note || '').trim();
      const paymentDetail = received > 0 && !fullyPaid ? `${entry.description} • Recebido: ${formatMoney(received)}` : entry.description;
      items.push({ id: `fin-${entry.id}`, date: entry.payment_date || entry.due_date || entry.created_at, action: fullyPaid ? 'Pagamento recebido' : received > 0 ? 'Pagamento parcial' : 'Lançamento financeiro', detail: paymentNote ? `${paymentDetail} • Comentário: ${paymentNote}` : paymentDetail, value: received > 0 ? formatMoney(received) : formatMoney(entry.amount), icon: CreditCard, color: fullyPaid ? 'text-emerald-600' : received > 0 ? 'text-primary' : 'text-amber-600', bg: fullyPaid ? 'bg-emerald-500/10' : received > 0 ? 'bg-primary/10' : 'bg-amber-500/10' });
    });
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [sales, serviceOrders, appointments, financials]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground"><History className="h-5 w-5 text-muted-foreground" /> Histórico unificado</h3>
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">{timeline.length} eventos</Badge>
      </div>

      <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-border">
        {timeline.map((item) => (
          <div key={item.id} className="relative flex items-start gap-4 group">
            <div className={`z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background ${item.bg} shadow-sm transition-transform group-hover:scale-110`}><item.icon className={`h-4 w-4 ${item.color}`} /></div>
            <div className="flex-1 rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3"><span className="text-sm font-bold text-foreground">{item.action}</span><Badge variant="outline" className="max-w-[55%] truncate text-[9px] font-semibold">{item.value}</Badge></div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{formatDateTime(item.date)}</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4"><p className="text-xs font-medium text-muted-foreground">{item.detail}</p></div>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-muted-foreground"><User className="h-3 w-3" /> Origem: <span className="font-bold text-foreground">Sistema</span></div>
            </div>
          </div>
        ))}
        {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-muted" />}
        {!isLoading && timeline.length === 0 && <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-sm text-muted-foreground">Nenhum histórico encontrado para este cliente.</div>}
      </div>
    </div>
  );
}
