import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellDot, CalendarDays, Check, CheckCheck, CircleAlert, Clock3, FileWarning, Package, Receipt, RefreshCw, Search, ShoppingCart, Store, Trash2, UserRound, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuth } from '@/contexts/AuthContext';
import { localApi } from '@/lib/localApi';
import { cn } from '@/lib/utils';

type NotificationLevel = 'critical' | 'warning' | 'info' | 'success';
type NotificationCategory = 'estoque' | 'vendas' | 'agenda' | 'os' | 'financeiro' | 'cadastro' | 'fiscal';
type NotificationItem = {
  id: string;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  description: string;
  timeLabel: string;
  href: string;
  icon: typeof Bell;
};

type NotificationData = {
  products: any[];
  sales: any[];
  appointments: any[];
  serviceOrders: any[];
  financialEntries: any[];
  fiscalDocuments: any[];
};

const READ_KEY = 'h2k-notifications-read-v1';
const DISMISSED_KEY = 'h2k-notifications-dismissed-v1';
const CATEGORY_KEY = 'h2k-notifications-categories-v1';
const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  estoque: 'Estoque',
  vendas: 'Vendas',
  agenda: 'Agenda',
  os: 'O.S.',
  financeiro: 'Financeiro',
  cadastro: 'Cadastros',
  fiscal: 'Fiscal',
};
const LEVEL_STYLES: Record<NotificationLevel, { dot: string; icon: string; badge: string }> = {
  critical: { dot: 'bg-destructive', icon: 'bg-destructive/10 text-destructive', badge: 'bg-destructive/10 text-destructive' },
  warning: { dot: 'bg-amber-500', icon: 'bg-amber-500/10 text-amber-600', badge: 'bg-amber-500/10 text-amber-700' },
  info: { dot: 'bg-primary', icon: 'bg-primary/10 text-primary', badge: 'bg-primary/10 text-primary' },
  success: { dot: 'bg-emerald-500', icon: 'bg-emerald-500/10 text-emerald-600', badge: 'bg-emerald-500/10 text-emerald-700' },
};

const readStorage = (key: string): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const normalizeDate = (value: any) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const dayStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const formatRelative = (value: any) => {
  const date = normalizeDate(value);
  if (!date) return 'agora';
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  return date.toLocaleDateString('pt-BR');
};
const inScope = (row: any, companyId: string | null, storeIds: string[]) => {
  if (companyId && String(row.company_id || row.companyId || '') !== String(companyId)) return false;
  const storeId = row.store_id || row.storeId;
  return storeIds.length === 0 || !storeId || storeIds.map(String).includes(String(storeId));
};

function useNotificationData() {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const can = (module: any) => hasPermission(module, 'view' as any);
  return useQuery<NotificationData>({
    queryKey: ['notification-center', user?.id, selectedCompanyId, selectedStoreIds, can('products'), can('sales'), can('appointments'), can('service_orders'), can('financial'), can('fiscal')],
    enabled: Boolean(user && selectedCompanyId),
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const requests: Promise<any>[] = [];
      const labels: string[] = [];
      if (can('products')) { requests.push(localApi.from('products').select('*, product_stock(*), product_images(*)')); labels.push('products'); }
      if (can('sales')) { requests.push(localApi.from('sales').select('*, sale_items(*)')); labels.push('sales'); }
      if (can('appointments')) { requests.push(localApi.from('appointments').select('*')); labels.push('appointments'); }
      if (can('service_orders')) { requests.push(localApi.from('service_orders').select('*')); labels.push('serviceOrders'); }
      if (can('financial')) { requests.push(localApi.from('financial_entries').select('*')); labels.push('financialEntries'); }
      if (can('fiscal')) { requests.push(localApi.fiscal.listDocuments({ company_id: selectedCompanyId || undefined, store_id: selectedStoreIds.length === 1 ? selectedStoreIds[0] : undefined, limit: 100 })); labels.push('fiscalDocuments'); }
      const responses = await Promise.all(requests);
      const result: NotificationData = { products: [], sales: [], appointments: [], serviceOrders: [], financialEntries: [], fiscalDocuments: [] };
      responses.forEach((response: any, index) => {
        if (response?.error) throw response.error;
        const key = labels[index] as keyof NotificationData;
        result[key] = (response?.data || []).filter((row: any) => inScope(row, selectedCompanyId, selectedStoreIds));
      });
      return result;
    },
  });
}

function buildNotifications(data: NotificationData | undefined): NotificationItem[] {
  if (!data) return [];
  const now = new Date();
  const today = dayStart(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const notifications: NotificationItem[] = [];
  const add = (item: NotificationItem) => notifications.push(item);

  for (const product of data.products) {
    const stocks = Array.isArray(product.product_stock) ? product.product_stock : [];
    const total = stocks.reduce((sum: number, stock: any) => sum + Number(stock.quantity ?? stock.stock_quantity ?? 0), 0);
    const reserved = stocks.reduce((sum: number, stock: any) => sum + Number(stock.reserved_quantity ?? stock.reserved ?? 0), 0);
    const minimum = Number(product.min_stock ?? product.minimum_stock ?? 0);
    if (total <= 0) add({ id: `stock-empty-${product.id}`, category: 'estoque', level: 'critical', title: 'Produto sem estoque', description: `${product.name || 'Produto'} precisa de reposição.`, timeLabel: 'Agora', href: '/products', icon: Package });
    else if (minimum > 0 && total - reserved <= minimum) add({ id: `stock-low-${product.id}`, category: 'estoque', level: 'warning', title: 'Estoque baixo', description: `${product.name || 'Produto'} está no limite disponível.`, timeLabel: 'Agora', href: '/products', icon: Package });
    if (reserved > 0) add({ id: `stock-reserved-${product.id}`, category: 'estoque', level: 'info', title: 'Reserva ativa', description: `${product.name || 'Produto'} possui unidades reservadas.`, timeLabel: 'Agora', href: '/products', icon: Package });
    if (!product.category && !product.category_id) add({ id: `product-category-${product.id}`, category: 'cadastro', level: 'info', title: 'Produto sem categoria', description: `${product.name || 'Produto'} precisa de classificação.`, timeLabel: 'Agora', href: '/products', icon: FileWarning });
    if (!product.brand && !product.brand_id) add({ id: `product-brand-${product.id}`, category: 'cadastro', level: 'info', title: 'Produto sem marca', description: `${product.name || 'Produto'} está sem marca vinculada.`, timeLabel: 'Agora', href: '/products', icon: FileWarning });
    if (!product.product_images?.length && !product.image_url) add({ id: `product-photo-${product.id}`, category: 'cadastro', level: 'info', title: 'Produto sem foto', description: `${product.name || 'Produto'} pode receber uma imagem no catálogo.`, timeLabel: 'Agora', href: '/products', icon: Package });
  }

  for (const sale of data.sales) {
    const status = String(sale.status || '').toLowerCase();
    const created = sale.created_at || sale.createdAt || sale.date;
    if (status === 'pending') add({ id: `sale-pending-${sale.id}`, category: 'vendas', level: 'warning', title: 'Venda pendente', description: `A venda ${String(sale.id).slice(0, 8).toUpperCase()} aguarda conferência.`, timeLabel: formatRelative(created), href: '/sales', icon: ShoppingCart });
    if ((status === 'cancelled' || status === 'canceled') && normalizeDate(created) && normalizeDate(created)!.getTime() >= today.getTime()) add({ id: `sale-cancelled-${sale.id}`, category: 'vendas', level: 'warning', title: 'Venda cancelada hoje', description: `A venda ${String(sale.id).slice(0, 8).toUpperCase()} foi cancelada e precisa ser conferida.`, timeLabel: formatRelative(created), href: '/sales', icon: ShoppingCart });
    if (Number(sale.discount || 0) > 0) add({ id: `sale-discount-${sale.id}`, category: 'vendas', level: 'info', title: 'Venda com desconto', description: `A venda ${String(sale.id).slice(0, 8).toUpperCase()} possui desconto aplicado.`, timeLabel: formatRelative(created), href: '/sales', icon: Receipt });
  }

  for (const appointment of data.appointments) {
    const appointmentDate = normalizeDate(appointment.date || appointment.scheduled_date);
    const appointmentTime = appointment.time || appointment.scheduled_time || '';
    const customer = appointment.customer_name || appointment.customerName || appointment.guest_name || 'Cliente';
    if (appointmentDate && appointmentDate.getTime() === today.getTime()) add({ id: `appointment-today-${appointment.id}`, category: 'agenda', level: 'info', title: 'Agendamento de hoje', description: `${customer}${appointmentTime ? ` às ${String(appointmentTime).slice(0, 5)}` : ''}.`, timeLabel: 'Hoje', href: '/appointments', icon: CalendarDays });
    if (appointmentDate && appointmentDate >= tomorrow && appointmentDate.getTime() <= tomorrow.getTime() + 86400000) add({ id: `appointment-next-${appointment.id}`, category: 'agenda', level: 'info', title: 'Agendamento amanhã', description: `${customer}${appointmentTime ? ` às ${String(appointmentTime).slice(0, 5)}` : ''}.`, timeLabel: 'Amanhã', href: '/appointments', icon: CalendarDays });
    if (!appointment.customer_id && !appointment.customerId) add({ id: `appointment-guest-${appointment.id}`, category: 'agenda', level: 'warning', title: 'Agendamento avulso', description: `${customer} não possui cadastro vinculado.`, timeLabel: 'Agenda', href: '/appointments', icon: UserRound });
    if (!appointment.phone && !appointment.customer_phone) add({ id: `appointment-phone-${appointment.id}`, category: 'agenda', level: 'info', title: 'Agendamento sem telefone', description: `Confira o contato de ${customer}.`, timeLabel: 'Agenda', href: '/appointments', icon: UserRound });
  }

  for (const order of data.serviceOrders) {
    const due = normalizeDate(order.delivery_date || order.estimated_deadline || order.due_date);
    const customer = order.customer_name || order.customerName || 'Cliente';
    if (due && due < today && String(order.status || '').toLowerCase() !== 'delivered') add({ id: `os-overdue-${order.id}`, category: 'os', level: 'critical', title: 'O.S. atrasada', description: `A O.S. de ${customer} ultrapassou o prazo.`, timeLabel: formatRelative(due), href: '/service-orders', icon: Clock3 });
    if (!order.lab_id && !order.labId) add({ id: `os-lab-${order.id}`, category: 'os', level: 'warning', title: 'O.S. sem laboratório', description: `A O.S. de ${customer} ainda não possui laboratório.`, timeLabel: 'O.S.', href: '/service-orders', icon: FileWarning });
    if (!order.prescription_id && !order.prescriptionId) add({ id: `os-prescription-${order.id}`, category: 'os', level: 'info', title: 'O.S. sem receita vinculada', description: `Confira a receita da O.S. de ${customer}.`, timeLabel: 'O.S.', href: '/service-orders', icon: FileWarning });
  }

  for (const entry of data.financialEntries) {
    const due = normalizeDate(entry.due_date || entry.dueDate);
    const status = String(entry.status || '').toLowerCase();
    if (due && due < today && !['paid', 'settled', 'cancelled', 'canceled'].includes(status)) add({ id: `financial-overdue-${entry.id}`, category: 'financeiro', level: 'critical', title: 'Lançamento vencido', description: 'Existe um lançamento financeiro vencido para conferência.', timeLabel: formatRelative(due), href: '/financial', icon: Receipt });
    if (status === 'pending') add({ id: `financial-pending-${entry.id}`, category: 'financeiro', level: 'warning', title: 'Pagamento pendente', description: 'Existe um pagamento aguardando baixa.', timeLabel: formatRelative(entry.created_at || entry.createdAt), href: '/financial', icon: Receipt });
    if (entry.reconciled === false || entry.is_reconciled === false) add({ id: `financial-reconcile-${entry.id}`, category: 'financeiro', level: 'info', title: 'Conciliação pendente', description: 'Existe um lançamento aguardando conciliação.', timeLabel: 'Financeiro', href: '/financial', icon: RefreshCw });
  }

  for (const document of data.fiscalDocuments) {
    const status = String(document.status || '').toLowerCase();
    const reference = `${String(document.type || 'Documento fiscal')} ${document.number ? `nº ${document.number}` : 'sem número'}`;
    if (['rejected', 'denied'].includes(status)) add({ id: `fiscal-rejected-${document.id}`, category: 'fiscal', level: 'critical', title: 'Documento fiscal rejeitado', description: `${reference} requer revisão antes de qualquer reenvio.`, timeLabel: formatRelative(document.updated_at || document.created_at), href: '/fiscal', icon: FileWarning });
    if (status === 'communication_failed') add({ id: `fiscal-failed-${document.id}`, category: 'fiscal', level: 'critical', title: 'Falha de comunicação fiscal', description: `${reference} está com falha registrada para conferência.`, timeLabel: formatRelative(document.updated_at || document.created_at), href: '/fiscal', icon: CircleAlert });
    if (['draft', 'validation_pending', 'queued', 'processing'].includes(status)) add({ id: `fiscal-pending-${document.id}`, category: 'fiscal', level: 'warning', title: 'Documento fiscal pendente', description: `${reference} ainda não possui autorização oficial.`, timeLabel: formatRelative(document.updated_at || document.created_at), href: '/fiscal', icon: Receipt });
  }

  const uniqueNotifications = Array.from(new Map(notifications.map((item) => [item.id, item])).values());
  return uniqueNotifications.sort((a, b) => {
    const weight = { critical: 0, warning: 1, info: 2, success: 3 };
    return weight[a.level] - weight[b.level] || a.title.localeCompare(b.title, 'pt-BR');
  });
}

export function NotificationCenter() {
  const { data, isLoading, isError, refetch } = useNotificationData();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [category, setCategory] = useState<'all' | NotificationCategory>('all');
  const [search, setSearch] = useState('');
  const [readIds, setReadIds] = useState<string[]>(() => readStorage(READ_KEY));
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readStorage(DISMISSED_KEY));
  const [enabledCategories, setEnabledCategories] = useState<NotificationCategory[]>(() => {
    const stored = readStorage(CATEGORY_KEY) as NotificationCategory[];
    return stored.length ? Array.from(new Set([...stored, 'fiscal'])) : Object.keys(CATEGORY_LABELS) as NotificationCategory[];
  });
  const notifications = useMemo(() => buildNotifications(data).filter((item) => !dismissedIds.includes(item.id)), [data, dismissedIds]);
  const filteredNotifications = useMemo(() => notifications.filter((item) => enabledCategories.includes(item.category) && (category === 'all' || item.category === category) && (!onlyUnread || !readIds.includes(item.id)) && (!search.trim() || `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase().trim()))), [notifications, enabledCategories, category, onlyUnread, readIds, search]);
  const visibleNotifications = useMemo(() => showAll ? filteredNotifications : filteredNotifications.slice(0, 80), [filteredNotifications, showAll]);
  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length;

  useEffect(() => { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(new Set(readIds)))); }, [readIds]);
  useEffect(() => { localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(new Set(dismissedIds)))); }, [dismissedIds]);
  useEffect(() => { localStorage.setItem(CATEGORY_KEY, JSON.stringify(enabledCategories)); }, [enabledCategories]);

  const persistIds = (key: string, ids: string[]) => {
    const normalized = Array.from(new Set(ids)).slice(-500);
    localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  };
  const markRead = (id: string) => {
    const next = persistIds(READ_KEY, [...readIds, id]);
    setReadIds(next);
  };
  const toggleRead = (id: string) => {
    const next = readIds.includes(id) ? readIds.filter((currentId) => currentId !== id) : [...readIds, id];
    setReadIds(persistIds(READ_KEY, next));
  };
  const markAllRead = () => setReadIds(persistIds(READ_KEY, [...readIds, ...notifications.map((item) => item.id)]));
  const dismiss = (id: string) => {
    markRead(id);
    setDismissedIds(persistIds(DISMISSED_KEY, [...dismissedIds, id]));
  };
  const handleOpen = (item: NotificationItem) => { markRead(item.id); setOpen(false); window.location.assign(item.href); };

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Notificações" className="relative h-9 w-9 hover:bg-accent transition-all hover-lift">
        {unreadCount > 0 ? <BellDot className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" /></span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} className="w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-2xl border-border/70 bg-background p-0 shadow-2xl">
      <div className="border-b border-border/70 bg-card px-4 py-3">
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-sm font-bold text-foreground">Notificações</h2><Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">{unreadCount} novas</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">Alertas locais do seu escopo de lojas e permissões.</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" title="Atualizar" onClick={() => void refetch()}><RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} /></Button><Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar tudo como lido" onClick={markAllRead} disabled={!unreadCount}><CheckCheck className="h-3.5 w-3.5" /></Button></div></div>
        <div className="relative mt-3"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar notificações..." className="h-8 pl-8 text-xs" /></div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5"><Button variant="ghost" size="sm" onClick={() => setCategory('all')} className={cn('h-7 shrink-0 rounded-full px-2.5 text-[10px]', category === 'all' && 'bg-primary/10 text-primary')}>Todas</Button>{(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((key) => <Button key={key} variant="ghost" size="sm" onClick={() => setCategory(key)} className={cn('h-7 shrink-0 rounded-full px-2.5 text-[10px]', category === key && 'bg-primary/10 text-primary')}>{CATEGORY_LABELS[key]}</Button>)}</div>
        <div className="mt-2 flex items-center justify-between"><label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground"><Checkbox checked={onlyUnread} onCheckedChange={(checked) => setOnlyUnread(checked === true)} /> Somente não lidas</label><NotificationSettings enabledCategories={enabledCategories} setEnabledCategories={setEnabledCategories} /></div>
      </div>
      <div className="max-h-[min(58vh,460px)] overflow-y-auto p-2">
        {isLoading && <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" /> Atualizando alertas...</div>}
        {isError && !isLoading && <div className="px-4 py-10 text-center"><CircleAlert className="mx-auto mb-2 h-5 w-5 text-destructive" /><p className="text-xs font-semibold text-foreground">Não foi possível atualizar as notificações</p><Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => void refetch()}>Tentar novamente</Button></div>}
        {!isLoading && !isError && visibleNotifications.length === 0 && <div className="px-4 py-10 text-center"><Check className="mx-auto mb-2 h-5 w-5 text-emerald-500" /><p className="text-xs font-semibold text-foreground">Tudo em ordem</p><p className="mt-1 text-[11px] text-muted-foreground">Nenhum alerta corresponde aos filtros atuais.</p></div>}
        {!isLoading && !isError && visibleNotifications.map((item) => { const Icon = item.icon; const style = LEVEL_STYLES[item.level]; const isRead = readIds.includes(item.id); return <div key={item.id} className={cn('group flex gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-muted/60', !isRead && 'bg-primary/[0.035]')}><div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', style.icon)}><Icon className="h-4 w-4" /></div><button type="button" onClick={() => handleOpen(item)} className="min-w-0 flex-1 text-left"><div className="flex items-start justify-between gap-2"><p className={cn('text-xs leading-tight text-foreground', !isRead ? 'font-bold' : 'font-medium')}>{item.title}</p><span className="shrink-0 text-[10px] text-muted-foreground">{item.timeLabel}</span></div><p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{item.description}</p><div className="mt-1.5 flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} /><span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', style.badge)}>{CATEGORY_LABELS[item.category]}</span>{!isRead && <span className="text-[9px] font-semibold text-primary">Nova</span>}</div></button><div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"><Button variant="ghost" size="icon" title={isRead ? 'Marcar como não lida' : 'Marcar como lida'} className="h-7 w-7" onClick={(event) => { event.stopPropagation(); toggleRead(item.id); }}>{isRead ? <BellDot className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}</Button><Button variant="ghost" size="icon" title="Dispensar" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); dismiss(item.id); }}><X className="h-3.5 w-3.5" /></Button></div></div>; })}
      </div>
      <Separator /><div className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 py-2.5"><span className="text-[10px] text-muted-foreground">{filteredNotifications.length} alerta(s) correspondem aos filtros{filteredNotifications.length > 80 && !showAll ? ` · mostrando 80` : ''}</span><div className="flex items-center gap-1"><Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-[10px]" onClick={() => setShowAll((current) => !current)}>{showAll ? 'Mostrar menos' : 'Visualizar todas'}</Button><Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-[10px]" onClick={() => { setDismissedIds([]); persistIds(DISMISSED_KEY, []); }} disabled={!dismissedIds.length}>Restaurar dispensadas</Button></div></div>
    </PopoverContent>
  </Popover>;
}

function NotificationSettings({ enabledCategories, setEnabledCategories }: { enabledCategories: NotificationCategory[]; setEnabledCategories: (value: NotificationCategory[]) => void }) {
  const [open, setOpen] = useState(false);
  const all = Object.keys(CATEGORY_LABELS) as NotificationCategory[];
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"><Store className="h-3 w-3" /> Categorias</Button></PopoverTrigger><PopoverContent align="end" className="w-44 rounded-xl p-2"><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mostrar alertas</p>{all.map((key) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted"><Checkbox checked={enabledCategories.includes(key)} onCheckedChange={(checked) => setEnabledCategories(checked === true ? Array.from(new Set([...enabledCategories, key])) : enabledCategories.filter((item) => item !== key))} /> {CATEGORY_LABELS[key]}</label>)}<Separator className="my-1" /><Button variant="ghost" size="sm" className="h-7 w-full text-[10px]" onClick={() => setEnabledCategories(all)}>Restaurar categorias</Button></PopoverContent></Popover>;
}
