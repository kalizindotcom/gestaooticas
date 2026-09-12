import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Filter, Grid3X3, List, Users, UserCheck, Calendar, MoreVertical, ShoppingBag, Wrench, X, Download, Printer, Mail, Phone, Store, MapPin, CreditCard, Clock3, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomerDetailsModal } from '@/components/customers/CustomerDetailsModal';
import { CustomerFormModal } from '@/components/customers/CustomerFormModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPICard } from '@/components/shared/KPICard';
import { cn } from '@/lib/utils';
import { useCustomers, useSales, useServiceOrders, useFinancialEntries, useStores, useLocalMutation } from '@/hooks/useLocalData';

const CUSTOMERS_PAGE_SIZE = 30;
const HIDDEN_IMPORT_TAGS = new Set(['importado-sistema-anterior', 'origem-otica-nordestina-ltda', 'origem-sertao-otica-bdc']);
const visibleCustomerTags = (tags: string[] = []) => tags.filter(tag => !HIDDEN_IMPORT_TAGS.has(tag));

export default function Customers() {
  const { data: customers = [], isLoading } = useCustomers();
  const { data: sales = [] } = useSales();
  const { data: serviceOrders = [] } = useServiceOrders();
  const { data: financialEntries = [] } = useFinancialEntries();
  const { data: stores = [] } = useStores();
  const mutation = useLocalMutation('customers', [['customers']]);

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState('overview');
  const [autoAction, setAutoAction] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 'cards' : 'table');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const storeById = new Map(stores.map((store: any) => [String(store.id), store]));
  const normalizedSearch = search.trim().toLowerCase();
  const getCustomerStore = (customer: any) => storeById.get(String(customer.storeId || customer.store_id || '')) as any;
  const getStoreName = (customer: any) => getCustomerStore(customer)?.name || 'Loja não informada';
  const getStoreLocation = (customer: any) => {
    const store = getCustomerStore(customer);
    const location = [store?.city, store?.state].filter(Boolean).join(' - ');
    return location || [customer.address?.city, customer.address?.state].filter(Boolean).join(' - ') || 'Localização não informada';
  };

  const customerSalesTotals = sales.reduce((acc: Record<string, { count: number; total: number }>, sale: any) => {
    if (!sale.customer_id || sale.status === 'cancelled') return acc;
    const customerId = String(sale.customer_id);
    acc[customerId] = acc[customerId] || { count: 0, total: 0 };
    acc[customerId].count += 1;
    acc[customerId].total += Number(sale.total || 0);
    return acc;
  }, {});

  const customerServiceOrderTotals = serviceOrders.reduce((acc: Record<string, number>, order: any) => {
    if (!order.customerId && !order.customer_id) return acc;
    const customerId = String(order.customerId || order.customer_id);
    acc[customerId] = (acc[customerId] || 0) + 1;
    return acc;
  }, {});

  const customerFinancialTotals = financialEntries.reduce((acc: { byId: Record<string, { count: number; creditCount: number; overdueCount: number; total: number }>; byName: Record<string, { count: number; creditCount: number; overdueCount: number; total: number }> }, entry: any) => {
    // O resumo da lista deve seguir o Crediário: somente recebíveis do cliente.
    // Entradas de vendas canceladas, inclusive as que ficaram com customer_id, não são crédito aberto nem atraso.
    if (String(entry.type || '').toLowerCase() !== 'receivable') return acc;
    const status = String(entry.status || '').toLowerCase();
    const paidStatuses = new Set(['paid', 'completed', 'settled']);
    const cancelledStatuses = new Set(['cancelled', 'canceled', 'cancelada', 'cancelado']);
    const openStatuses = new Set(['pending', 'partially_paid', 'overdue']);
    if (cancelledStatuses.has(status)) return acc;
    const amount = Number(entry.amount || 0);
    const paidAmount = Number(entry.paid_amount || (paidStatuses.has(status) ? amount : 0));
    const remainingAmount = Math.max(amount - paidAmount, 0);
    const dueDateText = entry.due_date ? String(entry.due_date).slice(0, 10) : '';
    const dueDate = dueDateText ? new Date(`${dueDateText}T23:59:59`) : null;
    const isOpen = openStatuses.has(status) && remainingAmount > 0;
    const isOverdue = isOpen && !!dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
    const add = (target: Record<string, { count: number; creditCount: number; overdueCount: number; total: number }>, key: string) => {
      const current = target[key] || { count: 0, creditCount: 0, overdueCount: 0, total: 0 };
      current.count += 1;
      current.total += amount;
      if (isOpen) current.creditCount += 1;
      if (isOverdue) current.overdueCount += 1;
      target[key] = current;
    };
    if (entry.customer_id) add(acc.byId, String(entry.customer_id));
    const name = String(entry.supplier_customer_name || '').trim().toLowerCase();
    // Parcelas legadas podem não ter customer_id; só entram por nome quando não há ID,
    // evitando duplicar uma mesma parcela que possui os dois vínculos.
    if (name && !entry.customer_id) add(acc.byName, name);
    return acc;
  }, { byId: {}, byName: {} });

  const emptyFinancial = { count: 0, creditCount: 0, overdueCount: 0, total: 0 };
  const mergeFinancial = (direct?: typeof emptyFinancial, legacy?: typeof emptyFinancial) => ({
    count: (direct?.count || 0) + (legacy?.count || 0),
    creditCount: (direct?.creditCount || 0) + (legacy?.creditCount || 0),
    overdueCount: (direct?.overdueCount || 0) + (legacy?.overdueCount || 0),
    total: (direct?.total || 0) + (legacy?.total || 0),
  });
  const getCustomerMetrics = (customer: any) => ({
    sales: customerSalesTotals[String(customer.id)] || { count: 0, total: 0 },
    serviceOrders: customerServiceOrderTotals[String(customer.id)] || 0,
    financial: mergeFinancial(customerFinancialTotals.byId[String(customer.id)], customerFinancialTotals.byName[String(customer.name || '').trim().toLowerCase()]),
  });

  const filtered = customers.filter(c => {
    const storeName = getStoreName(c).toLowerCase();
    const storeLocation = getStoreLocation(c).toLowerCase();
    const matchesSearch = !normalizedSearch || [
      c.name, c.email, c.nickname, c.cpf, c.cnpj, c.phone, c.whatsapp,
      storeName, storeLocation,
    ].some(value => String(value || '').toLowerCase().includes(normalizedSearch));

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(c.status);
    const matchesTags = tagFilter.length === 0 || (c.tags && tagFilter.some(tag => c.tags.includes(tag)));
    const matchesStore = storeFilter.length === 0 || storeFilter.includes(String(c.storeId || c.store_id || ''));

    return matchesSearch && matchesStatus && matchesTags && matchesStore;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / CUSTOMERS_PAGE_SIZE));
  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearch, statusFilter.join('|'), tagFilter.join('|'), storeFilter.join('|')]);
  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * CUSTOMERS_PAGE_SIZE;
    return filtered.slice(start, start + CUSTOMERS_PAGE_SIZE);
  }, [filtered, currentPage]);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * CUSTOMERS_PAGE_SIZE, filtered.length);

  const allTags = Array.from(new Set(customers.flatMap(c => visibleCustomerTags(c.tags || []))));
  const birthdaysThisMonth = customers.filter(c => {
    if (!c.birth_date) return false;
    const date = new Date(`${c.birth_date}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getMonth() === new Date().getMonth();
  }).length;

  const handleExportCsv = () => {
    const header = ['nome', 'nome_preferido', 'tipo', 'loja', 'localizacao_loja', 'cpf', 'cnpj', 'telefone', 'email', 'origem', 'profissao', 'convenio', 'status', 'tags', 'total_vendas', 'valor_total_gasto', 'total_os', 'parcelas_em_aberto', 'parcelas_em_atraso', 'ultima_visita'];
    const rows = filtered.map((customer: any) => {
      const metrics = getCustomerMetrics(customer);
      return [
        customer.name,
        customer.nickname || customer.legal_name || '',
        customer.customerType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física',
        getStoreName(customer),
        getStoreLocation(customer),
        customer.cpf || '',
        customer.cnpj || '',
        customer.phone || '',
        customer.email || '',
        customer.origin || '',
        customer.profession || '',
        customer.insurance || '',
        customer.status || '',
        visibleCustomerTags(customer.tags || []).join('|'),
        metrics.sales.count,
        metrics.sales.total.toFixed(2),
        metrics.serviceOrders,
        metrics.financial.creditCount,
        metrics.financial.overdueCount,
        customer.last_visit || customer.lastVisit || '',
      ];
    });
    const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Exportação concluída",
      description: `${filtered.length} clientes exportados para CSV.`,
    });
  };

  const handleQuickAction = (action: string, customerId?: string) => {
    const id = customerId || filtered[0]?.id;
    if (!id) return;

    if (action === "Nova Venda") {
        setInitialTab('sales');
        setAutoAction('Nova Venda');
    } else if (action === "Nova O.S.") {
        setInitialTab('os');
        setAutoAction('Nova O.S.');
    } else if (action === "Enviar WhatsApp") {
        const customer = customers.find(c => c.id === id);
        if (customer) {
            const phone = (customer.phone || '').replace(/\D/g, '');
            window.open(`https://wa.me/55${phone}`, '_blank');
            return;
        }
    }

    setDetailsOpen(id);
  };

  const handleSaveCustomer = async (data: any) => {
    try {
      await mutation.mutateAsync({ action: 'insert', data });
      setOpen(false);
      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível cadastrar o cliente.",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setTagFilter([]);
    setStoreFilter([]);
    setSearch('');
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleTagFilter = (tag: string) => {
    setTagFilter(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const columns = [
    { header: 'Cliente', render: (c: any) => {
      const document = c.customerType === 'company' ? c.cnpj : c.cpf;
      const documentLabel = c.customerType === 'company' ? 'CNPJ' : 'CPF';
      const displayName = c.nickname || c.name;
      const initials = String(displayName).split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'CL';
      return (
        <div className="flex min-w-[210px] items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-black text-primary">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{displayName}</p>
            {c.nickname && <p className="truncate text-[10px] text-muted-foreground">{c.name}</p>}
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="font-mono">{document ? `${documentLabel}: ${document}` : 'Documento não informado'}</span>
              {visibleCustomerTags(c.tags || []).slice(0, 1).map((tag: string) => <Badge key={tag} variant="secondary" className="h-4 rounded px-1.5 text-[9px] font-bold text-primary">{tag}</Badge>)}
            </div>
          </div>
        </div>
      );
    }},
    { header: 'Loja', render: (c: any) => (
      <div className="min-w-[160px] space-y-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Store className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{getStoreName(c)}</span></div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{getStoreLocation(c)}</span></div>
      </div>
    )},
    { header: 'Contato', render: (c: any) => (
      <div className="min-w-[150px] space-y-1">
        <div className="flex items-center gap-1.5 text-sm"><Phone className="h-3 w-3 shrink-0 text-muted-foreground" /><span>{c.phone || c.whatsapp || '—'}</span></div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><span className="max-w-[180px] truncate">{c.email || '—'}</span></div>
      </div>
    )},
    { header: 'Atividade', render: (c: any) => {
      const metrics = getCustomerMetrics(c);
      return (
        <div className="grid min-w-[190px] grid-cols-2 gap-1.5">
          <div className="min-w-0 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold leading-none text-primary"><ShoppingBag className="h-3 w-3 shrink-0" /> Vendas</p>
            <p className="mt-1 text-sm font-bold leading-none tabular-nums text-foreground">{metrics.sales.count}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border/70 bg-muted/40 px-2 py-1.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold leading-none text-foreground"><Wrench className="h-3 w-3 shrink-0 text-muted-foreground" /> O.S.</p>
            <p className="mt-1 text-sm font-bold leading-none tabular-nums text-foreground">{metrics.serviceOrders}</p>
          </div>
        </div>
      );
    }},
    { header: 'Financeiro', render: (c: any) => {
      const metrics = getCustomerMetrics(c);
      return (
        <div className="min-w-[150px] space-y-1">
          <p className="text-sm font-bold tabular-nums text-foreground">{metrics.sales.total > 0 ? `R$ ${metrics.sales.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00'}</p>
          <div className="flex flex-wrap gap-1 text-[10px] font-semibold">
            <span className="flex items-center gap-1 text-muted-foreground"><CreditCard className="h-3 w-3" /> {metrics.financial.creditCount} em aberto</span>
            {metrics.financial.overdueCount > 0 && <span className="text-red-600">{metrics.financial.overdueCount} em atraso</span>}
          </div>
        </div>
      );
    }},
    { header: 'Última visita', render: (c: any) => {
      const lastVisit = c.lastVisit || c.last_visit;
      const date = lastVisit ? new Date(lastVisit) : null;
      return <div className="flex min-w-[105px] items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /><span>{date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('pt-BR') : 'Sem registro'}</span></div>;
    }},
    { header: 'Status', render: (c: any) => <StatusBadge status={c.status} variant="dot" /> },
  ];

  if (isLoading) {
    return <LoadingSpinner message="Carregando clientes..." />;
  }

  if (customers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-fade-in-up">
          <PageHeader
            title="Clientes"
            description="Gestão completa de relacionamento e histórico"
            actions={
              <PermissionGate module="customers" action="create">
                <Button
                  size="lg"
                  className="gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 hover-lift rounded-xl"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Novo Cliente
                </Button>
              </PermissionGate>
            }
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado"
            description="Comece adicionando seus clientes para gerenciar relacionamentos e histórico."
            action={
              <Button
                onClick={() => setOpen(true)}
                className="gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 hover-lift rounded-xl"
              >
                <Plus className="h-4 w-4" />
                Cadastrar Cliente
              </Button>
            }
          />
        </div>
        <CustomerFormModal open={open} onOpenChange={setOpen} onSave={handleSaveCustomer} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <PageHeader
          title="Clientes"
          description="Gestão completa de relacionamento e histórico"
          actions={
            <div className="flex gap-2 flex-wrap">
              <PermissionGate module="customers" action="print">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 border-border/60 hover:border-primary/40 hover:bg-primary/5 rounded-xl hover-lift"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
              </PermissionGate>

              <PermissionGate module="customers" action="export">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 border-border/60 hover:border-primary/40 hover:bg-primary/5 rounded-xl hover-lift"
                  onClick={handleExportCsv}
                >
                  <Download className="h-4 w-4" /> Exportar
                </Button>
              </PermissionGate>

              <PermissionGate module="customers" action="create">
                <Button
                  size="lg"
                  className="gap-2 btn-shimmer text-white border-0 shadow-lg shadow-primary/30 hover-lift rounded-xl"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Novo Cliente
                </Button>
              </PermissionGate>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <KPICard title="Total de Clientes" value={customers.length} icon={Users} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <KPICard title="Clientes Ativos" value={customers.filter(c => c.status === 'active').length} icon={UserCheck} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '220ms' }}>
          <KPICard title="Clientes Prospecto" value={customers.filter(c => c.status === 'prospect').length} icon={Users} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: '280ms' }}>
          <KPICard title="Aniversariantes" value={birthdaysThisMonth} icon={Calendar} />
        </div>
      </div>

      <div className="animate-fade-in-up grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center" style={{ animationDelay: '350ms' }}>
        <div className="relative min-w-0 w-full flex-1 sm:min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, apelido, CPF/CNPJ, telefone ou loja..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 bg-background/40 border-border/60 rounded-xl focus-visible:border-primary/40 focus-visible:ring-0 transition-all"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-11 w-full gap-2 rounded-xl border-border/60 bg-background/40 hover-lift sm:w-auto",
                (statusFilter.length > 0 || tagFilter.length > 0 || storeFilter.length > 0) && "border-primary/40 bg-primary/5"
              )}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {(statusFilter.length > 0 || tagFilter.length > 0 || storeFilter.length > 0) && (
                <Badge className="ml-1 h-5 min-w-5 justify-center border-0 bg-primary px-1.5 font-bold text-white">
                  {statusFilter.length + tagFilter.length + storeFilter.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="max-h-[min(70vh,540px)] w-[calc(100vw-1rem)] max-w-[320px] overflow-y-auto rounded-xl border-gradient p-0 shadow-2xl glass" align="start" sideOffset={8}>
            <div className="p-5 space-y-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Filtros Avançados</h4>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wider">
                    Refine sua lista de clientes
                  </p>
                </div>
                {(statusFilter.length > 0 || tagFilter.length > 0 || storeFilter.length > 0 || search) && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2 font-bold transition-all">
                    <X className="h-3 w-3" /> Limpar
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Status do Cliente
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'active', label: 'Ativo', color: 'bg-emerald-500' },
                    { id: 'prospect', label: 'Prospecto', color: 'bg-amber-500' },
                    { id: 'inactive', label: 'Inativo', color: 'bg-slate-400' }
                  ].map((status) => (
                    <label
                      key={status.id}
                      htmlFor={`status-${status.id}`}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer",
                        statusFilter.includes(status.id) ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`status-${status.id}`}
                          checked={statusFilter.includes(status.id)}
                          onCheckedChange={() => toggleStatusFilter(status.id)}
                          className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <div className={cn("h-1.5 w-1.5 rounded-full", status.color)} />
                          {status.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {stores.length > 0 && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Loja de relacionamento</p>
                  <div className="space-y-1.5">
                    {stores.map((store: any) => {
                      const storeId = String(store.id);
                      const selected = storeFilter.includes(storeId);
                      return (
                        <label key={storeId} htmlFor={`store-${storeId}`} className={cn("flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition-all", selected ? "border-primary/20 bg-primary/10" : "border-transparent hover:bg-muted")}>
                          <div className="flex min-w-0 items-center gap-3">
                            <Checkbox id={`store-${storeId}`} checked={selected} onCheckedChange={() => setStoreFilter(prev => selected ? prev.filter(id => id !== storeId) : [...prev, storeId])} className="border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground"><Store className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{store.name}</span></span>
                          </div>
                          <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">{store.city || 'Sem cidade'}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {allTags.length > 0 && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Segmentação / Tags
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {allTags.map((tag) => (
                      <label
                        key={tag}
                        htmlFor={`tag-${tag}`}
                        className={cn(
                          "flex items-center space-x-2 p-2 rounded-lg transition-all cursor-pointer",
                          tagFilter.includes(tag) ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"
                        )}
                      >
                        <Checkbox
                          id={`tag-${tag}`}
                          checked={tagFilter.includes(tag)}
                          onCheckedChange={() => toggleTagFilter(tag)}
                          className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <span className="text-xs font-semibold text-foreground truncate">
                          {tag}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <span className="w-full text-xs font-semibold text-muted-foreground sm:mr-auto sm:w-auto">Mostrando <strong className="text-foreground">{pageStart}–{pageEnd}</strong> de {filtered.length} clientes</span>

        <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)} className="w-full sm:ml-auto sm:w-auto">
          <TabsList className="grid h-11 w-full grid-cols-2 p-1 bg-muted/40 border border-border/60 rounded-xl sm:flex sm:w-auto">
            <TabsTrigger value="table" className="h-9 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md">
              <List className="h-4 w-4 mr-2" /> Tabela
            </TabsTrigger>
            <TabsTrigger value="cards" className="h-9 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-md">
              <Grid3X3 className="h-4 w-4 mr-2" /> Cards
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'table' ? (
        <div className="animate-fade-in-up" style={{ animationDelay: '450ms' }}>
          <Card className="overflow-hidden border-border/60 hover-lift">
            <div className="divide-y divide-border/50 md:hidden">
              {paginatedCustomers.map((c, i) => {
                const metrics = getCustomerMetrics(c);
                const displayName = c.nickname || c.name;
                const document = c.customerType === 'company' ? c.cnpj : c.cpf;
                const documentLabel = c.customerType === 'company' ? 'CNPJ' : 'CPF';
                const initials = String(displayName).split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'CL';
                return (
                  <div key={c.id} className="group flex min-w-0 items-center gap-3 p-3.5 transition-colors active:bg-primary/5" style={{ animationDelay: `${500 + i * 30}ms` }}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setDetailsOpen(c.id)} aria-label={`Abrir detalhes de ${displayName}`}>
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-black text-primary">{initials}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{displayName}</p>
                          <StatusBadge status={c.status} variant="dot" />
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{document ? `${documentLabel}: ${document}` : 'Documento não informado'}</p>
                        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Store className="h-3 w-3 shrink-0 text-primary" />
                          <span className="truncate">{getStoreName(c)}</span>
                          <span className="shrink-0 text-border">•</span>
                          <span className="truncate">{getStoreLocation(c)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                          <span className="rounded-md bg-primary/8 px-1.5 py-1 text-primary">{metrics.sales.count} vendas</span>
                          <span className="rounded-md bg-muted px-1.5 py-1">{metrics.serviceOrders} O.S.</span>
                          <span className="ml-auto whitespace-nowrap font-bold text-foreground">R$ {metrics.sales.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </button>
                    <PermissionGate module="customers" action="edit">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" aria-label={`Ações de ${displayName}`} className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 glass border-gradient">
                          <DropdownMenuItem onClick={() => handleQuickAction("Nova Venda", c.id)} className="gap-2 cursor-pointer font-medium"><ShoppingBag className="h-4 w-4 text-primary" /> Nova Venda</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickAction("Nova O.S.", c.id)} className="gap-2 cursor-pointer font-medium"><Wrench className="h-4 w-4 text-primary" /> Abrir O.S.</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickAction("Enviar WhatsApp", c.id)} className="gap-2 cursor-pointer font-medium"><Phone className="h-4 w-4 text-emerald-500" /> WhatsApp</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </PermissionGate>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                  {columns.map((col) => (
                    <TableHead key={col.header} className="py-4 font-bold text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                      {col.header}
                    </TableHead>
                  ))}
                  <TableHead className="py-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((c, i) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors animate-fade-in border-b border-border/40"
                    style={{ animationDelay: `${500 + i * 30}ms` }}
                    onClick={() => setDetailsOpen(c.id)}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.header} className="py-3.5">
                        {col.render(c)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <PermissionGate module="customers" action="edit">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 glass border-gradient">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleQuickAction("Nova Venda", c.id); }} className="gap-2 cursor-pointer font-medium">
                                <ShoppingBag className="h-4 w-4 text-primary" /> Nova Venda
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleQuickAction("Nova O.S.", c.id); }} className="gap-2 cursor-pointer font-medium">
                                <Wrench className="h-4 w-4 text-primary" /> Abrir O.S.
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleQuickAction("Enviar WhatsApp", c.id); }} className="gap-2 cursor-pointer font-medium">
                                <Phone className="h-4 w-4 text-emerald-500" /> WhatsApp
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {paginatedCustomers.map((c, i) => (
            <div
              key={c.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${500 + i * 40}ms` }}
            >
              <Card className="group cursor-pointer hover-lift border-border/60 overflow-hidden relative" onClick={() => setDetailsOpen(c.id)}>
                {/* top gradient decoration */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="h-20 bg-gradient-to-br from-primary/10 via-primary/5 to-orange-700/10 relative overflow-hidden">
                  <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
                </div>
                <CardContent className="p-5 -mt-12 relative">
                  <div className="flex justify-between items-start mb-3">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-orange-700 blur-md opacity-40" />
                      <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-orange-700 grid place-items-center font-bold text-lg text-white shadow-lg shadow-primary/30 ring-4 ring-card">
                        {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                    </div>
                    <StatusBadge status={c.status} variant="pill" />
                  </div>
                  <h3 className="font-bold text-foreground line-clamp-1 tracking-tight">{c.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.nickname || (c.customerType === 'company' ? c.cnpj : c.cpf) || '—'}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Store className="h-3 w-3 shrink-0 text-primary" /><span className="truncate">{getStoreName(c)}</span></div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{c.phone || c.whatsapp || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{c.email || '—'}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="h-6 gap-1 rounded-md border-primary/20 bg-primary/5 px-1.5 text-[10px] font-bold text-primary"><ShoppingBag className="h-3 w-3" /> {getCustomerMetrics(c).sales.count} vendas</Badge>
                    <Badge variant="outline" className="h-6 gap-1 rounded-md border-border/70 bg-muted/40 px-1.5 text-[10px] font-bold text-foreground"><Wrench className="h-3 w-3 text-muted-foreground" /> {getCustomerMetrics(c).serviceOrders} O.S.</Badge>
                    {getCustomerMetrics(c).financial.overdueCount > 0 && <Badge variant="outline" className="h-6 rounded-md border-red-500/20 bg-red-500/5 px-1.5 text-[10px] font-bold text-red-600">{getCustomerMetrics(c).financial.overdueCount} em atraso</Badge>}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-[11px]">
                    <span className="text-muted-foreground">Total comprado</span>
                    <span className="font-bold tabular-nums text-foreground">{getCustomerMetrics(c).sales.total > 0 ? `R$ ${getCustomerMetrics(c).sales.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00'}</span>
                  </div>
                  {visibleCustomerTags(c.tags || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {visibleCustomerTags(c.tags || []).slice(0, 2).map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3" onClick={(event) => event.stopPropagation()}>
                    <Button type="button" variant="outline" className="h-10 gap-1 px-2 text-[10px]" onClick={() => handleQuickAction('Enviar WhatsApp', c.id)} disabled={!c.phone && !c.whatsapp} aria-label="Enviar WhatsApp">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" /><span className="hidden min-[380px]:inline">WhatsApp</span>
                    </Button>
                    <Button type="button" variant="outline" className="h-10 gap-1 px-2 text-[10px]" onClick={() => handleQuickAction('Nova Venda', c.id)} aria-label="Nova venda">
                      <ShoppingBag className="h-3.5 w-3.5 text-primary" /><span className="hidden min-[380px]:inline">Venda</span>
                    </Button>
                    <Button type="button" variant="outline" className="h-10 gap-1 px-2 text-[10px]" onClick={() => handleQuickAction('Nova O.S.', c.id)} aria-label="Abrir ordem de serviço">
                      <Wrench className="h-3.5 w-3.5 text-primary" /><span className="hidden min-[380px]:inline">O.S.</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Página <strong className="text-foreground">{currentPage}</strong> de <strong className="text-foreground">{totalPages}</strong> · {filtered.length} clientes encontrados</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-lg" disabled={currentPage === 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))} aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[92px] text-center text-xs font-bold text-foreground">{pageStart}–{pageEnd}</span>
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-lg" disabled={currentPage === totalPages} onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} aria-label="Próxima página">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CustomerFormModal
        open={open}
        onOpenChange={setOpen}
        onSave={handleSaveCustomer}
        isLoading={mutation.isPending}
      />

      {detailsOpen && (
        <CustomerDetailsModal
          customer={customers.find(c => c.id === detailsOpen) || null}
          open={!!detailsOpen}
          onOpenChange={(open) => !open && setDetailsOpen(null)}
          initialTab={initialTab}
          autoAction={autoAction}
        />
      )}
    </div>
  );
}