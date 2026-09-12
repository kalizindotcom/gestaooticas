import React, { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, User, Phone, MapPin, Calendar, AlertTriangle, CreditCard, ShoppingBag, CheckCircle2, Search, X, Store, Clock } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useFinancialEntries, useFinancialCategories, useMarkAsPaid } from '@/hooks/useFinancialData';
import { useStores, useCustomers } from "@/hooks/useLocalData";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DetailModal, DetailBlock, DetailItem } from "@/components/shared/premium/DetailModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { usePermissions } from '@/contexts/PermissionsContext';

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const getReceivedAmount = (entry: any) => {
  if (entry.status === "cancelled") return 0;
  return entry.type === "in" ? Number(entry.amount || 0) : Number(entry.paid_amount || (entry.status === "paid" ? entry.amount : 0) || 0);
};
const getRemainingAmount = (entry: any) => entry.type === "receivable" ? Math.max(Number(entry.amount || 0) - getReceivedAmount(entry), 0) : 0;
const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debit", label: "Cartão de débito" },
  { value: "credit", label: "Cartão de crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "transfer", label: "Transferência" },
] as const;
const getPaymentMethodLabel = (value?: string) => PAYMENT_METHODS.find(method => method.value === value)?.label || ({ "Cartao Debito": "Cartão de débito", "Cartao Credito": "Cartão de crédito", Transferencia: "Transferência" } as Record<string, string>)[value || ""] || value || "Não informado";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  paid:      { label: "Recebido",  bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
  overdue:   { label: "Vencido",   bg: "bg-red-500/10", text: "text-red-700 dark:text-red-300" },
  pending:   { label: "Pendente",  bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300" },
  partially_paid: { label: "Parcial", bg: "bg-primary/10", text: "text-primary" },
  cancelled: { label: "Cancelado", bg: "bg-muted", text: "text-muted-foreground" },
};

const RECEIVABLE_KPI_TONES = {
  primary: { card: "bg-primary/[0.06] border-primary/15", glow: "from-primary/25 to-orange-500/5", icon: "from-primary to-orange-700", label: "text-primary", value: "text-primary" },
  positive: { card: "bg-emerald-500/[0.06] border-emerald-500/15", glow: "from-emerald-500/20 to-transparent", icon: "from-emerald-500 to-teal-600", label: "text-emerald-600", value: "text-emerald-600" },
  negative: { card: "bg-red-500/[0.06] border-red-500/15", glow: "from-red-500/20 to-transparent", icon: "from-red-500 to-rose-600", label: "text-red-600", value: "text-red-600" },
  warning: { card: "bg-amber-500/[0.06] border-amber-500/15", glow: "from-amber-500/20 to-orange-500/5", icon: "from-amber-500 to-orange-600", label: "text-amber-600", value: "text-amber-600" },
} as const;

type ReceivableKpiTone = keyof typeof RECEIVABLE_KPI_TONES;

function KPI({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: ReceivableKpiTone }) {
  const styles = RECEIVABLE_KPI_TONES[tone];
  return (
    <div className={cn("group relative rounded-2xl p-4 border hover-lift overflow-hidden animate-fade-in-up", styles.card)}>
      <div className={cn("absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br opacity-20 blur-2xl group-hover:opacity-40 transition-opacity", styles.glow)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className={cn("text-[10px] font-bold uppercase tracking-[0.15em]", styles.label)}>{label}</span>
          <div className={"relative"}>
            <div className={cn("absolute inset-0 rounded-lg blur-sm opacity-50 bg-gradient-to-br", styles.icon)} />
            <div className={cn("relative h-7 w-7 rounded-lg grid place-items-center bg-gradient-to-br shadow-sm", styles.icon)}>
              <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
            </div>
          </div>
        </div>
        <div className={cn("text-xl font-heading font-black tracking-tight", styles.value)}>{fmt(value)}</div>
      </div>
    </div>
  );
}

export function AccountsReceivableContent({ globalDateRange }: { globalDateRange?: import("react-day-picker").DateRange }) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canSettle = hasPermission('financial', 'settle_entry');
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0),
  });
  React.useEffect(() => { if (globalDateRange) setDateRange(globalDateRange); }, [globalDateRange?.from?.toISOString(), globalDateRange?.to?.toISOString()]);
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [paymentDialog, setPaymentDialog] = useState<{ entryId: string; amount: number } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");

  const storesQuery = useStores();
  const customersQuery = useCustomers();
  const categoriesQuery = useFinancialCategories("income");
  const entriesQuery = useFinancialEntries({
    types: ["receivable"],
    store_id: selectedStore !== "all" ? selectedStore : undefined,
    status: selectedStatus !== "all" && selectedStatus !== "overdue" ? selectedStatus : undefined,
  });
  const { data: stores = [], isLoading: storesLoading } = storesQuery;
  const { data: customers = [], isLoading: customersLoading } = customersQuery;
  const { data: categories = [], isLoading: categoriesLoading } = categoriesQuery;
  const { data: entries = [], isLoading: entriesLoading } = entriesQuery;

  const markAsPaidMutation = useMarkAsPaid();
  const isLoading = storesLoading || customersLoading || categoriesLoading || entriesLoading;

  const periodBounds = useMemo(() => {
    const from = dateRange?.from ? new Date(dateRange.from) : undefined;
    const to = dateRange?.to ? new Date(dateRange.to) : from ? new Date(from) : undefined;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(23, 59, 59, 999);
    return { from, to };
  }, [dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]);

  const periodEntries = useMemo(() => entries.filter(entry => {
    const dueDate = new Date(entry.due_date);
    const paidDate = entry.payment_date && getReceivedAmount(entry) > 0 ? new Date(entry.payment_date) : null;
    const dueInPeriod = (!periodBounds.from || dueDate >= periodBounds.from) && (!periodBounds.to || dueDate <= periodBounds.to);
    const paidInPeriod = !!paidDate && (!periodBounds.from || paidDate >= periodBounds.from) && (!periodBounds.to || paidDate <= periodBounds.to);
    return dueInPeriod || paidInPeriod;
  }), [entries, periodBounds.from?.getTime(), periodBounds.to?.getTime()]);

  const statusEntries = useMemo(() => {
    if (selectedStatus !== "overdue") return periodEntries;
    const now = new Date();
    return periodEntries.filter(entry => entry.status === "overdue" || ((entry.status === "pending" || entry.status === "partially_paid") && new Date(entry.due_date) < now));
  }, [periodEntries, selectedStatus]);

  const filtered = useMemo(() => {
    const categoryName = selectedCategory === "all" ? "" : categories.find(category => category.id === selectedCategory)?.name || "";
    const searchTerm = search.trim().toLowerCase();
    return statusEntries.filter(entry => {
      const matchesSearch = !searchTerm || entry.description?.toLowerCase().includes(searchTerm) || entry.supplier_customer_name?.toLowerCase().includes(searchTerm);
      const matchesCategory = selectedCategory === "all" || String(entry.category_id || "") === selectedCategory || String(entry.category || "") === categoryName;
      const matchesPayment = selectedPaymentFilter === "all" || String(entry.payment_method || "") === selectedPaymentFilter;
      return Boolean(matchesSearch && matchesCategory && matchesPayment);
    });
  }, [statusEntries, search, selectedCategory, selectedPaymentFilter, categories]);

  const venceNoPeriodo = useMemo(() => filtered.filter(e => {
    if (e.status === "paid" || e.status === "cancelled") return false;
    const d = new Date(e.due_date);
    return (!periodBounds.from || d >= periodBounds.from) && (!periodBounds.to || d <= periodBounds.to);
  }).reduce((s, e) => s + getRemainingAmount(e), 0), [filtered, periodBounds.from?.getTime(), periodBounds.to?.getTime()]);

  const overdue = useMemo(() => filtered.filter(e => {
    if (e.status === "paid" || e.status === "cancelled") return false;
    const d = new Date(e.due_date);
    const isOverdue = e.status === "overdue" || ((e.status === "pending" || e.status === "partially_paid") && d < new Date());
    return isOverdue && (!periodBounds.from || d >= periodBounds.from) && (!periodBounds.to || d <= periodBounds.to);
  }).reduce((s, e) => s + getRemainingAmount(e), 0), [filtered, periodBounds.from?.getTime(), periodBounds.to?.getTime()]);

  const recebidoNoPeriodo = useMemo(() => filtered.filter(e => {
    if (getReceivedAmount(e) <= 0 || !e.payment_date) return false;
    const d = new Date(e.payment_date);
    return (!periodBounds.from || d >= periodBounds.from) && (!periodBounds.to || d <= periodBounds.to);
  }).reduce((s, e) => s + getReceivedAmount(e), 0), [filtered, periodBounds.from?.getTime(), periodBounds.to?.getTime()]);

  const aReceberAinda = useMemo(() => filtered.filter(e => {
    if (e.status !== "pending" && e.status !== "partially_paid") return false;
    const d = new Date(e.due_date);
    return (!periodBounds.from || d >= periodBounds.from) && (!periodBounds.to || d <= periodBounds.to);
  }).reduce((s, e) => s + getRemainingAmount(e), 0), [filtered, periodBounds.from?.getTime(), periodBounds.to?.getTime()]);

  const getCustomer = (id?: string) => customers.find(c => c.id === id);
  const getStore    = (id?: string) => stores.find(s => s.id === id)?.name || "Sem loja";

  const openPaymentDialog = (entry: any) => {
    const remaining = getRemainingAmount(entry);
    setPaymentDialog({ entryId: entry.id, amount: remaining });
    setPaymentAmount(remaining.toFixed(2));
    setInterestAmount('');
    setFineAmount('');
    setDiscountAmount('');
    setPaymentNote("");
  };

  const handleMarkAsPaid = async () => {
    if (!paymentDialog) return;
    const amount = Number(String(paymentAmount).replace(',', '.'));
    const interest = Number(String(interestAmount || '0').replace(',', '.')) || 0;
    const fine = Number(String(fineAmount || '0').replace(',', '.')) || 0;
    const discount = Number(String(discountAmount || '0').replace(',', '.')) || 0;
    if ([interest, fine, discount].some(value => value < 0) || !Number.isFinite(amount) || amount <= 0 || amount > paymentDialog.amount + 0.001) {
      toast({ title: "Valor inválido", description: `Informe um valor entre R$ 0,01 e ${fmt(paymentDialog.amount)}.`, variant: "destructive" });
      return;
    }
    try {
      await markAsPaidMutation.mutateAsync({ id: paymentDialog.entryId, amount, paymentDate: new Date().toISOString(), paymentMethod: selectedPaymentMethod, paymentNote: paymentNote.trim() || undefined, interestAmount: interest, fineAmount: fine, discountAmount: discount });
      toast({ title: amount >= paymentDialog.amount - 0.001 ? "Parcela baixada" : "Recebimento parcial registrado", description: amount >= paymentDialog.amount - 0.001 ? "A parcela foi quitada com sucesso." : "O saldo restante foi atualizado." });
      setPaymentDialog(null);
      setPaymentAmount("");
      setInterestAmount('');
      setFineAmount('');
      setDiscountAmount('');
      setPaymentNote("");
      setSelectedAccount(null);
    } catch (error) {
      toast({ title: "Erro ao registrar recebimento", description: error instanceof Error ? error.message : "Ocorreu um erro ao marcar a parcela como paga.", variant: "destructive" });
    }
  };

  if (isLoading) return <LoadingSpinner message="Carregando contas a receber..." />;
      const queryError = storesQuery.error || customersQuery.error || categoriesQuery.error || entriesQuery.error;
      if (queryError) return <ErrorMessage message={queryError instanceof Error ? queryError.message : 'Não foi possível carregar as contas a receber.'} retry={() => { void Promise.all([storesQuery.refetch(), customersQuery.refetch(), categoriesQuery.refetch(), entriesQuery.refetch()]); }} />;

  return (
    <div className="space-y-5">
      <FinancialInfoTip title="Como usar Contas a Receber">Receba o total ou apenas uma parte. O saldo restante permanece no Financeiro e na ficha do cliente até a quitação completa.</FinancialInfoTip>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Vence no Período" value={venceNoPeriodo} icon={Calendar} tone="primary" />
        <KPI label="Vencidas" value={overdue} icon={AlertTriangle} tone="negative" />
        <KPI label="Recebido no Período" value={recebidoNoPeriodo} icon={CheckCircle2} tone="positive" />
        <KPI label="A Receber Ainda" value={aReceberAinda} icon={DollarSign} tone="warning" />
      </div>

      {/* Urgency banner */}
      {overdue > 0 && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 backdrop-blur-sm rounded-2xl px-4 py-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 grid place-items-center shadow-md shadow-red-500/30 shrink-0">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
              <span className="text-sm font-bold text-red-700 dark:text-red-300">
              {filtered.filter(e => e.status !== "paid" && e.status !== "cancelled" && (e.status === "overdue" || ((e.status === "pending" || e.status === "partially_paid") && new Date(e.due_date) < new Date()))).length} parcela(s) vencida(s) — {fmt(overdue)} em atraso
            </span>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Entre em contato com os clientes para regularização.</p>
          </div>
          <button onClick={() => setSelectedStatus("overdue")} className="text-xs font-bold text-red-600 hover:text-red-800 dark:text-red-300 transition-colors whitespace-nowrap px-2 py-1 rounded-lg hover:bg-red-500/10">
            Ver agora
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl p-3 flex flex-col md:flex-row gap-2 hover-lift animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cliente, descrição..."
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
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="h-10 w-full md:w-36 bg-background/40 border-border/60 rounded-xl text-sm hover:border-primary/40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="glass border-gradient rounded-xl">
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="partially_paid">Parciais</SelectItem>
            <SelectItem value="overdue">Vencidas</SelectItem>
            <SelectItem value="paid">Recebidas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-10 w-full md:w-44 bg-background/40 border-border/60 rounded-xl text-sm hover:border-primary/40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="glass border-gradient rounded-xl">
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedPaymentFilter} onValueChange={setSelectedPaymentFilter}>
          <SelectTrigger className="h-10 w-full md:w-44 bg-background/40 border-border/60 rounded-xl text-sm hover:border-primary/40">
            <SelectValue placeholder="Pagamento" />
          </SelectTrigger>
          <SelectContent className="glass border-gradient rounded-xl">
            <SelectItem value="all">Todos os pagamentos</SelectItem>
            {PAYMENT_METHODS.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || selectedStore !== "all" || selectedStatus !== "all" || selectedCategory !== "all" || selectedPaymentFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setSelectedStore("all"); setSelectedStatus("all"); setSelectedCategory("all"); setSelectedPaymentFilter("all"); }}
            className="h-10 px-3 rounded-xl border border-border/60 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all whitespace-nowrap"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-x-auto hover-lift animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="grid min-w-[900px] grid-cols-[2fr_1.5fr_1fr_1fr_auto_auto] bg-muted/30 border-b border-border/60 px-4 py-3 gap-4">
          {["Cliente / Contato", "Descrição / Loja", "Valor", "Vencimento", "Status", ""].map(h => (
            <span key={h} className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">Nenhuma conta a receber encontrada.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(entry => {
              const customer = getCustomer(entry.customer_id);
              const isOverdue = entry.status !== "paid" && entry.status !== "cancelled" && getRemainingAmount(entry) > 0 && (entry.status === "overdue" || ((entry.status === "pending" || entry.status === "partially_paid") && new Date(entry.due_date) < new Date()));
              const daysOverdue = isOverdue ? Math.max(0, Math.floor((Date.now() - new Date(entry.due_date).getTime()) / 86400000)) : 0;
              const st = isOverdue ? STATUS_MAP.overdue : (STATUS_MAP[entry.status] || STATUS_MAP.pending);
              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedAccount(entry)}
                  className={cn(
                    "grid min-w-[900px] grid-cols-[2fr_1.5fr_1fr_1fr_auto_auto] gap-4 items-center px-4 py-3.5 cursor-pointer transition-colors hover:bg-primary/5 hover-lift animate-fade-in group",
                    isOverdue && "border-l-[3px] border-l-red-500 bg-red-500/5 hover:bg-red-500/10"
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {entry.supplier_customer_name || customer?.name || "Cliente não identificado"}
                    </div>
                    {customer?.phone && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-2.5 w-2.5" />{customer.phone}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm text-foreground/80 truncate">{entry.description || "Sem descrição"}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Store className="h-2.5 w-2.5" />{getStore(entry.store_id)}
                    </div>
                    <div className="text-[10px] text-primary/80 font-semibold truncate mt-0.5">Responsável: {entry.last_action_by_name || entry.created_by_name || 'Sistema'}</div>
                  </div>

                  <div>
                    <span className="text-sm font-black text-primary tabular-nums">{fmt(entry.amount)}</span>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-foreground">{new Date(entry.due_date).toLocaleDateString("pt-BR")}</div>
                    {isOverdue && (
                      <div className="text-[10px] font-black text-red-600 mt-0.5">{daysOverdue}d em atraso</div>
                    )}
                  </div>

                  <div>
                    <span                       className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap", st.bg, st.text)}>
                      {st.label}
                    </span>
                  </div>

                  <div onClick={e => e.stopPropagation()}>
                    {canSettle && entry.status !== "paid" && entry.status !== "cancelled" && getRemainingAmount(entry) > 0 && (
                      <button
                        onClick={() => openPaymentDialog(entry)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold whitespace-nowrap"
                      >
                        Baixar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedAccount && (() => {
        const customer = getCustomer(selectedAccount.customer_id);
        const selectedIsOverdue = selectedAccount.status !== "paid" && selectedAccount.status !== "cancelled" && (selectedAccount.status === "overdue" || ((selectedAccount.status === "pending" || selectedAccount.status === "partially_paid") && new Date(selectedAccount.due_date) < new Date()));
        const daysOverdue = selectedIsOverdue
          ? Math.max(0, Math.floor((Date.now() - new Date(selectedAccount.due_date).getTime()) / 86400000)) : 0;
        return (
          <DetailModal
            open={!!selectedAccount}
            onOpenChange={o => !o && setSelectedAccount(null)}
            title={`Conta a Receber: ${selectedAccount.supplier_customer_name || customer?.name || "Cliente"}`}
            subtitle={selectedAccount.description || "Sem descricao"}
            status={selectedIsOverdue ? "overdue" : selectedAccount.status}
              actions={
                canSettle && selectedAccount.status !== "paid" && selectedAccount.status !== "cancelled" && getRemainingAmount(selectedAccount) > 0 && (
                <Button
                  className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                  onClick={() => openPaymentDialog(selectedAccount)}
                >
                  Baixar Parcela
                </Button>
              )
            }
          >
            {selectedIsOverdue && (
              <div className="col-span-12 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-4 mb-2">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h4 className="text-red-700 dark:text-red-300 font-bold text-sm">Parcela Vencida há {daysOverdue} {daysOverdue === 1 ? "dia" : "dias"}</h4>
                  <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">Entre em contato com o cliente para regularização.</p>
                </div>
              </div>
            )}
            <DetailBlock title="Dados Financeiros" colSpan={6}>
              <DetailItem label="Valor original" value={fmt(Number(selectedAccount.original_amount ?? selectedAccount.amount ?? 0))} icon={DollarSign} />
              <DetailItem label="Juros acumulados" value={fmt(Number(selectedAccount.interest_amount || 0))} />
              <DetailItem label="Multa acumulada" value={fmt(Number(selectedAccount.fine_amount || 0))} />
              <DetailItem label="Desconto acumulado" value={fmt(Number(selectedAccount.discount_amount || 0))} />
              <DetailItem label="Valor líquido" value={fmt(Number(selectedAccount.net_amount ?? selectedAccount.amount ?? 0))} />
              <DetailItem label="Já recebido" value={fmt(getReceivedAmount(selectedAccount))} />
              <DetailItem label="Saldo principal restante" value={fmt(getRemainingAmount(selectedAccount))} />
              <DetailItem label="Data de Vencimento" value={new Date(selectedAccount.due_date).toLocaleDateString("pt-BR")} icon={Calendar} />
              <DetailItem label="Método de Cobrança" value={getPaymentMethodLabel(selectedAccount.payment_method)} icon={CreditCard} />
              {selectedAccount.payment_date && (
                <DetailItem label="Data de Pagamento" value={new Date(selectedAccount.payment_date).toLocaleDateString("pt-BR")} icon={Calendar} />
              )}
            </DetailBlock>
            <DetailBlock title="Informacoes do Cliente" colSpan={6}>
              <DetailItem label="Cliente" value={selectedAccount.supplier_customer_name || customer?.name || "Não identificado"} icon={User} />
              {customer?.phone && <DetailItem label="Telefone" value={customer.phone} icon={Phone} />}
              {customer?.address && <DetailItem label="Endereco" value={customer.address} icon={MapPin} />}
              <DetailItem label="Loja" value={getStore(selectedAccount.store_id)} icon={Store} />
            </DetailBlock>
            {selectedAccount.origin_table && (
              <DetailBlock title="Origem da Divida" colSpan={12}>
                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedAccount.origin_table === "sales" ? "Venda" : "Ordem de Servico"} #{selectedAccount.origin_id?.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Criado em {new Date(selectedAccount.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              </DetailBlock>
            )}
            <DetailBlock title="Informacoes Adicionais" colSpan={12}>
              <DetailItem label="Descrição Completa" value={selectedAccount.description || "Sem descrição"} />
              <DetailItem label="Criado em" value={new Date(selectedAccount.created_at).toLocaleString("pt-BR")} icon={Calendar} />
              <DetailItem label="Criado por" value={selectedAccount.created_by_name || 'Sistema'} icon={User} />
              {selectedAccount.settled_by_name && <DetailItem label="Baixa realizada por" value={selectedAccount.settled_by_name} icon={User} />}
              {selectedAccount.updated_by_name && selectedAccount.updated_by_name !== selectedAccount.created_by_name && <DetailItem label="Última alteração por" value={selectedAccount.updated_by_name} icon={User} />}
            </DetailBlock>
          </DetailModal>
        );
      })()}

      {/* Payment dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={o => !o && setPaymentDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-primary/10 rounded-xl p-4 text-center border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Saldo disponível para receber</p>
              <p className="text-2xl font-bold text-primary">{fmt(paymentDialog?.amount || 0)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receivable-payment-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor deste recebimento</Label>
              <Input id="receivable-payment-amount" type="number" min="0.01" max={paymentDialog?.amount || undefined} step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Você pode registrar uma parte agora e quitar o restante depois.</p>
            </div>
            <FinancialInfoTip title="Ajustes do recebimento">Use juros ou multa quando houver atraso e desconto quando houver acordo. Esses valores permanecem no detalhe e na auditoria do lançamento.</FinancialInfoTip>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Juros</Label><Input value={interestAmount} onChange={e => setInterestAmount(e.target.value)} inputMode="decimal" placeholder="0,00" /></div>
              <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Multa</Label><Input value={fineAmount} onChange={e => setFineAmount(e.target.value)} inputMode="decimal" placeholder="0,00" /></div>
              <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Desconto</Label><Input value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} inputMode="decimal" placeholder="0,00" /></div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs"><span className="text-muted-foreground">Valor líquido deste recebimento: </span><strong>{fmt(Math.max((Number(String(paymentAmount || '0').replace(',', '.')) || 0) + (Number(String(interestAmount || '0').replace(',', '.')) || 0) + (Number(String(fineAmount || '0').replace(',', '.')) || 0) - (Number(String(discountAmount || '0').replace(',', '.')) || 0), 0))}</strong></div>
            <div className="space-y-2">
              <Label htmlFor="receivable-payment-note" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comentário (opcional)</Label>
              <Textarea id="receivable-payment-note" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Ex.: recebido no balcão, comprovante..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Forma de Recebimento</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.value}
                    onClick={() => setSelectedPaymentMethod(method.value)}
                    className={cn(
                      "h-10 rounded-xl text-sm font-medium transition-all border",
                      selectedPaymentMethod === method.value
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border text-foreground/80 hover:bg-muted"
                    )}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-0 font-bold"
              onClick={handleMarkAsPaid}
              disabled={markAsPaidMutation.isPending}
            >
              {markAsPaidMutation.isPending ? "Registrando..." : "Confirmar Recebimento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
