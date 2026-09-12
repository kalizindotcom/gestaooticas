import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, User, Calendar, Tag, CreditCard, Receipt, AlertTriangle, Search, X, Store, Download, Link2, Percent, Banknote, Clock, ShieldCheck, Trash2 } from "lucide-react";
import { DateRange } from "react-day-picker";
import { getEntryPaidAmount, getEntryRemainingAmount, getPaymentMethodLabel } from '@/lib/financial';
import { cn } from "@/lib/utils";
import { useFinancialEntries, useFinancialEntriesPage, useFinancialCategories, useFinancialEntryAudits } from '@/hooks/useFinancialData';
import { useSales, useStores } from "@/hooks/useLocalData";
import { usePermissions } from '@/contexts/PermissionsContext';
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Input } from "@/components/ui/input";
import { DetailModal, DetailBlock, DetailItem } from "@/components/shared/premium/DetailModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { localApi } from '@/lib/localApi';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  paid:      { label: "Pago",      bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
  partially_paid: { label: "Parcial", bg: "bg-primary/10", text: "text-primary" },
  overdue:   { label: "Vencido",   bg: "bg-red-500/10", text: "text-red-700 dark:text-red-300" },
  pending:   { label: "Pendente",  bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300" },
  cancelled: { label: "Cancelado", bg: "bg-muted", text: "text-muted-foreground" },
};

const STATEMENT_KPI_TONES = {
  primary: { card: "bg-emerald-500/[0.06] border-emerald-500/15", glow: "from-emerald-500/20 to-transparent", icon: "from-emerald-500 to-teal-600", label: "text-emerald-600", value: "text-emerald-600" },
  positive: { card: "bg-primary/[0.06] border-primary/20", glow: "from-primary/25 to-orange-500/5", icon: "from-primary to-orange-700", label: "text-primary", value: "text-primary" },
  negative: { card: "bg-red-500/[0.06] border-red-500/15", glow: "from-red-500/20 to-transparent", icon: "from-red-500 to-rose-600", label: "text-red-600", value: "text-red-600" },
  warning: { card: "bg-amber-500/[0.06] border-amber-500/15", glow: "from-amber-500/20 to-orange-500/5", icon: "from-amber-500 to-orange-600", label: "text-amber-600", value: "text-amber-600" },
} as const;

type StatementKpiTone = keyof typeof STATEMENT_KPI_TONES;

function KPI({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: StatementKpiTone }) {
  const styles = STATEMENT_KPI_TONES[tone];
  return (
    <div className={cn("group relative rounded-2xl p-4 border hover-lift overflow-hidden animate-fade-in-up", styles.card)}>
      <div className={cn("absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br opacity-20 blur-2xl group-hover:opacity-40 transition-opacity", styles.glow)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.15em]", styles.label)}>{label}</span>
          <div className="relative">
            <div className={cn("absolute inset-0 rounded-lg blur-sm opacity-50 bg-gradient-to-br", styles.icon)} />
            <div className={cn("relative h-7 w-7 rounded-lg grid place-items-center bg-gradient-to-br shadow-sm", styles.icon)}>
              <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
            </div>
          </div>
        </div>
        <div className={cn("text-xl font-heading font-black tracking-tight", styles.value)}>{typeof value === "number" ? fmt(value) : value}</div>
      </div>
    </div>
  );
}

export function FinancialStatementContent({ globalDateRange }: { globalDateRange?: import("react-day-picker").DateRange }) {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  React.useEffect(() => { if (globalDateRange) setDateRange(globalDateRange); }, [globalDateRange?.from?.toISOString(), globalDateRange?.to?.toISOString()]);
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [reversalDialog, setReversalDialog] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [deletionDialog, setDeletionDialog] = useState<any>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [page, setPage] = useState(1);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canExport = hasPermission('financial', 'export_statement');
  const canReverse = hasPermission('financial', 'reverse_entry');
  const canDeleteEntry = hasPermission('financial', 'delete_entry');
  const canViewAudit = hasPermission('financial', 'view_audit');
  const canViewSales = hasPermission('sales', 'view');
  const auditsQuery = useFinancialEntryAudits(canViewAudit ? selectedTx?.id : undefined);

  const storesQuery = useStores();
  const salesQuery = useSales({ enabled: canViewSales });
  const categoriesQuery = useFinancialCategories();
  const entriesQuery = useFinancialEntries({
    store_id: selectedStore !== "all" ? selectedStore : undefined,
    type: selectedType !== "all" ? selectedType : undefined,
  });
  const { data: stores = [] } = storesQuery;
  const { data: sales = [] } = salesQuery;
  const { data: categories = [] } = categoriesQuery;
  const { data: entries = [], isLoading: entriesLoading } = entriesQuery;

  const periodBounds = useMemo(() => {
    const from = dateRange?.from ? new Date(dateRange.from) : undefined;
    const to = dateRange?.to ? new Date(dateRange.to) : from ? new Date(from) : undefined;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]);

  const pageSize = 30;
  const pageEntriesQuery = useFinancialEntriesPage({
    store_id: selectedStore !== "all" ? selectedStore : undefined,
    type: selectedType !== "all" ? selectedType : undefined,
    status: selectedStatus !== "all" ? selectedStatus : undefined,
    category_id: selectedCategory !== "all" && selectedCategory !== "uncategorized" ? selectedCategory : undefined,
    start_date: periodBounds.from?.toISOString().slice(0, 10),
    end_date: periodBounds.to?.toISOString().slice(0, 10),
    page,
    pageSize,
  });

  const periodEntries = useMemo(() => entries.filter(entry => {
    const referenceDate = new Date(entry.payment_date || entry.due_date);
    return (!periodBounds.from || referenceDate >= periodBounds.from) && (!periodBounds.to || referenceDate <= periodBounds.to);
  }), [entries, periodBounds.from?.getTime(), periodBounds.to?.getTime()]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return periodEntries.filter(e => {
      const matchesSearch = !s || e.description?.toLowerCase().includes(s) || e.supplier_customer_name?.toLowerCase().includes(s);
      const matchesStatus = selectedStatus === 'all' || e.status === selectedStatus;
      const matchesCategory = selectedCategory === 'all' || (selectedCategory === 'uncategorized' ? !e.category_id : e.category_id === selectedCategory);
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [periodEntries, search, selectedStatus, selectedCategory]);

  const activeEntries = useMemo(() => filtered.filter(e => e.status !== "cancelled"), [filtered]);
  const pageResult = pageEntriesQuery.data;
  const pageCount = Math.max(1, Math.ceil((pageResult?.total || 0) / pageSize));
  const pagedEntries = useMemo(() => {
    const pageRows = pageResult?.data || [];
    const s = search.toLowerCase();
    return pageRows.filter(e => !s || e.description?.toLowerCase().includes(s) || e.supplier_customer_name?.toLowerCase().includes(s));
  }, [pageResult?.data, search]);
  React.useEffect(() => setPage(1), [search, selectedStore, selectedType, selectedStatus, selectedCategory, periodBounds.from?.getTime(), periodBounds.to?.getTime()]);
  const totalIn  = useMemo(() => activeEntries.filter(e => e.type === "receivable" || e.type === "in").reduce((s, e) => s + e.amount, 0), [activeEntries]);
  const totalOut = useMemo(() => activeEntries.filter(e => e.type === "payable" || e.type === "out").reduce((s, e) => s + e.amount, 0), [activeEntries]);
  const balance  = totalIn - totalOut;

  const getCat   = (id?: string, fallback?: string) => categories.find(c => c.id === id)?.name || fallback || "—";
  const getStore = (id?: string) => stores.find(s => s.id === id)?.name || "—";
  const reverseMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const result = await localApi.operations.reverseFinancialEntry(id, reason);
      if (result.error || !result.data) throw new Error(result.error?.message || 'O servidor não confirmou o estorno.');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries-page'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entry-audits'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      toast({ title: 'Estorno registrado', description: 'O lançamento foi neutralizado e a auditoria foi atualizada.' });
      setReversalDialog(null);
      setReversalReason('');
      setSelectedTx(null);
    },
    onError: (error: any) => toast({ title: 'Não foi possível estornar', description: error?.message || 'Revise a permissão, o motivo e o status do lançamento.', variant: 'destructive' }),
  });
  const deletionMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const result = await localApi.operations.deleteFinancialEntry(id, reason);
      if (result.error || !result.data) throw new Error(result.error?.message || 'O servidor não confirmou a exclusão.');
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries-page'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entry-audits'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      toast({ title: 'Lançamento excluído', description: 'O registro foi removido e a exclusão ficou documentada na auditoria.' });
      setDeletionDialog(null);
      setDeletionReason('');
      setSelectedTx(null);
    },
    onError: (error: any) => toast({ title: 'Não foi possível excluir', description: error?.message || 'Revise a permissão, a origem e o motivo informado.', variant: 'destructive' }),
  });
  const linkedSale = useMemo(() => {
    if (!selectedTx || selectedTx.origin_table !== "sales") return null;
    const originId = selectedTx.origin_id || selectedTx.reference_id;
    return sales.find((sale: any) => sale.id === originId) || null;
  }, [selectedTx, sales]);
  const exportCsv = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Data', 'Descrição', 'Cliente/Fornecedor', 'Tipo', 'Valor original', 'Pago/recebido', 'Saldo restante', 'Status', 'Loja', 'Responsável'],
      ...filtered.map(entry => [
        new Date(entry.due_date || entry.created_at).toLocaleDateString('pt-BR'),
        entry.description,
        entry.supplier_customer_name || '',
        entry.type,
        Number(entry.amount || 0).toFixed(2),
        getEntryPaidAmount(entry).toFixed(2),
        getEntryRemainingAmount(entry).toFixed(2),
        entry.status,
        getStore(entry.store_id),
        entry.last_action_by_name || entry.created_by_name || 'Sistema',
      ]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(';')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `extrato-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (entriesLoading || pageEntriesQuery.isLoading) return <LoadingSpinner message="Carregando extrato..." />;
  const queryError = storesQuery.error || categoriesQuery.error || entriesQuery.error || pageEntriesQuery.error || (canViewSales ? salesQuery.error : null);
  if (queryError) return <ErrorMessage message={queryError instanceof Error ? queryError.message : 'Não foi possível carregar o extrato local.'} retry={() => { void Promise.all([storesQuery.refetch(), categoriesQuery.refetch(), entriesQuery.refetch(), pageEntriesQuery.refetch()]); }} />;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Entradas" value={totalIn} icon={TrendingUp} tone="primary" />
        <KPI label="Saídas" value={totalOut} icon={TrendingDown} tone="negative" />
        <KPI label="Balanço" value={balance} icon={DollarSign} tone="positive" />
        <KPI label="Transações" value={String(activeEntries.length)} icon={Wallet} tone="primary" />
      </div>

      {/* Filters */}
      <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl p-3 flex flex-col md:flex-row gap-2 hover-lift animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Descricao, cliente, fornecedor..."
            className="pl-9 h-10 bg-background/40 border-border/60 rounded-xl text-sm focus-visible:border-primary/40 focus-visible:ring-0"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="h-10 w-full md:w-44 bg-background/40 border-border/60 rounded-xl text-sm hover:border-primary/40">
            <SelectValue placeholder="Loja" />
          </SelectTrigger>
          <SelectContent className="glass border-gradient rounded-xl">
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="h-10 w-full md:w-40 bg-background/40 border-border/60 rounded-xl text-sm hover:border-primary/40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="in">Entradas</SelectItem>
            <SelectItem value="out">Saídas</SelectItem>
            <SelectItem value="receivable">A Receber</SelectItem>
            <SelectItem value="payable">A Pagar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="h-10 w-full md:w-36 bg-background/40 border-border/60 rounded-xl text-sm hover:border-primary/40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="partially_paid">Parcial</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-10 w-full md:w-40 bg-background/40 border-border/60 rounded-xl text-sm hover:border-primary/40"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem value="uncategorized">Sem categoria</SelectItem>
            {categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {canExport && (
          <button type="button" onClick={exportCsv} className="h-10 px-3 rounded-xl border border-primary/30 text-sm font-bold text-primary hover:bg-primary/10 transition-all whitespace-nowrap">
            <Download className="mr-1.5 inline h-3.5 w-3.5" />CSV
          </button>
        )}
        {(search || selectedStore !== "all" || selectedType !== "all" || selectedStatus !== "all" || selectedCategory !== "all") && (
          <button
            onClick={() => { setSearch(""); setSelectedStore("all"); setSelectedType("all"); setSelectedStatus("all"); setSelectedCategory("all"); }}
            className="h-10 px-3 rounded-xl border border-border/60 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all whitespace-nowrap"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        {pagedEntries.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma transação encontrada nesta página.</div>
        ) : (
          <Table className="min-w-[980px] table-fixed">
            <colgroup><col className="w-[14%]" /><col className="w-[29%]" /><col className="w-[25%]" /><col className="w-[16%]" /><col className="w-[16%]" /></colgroup>
            <TableHeader><TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30"><TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Data</TableHead><TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Descrição / Cliente</TableHead><TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Categoria / Loja</TableHead><TableHead className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Valor</TableHead><TableHead className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {pagedEntries.map(entry => {
                const isCancelled = entry.status === "cancelled";
                const isIn = entry.type === "receivable" || entry.type === "in";
                const isOverdue = !isCancelled && entry.status !== "paid" && (entry.status === "overdue" || (entry.status === "pending" && new Date(entry.due_date) < new Date()));
                const st = isOverdue ? STATUS_MAP.overdue : (STATUS_MAP[entry.status] || STATUS_MAP.pending);
                return <TableRow key={entry.id} onClick={() => setSelectedTx(entry)} className={cn("group cursor-pointer border-border/40 transition-colors hover:bg-primary/5", isOverdue && "border-l-[3px] border-l-red-500 bg-red-500/5 hover:bg-red-500/10")}>
                  <TableCell className="align-middle px-4 py-3.5"><div className="text-sm font-bold text-foreground">{new Date(entry.due_date).toLocaleDateString("pt-BR")}</div>{entry.payment_date && <div className="mt-0.5 text-[10px] font-bold text-emerald-600">Pago {new Date(entry.payment_date).toLocaleDateString("pt-BR")}</div>}</TableCell>
                  <TableCell className="align-middle px-4 py-3.5"><div className="flex min-w-0 items-center gap-2.5"><div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm", isIn ? "bg-emerald-500/10" : "bg-red-500/10")}>{isIn ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">{entry.description || "Sem descrição"}</div><div className="mt-0.5 flex min-w-0 items-center gap-2">{entry.supplier_customer_name && <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground"><User className="h-2.5 w-2.5 shrink-0" />{entry.supplier_customer_name}</span>}{isOverdue && <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-red-600"><AlertTriangle className="h-2.5 w-2.5" />{Math.max(0, Math.floor((Date.now() - new Date(entry.due_date).getTime()) / 86400000))}d atraso</span>}</div></div></div></TableCell>
                  <TableCell className="align-middle px-4 py-3.5"><div className="min-w-0 space-y-0.5"><div className="truncate text-sm font-semibold leading-5 text-foreground" title={getCat(entry.category_id, entry.category)}>{getCat(entry.category_id, entry.category)}</div><div className="flex min-w-0 items-center gap-1 truncate text-[11px] leading-4 text-muted-foreground" title={getStore(entry.store_id)}><Store className="h-2.5 w-2.5 shrink-0" />{getStore(entry.store_id)}</div><div className="truncate text-[10px] font-semibold leading-4 text-primary/80" title={entry.last_action_by_name || entry.created_by_name || 'Sistema'}>Responsável: {entry.last_action_by_name || entry.created_by_name || 'Sistema'}</div></div></TableCell>
                  <TableCell className="align-middle px-4 py-3.5 text-right"><span className={cn("text-sm font-black tabular-nums", isCancelled ? "text-muted-foreground" : isIn ? "text-primary" : "text-red-500")}>{!isCancelled && (isIn ? "+" : "-")} {fmt(entry.amount)}</span>{isCancelled && <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Fora dos totais</div>}</TableCell>
                  <TableCell className="align-middle px-4 py-3.5"><span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap", st.bg, st.text)}>{st.label}</span></TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Exibindo {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, pageResult?.total || 0)} de {pageResult?.total || 0} transações</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-muted">Anterior</button>
            <span className="min-w-16 text-center text-xs font-bold text-muted-foreground">{page}/{pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-muted">Próxima</button>
          </div>
        </div>
      )}

      {selectedTx && (
        <DetailModal
          open={!!selectedTx}
          onOpenChange={o => !o && setSelectedTx(null)}
          title="Detalhes da Movimentação"
          subtitle={`ID do lançamento: ${selectedTx.id?.slice(0, 8)}` }
          status={selectedTx.status}
          statusLabel={STATUS_MAP[selectedTx.status]?.label || "Pendente"}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canReverse && selectedTx.status !== 'cancelled' && Number(selectedTx.amount || 0) > 0 && (
                <Button variant="outline" className="h-9 rounded-xl border-amber-500/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300" onClick={() => setReversalDialog(selectedTx)}>
                  Estornar lançamento
                </Button>
              )}
              {canDeleteEntry && !['sales', 'service_orders', 'customers'].includes(String(selectedTx.origin_table || '')) && (
                <Button variant="outline" className="h-9 rounded-xl border-red-500/30 text-red-700 hover:bg-red-500/10 dark:text-red-300" onClick={() => { setDeletionDialog(selectedTx); setDeletionReason(''); }}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir lançamento
                </Button>
              )}
            </div>
          }
        >
          <DetailBlock title="Dados Financeiros" colSpan={6}>
            <DetailItem
              label="Valor original"
              value={
                <span className={cn("font-bold", (selectedTx.type === "receivable" || selectedTx.type === "in") ? "text-emerald-600" : "text-red-500")}>
                  {fmt(Number(selectedTx.original_amount ?? selectedTx.amount ?? 0))}
                </span>
              }
              icon={DollarSign}
            />
            <DetailItem label="Pago / recebido" value={fmt(getEntryPaidAmount(selectedTx))} />
            <DetailItem label="Saldo restante" value={fmt(getEntryRemainingAmount(selectedTx))} />
            {Number(selectedTx.discount_amount || 0) > 0 && <DetailItem label="Desconto aplicado" value={fmt(Number(selectedTx.discount_amount))} icon={Percent} />}
            {(Number(selectedTx.interest_amount || 0) > 0 || Number(selectedTx.fine_amount || 0) > 0) && <DetailItem label="Encargos acumulados" value={fmt(Number(selectedTx.interest_amount || 0) + Number(selectedTx.fine_amount || 0))} />}
            {Number(selectedTx.net_amount || 0) > 0 && <DetailItem label="Valor líquido" value={fmt(Number(selectedTx.net_amount))} icon={Banknote} />}
            <DetailItem label="Forma de pagamento" value={getPaymentMethodLabel(selectedTx.payment_method)} icon={CreditCard} />
            <DetailItem label="Vencimento" value={formatDate(selectedTx.due_date)} icon={Calendar} />
            {selectedTx.payment_date && <DetailItem label="Data de pagamento" value={formatDate(selectedTx.payment_date)} icon={Calendar} />}
            {selectedTx.settled_at && <DetailItem label="Baixado em" value={formatDateTime(selectedTx.settled_at)} icon={Clock} />}
          </DetailBlock>
          <DetailBlock title="Parcelamento e liquidação" colSpan={6}>
            <DetailItem label="Parcela" value={selectedTx.installment_number && selectedTx.installment_total ? `${selectedTx.installment_number} de ${selectedTx.installment_total}` : "Não parcelado"} />
            {selectedTx.installment_group_id && <DetailItem label="Grupo de parcelas" value={selectedTx.installment_group_id} icon={Link2} />}
            {Number(selectedTx.card_fee_amount || 0) > 0 && <DetailItem label="Taxa do cartão" value={`${fmt(Number(selectedTx.card_fee_amount))}${selectedTx.card_fee_percent ? ` · ${Number(selectedTx.card_fee_percent).toLocaleString("pt-BR")} %` : ""}`} />}
            {selectedTx.anticipated_at && <DetailItem label="Antecipado em" value={formatDateTime(selectedTx.anticipated_at)} icon={Calendar} />}
          </DetailBlock>
          <DetailBlock title="Classificação" colSpan={6}>
            <DetailItem label="Categoria" value={getCat(selectedTx.category_id)} icon={Tag} />
            <DetailItem label="Loja" value={getStore(selectedTx.store_id)} icon={Store} />
            {selectedTx.origin_table && (
              <DetailItem
                label="Origem"
                value={selectedTx.origin_table === "sales" ? "Venda" : selectedTx.origin_table === "service_orders" ? "Ordem de Servico" : "Manual"}
                icon={Receipt}
              />
            )}
          </DetailBlock>
          <DetailBlock title="Rastreamento da venda" colSpan={12}>
            <DetailItem label="ID da venda" value={linkedSale?.id || selectedTx.origin_id || "Não vinculado"} icon={Link2} />
            <DetailItem label="Cliente" value={linkedSale?.customerName || selectedTx.supplier_customer_name || "Cliente não informado"} icon={User} />
            {linkedSale && <DetailItem label="Itens da venda" value={`${linkedSale.items?.reduce((total: number, item: any) => total + Number(item.qty || 0), 0) || 0} unidade(s)`} />}
            {linkedSale && <DetailItem label="Subtotal da venda" value={fmt(Number(linkedSale.total || 0) + Number(linkedSale.discount || 0))} />}
            {linkedSale && Number(linkedSale.discount || 0) > 0 && <DetailItem label="Desconto da venda" value={fmt(Number(linkedSale.discount))} icon={Percent} />}
            {linkedSale && <DetailItem label="Total líquido da venda" value={fmt(Number(linkedSale.total || 0))} icon={Banknote} />}
            {linkedSale?.service_order_id && <DetailItem label="O.S. vinculada" value={linkedSale.service_order_id} icon={Receipt} />}
            {linkedSale?.status && <DetailItem label="Status comercial" value={linkedSale.status === "cancelled" ? "Cancelada" : linkedSale.status === "completed" ? "Concluída" : linkedSale.status} icon={ShieldCheck} />}
            {!linkedSale && selectedTx.origin_table === "sales" && <p className="text-xs text-muted-foreground">A venda vinculada não está disponível na consulta atual, mas o lançamento permanece associado pelo ID de origem.</p>}
          </DetailBlock>
          <DetailBlock title="Informações adicionais" colSpan={12}>
            <DetailItem label="Descrição" value={selectedTx.description || "Sem descrição"} />
            {selectedTx.payment_note && <DetailItem label="Comentário do pagamento" value={selectedTx.payment_note} />}
            {selectedTx.is_reconciled && <DetailItem label="Conciliação" value="Conciliado" />}
            {selectedTx.supplier_customer_name && (
              <DetailItem label="Fornecedor / Cliente" value={selectedTx.supplier_customer_name} icon={User} />
            )}
            <DetailItem label="Criado em" value={formatDateTime(selectedTx.created_at)} icon={Calendar} />
            <DetailItem label="Criado por" value={selectedTx.created_by_name || 'Sistema'} icon={User} />
            {selectedTx.settled_by_name && <DetailItem label="Baixa realizada por" value={selectedTx.settled_by_name} icon={User} />}
            {selectedTx.updated_by_name && selectedTx.updated_by_name !== selectedTx.created_by_name && <DetailItem label="Última alteração por" value={selectedTx.updated_by_name} icon={User} />}
          </DetailBlock>
          <DetailBlock title="Histórico de auditoria" colSpan={12}>
            {auditsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            ) : auditsQuery.data?.length ? (
              <div className="space-y-2">
                {auditsQuery.data.map((audit: any) => (
                  <div key={String(audit.id)} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">{audit.action === 'settled' ? 'Baixa total' : audit.action === 'partially_settled' ? 'Baixa parcial' : audit.action === 'reconciled' ? 'Conciliação' : String(audit.action || 'Alteração')}</span>
                      <span className="text-[11px] text-muted-foreground">{audit.user_name || 'Usuário atual'} · {audit.created_at ? new Date(audit.created_at).toLocaleString('pt-BR') : '—'}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Registro imutável da operação financeira.</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum evento de auditoria registrado para este lançamento.</p>
            )}
          </DetailBlock>
        </DetailModal>
      )}

      <Dialog open={!!reversalDialog} onOpenChange={(open) => { if (!open) { setReversalDialog(null); setReversalReason(''); } }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Confirmar estorno</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm">
              <p className="font-bold text-foreground">{reversalDialog?.description || 'Lançamento financeiro'}</p>
              <p className="mt-1 text-muted-foreground">Valor: {fmt(Number(reversalDialog?.amount || 0))}</p>
            </div>
            <div className="space-y-2"><Label htmlFor="statement-reversal-reason">Motivo do estorno</Label><Textarea id="statement-reversal-reason" value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} placeholder="Explique o motivo do estorno" className="min-h-24 resize-none" /></div>
            <Button className="w-full rounded-xl bg-amber-600 text-white hover:bg-amber-700" disabled={!reversalReason.trim() || reverseMutation.isPending} onClick={() => reversalDialog && reverseMutation.mutate({ id: reversalDialog.id, reason: reversalReason.trim() })}>{reverseMutation.isPending ? 'Registrando...' : 'Confirmar estorno'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletionDialog} onOpenChange={(open) => { if (!open) { setDeletionDialog(null); setDeletionReason(''); } }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Excluir lançamento definitivamente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm">
              <p className="font-bold text-foreground">{deletionDialog?.description || 'Lançamento financeiro'}</p>
              <p className="mt-1 text-muted-foreground">Valor registrado: {fmt(Number(deletionDialog?.amount || 0))}</p>
              <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">A ação é permanente e ficará registrada na auditoria.</p>
            </div>
            <div className="space-y-2"><Label htmlFor="statement-deletion-reason">Motivo da exclusão</Label><Textarea id="statement-deletion-reason" value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)} placeholder="Explique por que este lançamento deve ser removido" className="min-h-24 resize-none" /></div>
            <Button className="w-full rounded-xl bg-red-600 text-white hover:bg-red-700" disabled={!deletionReason.trim() || deletionMutation.isPending} onClick={() => deletionDialog && deletionMutation.mutate({ id: deletionDialog.id, reason: deletionReason.trim() })}>{deletionMutation.isPending ? 'Excluindo...' : 'Confirmar exclusão permanente'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
