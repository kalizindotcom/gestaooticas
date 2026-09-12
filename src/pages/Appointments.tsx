import { useMemo, useState } from 'react';
import {
  Plus, Search, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight,
  Users, Store as StoreIcon, MoreHorizontal, CheckCircle2, XCircle,
  AlertCircle, CalendarDays, User as UserIcon, Phone, Mail, MessageSquare,
  MapPin, ArrowRight, Loader2, Pencil, Trash2, UserCheck, Timer,
  CircleDot, RefreshCw, ClipboardCheck, UserRound, CalendarPlus, Filter, FilterX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { CustomerSelector } from '@/components/shared/CustomerSelector';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAppointments, useCustomers, useEmployees, useSales, useServiceOrders, useLocalMutation, useProfessionals } from '@/hooks/useLocalData';
import { cn } from '@/lib/utils';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const appointmentStatusMap: Record<string, { label: string; color: string; description: string }> = {
  scheduled: { label: 'Agendado', color: 'bg-primary', description: 'Aguardando confirmação do cliente.' },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-500', description: 'Cliente confirmou presença.' },
  waiting: { label: 'Aguardando', color: 'bg-amber-500', description: 'Cliente está aguardando atendimento.' },
  in_progress: { label: 'Em atendimento', color: 'bg-violet-500', description: 'Atendimento em andamento.' },
  completed: { label: 'Concluído', color: 'bg-teal-500', description: 'Atendimento finalizado.' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive', description: 'Horário cancelado.' },
  no_show: { label: 'Não compareceu', color: 'bg-muted-foreground', description: 'Cliente não compareceu.' },
  rescheduled: { label: 'Reagendado', color: 'bg-orange-500', description: 'Horário foi remarcado.' },
};

const statusCardColors: Record<string, string> = {
  scheduled: 'border-l-primary bg-primary/5 hover:bg-primary/10',
  confirmed: 'border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10',
  waiting: 'border-l-amber-500 bg-amber-500/5 hover:bg-amber-500/10',
  in_progress: 'border-l-violet-500 bg-violet-500/5 hover:bg-violet-500/10',
  completed: 'border-l-teal-500 bg-teal-500/5 hover:bg-teal-500/10',
  cancelled: 'border-l-destructive bg-destructive/5 opacity-70 hover:bg-destructive/10',
  no_show: 'border-l-muted-foreground bg-muted/50 opacity-70 hover:bg-muted',
  rescheduled: 'border-l-orange-500 bg-orange-500/5 hover:bg-orange-500/10',
};

const statusDotColors: Record<string, string> = {
  scheduled: 'bg-primary',
  confirmed: 'bg-emerald-500',
  waiting: 'bg-amber-500',
  in_progress: 'bg-violet-500',
  completed: 'bg-teal-500',
  cancelled: 'bg-destructive',
  no_show: 'bg-muted-foreground',
  rescheduled: 'bg-orange-500',
};

const timeSlots = Array.from({ length: (18 - 8) * 4 + 1 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 15;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
});

const appointmentTypes = ['Consulta', 'Retorno', 'Avaliação', 'Entrega', 'Ajuste', 'Outro'];

function safeDate(date?: string | null) {
  if (!date) return null;
  try {
    return parseISO(date);
  } catch {
    return null;
  }
}

function displayDate(date?: string | null, pattern = 'dd/MM/yyyy') {
  const parsed = safeDate(date);
  return parsed ? format(parsed, pattern, { locale: ptBR }) : '—';
}

function storeLabel(name?: string | null) {
  if (!name) return 'Unidade não informada';
  return name.includes(' - ') ? name.split(' - ')[1] : name;
}

function initials(name?: string | null) {
  return (name || 'Cliente')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function money(value: unknown) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function appointmentStatusLabel(status?: string | null) {
  return appointmentStatusMap[String(status || '')]?.label || 'Sem status';
}

export default function Appointments() {
  const { selectedStoreIds, selectedCompanyId, stores } = useGlobalFilter();
  const { hasPermission } = usePermissions();
  const { data: appointments = [], isLoading: loadingApts } = useAppointments();
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();
  const { data: professionalsDb = [] } = useProfessionals();
  const { data: sales = [] } = useSales();
  const { data: serviceOrders = [] } = useServiceOrders();
  const appointmentMutation = useLocalMutation('appointments', [['appointments']]);

  const canCreate = hasPermission('appointments', 'create');
  const canEdit = hasPermission('appointments', 'edit');
  const canDelete = hasPermission('appointments', 'delete');

  const allProfessionals = useMemo(() => {
    const fromProfessionals = professionalsDb
      .filter((professional: any) => professional?.name)
      .map((professional: any) => ({ id: professional.id, name: professional.name, specialty: professional.specialty }));
    const fromEmployees = employees
      .filter((employee: any) => employee?.name)
      .map((employee: any) => ({ id: employee.id, name: employee.name, specialty: employee.role }));
    const names = new Set(fromProfessionals.map((professional: any) => professional.name));
    return [...fromProfessionals, ...fromEmployees.filter((employee: any) => !names.has(employee.name))];
  }, [professionalsDb, employees]);

  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [selectedApt, setSelectedApt] = useState<any | null>(null);
  const [storeFilter, setStoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [profFilter, setProfFilter] = useState('all');
  const [draggingAptId, setDraggingAptId] = useState<string | null>(null);

  const [isAptDialogOpen, setIsAptDialogOpen] = useState(false);
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [newAptData, setNewAptData] = useState({
    customerId: '',
    guestName: '',
    storeId: selectedStoreIds[0] || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
    professional: '',
    type: 'Consulta',
    notes: '',
  });

  const openNewApt = (date: Date, time = '08:00') => {
    setEditingAptId(null);
    setGuestMode(false);
    setNewAptData({
      customerId: '',
      guestName: '',
      storeId: selectedStoreIds[0] || stores[0]?.id || '',
      date: format(date, 'yyyy-MM-dd'),
      time,
      professional: '',
      type: 'Consulta',
      notes: '',
    });
    setIsAptDialogOpen(true);
  };

  const openEditApt = (appointment: any) => {
    setEditingAptId(appointment.id);
    setGuestMode(Boolean(appointment.isGuest || !appointment.customerId));
    setNewAptData({
      customerId: appointment.customerId || '',
      guestName: appointment.isGuest ? appointment.customerName || '' : '',
      storeId: appointment.storeId || selectedStoreIds[0] || stores[0]?.id || '',
      date: appointment.date || format(new Date(), 'yyyy-MM-dd'),
      time: appointment.time || '08:00',
      professional: appointment.professional || '',
      type: appointment.type || 'Consulta',
      notes: appointment.notes || '',
    });
    setSelectedApt(null);
    setIsAptDialogOpen(true);
  };

  const handleSaveApt = async () => {
    if (!selectedCompanyId || !newAptData.storeId) {
      toast.error('Selecione a empresa e a unidade do atendimento.');
      return;
    }
    if (guestMode && !newAptData.guestName.trim()) {
      toast.error('Informe o nome do visitante.');
      return;
    }
    if (!guestMode && !newAptData.customerId) {
      toast.error('Selecione um cliente ou use a opção visitante.');
      return;
    }
    if (!newAptData.professional) {
      toast.error('Selecione um profissional.');
      return;
    }

    const currentStatus = editingAptId
      ? appointments.find((appointment: any) => appointment.id === editingAptId)?.status || 'scheduled'
      : 'scheduled';
    const payload: any = {
      company_id: selectedCompanyId,
      store_id: newAptData.storeId,
      date: newAptData.date,
      time: newAptData.time,
      professional_name: newAptData.professional,
      type: newAptData.type,
      notes: newAptData.notes.trim(),
      status: currentStatus,
      customer_id: guestMode ? null : newAptData.customerId,
      guest_name: guestMode ? newAptData.guestName.trim() : null,
    };

    try {
      const saved = await appointmentMutation.mutateAsync({
        action: editingAptId ? 'update' : 'insert',
        id: editingAptId || undefined,
        data: payload,
      });
      const savedAppointment = Array.isArray(saved) ? saved[0] : saved;
      if (editingAptId) {
        setSelectedApt((previous: any) => previous?.id === editingAptId ? {
          ...previous,
          ...payload,
          customerId: payload.customer_id,
          customerName: guestMode ? payload.guest_name : customers.find((customer: any) => customer.id === payload.customer_id)?.name || previous.customerName,
          professional: payload.professional_name,
          storeId: payload.store_id,
          time: payload.time,
          isGuest: guestMode,
        } : previous);
      }
      toast.success(editingAptId ? 'Agendamento atualizado com sucesso.' : 'Agendamento criado com sucesso.');
      setIsAptDialogOpen(false);
      setEditingAptId(null);
      setGuestMode(false);
      if (savedAppointment && !editingAptId) setSelectedApt(null);
    } catch (error: any) {
      toast.error(`Não foi possível salvar o agendamento: ${error?.message || 'tente novamente.'}`);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!canEdit) {
      toast.error('Você não tem permissão para alterar agendamentos.');
      return;
    }
    const appointment = appointments.find((item: any) => item.id === id);
    if (appointment?.status === newStatus) return;
    try {
      await appointmentMutation.mutateAsync({ action: 'update', id, data: { status: newStatus } });
      setSelectedApt((previous: any) => previous?.id === id ? { ...previous, status: newStatus } : previous);
      toast.success(`Status atualizado para ${appointmentStatusLabel(newStatus)}.`);
    } catch (error: any) {
      toast.error(`Erro ao atualizar status: ${error?.message || 'tente novamente.'}`);
    }
  };

  const handleDeleteApt = async (appointment: any) => {
    if (!canDelete) {
      toast.error('Você não tem permissão para excluir agendamentos.');
      return;
    }
    if (!window.confirm(`Excluir o agendamento de ${appointment.customerName || 'cliente'}?`)) return;
    try {
      await appointmentMutation.mutateAsync({ action: 'delete', id: appointment.id });
      setSelectedApt(null);
      toast.success('Agendamento excluído.');
    } catch (error: any) {
      toast.error(`Erro ao excluir agendamento: ${error?.message || 'tente novamente.'}`);
    }
  };

  const openWhatsApp = (appointment: any) => {
    const customer = customers.find((item: any) => item.id === appointment.customerId);
    const phone = String(customer?.phone || customer?.whatsapp || appointment.phone || '').replace(/\D/g, '');
    if (!phone) {
      toast.info('Este cliente não possui WhatsApp cadastrado.');
      return;
    }
    const message = encodeURIComponent(`Olá ${appointment.customerName}, confirmando seu agendamento para ${displayDate(appointment.date)} às ${appointment.time}.`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  const handleDragStart = (event: any, appointment: any) => {
    if (!canEdit) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', appointment.id);
    setDraggingAptId(appointment.id);
  };

  const handleDrop = async (date: Date, time: string) => {
    if (!canEdit || !draggingAptId) return;
    const appointment = appointments.find((item: any) => item.id === draggingAptId);
    setDraggingAptId(null);
    if (!appointment || (appointment.date === format(date, 'yyyy-MM-dd') && appointment.time === time)) return;
    try {
      await appointmentMutation.mutateAsync({ action: 'update', id: appointment.id, data: { date: format(date, 'yyyy-MM-dd'), time } });
      setSelectedApt((previous: any) => previous?.id === appointment.id ? { ...previous, date: format(date, 'yyyy-MM-dd'), time } : previous);
      toast.success(`Agendamento reagendado para ${displayDate(format(date, 'yyyy-MM-dd'))} às ${time}.`);
    } catch (error: any) {
      toast.error(`Não foi possível reagendar: ${error?.message || 'tente novamente.'}`);
    }
  };

  const filtered = useMemo(() => appointments.filter((appointment: any) => {
    const searchable = [appointment.customerName, appointment.phone, appointment.professional, appointment.type, appointment.notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = !search || searchable.includes(search.toLowerCase());
    const matchesStore = storeFilter === 'all' || appointment.storeId === storeFilter;
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    const matchesProf = profFilter === 'all' || appointment.professional === profFilter;
    return matchesSearch && matchesStore && matchesStatus && matchesProf;
  }), [appointments, search, storeFilter, statusFilter, profFilter]);

  const conflicts = useMemo(() => {
    const result: { apt1: any; apt2: any; reason: string }[] = [];
    const active = appointments.filter((appointment: any) => !['cancelled', 'no_show'].includes(appointment.status));
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        const first = active[i];
        const second = active[j];
        if (first.date !== second.date || first.time !== second.time) continue;
        if (first.professional && second.professional && first.professional === second.professional) {
          result.push({ apt1: first, apt2: second, reason: `Profissional “${first.professional}” com dois horários simultâneos.` });
        } else if (first.storeId === second.storeId && !first.professional && !second.professional) {
          result.push({ apt1: first, apt2: second, reason: 'Mesma unidade e horário sem profissional definido.' });
        }
      }
    }
    return result;
  }, [appointments]);

  const weekDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: endOfWeek(currentDate, { weekStartsOn: 1 }),
  }), [currentDate]);
  const monthDays = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }), [currentDate]);
  const monthPadding = (startOfMonth(currentDate).getDay() + 6) % 7;
  const dayAppointments = useMemo(() => filtered.filter((appointment: any) => isSameDay(safeDate(appointment.date) || new Date(0), currentDate)), [filtered, currentDate]);
  const stats = useMemo(() => ({
    total: dayAppointments.length,
    confirmed: dayAppointments.filter((appointment: any) => appointment.status === 'confirmed').length,
    waiting: dayAppointments.filter((appointment: any) => ['scheduled', 'waiting'].includes(appointment.status)).length,
    inProgress: dayAppointments.filter((appointment: any) => appointment.status === 'in_progress').length,
  }), [dayAppointments]);

  const handlePrev = () => {
    if (view === 'day') setCurrentDate((previous) => subDays(previous, 1));
    else if (view === 'week') setCurrentDate((previous) => subDays(previous, 7));
    else setCurrentDate((previous) => subMonths(previous, 1));
  };

  const handleNext = () => {
    if (view === 'day') setCurrentDate((previous) => addDays(previous, 1));
    else if (view === 'week') setCurrentDate((previous) => addDays(previous, 7));
    else setCurrentDate((previous) => addMonths(previous, 1));
  };

  const getCustomerHistory = (customerId: string) => ({
    sales: sales.filter((sale: any) => sale.customerId === customerId),
    os: serviceOrders.filter((order: any) => order.customerId === customerId),
  });

  const clearFilters = () => {
    setSearch('');
    setStoreFilter('all');
    setStatusFilter('all');
    setProfFilter('all');
  };

  if (loadingApts || loadingCustomers || loadingEmployees) {
    return <div className="flex h-full w-full items-center justify-center p-20"><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>;
  }

  const currentDateLabel = view === 'day'
    ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : view === 'week'
      ? `${format(weekDays[0], 'dd/MM')} – ${format(weekDays[6], 'dd/MM/yyyy')}`
      : format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="min-w-0 space-y-5 pb-8 sm:space-y-6 sm:pb-10">
      <PageHeader
        title="Agendamentos"
        description="Organize a agenda da equipe, acompanhe o atendimento e reduza conflitos de horário."
        actions={canCreate ? (
          <Button onClick={() => openNewApt(currentDate)} className="h-10 w-full gap-2 shadow-sm sm:w-auto">
            <CalendarPlus className="h-4 w-4" /> Novo agendamento
          </Button>
        ) : undefined}
      />

      <FinancialInfoTip className="px-3 py-2.5" title="Dica da agenda"><span className="sm:hidden">Use Dia, Semana e Mês para planejar. Toque em um horário para abrir ou editar.</span><span className="hidden sm:inline">Use as visões Dia, Semana e Mês para planejar a operação. Arraste um horário para reagendar e revise os conflitos antes de confirmar o atendimento.</span></FinancialInfoTip>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {[
          { label: 'Na agenda', value: stats.total, helper: 'horários no dia', icon: CalendarDays, tone: 'text-primary bg-primary/10' },
          { label: 'Confirmados', value: stats.confirmed, helper: 'presenças confirmadas', icon: UserCheck, tone: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Pendentes', value: stats.waiting, helper: 'aguardando confirmação', icon: Timer, tone: 'text-amber-600 bg-amber-500/10' },
          { label: 'Em atendimento', value: stats.inProgress, helper: 'atendimentos em curso', icon: CircleDot, tone: 'text-violet-600 bg-violet-500/10' },
        ].map((item) => (
          <Card key={item.label} className="border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-2.5 p-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', item.tone)}><item.icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><div className="flex min-w-0 items-baseline gap-2"><p className="shrink-0 text-xl font-bold leading-none text-foreground">{item.value}</p><p className="truncate text-[11px] font-semibold leading-tight text-foreground">{item.label}</p></div><p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground">{item.helper}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="p-2.5 sm:p-3">
          <div className="grid min-w-0 grid-cols-1 items-center gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_minmax(155px,1fr)_minmax(180px,1.1fr)_minmax(145px,1fr)_auto_auto]">
            <div className="relative min-w-0 md:col-span-2 xl:col-span-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, telefone ou profissional..." className="h-9 w-full pl-8 text-xs" /></div>
            <Select value={storeFilter} onValueChange={setStoreFilter}><SelectTrigger className="h-9 w-full min-w-0 text-xs"><StoreIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><SelectValue placeholder="Todas as lojas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{stores.map((store: any) => <SelectItem key={store.id} value={store.id}>{storeLabel(store.name)}</SelectItem>)}</SelectContent></Select>
            <Select value={profFilter} onValueChange={setProfFilter}><SelectTrigger className="h-9 w-full min-w-0 text-xs"><UserRound className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><SelectValue placeholder="Todos os profissionais" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os profissionais</SelectItem>{allProfessionals.map((professional: any) => <SelectItem key={professional.id} value={professional.name}>{professional.name}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-9 w-full min-w-0 text-xs"><CircleDot className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(appointmentStatusMap).map(([key, meta]) => <SelectItem key={key} value={key}>{meta.label}</SelectItem>)}</SelectContent></Select>
            <div className="flex items-center gap-1.5 md:justify-self-end"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={() => setConflictsOpen(true)} className={cn('relative h-9 w-9 shrink-0', conflicts.length > 0 && 'border-destructive/50 text-destructive')}><AlertCircle className="h-3.5 w-3.5" />{conflicts.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{conflicts.length}</span>}</Button></TooltipTrigger><TooltipContent>{conflicts.length ? `${conflicts.length} conflito(s) encontrado(s)` : 'Verificar conflitos'}</TooltipContent></Tooltip></TooltipProvider>{(search || storeFilter !== 'all' || statusFilter !== 'all' || profFilter !== 'all') && <Button variant="ghost" size="icon" onClick={clearFilters} className="h-9 w-9 shrink-0" title="Limpar filtros"><FilterX className="h-3.5 w-3.5" /></Button>}</div>
            <div className="flex min-h-9 items-center gap-1.5 whitespace-nowrap px-1 text-[11px] leading-none text-muted-foreground md:col-span-2 xl:col-span-1 xl:justify-self-end"><Filter className="h-3 w-3 shrink-0" /><span>{filtered.length} agendamento(s) encontrado(s)</span>{conflicts.length > 0 && <><span className="text-border">•</span><button type="button" className="font-semibold text-destructive hover:underline" onClick={() => setConflictsOpen(true)}>{conflicts.length} conflito(s) para revisar</button></>}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-1 rounded-xl border border-border/70 bg-card p-1 shadow-sm sm:justify-start sm:gap-2"><Button aria-label="Dia anterior" variant="ghost" size="icon" onClick={handlePrev} className="h-9 w-9 shrink-0"><ChevronLeft className="h-4 w-4" /></Button><div className="min-w-0 flex-1 px-1 text-center sm:min-w-[205px] sm:px-3"><p className="truncate text-sm font-bold capitalize text-foreground">{currentDateLabel}</p>{view === 'day' && <p className="truncate text-[11px] text-muted-foreground">{stats.total} horário(s) programado(s)</p>}</div><Button aria-label="Próximo dia" variant="ghost" size="icon" onClick={handleNext} className="h-9 w-9 shrink-0"><ChevronRight className="h-4 w-4" /></Button><Separator orientation="vertical" className="mx-0.5 h-6 sm:mx-1" /><Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8 shrink-0 gap-1.5 px-2 text-xs font-semibold text-primary sm:px-3"><RefreshCw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Hoje</span></Button></div>
        <Tabs value={view} onValueChange={(value: string) => setView(value as 'day' | 'week' | 'month')} className="w-full sm:w-auto"><TabsList className="grid h-10 w-full grid-cols-3 border border-border/70 bg-card p-1 sm:flex sm:w-auto"><TabsTrigger value="day" className="h-8 gap-1.5 px-2 text-xs sm:px-3"><Clock className="h-3.5 w-3.5" /> Dia</TabsTrigger><TabsTrigger value="week" className="h-8 gap-1.5 px-2 text-xs sm:px-3"><CalendarDays className="h-3.5 w-3.5" /> Semana</TabsTrigger><TabsTrigger value="month" className="h-8 gap-1.5 px-2 text-xs sm:px-3"><CalendarIcon className="h-3.5 w-3.5" /> Mês</TabsTrigger></TabsList></Tabs>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 bg-muted/20 px-3 py-3 sm:px-5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><CardTitle className="text-sm">{view === 'day' ? 'Linha do tempo do dia' : view === 'week' ? 'Visão semanal' : 'Calendário mensal'}</CardTitle><CardDescription className="mt-0.5 text-xs"><span className="sm:hidden">Toque em um horário para criar ou abrir.</span><span className="hidden sm:inline">Clique em um espaço vazio para criar. Arraste um agendamento para reagendar.</span></CardDescription></div><Badge variant="outline" className="hidden shrink-0 gap-1.5 sm:flex"><ClipboardCheck className="h-3.5 w-3.5 text-primary" /> Agenda operacional</Badge></div></CardHeader>
          <CardContent className="p-0">
            {view === 'day' && <div className="divide-y divide-border/60 bg-card">{timeSlots.map((slot) => { const slotApps = dayAppointments.filter((appointment: any) => appointment.time === slot); const isHour = slot.endsWith(':00'); return <div key={slot} className={cn('group flex min-h-[29px]', isHour && 'min-h-[52px]')}><div className={cn('w-[70px] shrink-0 border-r border-border/60 bg-muted/20 px-3 pt-1.5 text-right', isHour ? 'text-muted-foreground' : 'text-muted-foreground/40')}><span className={cn('text-[10px] font-semibold', !isHour && 'opacity-60')}>{slot}</span></div><div className="relative flex min-h-full flex-1 flex-wrap gap-2 p-1.5" onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(currentDate, slot)} onClick={() => slotApps.length === 0 && canCreate && openNewApt(currentDate, slot)}>{slotApps.length === 0 && canCreate && <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"><span className="rounded-md border border-dashed border-primary/40 px-2 py-1 text-[10px] font-medium text-primary">Clique para agendar</span></div>}{slotApps.map((appointment: any) => <AppointmentCard key={appointment.id} appointment={appointment} canEdit={canEdit} canDelete={canDelete} dragging={draggingAptId === appointment.id} onDragStart={handleDragStart} onDragEnd={() => setDraggingAptId(null)} onSelect={() => setSelectedApt(appointment)} onEdit={() => openEditApt(appointment)} onDelete={() => handleDeleteApt(appointment)} onStatusChange={handleUpdateStatus} onWhatsApp={() => openWhatsApp(appointment)} />)}</div></div>; })}</div>}

            {view === 'week' && <div className="overflow-x-auto"><div className="min-w-[920px]"><div className="grid grid-cols-8 border-b border-border/70 bg-muted/20"><div className="w-[70px] border-r border-border/60" />{weekDays.map((day) => <div key={day.toISOString()} className={cn('border-r border-border/60 p-3 text-center last:border-r-0', isSameDay(day, new Date()) && 'bg-primary/5')}><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{format(day, 'EEE', { locale: ptBR })}</p><p className={cn('mt-1 text-lg font-bold', isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground')}>{format(day, 'dd')}</p></div>)}</div><ScrollArea className="h-[630px]"><div className="grid grid-cols-8 divide-x divide-border/60"><div className="divide-y divide-border/40 bg-muted/10">{timeSlots.map((slot) => <div key={slot} className={cn('w-[70px] px-2 text-right text-[9px] text-muted-foreground/60', slot.endsWith(':00') ? 'h-[52px] pt-1.5 font-semibold' : 'h-[29px] pt-1')}>{slot}</div>)}</div>{weekDays.map((day) => <div key={day.toISOString()} className="divide-y divide-border/40">{timeSlots.map((slot) => { const slotApps = filtered.filter((appointment: any) => appointment.time === slot && isSameDay(safeDate(appointment.date) || new Date(0), day)); return <div key={slot} className={cn('group relative p-1 transition-colors hover:bg-primary/5', slot.endsWith(':00') ? 'h-[52px]' : 'h-[29px]')} onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(day, slot)} onClick={() => slotApps.length === 0 && canCreate && openNewApt(day, slot)}>{slotApps.map((appointment: any) => <MiniAppointmentCard key={appointment.id} appointment={appointment} dragging={draggingAptId === appointment.id} canEdit={canEdit} onDragStart={handleDragStart} onDragEnd={() => setDraggingAptId(null)} onSelect={() => setSelectedApt(appointment)} />)}</div>; })}</div>)}</div></ScrollArea></div></div>}

            {view === 'month' && <div className="p-2 sm:p-4"><div className="grid grid-cols-7 border-b border-border/60 pb-1 sm:pb-2">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <div key={day} className="py-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:py-2 sm:text-[10px]">{day}</div>)}</div><div className="grid grid-cols-7 gap-1 pt-1.5 sm:gap-1.5 sm:pt-2">{Array.from({ length: monthPadding }).map((_, index) => <div key={`empty-${index}`} className="min-h-[80px] rounded-lg bg-muted/10 sm:min-h-[116px]" />)}{monthDays.map((day) => { const dayApps = filtered.filter((appointment: any) => isSameDay(safeDate(appointment.date) || new Date(0), day)); return <div key={day.toISOString()} className={cn('group min-h-[80px] cursor-pointer rounded-lg border border-border/60 bg-card p-1 transition-colors hover:border-primary/40 hover:bg-primary/[0.02] sm:min-h-[116px] sm:rounded-xl sm:p-2', isSameDay(day, new Date()) && 'border-primary/40 bg-primary/[0.03]')} onClick={() => dayApps.length === 0 && canCreate && openNewApt(day)}>{<div className="mb-1 flex items-center justify-between sm:mb-2"><span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs', isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{format(day, 'd')}</span>{dayApps.length > 0 && <span className="text-[8px] font-semibold text-muted-foreground sm:text-[9px]">{dayApps.length} ag.</span>}</div>}<div className="space-y-1">{dayApps.slice(0, 3).map((appointment: any) => <MiniAppointmentCard key={appointment.id} appointment={appointment} dragging={draggingAptId === appointment.id} canEdit={canEdit} onDragStart={handleDragStart} onDragEnd={() => setDraggingAptId(null)} onSelect={() => setSelectedApt(appointment)} compact />)}{dayApps.length > 3 && <p className="pt-1 text-center text-[9px] font-semibold text-muted-foreground">+{dayApps.length - 3} mais</p>}</div></div>; })}</div></div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 shadow-sm"><CardHeader className="border-b border-border/60 px-4 py-3"><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-primary" /> Ocupação por unidade</CardTitle><CardDescription className="text-xs">Volume de horários na data selecionada.</CardDescription></CardHeader><CardContent className="space-y-4 p-4">{stores.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma unidade disponível.</p> : stores.map((store: any) => { const count = appointments.filter((appointment: any) => appointment.storeId === store.id && isSameDay(safeDate(appointment.date) || new Date(0), currentDate) && appointment.status !== 'cancelled').length; const pct = Math.min((count / 12) * 100, 100); return <div key={store.id} className="space-y-1.5"><div className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold text-foreground">{storeLabel(store.name)}</span><span className="shrink-0 text-muted-foreground">{count}/12</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-all', pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} /></div></div>; })}</CardContent></Card>
          <Card className="border-border/70 shadow-sm"><CardHeader className="border-b border-border/60 px-4 py-3"><CardTitle className="text-sm">Próximos horários</CardTitle><CardDescription className="text-xs">Compromissos da data selecionada.</CardDescription></CardHeader><CardContent className="space-y-2 p-3">{dayAppointments.length === 0 ? <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center"><CalendarDays className="mx-auto mb-2 h-5 w-5 text-muted-foreground" /><p className="text-xs font-semibold text-muted-foreground">Nenhum agendamento neste dia.</p>{canCreate && <Button variant="link" size="sm" onClick={() => openNewApt(currentDate)} className="mt-1 h-auto p-0 text-xs">Criar horário</Button>}</div> : dayAppointments.slice().sort((a: any, b: any) => String(a.time).localeCompare(String(b.time))).slice(0, 5).map((appointment: any) => <button type="button" key={appointment.id} onClick={() => setSelectedApt(appointment)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted/60"><span className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border/60 bg-muted/20"><span className="text-[11px] font-bold text-foreground">{appointment.time}</span><span className="text-[8px] text-muted-foreground">horário</span></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-foreground">{appointment.customerName}</span><span className="block truncate text-[10px] text-muted-foreground">{appointment.type || 'Atendimento'} · {appointment.professional || 'Sem profissional'}</span></span><span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotColors[appointment.status] || 'bg-primary')} /></button>)}</CardContent></Card>
          <Card className={cn('border-border/70 shadow-sm', conflicts.length > 0 ? 'border-destructive/30 bg-destructive/[0.03]' : 'bg-primary/[0.03]')}><CardContent className="flex items-start gap-3 p-4"><div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', conflicts.length > 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>{conflicts.length > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</div><div className="min-w-0"><p className="text-xs font-bold text-foreground">{conflicts.length > 0 ? 'Atenção à agenda' : 'Agenda organizada'}</p><p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{conflicts.length > 0 ? `${conflicts.length} conflito(s) de horário precisam de revisão.` : 'Nenhum conflito de profissional ou unidade foi detectado.'}</p>{conflicts.length > 0 && <Button variant="link" size="sm" onClick={() => setConflictsOpen(true)} className="mt-1 h-auto p-0 text-xs text-destructive">Revisar conflitos</Button>}</div></CardContent></Card>
        </div>
      </div>

      <Dialog open={isAptDialogOpen} onOpenChange={(open) => { setIsAptDialogOpen(open); if (!open) setEditingAptId(null); }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-primary" />{editingAptId ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle><DialogDescription>{editingAptId ? 'Atualize os dados e o horário deste atendimento.' : 'Cadastre um horário para cliente ou visitante.'}</DialogDescription></DialogHeader><div className="space-y-5 py-2"><div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label>Cliente</Label><button type="button" onClick={() => setGuestMode((previous) => !previous)} className="text-xs font-semibold text-primary hover:underline">{guestMode ? 'Selecionar cliente' : 'Agendar como visitante'}</button></div>{guestMode ? <Input autoFocus value={newAptData.guestName} onChange={(event) => setNewAptData((previous) => ({ ...previous, guestName: event.target.value }))} placeholder="Nome do visitante" /> : <CustomerSelector customers={customers} value={newAptData.customerId} onValueChange={(value) => setNewAptData((previous) => ({ ...previous, customerId: value }))} />}</div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Unidade</Label><Select value={newAptData.storeId} onValueChange={(value) => setNewAptData((previous) => ({ ...previous, storeId: value }))}><SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger><SelectContent>{stores.map((store: any) => <SelectItem key={store.id} value={store.id}>{storeLabel(store.name)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Profissional</Label><Select value={newAptData.professional} onValueChange={(value) => setNewAptData((previous) => ({ ...previous, professional: value }))}><SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger><SelectContent>{allProfessionals.map((professional: any) => <SelectItem key={professional.id} value={professional.name}>{professional.name}{professional.specialty ? ` · ${professional.specialty}` : ''}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="space-y-2 sm:col-span-1"><Label>Data</Label><Input type="date" value={newAptData.date} onChange={(event) => setNewAptData((previous) => ({ ...previous, date: event.target.value }))} /></div><div className="space-y-2 sm:col-span-1"><Label>Horário</Label><Select value={newAptData.time} onValueChange={(value) => setNewAptData((previous) => ({ ...previous, time: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{timeSlots.map((slot) => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2 sm:col-span-1"><Label>Tipo</Label><Select value={appointmentTypes.includes(newAptData.type) ? newAptData.type : 'Outro'} onValueChange={(value) => setNewAptData((previous) => ({ ...previous, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{appointmentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>Observações</Label><Textarea value={newAptData.notes} onChange={(event) => setNewAptData((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Preferências, orientações ou observações importantes..." rows={4} /></div></div><DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={handleSaveApt} disabled={appointmentMutation.isPending} className="gap-2">{appointmentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{editingAptId ? 'Salvar alterações' : 'Agendar'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}><DialogContent className="sm:max-w-[560px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Conflitos de agenda</DialogTitle><DialogDescription>{conflicts.length ? 'Revise horários sobrepostos antes de confirmar a operação.' : 'A agenda atual não possui conflitos detectados.'}</DialogDescription></DialogHeader><div className="max-h-[430px] space-y-3 overflow-y-auto py-1">{conflicts.length === 0 ? <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center"><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" /><p className="text-sm font-semibold">Agenda sem conflitos</p></div> : conflicts.map((conflict, index) => <div key={`${conflict.apt1.id}-${conflict.apt2.id}-${index}`} className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/[0.03] p-3.5"><p className="text-xs font-semibold text-destructive">{conflict.reason}</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{[conflict.apt1, conflict.apt2].map((appointment: any) => <button type="button" key={appointment.id} onClick={() => { setSelectedApt(appointment); setConflictsOpen(false); }} className="rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:border-primary/40"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold">{appointment.customerName}</span><span className="text-[10px] font-semibold text-primary">{appointment.time}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{displayDate(appointment.date)} · {storeLabel(appointment.storeName)}</p><StatusBadge status={appointment.status} /></button>)}</div></div>)}</div><DialogFooter><Button variant="outline" onClick={() => setConflictsOpen(false)}>Fechar</Button></DialogFooter></DialogContent></Dialog>

      <Sheet open={Boolean(selectedApt)} onOpenChange={(open) => { if (!open) setSelectedApt(null); }}><SheetContent className="w-full border-border/70 bg-background p-0 sm:max-w-[520px]"><SheetHeader className="sr-only"><SheetTitle>{selectedApt?.customerName || 'Agendamento'}</SheetTitle><SheetDescription>Detalhes e ações do agendamento</SheetDescription></SheetHeader>{selectedApt && <AppointmentDetails appointment={selectedApt} customers={customers} sales={sales} serviceOrders={serviceOrders} canEdit={canEdit} canDelete={canDelete} onEdit={() => openEditApt(selectedApt)} onDelete={() => handleDeleteApt(selectedApt)} onStatusChange={handleUpdateStatus} onWhatsApp={() => openWhatsApp(selectedApt)} getCustomerHistory={getCustomerHistory} />}</SheetContent></Sheet>
    </div>
  );
}

function AppointmentCard({ appointment, canEdit, canDelete, dragging, onDragStart, onDragEnd, onSelect, onEdit, onDelete, onStatusChange, onWhatsApp }: any) {
  return <div draggable={canEdit} onDragStart={(event) => onDragStart(event, appointment)} onDragEnd={onDragEnd} onClick={onSelect} className={cn('group relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-xl border border-border/70 border-l-4 p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-w-[210px] sm:p-3', statusCardColors[appointment.status] || 'border-l-primary bg-primary/5', dragging && 'opacity-50')}><div className="flex items-start justify-between gap-2 pr-8"><div className="flex min-w-0 items-center gap-1.5"><span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotColors[appointment.status] || 'bg-primary')} /><span className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{appointmentStatusLabel(appointment.status)}</span></div>{appointment.type && <Badge variant="outline" className="shrink-0 bg-background/80 px-1.5 text-[9px]">{appointment.type}</Badge>}</div><div className="mt-2 flex items-center justify-between gap-2"><p className="truncate text-sm font-bold text-foreground">{appointment.customerName || 'Visitante'}</p>{appointment.isGuest && <Badge variant="secondary" className="shrink-0 px-1.5 text-[9px]">Visitante</Badge>}</div><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-muted-foreground">{appointment.professional && <span className="flex min-w-0 items-center gap-1 truncate"><UserIcon className="h-3 w-3 shrink-0" />{appointment.professional}</span>}{appointment.storeName && <span className="flex min-w-0 items-center gap-1 truncate"><StoreIcon className="h-3 w-3 shrink-0" />{storeLabel(appointment.storeName)}</span>}</div><div className="absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button aria-label="Ações do agendamento" variant="outline" size="icon" className="h-7 w-7 bg-background/90"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Ações rápidas</DropdownMenuLabel><DropdownMenuSeparator />{canEdit && <><DropdownMenuItem onSelect={onEdit} className="gap-2"><Pencil className="h-4 w-4" /> Editar horário</DropdownMenuItem><DropdownMenuItem onSelect={() => onStatusChange(appointment.id, 'confirmed')} className="gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Confirmar presença</DropdownMenuItem><DropdownMenuItem onSelect={() => onStatusChange(appointment.id, 'in_progress')} className="gap-2"><ArrowRight className="h-4 w-4 text-violet-500" /> Iniciar atendimento</DropdownMenuItem><DropdownMenuItem onSelect={() => onStatusChange(appointment.id, 'completed')} className="gap-2"><ClipboardCheck className="h-4 w-4 text-teal-500" /> Concluir</DropdownMenuItem></>}{canEdit && <DropdownMenuItem onSelect={() => onStatusChange(appointment.id, 'cancelled')} className="gap-2 text-destructive"><XCircle className="h-4 w-4" /> Cancelar horário</DropdownMenuItem>}{canDelete && <DropdownMenuItem onSelect={onDelete} className="gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem onSelect={onWhatsApp} className="gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>;
}

function MiniAppointmentCard({ appointment, canEdit, dragging, onDragStart, onDragEnd, onSelect, compact = false }: any) {
  return <div draggable={canEdit} onDragStart={(event) => onDragStart(event, appointment)} onDragEnd={onDragEnd} onClick={(event) => { event.stopPropagation(); onSelect(); }} className={cn('group flex h-full min-h-[25px] cursor-pointer items-center gap-1 overflow-hidden rounded-md border border-border/60 border-l-2 px-1.5 py-1 text-[10px] shadow-sm transition-colors hover:border-primary/40', statusCardColors[appointment.status] || 'border-l-primary bg-primary/5', dragging && 'opacity-50', compact && 'min-h-[22px]')}><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDotColors[appointment.status] || 'bg-primary')} /><span className="truncate font-bold text-foreground">{appointment.time} {appointment.customerName || 'Visitante'}</span></div>;
}

function AppointmentDetails({ appointment, customers, sales, serviceOrders, canEdit, canDelete, onEdit, onDelete, onStatusChange, onWhatsApp, getCustomerHistory }: any) {
  const customer = customers.find((item: any) => item.id === appointment.customerId);
  const history = getCustomerHistory(appointment.customerId || '');
  const totalSpent = history.sales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
  const openOs = history.os.filter((order: any) => !['completed', 'delivered', 'cancelled'].includes(order.status));
  const whatsappAvailable = Boolean(customer?.phone || customer?.whatsapp || appointment.phone);
  const statusOptions = [
    { key: 'scheduled', label: 'Agendado' },
    { key: 'confirmed', label: 'Confirmado' },
    { key: 'waiting', label: 'Aguardando' },
    { key: 'in_progress', label: 'Em atendimento' },
    { key: 'completed', label: 'Concluído' },
    { key: 'no_show', label: 'Não compareceu' },
    { key: 'cancelled', label: 'Cancelado' },
  ];

  return <div className="flex h-full flex-col bg-background"><div className="border-b border-border/70 bg-primary/[0.04] p-5 pt-8 sm:p-6 sm:pt-9"><div className="flex items-start gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-lg font-bold text-primary">{initials(appointment.customerName)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold text-foreground">{appointment.customerName || 'Visitante'}</h2><StatusBadge status={appointment.status} /></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{displayDate(appointment.date)}</span><span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{appointment.time || '—'}</span></div>{appointment.type && <p className="mt-1 text-xs font-medium text-muted-foreground">{appointment.type}{appointment.isGuest ? ' · Visitante' : ''}</p>}</div></div><div className="mt-4 grid grid-cols-3 gap-2">{[{ label: 'Compras', value: history.sales.length }, { label: 'Total gasto', value: money(totalSpent) }, { label: 'O.S. abertas', value: openOs.length }].map((item) => <div key={item.label} className="min-w-0 rounded-xl border border-border/60 bg-card px-2 py-2.5 text-center"><p className="truncate text-[10px] font-semibold text-muted-foreground">{item.label}</p><p className="mt-1 truncate text-sm font-bold text-foreground">{item.value}</p></div>)}</div></div><ScrollArea className="flex-1"><div className="space-y-6 p-5 sm:p-6"><section><p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resumo do atendimento</p><div className="grid grid-cols-2 gap-2.5"><DetailItem icon={Clock} label="Horário" value={appointment.time || '—'} /><DetailItem icon={CalendarIcon} label="Data" value={displayDate(appointment.date)} /><DetailItem icon={UserIcon} label="Profissional" value={appointment.professional || 'Não informado'} /><DetailItem icon={MapPin} label="Unidade" value={storeLabel(appointment.storeName)} /></div></section><section><div className="mb-3 flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Atualizar status</p><span className="text-[10px] text-muted-foreground">{canEdit ? 'Clique para alterar' : 'Sem permissão de edição'}</span></div><div className="flex flex-wrap gap-2">{statusOptions.map((status) => <button type="button" key={status.key} disabled={!canEdit || appointment.status === status.key} onClick={() => onStatusChange(appointment.id, status.key)} className={cn('rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors', appointment.status === status.key ? `${appointmentStatusMap[status.key]?.color || 'bg-primary'} border-transparent text-primary-foreground` : 'border-border/70 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50')}>{status.label}</button>)}</div></section>{(customer?.phone || customer?.email) && <section><p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contato</p><div className="space-y-2 rounded-xl border border-border/60 bg-card p-3 text-xs text-muted-foreground">{customer?.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" />{customer.phone}</p>}{customer?.email && <p className="flex items-center gap-2 break-all"><Mail className="h-3.5 w-3.5 text-primary" />{customer.email}</p>}</div></section>}<section><p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Histórico relacionado</p><div className="space-y-2">{history.sales[0] && <div className="rounded-xl border border-border/60 bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Última compra</span><span className="text-sm font-bold text-primary">{money(history.sales[0].total)}</span></div><p className="mt-1 text-xs font-semibold text-foreground">{history.sales[0].items?.[0]?.product || 'Produto não informado'}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{displayDate(history.sales[0].date)}</p></div>}{openOs.length > 0 && <div className="rounded-xl border border-border/60 bg-card p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ordens em aberto</span><Badge variant="secondary">{openOs.length}</Badge></div>{openOs.slice(0, 3).map((order: any) => <div key={order.id} className="flex items-center justify-between gap-2 py-1"><span className="truncate text-xs font-medium text-foreground">{order.description || order.serviceType || 'Ordem de serviço'}</span><StatusBadge status={order.status} /></div>)}</div>}{!history.sales.length && !openOs.length && <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">Nenhum registro relacionado encontrado.</div>}</div></section><section><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observações</p><div className="min-h-[70px] rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">{appointment.notes || 'Nenhuma observação registrada para este horário.'}</div></section></div></ScrollArea><div className="grid grid-cols-2 gap-2 border-t border-border/70 bg-muted/20 p-4">{canEdit && <Button variant="outline" onClick={onEdit} className="gap-2"><Pencil className="h-4 w-4" /> Editar</Button>}{canDelete && <Button variant="outline" onClick={onDelete} className="gap-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /> Excluir</Button>}{!canEdit && !canDelete && <div />}{whatsappAvailable && <Button onClick={onWhatsApp} className="col-span-2 gap-2"><MessageSquare className="h-4 w-4" /> Enviar confirmação no WhatsApp</Button>}</div></div>;
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-xs font-bold text-foreground">{value}</p></div></div>;
}
