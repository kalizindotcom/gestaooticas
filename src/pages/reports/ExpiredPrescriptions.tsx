import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FilterBar } from '@/components/shared/premium/FilterBar';
import { KPICard } from '@/components/shared/KPICard';
import { DetailModal, DetailBlock, DetailItem } from '@/components/shared/premium/DetailModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Calendar, Clock, Phone, Store, UserCheck, Mail } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useServiceOrders, useStores } from '@/hooks/useLocalData';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { getScopedStoreOptions, isRecordInStoreScope } from '@/lib/reportScope';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';

type PrescriptionRow = {
  id: string;
  customer: string;
  phone: string;
  store: string;
  storeId: string;
  date: string;
  expiry: string;
  expiryDate: Date;
  status: 'overdue' | 'pending' | 'active';
  days: number;
  professional: string;
};

const formatDate = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

export default function ExpiredPrescriptions() {
  const { selectedStoreIds } = useGlobalFilter();
  const { data: serviceOrders = [], isLoading } = useServiceOrders();
  const { data: stores = [] } = useStores();
  const scopedStores = useMemo(() => getScopedStoreOptions(stores, selectedStoreIds), [stores, selectedStoreIds]);
  const [searchValue, setSearchValue] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedProfessional, setSelectedProfessional] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedItem, setSelectedItem] = useState<PrescriptionRow | null>(null);

  useEffect(() => {
    if (selectedStore !== 'all' && !selectedStoreIds.some((storeId) => String(storeId) === String(selectedStore))) setSelectedStore('all');
  }, [selectedStore, selectedStoreIds]);

  const prescriptions = useMemo<PrescriptionRow[]>(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return (serviceOrders as any[]).filter((order) => isRecordInStoreScope(order, selectedStoreIds)).flatMap((order) => {
      if (!order.prescriptionValidUntil) return [];
      const expiryDate = new Date(`${String(order.prescriptionValidUntil).slice(0, 10)}T12:00:00`);
      if (Number.isNaN(expiryDate.getTime())) return [];
      const days = Math.round((expiryDate.getTime() - today.getTime()) / 86400000);
      return [{
        id: String(order.id),
        customer: String(order.customerName || 'Cliente sem nome'),
        phone: String(order.customerPhone || ''),
        store: String((stores as any[]).find((store) => store.id === order.storeId)?.name || '—'),
        storeId: String(order.storeId || ''),
        date: String(order.prescriptionDate || order.date || ''),
        expiry: String(order.prescriptionValidUntil),
        expiryDate,
        status: days < 0 ? 'overdue' : days === 0 ? 'pending' : 'active',
        days,
        professional: String(order.technicianName || '—'),
      }];
    });
  }, [serviceOrders, stores, selectedStoreIds]);

  const filtered = useMemo(() => prescriptions.filter((item) => {
    if (selectedStore !== 'all' && item.storeId !== selectedStore) return false;
    if (selectedProfessional !== 'all' && item.professional !== selectedProfessional) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (dateRange?.from && item.expiryDate < dateRange.from) return false;
    if (dateRange?.to && item.expiryDate > new Date(dateRange.to.getTime() + 86400000 - 1)) return false;
    if (!searchValue) return true;
    const q = searchValue.toLowerCase();
    return `${item.customer} ${item.phone} ${item.store} ${item.professional}`.toLowerCase().includes(q);
  }), [dateRange, prescriptions, searchValue, selectedProfessional, selectedStatus, selectedStore]);

  const expired = filtered.filter((item) => item.status === 'overdue').length;
  const dueToday = filtered.filter((item) => item.days === 0).length;
  const dueWeek = filtered.filter((item) => item.days >= 0 && item.days <= 7).length;
  const professionals = Array.from(new Set(prescriptions.map((item) => item.professional).filter((name) => name !== '—'))).sort();

  if (isLoading) return <LoadingSpinner message="Carregando receitas..." />;

  return (
    <div className="space-y-8">
      <PageHeader title="Receitas Vencidas" description="Acompanhamento das validades informadas nas ordens de serviço" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Vencidas" value={expired} icon={Clock} />
        <KPICard title="Vencem Hoje" value={dueToday} icon={Calendar} />
        <KPICard title="Vencem em 7 Dias" value={dueWeek} icon={Calendar} />
        <KPICard title="Total Monitorado" value={filtered.length} icon={UserCheck} />
      </div>

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onClearFilters={() => { setSearchValue(''); setDateRange(undefined); setSelectedStore('all'); setSelectedProfessional('all'); setSelectedStatus('all'); }}
        onApplyFilters={() => {}}
        searchPlaceholder="Cliente, telefone ou profissional..."
      >
        <div className="space-y-1.5"><label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">Loja</label><Select value={selectedStore} onValueChange={setSelectedStore}><SelectTrigger className="h-10 rounded-xl border-border/50"><SelectValue placeholder="Todas as lojas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas selecionadas</SelectItem>{scopedStores.map((store: any) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">Profissional</label><Select value={selectedProfessional} onValueChange={setSelectedProfessional}><SelectTrigger className="h-10 rounded-xl border-border/50"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{professionals.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">Status</label><Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger className="h-10 rounded-xl border-border/50"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="overdue">Vencida</SelectItem><SelectItem value="pending">Vence hoje</SelectItem><SelectItem value="active">Em dia</SelectItem></SelectContent></Select></div>
      </FilterBar>

      <Card className="premium-shadow border-border/60 overflow-hidden"><CardContent className="p-0">
        {filtered.length === 0 ? <EmptyState icon={Clock} title="Nenhuma receita monitorada" description="Informe a data de validade da receita na O.S. para que ela apareça neste relatório." /> : <Table><TableHeader><TableRow className="hover:bg-transparent border-border/60 bg-muted/20"><TableHead>Cliente / Telefone</TableHead><TableHead>Profissional / Loja</TableHead><TableHead className="text-center">Data Receita</TableHead><TableHead className="text-center">Validade</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{filtered.map((item) => <TableRow key={item.id} className="cursor-pointer hover:bg-accent/30 transition-all border-border/40 group" onClick={() => setSelectedItem(item)}>
          <TableCell className="py-4"><div className="flex flex-col"><span className="text-[13px] font-semibold group-hover:text-primary transition-colors">{item.customer}</span>{item.phone && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone}</span>}</div></TableCell>
          <TableCell><div className="flex flex-col"><span className="text-[12px] font-medium">{item.professional}</span><span className="text-[11px] text-muted-foreground">{item.store}</span></div></TableCell>
          <TableCell className="text-center text-[12px]">{formatDate(item.date)}</TableCell>
          <TableCell className="text-center"><div className="flex flex-col items-center"><span className="text-[12px] font-bold">{formatDate(item.expiry)}</span><span className={cn('text-[10px] font-bold', item.days < 0 ? 'text-red-500' : item.days === 0 ? 'text-amber-500' : 'text-emerald-500')}>{item.days < 0 ? `Vencida há ${Math.abs(item.days)} dias` : item.days === 0 ? 'Vence hoje' : `Vence em ${item.days} dias`}</span></div></TableCell>
          <TableCell><StatusBadge status={item.status} /></TableCell>
          <TableCell onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-1">{item.phone && <a href={`tel:${item.phone}`} aria-label="Ligar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"><Phone className="h-3.5 w-3.5" /></a>}<a href={`mailto:?subject=Sua receita óptica&body=Olá, ${encodeURIComponent(item.customer)}. Sua receita óptica vence em ${formatDate(item.expiry)}.`} aria-label="Enviar e-mail" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"><Mail className="h-3.5 w-3.5" /></a></div></TableCell>
        </TableRow>)}</TableBody></Table>}
      </CardContent></Card>

      {selectedItem && <DetailModal open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)} title={`Receita: ${selectedItem.customer}`} status={selectedItem.status}>
        <DetailBlock title="Dados do Cliente" colSpan={6}><DetailItem label="Nome Completo" value={selectedItem.customer} icon={User} /><DetailItem label="Telefone" value={selectedItem.phone || 'Não informado'} icon={Phone} /><DetailItem label="Loja" value={selectedItem.store} icon={Store} /></DetailBlock>
        <DetailBlock title="Detalhes da Receita" colSpan={6}><DetailItem label="Profissional" value={selectedItem.professional} icon={User} /><DetailItem label="Data de Emissão" value={formatDate(selectedItem.date)} icon={Calendar} /><DetailItem label="Data de Vencimento" value={formatDate(selectedItem.expiry)} icon={Clock} /></DetailBlock>
        <DetailBlock title="Origem" colSpan={12}><DetailItem label="Ordem de Serviço" value={`#${selectedItem.id.slice(0, 8)}`} /><p className="text-xs text-muted-foreground">A validade exibida é a data registrada na ordem de serviço. Para renovar, edite a O.S. do cliente.</p></DetailBlock>
      </DetailModal>}
    </div>
  );
}
