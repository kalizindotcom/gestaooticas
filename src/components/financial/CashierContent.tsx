import React, { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ArrowUpRight, ArrowDownRight, User, Monitor, Lock, Unlock, Plus, Minus, Search, X, Store, Clock, AlertTriangle, Eye, ChevronRight } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useCashRegistersWithBalance, useOpenCashRegister, useCloseCashRegister, useCashMovements, useCreateCashMovement } from "@/hooks/useFinancialData";
import { useStores } from "@/hooks/useLocalData";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DetailModal, DetailBlock, DetailItem } from "@/components/shared/premium/DetailModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { usePermissions } from '@/contexts/PermissionsContext';

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const CASHIER_KPI_TONES = {
  primary: { card: "bg-primary/[0.06] border-primary/15", icon: "bg-primary/10 text-primary", value: "text-primary" },
  positive: { card: "bg-emerald-500/[0.06] border-emerald-500/15", icon: "bg-emerald-500/10 text-emerald-600", value: "text-emerald-600" },
  negative: { card: "bg-red-500/[0.06] border-red-500/15", icon: "bg-red-500/10 text-red-600", value: "text-red-600" },
} as const;

type CashierKpiTone = keyof typeof CASHIER_KPI_TONES;

function KPI({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: CashierKpiTone }) {
  const styles = CASHIER_KPI_TONES[tone];
  return (
    <div className={cn("rounded-2xl p-4 border hover-lift", styles.card)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("h-7 w-7 rounded-xl flex items-center justify-center", styles.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className={cn("text-xl font-bold", styles.value)}>{typeof value === "number" ? fmt(value) : value}</div>
    </div>
  );
}

function hoursOpen(openedAt: string) {
  const h = Math.floor((Date.now() - new Date(openedAt).getTime()) / 3600000);
  return h;
}

export function CashierContent({ globalDateRange }: { globalDateRange?: import("react-day-picker").DateRange }) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canViewCashier = hasPermission('financial', 'view_cashier');
  const canOpenCash = hasPermission('financial', 'open_cash');
  const canMoveCash = hasPermission('financial', 'cash_movement');
  const canCloseCash = hasPermission('financial', 'close_cash');
  const canViewCashHistory = hasPermission('financial', 'view_cash_history');
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
  React.useEffect(() => { if (globalDateRange) setDateRange(globalDateRange); }, [globalDateRange?.from?.toISOString(), globalDateRange?.to?.toISOString()]);
  const [selectedStore, setSelectedStore] = useState("all");
  const [openingStoreId, setOpeningStoreId] = useState("");
  const [selectedCashier, setSelectedCashier] = useState<any>(null);
  const [openCashierDialog, setOpenCashierDialog] = useState(false);
  const [closeCashierDialog, setCloseCashierDialog] = useState(false);
  const [movementDialog, setMovementDialog] = useState<{ type: "withdrawal" | "reinforcement" | null }>({ type: null });

  const [openingBalance, setOpeningBalance] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");

  const storesQuery = useStores();
  const cashRegistersQuery = useCashRegistersWithBalance({
    store_id: selectedStore !== "all" ? selectedStore : undefined,
    start_date: dateRange?.from ? new Date(new Date(dateRange.from).setHours(0, 0, 0, 0)).toISOString() : undefined,
    end_date: dateRange?.to ? new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString() : undefined,
  });
  const movementsQuery = useCashMovements(selectedCashier?.id && canViewCashHistory ? selectedCashier.id : "");
  const { data: stores = [], isLoading: storesLoading } = storesQuery;
  const { data: cashRegisters = [], isLoading: cashRegistersLoading } = cashRegistersQuery;
  const { data: movements = [] } = movementsQuery;

  const getStore = (id?: string) => stores.find(s => s.id === id)?.name || "Sem loja";
  const parseCashAmount = (value: string) => { const normalized = String(value || '').trim().replace(/R\$\s?/gi, '').replace(/\s/g, ''); return Number(normalized.includes(',') && normalized.includes('.') ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(',', '.')); };

  const openCashRegisterMutation = useOpenCashRegister();
  const closeCashRegisterMutation = useCloseCashRegister();
  const createMovementMutation = useCreateCashMovement();

  const isLoading = storesLoading || cashRegistersLoading;

  if (!canViewCashier) return <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-muted-foreground">Você não possui permissão para visualizar os caixas.</div>;

  const filtered = useMemo(() => {
    if (!search) return cashRegisters;
    const s = search.toLowerCase();
    return cashRegisters.filter(c =>
      getStore(c.store_id).toLowerCase().includes(s) ||
      (c.user_id || "").toLowerCase().includes(s)
    );
  }, [cashRegisters, search, stores]);

  const openCashRegisters = useMemo(() => filtered.filter(c => c.status === "open"), [filtered]);
  const openCount    = openCashRegisters.length;
  const totalInCash  = useMemo(() => filtered.filter(c => c.status === "open").reduce((sum, c) => {
    return sum + (c.movements || []).reduce((acc: number, m: any) => {
      if (m.type === "opening" || m.type === "sale" || m.type === "reinforcement" || m.type === "transfer_in") return acc + Number(m.amount || 0);
      if (m.type === "withdrawal" || m.type === "transfer_out") return acc - Number(m.amount || 0);
      return acc;
    }, 0);
  }, 0), [filtered]);
  const entriesToday = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return filtered.filter(c => new Date(c.opened_at) >= today).reduce((sum, c) =>
      sum + (c.movements || []).filter((m: any) => m.type === "sale" || m.type === "reinforcement" || m.type === "transfer_in").reduce((a: number, m: any) => a + Number(m.amount || 0), 0), 0);
  }, [filtered]);
  const exitsToday   = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return filtered.filter(c => new Date(c.opened_at) >= today).reduce((sum, c) =>
      sum + (c.movements || []).filter((m: any) => m.type === "withdrawal" || m.type === "transfer_out").reduce((a: number, m: any) => a + Number(m.amount || 0), 0), 0);
  }, [filtered]);

  const calcBalance = (cr: any) => (cr.movements || []).reduce((acc: number, m: any) => {
    if (m.type === "opening" || m.type === "sale" || m.type === "reinforcement" || m.type === "transfer_in") return acc + Number(m.amount || 0);
    if (m.type === "withdrawal" || m.type === "transfer_out") return acc - Number(m.amount || 0);
    return acc;
  }, 0);

  const handleOpen = async () => {
    const storeId = openingStoreId || (selectedStore !== "all" ? selectedStore : stores.length === 1 ? stores[0].id : "");
    const amount = parseCashAmount(openingBalance);
    if (!storeId || !openingBalance || !Number.isFinite(amount) || amount < 0) {
      toast({ title: "Dados incompletos", description: "Selecione a loja no próprio modal e informe um saldo inicial válido.", variant: "destructive" }); return;
    }
    try {
      await openCashRegisterMutation.mutateAsync({ store_id: storeId, opening_balance: amount, notes: openingNotes });
      toast({ title: "Caixa aberto", description: "O caixa foi aberto com sucesso." });
      setOpenCashierDialog(false); setOpeningBalance(""); setOpeningNotes(""); setOpeningStoreId("");
    } catch (error) { toast({ title: "Erro ao abrir caixa", description: error instanceof Error ? error.message : "Não foi possível abrir o caixa com os dados informados.", variant: "destructive" }); }
  };

  const handleClose = async () => {
    if (!closingBalance || !selectedCashier) {
      toast({ title: "Erro", description: "Informe o saldo de fechamento.", variant: "destructive" }); return;
    }
    try {
      await closeCashRegisterMutation.mutateAsync({ id: selectedCashier.id, actual_balance: parseCashAmount(closingBalance), notes: closingNotes });
      toast({ title: "Caixa fechado", description: "O caixa foi fechado com sucesso." });
      setCloseCashierDialog(false); setSelectedCashier(null); setClosingBalance(""); setClosingNotes("");
    } catch { toast({ title: "Erro ao fechar caixa", description: "Ocorreu um erro ao fechar o caixa.", variant: "destructive" }); }
  };

  const handleMovement = async () => {
    if (!movementAmount || !movementDialog.type || !selectedCashier) {
      toast({ title: "Erro", description: "Informe o valor e a descricao.", variant: "destructive" }); return;
    }
    try {
      await createMovementMutation.mutateAsync({ cash_register_id: selectedCashier.id, type: movementDialog.type, amount: parseCashAmount(movementAmount), description: movementDescription });
      toast({ title: movementDialog.type === "withdrawal" ? "Sangria registrada" : "Reforco registrado", description: "A movimentacao foi registrada com sucesso." });
      setMovementDialog({ type: null }); setMovementAmount(""); setMovementDescription("");
    } catch { toast({ title: "Erro ao registrar movimentacao", description: "Ocorreu um erro.", variant: "destructive" }); }
  };

  if (isLoading) return <LoadingSpinner message="Carregando caixas..." />;
  const queryError = storesQuery.error || cashRegistersQuery.error || movementsQuery.error;
  if (queryError) return <ErrorMessage message={queryError instanceof Error ? queryError.message : 'Não foi possível carregar os caixas locais.'} retry={() => { void Promise.all([storesQuery.refetch(), cashRegistersQuery.refetch(), movementsQuery.refetch()]); }} />;

  return (
    <div className="space-y-5">
      <FinancialInfoTip title="Como usar Caixas">Abra um caixa por turno, registre sangrias e reforços com motivo e confira a diferença antes de fechar. Vendas e pagamentos em dinheiro aparecem no histórico do caixa.</FinancialInfoTip>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Caixas Abertos" value={String(openCount)} icon={Unlock} tone="positive" />
        <KPI label="Total em Caixa" value={totalInCash} icon={DollarSign} tone="primary" />
        <KPI label="Entradas Hoje" value={entriesToday} icon={ArrowUpRight} tone="positive" />
        <KPI label="Saídas Hoje" value={exitsToday} icon={ArrowDownRight} tone="negative" />
      </div>

      {/* Long-open warning */}
      {filtered.some(c => c.status === "open" && hoursOpen(c.opened_at) > 8) && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
          <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <span className="text-sm font-bold text-amber-700">
            {filtered.filter(c => c.status === "open" && hoursOpen(c.opened_at) > 8).length} caixa(s) aberto(s) ha mais de 8 horas. Verifique o fechamento.
          </span>
        </div>
      )}

      {openCashRegisters.length > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-3 shadow-sm">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Unlock className="h-3.5 w-3.5" /></span><div className="min-w-0"><h3 className="truncate text-xs font-bold uppercase tracking-wider">Caixa atual</h3><p className="truncate text-[10px] text-muted-foreground">{openCashRegisters.length} caixa(s) aberto(s) neste filtro</p></div></div>
            <span className="hidden text-[10px] text-muted-foreground sm:block">Clique para visualizar detalhes e fechar</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {openCashRegisters.map((cashier: any) => {
              const balance = calcBalance(cashier);
              const entries = (cashier.movements || []).filter((m: any) => ["sale", "reinforcement", "transfer_in"].includes(m.type)).reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0);
              const exits = (cashier.movements || []).filter((m: any) => ["withdrawal", "transfer_out"].includes(m.type)).reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0);
              return <button type="button" key={cashier.id} onClick={() => setSelectedCashier(cashier)} className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"><div className="min-w-0"><div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /><span className="truncate text-xs font-bold">{getStore(cashier.store_id)}</span></div><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{cashier.opened_by_name || cashier.user_name || "Operador não informado"} · aberto {hoursOpen(cashier.opened_at)}h</p><p className="mt-1 text-[10px] text-muted-foreground"><span className="text-emerald-600">+{fmt(entries)}</span><span className="mx-1">·</span><span className="text-red-500">-{fmt(exits)}</span></p></div><div className="flex items-center gap-2"><div className="text-right"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Saldo atual</p><p className="text-sm font-black text-primary">{fmt(balance)}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></div></button>;
            })}
          </div>
        </section>
      )}

      {/* Filters + action */}
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/60 p-3 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar caixa..."
            className="pl-9 h-10 rounded-xl border-border/60 bg-background/40 text-sm focus-visible:border-primary/40 focus-visible:ring-0"
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
          <SelectTrigger className="h-10 w-full md:w-44 rounded-xl border-border/60 bg-background/40 text-sm hover:border-primary/40">
            <SelectValue placeholder="Loja" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {canOpenCash && <Button
          onClick={() => { setOpeningStoreId(selectedStore !== "all" ? selectedStore : stores.length === 1 ? stores[0].id : ""); setOpenCashierDialog(true); }}
          className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 whitespace-nowrap"
        >
          <Unlock className="h-4 w-4" /> Abrir Caixa
        </Button>}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-x-auto shadow-sm">
        <div className="grid min-w-[900px] grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] bg-muted/30 border-b border-border/60 px-4 py-2.5 gap-4">
          {["Data / Loja", "Operador", "Saldo Inicial", "Movimentacao", "Saldo Atual", "Status"].map(h => (
            <span key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">Nenhum caixa encontrado.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(cr => {
              const balance = calcBalance(cr);
      const entries = (cr.movements || []).filter((m: any) => m.type === "sale" || m.type === "reinforcement").reduce((s: number, m: any) => s + Number(m.amount || 0), 0);
      const exits   = (cr.movements || []).filter((m: any) => m.type === "withdrawal").reduce((s: number, m: any) => s + Number(m.amount || 0), 0);
              const isOpen  = cr.status === "open";
              const hours   = isOpen ? hoursOpen(cr.opened_at) : 0;
              const isLong  = isOpen && hours > 8;
              return (
                <div
                  key={cr.id}
                  onClick={() => setSelectedCashier(cr)}
                  className={cn(
                    "grid min-w-[900px] grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3.5 cursor-pointer transition-colors hover:bg-primary/5 group",
                    isLong && "border-l-[3px] border-l-amber-400 bg-amber-500/5"
                  )}
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground/80">{new Date(cr.opened_at).toLocaleDateString("pt-BR")}</div>
                    <div className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                      <Store className="h-2.5 w-2.5" />{getStore(cr.store_id)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">{cr.opened_by_name || cr.user_name || cr.user_id?.slice(0, 8) || "Sistema"}</span>
                  </div>

                  <div className="text-sm font-medium text-foreground/80 tabular-nums">{fmt(cr.opening_balance)}</div>

                  <div>
                    <div className="text-[11px] font-bold text-emerald-600">+{fmt(entries)}</div>
                    <div className="text-[11px] font-bold text-red-500 mt-0.5">-{fmt(exits)}</div>
                  </div>

                  <div className="text-sm font-bold text-foreground tabular-nums">{fmt(balance)}</div>

                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" aria-label={`Visualizar caixa de ${getStore(cr.store_id)}`} className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={(event) => { event.stopPropagation(); setSelectedCashier(cr); }}><Eye className="h-3.5 w-3.5" /></Button>
                    {isOpen ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Aberto{isLong ? ` · ${hours}h` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                        Fechado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedCashier && (() => {
        const balance = calcBalance(selectedCashier);
        const entries = (selectedCashier.movements || []).filter((m: any) => m.type === "sale" || m.type === "reinforcement").reduce((s: number, m: any) => s + m.amount, 0);
        const exits   = (selectedCashier.movements || []).filter((m: any) => m.type === "withdrawal").reduce((s: number, m: any) => s + m.amount, 0);
        return (
          <DetailModal
            open={!!selectedCashier}
            onOpenChange={o => !o && setSelectedCashier(null)}
            title={`Caixa: ${getStore(selectedCashier.store_id)}`}
            subtitle={`Abertura: ${new Date(selectedCashier.opened_at).toLocaleString("pt-BR")}`}
            status={selectedCashier.status === "open" ? "pending" : "paid"}
            actions={
              selectedCashier.status === "open" && (canMoveCash || canCloseCash) && (
                <div className="flex gap-2">
                  {canMoveCash && <>
                    <Button variant="outline" className="h-10 rounded-xl gap-2" onClick={() => setMovementDialog({ type: "withdrawal" })}>
                      <Minus className="h-4 w-4" /> Sangria
                    </Button>
                    <Button variant="outline" className="h-10 rounded-xl gap-2" onClick={() => setMovementDialog({ type: "reinforcement" })}>
                      <Plus className="h-4 w-4" /> Reforço
                    </Button>
                  </>}
                  {canCloseCash && <Button className="h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => { setClosingBalance(calcBalance(selectedCashier).toFixed(2)); setCloseCashierDialog(true); }}>
                    <Lock className="h-4 w-4 mr-2" /> Fechar Caixa
                  </Button>}
                </div>
              )
            }
          >
            <DetailBlock title="Resumo do Periodo" colSpan={12}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <DetailItem label="Saldo Inicial" value={fmt(selectedCashier.opening_balance)} icon={Lock} />
                <DetailItem label="Total Entradas" value={<span className="text-emerald-600 font-bold">{fmt(entries)}</span>} icon={ArrowUpRight} />
                <DetailItem label="Total Saidas"   value={<span className="text-red-500 font-bold">{fmt(exits)}</span>} icon={ArrowDownRight} />
                <DetailItem label="Saldo Atual"    value={<span className="text-primary font-bold">{fmt(balance)}</span>} icon={DollarSign} />
              </div>
            </DetailBlock>

            {selectedCashier.status === "closed" && selectedCashier.difference !== undefined && (
              <DetailBlock title="Fechamento" colSpan={12}>
                <div className="grid grid-cols-3 gap-6">
                  <DetailItem label="Saldo Esperado" value={fmt(selectedCashier.expected_balance || 0)} />
                  <DetailItem label="Saldo Contado"  value={fmt(selectedCashier.actual_balance || 0)} />
                  <DetailItem label="Diferenca" value={
                    <span className={selectedCashier.difference === 0 ? "text-emerald-600" : "text-red-500"}>
                      {fmt(Math.abs(selectedCashier.difference))}{selectedCashier.difference !== 0 ? ` (${selectedCashier.difference > 0 ? "Sobra" : "Falta"})` : ""}
                    </span>
                  } />
                </div>
              </DetailBlock>
            )}

            {canViewCashHistory ? <DetailBlock title="Movimentações" colSpan={12}>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {movements.length === 0 ? (
                  <p className="text-muted-foreground/70 text-sm text-center py-4">Nenhuma movimentacao registrada.</p>
                ) : movements.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", (m.type === "sale" || m.type === "reinforcement" || m.type === "transfer_in") ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500")}>
                        {(m.type === "sale" || m.type === "reinforcement" || m.type === "transfer_in") ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {m.type === "opening" ? "Abertura" : m.type === "closing" ? "Fechamento" : m.type === "sale" ? "Venda" : m.type === "withdrawal" ? "Sangria" : "Reforco"}
                        </p>
                        <p className="text-xs text-muted-foreground/70">{m.description || "Sem descricao"}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-primary">Responsável: {m.created_by_name || m.created_by?.slice(0, 8) || "Sistema"}</p>
                      </div>
                    </div>
                    <span className={cn("font-bold text-sm", (m.type === "sale" || m.type === "reinforcement" || m.type === "transfer_in") ? "text-emerald-600" : "text-red-500")}>
                      {(m.type === "sale" || m.type === "reinforcement" || m.type === "transfer_in") ? "+" : "-"}{fmt(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </DetailBlock> : <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">O histórico de movimentações está restrito a usuários com a permissão financeira correspondente.</div>}

            <DetailBlock title="Responsáveis" colSpan={12}>
              <DetailItem label="Operador Abertura" value={selectedCashier.opened_by_name || selectedCashier.user_name || selectedCashier.user_id?.slice(0, 8) || "Sistema"} icon={User} />
              {selectedCashier.closed_by && <DetailItem label="Operador Fechamento" value={selectedCashier.closed_by_name || selectedCashier.closed_by.slice(0, 8)} icon={Lock} />}
              <DetailItem label="Loja" value={getStore(selectedCashier.store_id)} icon={Monitor} />
              {selectedCashier.notes && <DetailItem label="Observacoes" value={selectedCashier.notes} />}
            </DetailBlock>
          </DetailModal>
        );
      })()}

      {/* Open dialog */}
      <Dialog open={openCashierDialog} onOpenChange={setOpenCashierDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription>Informe o saldo inicial para abertura do caixa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Loja do caixa</Label>
              <Select value={openingStoreId || (selectedStore !== "all" ? selectedStore : stores.length === 1 ? stores[0].id : "")} onValueChange={setOpeningStoreId}>
                <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent><SelectItem value="all" disabled>Selecione a loja</SelectItem>{stores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">A loja é obrigatória para vincular o caixa ao escopo correto.</p>
            </div>
            <div className="space-y-2">
              <Label>Saldo Inicial (R$)</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Observacoes (opcional)</Label>
              <Textarea value={openingNotes} onChange={e => setOpeningNotes(e.target.value)} placeholder="Observacoes sobre a abertura..." rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpenCashierDialog(false)}>Cancelar</Button>
              <Button onClick={handleOpen} disabled={openCashRegisterMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {openCashRegisterMutation.isPending ? "Abrindo..." : "Abrir Caixa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={closeCashierDialog} onOpenChange={setCloseCashierDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
            <DialogDescription>Informe o saldo contado para fechamento do caixa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Saldo Contado (R$)</Label>
              <Input type="number" step="0.01" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Observacoes (opcional)</Label>
              <Textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)} placeholder="Observacoes sobre o fechamento..." rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCloseCashierDialog(false)}>Cancelar</Button>
              <Button onClick={handleClose} disabled={closeCashRegisterMutation.isPending} className="bg-red-500 hover:bg-red-600 text-white">
                {closeCashRegisterMutation.isPending ? "Fechando..." : "Fechar Caixa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement dialog */}
      <Dialog open={!!movementDialog.type} onOpenChange={() => setMovementDialog({ type: null })}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{movementDialog.type === "withdrawal" ? "Registrar Sangria" : "Registrar Reforco"}</DialogTitle>
            <DialogDescription>
              {movementDialog.type === "withdrawal" ? "Retire dinheiro do caixa para deposito ou seguranca." : "Adicione dinheiro ao caixa para troco ou reforco."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea value={movementDescription} onChange={e => setMovementDescription(e.target.value)} placeholder="Motivo da movimentacao..." rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setMovementDialog({ type: null })}>Cancelar</Button>
              <Button
                onClick={handleMovement}
                disabled={createMovementMutation.isPending}
                className={movementDialog.type === "withdrawal" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"}
              >
                {createMovementMutation.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
