import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck, CloudOff, Download, Eye, FileCheck2, FileText, Filter, KeyRound, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Settings2, ShieldCheck, Timer, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { localApi, type FiscalConfig, type FiscalDocument, type FiscalStatus, type FiscalType } from '@/lib/localApi';
import { toast } from 'sonner';

type DraftState = { type: FiscalType; customer: string; customerDocument: string; total: string; origin: string; note: string };
type ConfigDraft = Omit<FiscalConfig, 'company_id' | 'store_id'> & { company_id: string; store_id: string };

const defaultConfig: ConfigDraft = {
  company_id: '',
  store_id: '',
  environment: 'homologacao',
  tax_regime: '',
  provider: '',
  cnpj: '',
  municipal_registration: '',
  state_registration: '',
  nfce_series: '1',
  nfe_series: '1',
  nfse_series: '1',
};

const statusMeta: Record<FiscalStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  draft: { label: 'Rascunho', className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300', icon: Pencil },
  validation_pending: { label: 'Validação pendente', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300', icon: Timer },
  queued: { label: 'Na fila', className: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300', icon: Timer },
  processing: { label: 'Processando', className: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300', icon: RefreshCw },
  simulation: { label: 'Simulação local', className: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300', icon: CloudOff },
  authorized: { label: 'Autorizada', className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300', icon: CheckCircle2 },
  rejected: { label: 'Rejeitada', className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300', icon: XCircle },
  communication_failed: { label: 'Falha de comunicação', className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300', icon: AlertTriangle },
  denied: { label: 'Denegada', className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300', icon: XCircle },
  cancelled: { label: 'Cancelada', className: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300', icon: AlertTriangle },
  inutilized: { label: 'Inutilizada', className: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300', icon: AlertTriangle },
  contingency: { label: 'Contingência', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300', icon: Timer },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(value: string | null | undefined) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function normalizeDocument(value: string) {
  return value.replace(/\D/g, '').slice(0, 14);
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Não foi possível concluir a operação.');
  return 'Não foi possível concluir a operação fiscal.';
}

export default function Fiscal() {
  const { hasPermission } = usePermissions();
  const { selectedCompanyId, selectedStoreIds, companies, stores } = useGlobalFilter();
  const queryClient = useQueryClient();
  const canView = hasPermission('fiscal', 'view');
  const canCreate = hasPermission('fiscal', 'create');
  const canEdit = hasPermission('fiscal', 'edit');
  const canDelete = hasPermission('fiscal', 'delete');
  const canEmit = hasPermission('fiscal', 'emit');
  const canCancel = hasPermission('fiscal', 'cancel');
  const canConfigure = hasPermission('fiscal', 'configure');
  const canViewProtocol = hasPermission('fiscal', 'view_protocol');
  const canViewTax = hasPermission('fiscal', 'view_tax_details');
  const canAudit = hasPermission('fiscal', 'view_audit');
  const canDownloadXml = hasPermission('fiscal', 'download_xml');
  const canImport = hasPermission('fiscal', 'import');

  const selectedStore = selectedStoreIds?.length === 1 ? stores.find((store) => store.id === selectedStoreIds[0]) : undefined;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const singleStoreId = selectedStoreIds?.length === 1 ? selectedStoreIds[0] : undefined;

  const documentsQuery = useQuery({
    queryKey: ['fiscal-documents', selectedCompanyId, singleStoreId],
    queryFn: async () => {
      const result = await localApi.fiscal.listDocuments({ company_id: selectedCompanyId || undefined, store_id: singleStoreId, limit: 100 });
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: Boolean(canView && selectedCompanyId),
  });

  const configQuery = useQuery({
    queryKey: ['fiscal-config', selectedCompanyId, singleStoreId],
    queryFn: async () => {
      if (!selectedCompanyId || !singleStoreId) return null;
      const result = await localApi.fiscal.getConfig(selectedCompanyId, singleStoreId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: Boolean(canView && selectedCompanyId && singleStoreId),
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FiscalStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | FiscalType>('all');
  const [openNew, setOpenNew] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<DraftState>({ type: 'NFC-e', customer: '', customerDocument: '', total: '', origin: 'Venda', note: '' });
  const [configDraft, setConfigDraft] = useState<ConfigDraft>(defaultConfig);
  const [openImport, setOpenImport] = useState(false);
  const [xmlContent, setXmlContent] = useState('');
  const [xmlPreview, setXmlPreview] = useState<Record<string, unknown> | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const xmlImportsQuery = useQuery({
    queryKey: ['fiscal-xml-imports', selectedCompanyId, singleStoreId],
    queryFn: async () => {
      const result = await localApi.fiscal.listXmlImports({ company_id: selectedCompanyId || undefined, store_id: singleStoreId });
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: Boolean(canImport && selectedCompanyId),
  });

  const detailQuery = useQuery({
    queryKey: ['fiscal-document', selectedDocumentId],
    queryFn: async () => {
      const result = await localApi.fiscal.getDocument(String(selectedDocumentId));
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: Boolean(selectedDocumentId),
  });

  const documents = documentsQuery.data || [];
  const selectedDocument = detailQuery.data?.document || documents.find((document) => document.id === selectedDocumentId) || null;
  const baseConfig: ConfigDraft = {
    ...defaultConfig,
    ...(configQuery.data || {}),
    company_id: selectedCompanyId || '',
    store_id: singleStoreId || '',
    environment: configQuery.data?.environment === 'producao' ? 'producao' : 'homologacao',
    provider: String(configQuery.data?.provider || ''),
    tax_regime: String(configQuery.data?.tax_regime || ''),
    cnpj: String(configQuery.data?.cnpj || ''),
    state_registration: String(configQuery.data?.state_registration || ''),
    municipal_registration: String(configQuery.data?.municipal_registration || ''),
    nfce_series: String(configQuery.data?.nfce_series || '1'),
    nfe_series: String(configQuery.data?.nfe_series || '1'),
    nfse_series: String(configQuery.data?.nfse_series || '1'),
  };
  const configured = Boolean(baseConfig.cnpj && baseConfig.provider && baseConfig.provider !== 'Ainda não configurado');

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents
      .filter((document) => statusFilter === 'all' || document.status === statusFilter)
      .filter((document) => typeFilter === 'all' || document.type === typeFilter)
      .filter((document) => !term || [document.number, document.series, document.customer_name, document.customer_document, document.origin_table, document.origin_id, document.access_key].some((value) => String(value || '').toLowerCase().includes(term)))
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }, [documents, search, statusFilter, typeFilter]);

  const metrics = useMemo(() => ({
    total: documents.length,
    authorized: documents.filter((document) => document.status === 'authorized').length,
    pending: documents.filter((document) => ['validation_pending', 'queued', 'processing'].includes(document.status)).length,
    rejected: documents.filter((document) => ['rejected', 'denied', 'communication_failed'].includes(document.status)).length,
    cancelled: documents.filter((document) => ['cancelled', 'inutilized'].includes(document.status)).length,
  }), [documents]);

  function invalidateFiscal() {
    void queryClient.invalidateQueries({ queryKey: ['fiscal-documents'] });
    void queryClient.invalidateQueries({ queryKey: ['fiscal-config'] });
    if (selectedDocumentId) void queryClient.invalidateQueries({ queryKey: ['fiscal-document', selectedDocumentId] });
    void queryClient.invalidateQueries({ queryKey: ['fiscal-xml-imports'] });
  }

  function openConfigDialog() {
    setConfigDraft(baseConfig);
    setOpenConfig(true);
  }

  async function handleCreateDraft() {
    if (!canCreate) return toast.error('Você não possui permissão para criar documentos fiscais.');
    const total = Number(draft.total.replace(',', '.'));
    if (!draft.customer.trim()) return toast.error('Informe o destinatário da nota.');
    if (!Number.isFinite(total) || total <= 0) return toast.error('Informe um valor total maior que zero.');
    if (!selectedCompanyId || !singleStoreId) return toast.error('Selecione exatamente uma empresa e uma loja antes de criar a nota.');
    setIsSaving(true);
    const operation = draft.origin.toLowerCase().includes('manual') ? 'manual' : draft.type === 'NFS-e' ? 'service' : 'sale';
    const result = await localApi.fiscal.createDocument({
      company_id: selectedCompanyId,
      store_id: singleStoreId,
      type: draft.type,
      operation,
      customer_name: draft.customer.trim(),
      customer_document: normalizeDocument(draft.customerDocument),
      total,
      notes: draft.note.trim(),
      origin_table: draft.origin.toLowerCase().includes('venda') ? 'sales' : draft.origin.toLowerCase().includes('o.s') ? 'service_orders' : null,
      manual: operation === 'manual',
      items: [],
    });
    setIsSaving(false);
    if (result.error || !result.data) return toast.error(errorMessage(result.error));
    setSelectedDocumentId(result.data.document.id);
    setOpenNew(false);
    setDraft({ type: 'NFC-e', customer: '', customerDocument: '', total: '', origin: 'Venda', note: '' });
    invalidateFiscal();
    toast.success('Rascunho fiscal salvo no banco local.');
  }

  async function handleTransmit(document: FiscalDocument) {
    if (!canEmit) return toast.error('Você não possui permissão para emitir documentos fiscais.');
    const result = await localApi.fiscal.transmitDocument(document.id);
    if (result.error || !result.data) return toast.error(errorMessage(result.error));
    setSelectedDocumentId(document.id);
    invalidateFiscal();
    toast.success('Simulação local concluída. Nenhuma transmissão real foi realizada.');
  }

  async function handleResend(document: FiscalDocument) {
    if (!hasPermission('fiscal', 'resend')) return toast.error('Você não possui permissão para reenviar documentos fiscais.');
    const result = await localApi.fiscal.resendDocument(document.id);
    if (result.error || !result.data) return toast.error(errorMessage(result.error));
    setSelectedDocumentId(document.id);
    invalidateFiscal();
    toast.success('Reenvio local registrado. Nenhuma transmissão real foi realizada.');
  }

  async function handleCancel(document: FiscalDocument) {
    if (!canCancel) return toast.error('Você não possui permissão para cancelar documentos fiscais.');
    const reason = window.prompt('Informe o motivo do cancelamento:');
    if (!reason?.trim()) return;
    const result = await localApi.fiscal.createEvent(document.id, 'cancel', reason.trim());
    if (result.error) return toast.error(errorMessage(result.error));
    invalidateFiscal();
    toast.success('Evento fiscal registrado conforme o bloqueio de integração atual.');
  }

  async function handleDeleteDraft(document: FiscalDocument) {
    if (!canDelete) return toast.error('Você não possui permissão para excluir rascunhos fiscais.');
    if (document.status !== 'draft') return toast.error('Somente rascunhos podem ser removidos nesta etapa.');
    if (!window.confirm(`Excluir o rascunho de ${document.customer_name} no valor de ${formatCurrency(document.total)}?`)) return;
    const result = await localApi.fiscal.deleteDocument(document.id);
    if (result.error) return toast.error(errorMessage(result.error));
    setSelectedDocumentId(null);
    invalidateFiscal();
    toast.success('Rascunho excluído com auditoria no banco local.');
  }

  async function handlePreviewXmlImport() {
    if (!canImport) return toast.error('Você não possui permissão para importar XML fiscal.');
    if (!selectedCompanyId || !singleStoreId) return toast.error('Selecione exatamente uma empresa e uma loja antes de importar XML.');
    if (xmlContent.trim().length < 20) return toast.error('Cole um XML fiscal para gerar a prévia.');
    setIsImporting(true);
    const result = await localApi.fiscal.previewXmlImport({ company_id: selectedCompanyId, store_id: singleStoreId, raw_xml: xmlContent });
    setIsImporting(false);
    if (result.error || !result.data) return toast.error(errorMessage(result.error));
    setXmlPreview(result.data.import);
    toast.success(result.data.duplicate ? 'Este XML já possui uma prévia registrada para a empresa e loja.' : 'Prévia do XML registrada. Revise antes de confirmar.');
  }

  async function handleConfirmXmlImport() {
    if (!canImport || !xmlPreview?.id) return;
    setIsImporting(true);
    const result = await localApi.fiscal.confirmXmlImport(String(xmlPreview.id));
    setIsImporting(false);
    if (result.error || !result.data) return toast.error(errorMessage(result.error));
    setXmlPreview(null);
    setXmlContent('');
    setOpenImport(false);
    invalidateFiscal();
    toast.success('Importação XML confirmada somente como registro fiscal. Estoque e Financeiro permanecem inalterados.');
  }

  async function handleSaveConfig() {
    if (!canConfigure) return toast.error('Você não possui permissão para configurar a Gestão Fiscal.');
    if (!configDraft.company_id || !configDraft.store_id) return toast.error('Selecione uma empresa e uma loja para configurar.');
    const digits = String(configDraft.cnpj || '').replace(/\D/g, '');
    if (digits && digits.length !== 14) return toast.error('O CNPJ informado precisa conter 14 dígitos.');
    const result = await localApi.fiscal.saveConfig({ ...configDraft, cnpj: digits || null, provider: configDraft.provider.trim() || '' });
    if (result.error || !result.data) return toast.error(errorMessage(result.error));
    setOpenConfig(false);
    invalidateFiscal();
    toast.success('Configuração fiscal salva no SQLite. A transmissão continua bloqueada até a integração oficial.');
  }

  if (!canView) {
    return (
      <Card className="mx-auto max-w-xl border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-bold">Acesso fiscal restrito</h1>
          <p className="text-sm text-muted-foreground">Seu perfil não possui permissão para visualizar a Gestão Fiscal. Solicite acesso ao administrador.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"><FileCheck2 className="h-4 w-4 text-primary" /> Operações / Fiscal</div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Gestão Fiscal</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Controle persistente de NF-e, NFC-e e NFS-e por empresa e loja, com preparação segura para homologação e auditoria.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => { void documentsQuery.refetch(); void configQuery.refetch(); toast.success('Dados fiscais atualizados do banco local.'); }} disabled={documentsQuery.isFetching}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          {canImport && <Button variant="outline" className="gap-2" onClick={() => { setXmlPreview(null); setOpenImport(true); }}><Upload className="h-4 w-4" /> Importar XML</Button>}
          {canConfigure && <Button variant="outline" className="gap-2" onClick={openConfigDialog}><Settings2 className="h-4 w-4" /> Configuração fiscal</Button>}
          {canCreate && <Button className="gap-2" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Nova nota</Button>}
        </div>
      </div>

      <FinancialInfoTip title="Como usar a Gestão Fiscal" description="Crie rascunhos, revise os dados e configure o escopo de empresa e loja. Nesta etapa local, o envio fica limitado à simulação persistida; nenhum documento é transmitido a órgãos fiscais." />

      {!selectedCompanyId || !singleStoreId ? <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">Selecione uma empresa e uma única loja no filtro global para criar documentos e editar a configuração fiscal. A listagem pode ser consultada por empresa quando houver uma loja diferente selecionada.</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Todos os documentos" value={metrics.total} icon={FileText} /><MetricCard label="Autorizadas" value={metrics.authorized} icon={CheckCircle2} tone="green" /><MetricCard label="Pendentes" value={metrics.pending} icon={Timer} tone="amber" /><MetricCard label="Rejeitadas/falhas" value={metrics.rejected} icon={AlertTriangle} tone="red" /><MetricCard label="Canceladas" value={metrics.cancelled} icon={XCircle} tone="orange" /></div>

      {canImport && <Card className="border-border/70"><CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4"><div><CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4 text-primary" /> Importações XML</CardTitle><p className="mt-1 text-xs text-muted-foreground">Pré-visualizações e confirmações registradas neste escopo.</p></div><Badge variant="outline">{xmlImportsQuery.data?.length || 0} registro(s)</Badge></CardHeader>{xmlImportsQuery.data?.length ? <CardContent className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">{xmlImportsQuery.data.slice(0, 3).map((item) => <div key={String(item.id)} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"><p className="text-xs font-semibold">{String(item.supplier_name || 'Fornecedor não identificado')}</p><p className="mt-1 text-[11px] text-muted-foreground">{String(item.access_key || 'Chave não identificada')} · {formatCurrency(Number(item.total || 0))}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{String(item.status || 'preview')}</p></div>)}</CardContent> : <CardContent className="px-5 pb-5 text-xs text-muted-foreground">Nenhum XML importado neste escopo. A confirmação não altera estoque ou Financeiro.</CardContent>}</Card>}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-card/80 px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><CardTitle className="text-base">Documentos fiscais</CardTitle><p className="mt-1 text-xs text-muted-foreground">Escopo atual: {selectedCompany?.name || 'empresa não selecionada'} · {selectedStore?.name || (selectedStoreIds?.length ? `${selectedStoreIds.length} lojas` : 'loja não selecionada')}</p></div><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1 sm:flex-none"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nota, cliente ou chave..." className="h-9 pl-9" /></div><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | FiscalStatus)}><SelectTrigger className="h-9 w-[170px]"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(statusMeta).map(([key, value]) => <SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent></Select><Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | FiscalType)}><SelectTrigger className="h-9 w-[125px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="NFC-e">NFC-e</SelectItem><SelectItem value="NF-e">NF-e</SelectItem><SelectItem value="NFS-e">NFS-e</SelectItem></SelectContent></Select></div></div></CardHeader>
        <CardContent className="p-0">
          {documentsQuery.isLoading ? <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">Carregando documentos fiscais do SQLite...</div> : documentsQuery.error ? <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-5 text-center"><AlertTriangle className="h-8 w-8 text-red-500" /><p className="font-semibold">Não foi possível carregar os documentos fiscais.</p><p className="text-sm text-muted-foreground">{errorMessage(documentsQuery.error)}</p><Button size="sm" variant="outline" onClick={() => void documentsQuery.refetch()}>Tentar novamente</Button></div> : filteredDocuments.length === 0 ? <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-5 py-12 text-center"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted"><FileText className="h-6 w-6 text-muted-foreground" /></div><div><h2 className="font-bold">Nenhum documento encontrado</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Crie um rascunho fiscal pelo botão “Nova nota” ou ajuste os filtros. Documentos reais só entram após uma integração homologada.</p></div>{canCreate && <Button size="sm" onClick={() => setOpenNew(true)} className="gap-2"><Plus className="h-4 w-4" /> Criar primeiro rascunho</Button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-border/60 bg-muted/25 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-5 py-3">Documento</th><th className="px-4 py-3">Destinatário</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Data/hora</th><th className="px-4 py-3">Status</th><th className="w-12 px-4 py-3" /></tr></thead><tbody>{filteredDocuments.map((document) => <FiscalRow key={document.id} document={document} onView={() => setSelectedDocumentId(document.id)} onTransmit={() => void handleTransmit(document)} onResend={() => void handleResend(document)} onCancel={() => void handleCancel(document)} onDelete={() => void handleDeleteDraft(document)} canEmit={canEmit} canCancel={canCancel} canDelete={canDelete} canResend={hasPermission('fiscal', 'resend')} />)}</tbody></table></div>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"><Card><CardHeader className="px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-primary" /> Checklist antes de transmitir</CardTitle></CardHeader><CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2">{[['Empresa e loja definidas', Boolean(selectedCompanyId && singleStoreId)], ['CNPJ configurado', String(baseConfig.cnpj || '').replace(/\D/g, '').length === 14], ['Ambiente selecionado', Boolean(baseConfig.environment)], ['Provedor fiscal definido', configured], ['Permissão de emissão', canEmit], ['Auditoria disponível', canAudit]].map(([label, ok]) => <div key={String(label)} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"><span className="text-xs font-medium">{label}</span>{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}</div>)}</CardContent></Card><Card><CardHeader className="px-5 py-4"><CardTitle className="flex items-center gap-2 text-base"><CloudOff className="h-4 w-4 text-muted-foreground" /> Limites da etapa local</CardTitle></CardHeader><CardContent className="space-y-3 px-5 pb-5 text-sm text-muted-foreground"><p>Rascunhos, eventos de simulação e auditoria ficam salvos no banco local, não no navegador. A transmissão para SEFAZ ou prefeitura ainda está bloqueada.</p><Separator /><p>Número oficial, chave, protocolo, XML válido, DANFE e DANFSe só serão criados após um provedor fiscal oficial, credenciais protegidas e homologação correspondente.</p></CardContent></Card></div>

      <Dialog open={openNew} onOpenChange={setOpenNew}><DialogContent className="!flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0"><DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4"><DialogTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-primary" /> Novo rascunho fiscal</DialogTitle><DialogDescription>Os dados serão gravados no SQLite local e não serão transmitidos.</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tipo de documento</Label><Select value={draft.type} onValueChange={(value) => setDraft({ ...draft, type: value as FiscalType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NFC-e">NFC-e · consumidor</SelectItem><SelectItem value="NF-e">NF-e · mercadoria</SelectItem><SelectItem value="NFS-e">NFS-e · serviço</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Origem</Label><Input value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} placeholder="Venda, O.S. ou Manual" /></div><div className="space-y-2 sm:col-span-2"><Label>Destinatário *</Label><Input value={draft.customer} onChange={(event) => setDraft({ ...draft, customer: event.target.value })} placeholder="Nome ou razão social" /></div><div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={draft.customerDocument} onChange={(event) => setDraft({ ...draft, customerDocument: event.target.value })} placeholder="Opcional nesta etapa" /></div><div className="space-y-2"><Label>Valor total *</Label><Input inputMode="decimal" value={draft.total} onChange={(event) => setDraft({ ...draft, total: event.target.value })} placeholder="0,00" /></div><div className="space-y-2 sm:col-span-2"><Label>Observação interna</Label><Input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Referência da venda, O.S. ou instruções" /></div></div></div><DialogFooter className="shrink-0 border-t border-border/60 px-5 py-4"><Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button><Button onClick={() => void handleCreateDraft()} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar rascunho'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={openConfig} onOpenChange={setOpenConfig}><DialogContent className="!flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0"><DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4"><DialogTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-primary" /> Configuração fiscal por loja</DialogTitle><DialogDescription>Campos fiscais são persistidos no servidor local. Certificados, tokens e senhas não são aceitos nesta tela.</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><div className="mb-4 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Escopo: <strong>{selectedCompany?.name || 'empresa não selecionada'}</strong> · <strong>{selectedStore?.name || 'loja não selecionada'}</strong></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Ambiente</Label><Select value={configDraft.environment} onValueChange={(value) => setConfigDraft({ ...configDraft, environment: value as ConfigDraft['environment'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="homologacao">Homologação · testes</SelectItem><SelectItem value="producao">Produção · bloqueada até integração</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Regime tributário</Label><Input value={configDraft.tax_regime || ''} onChange={(event) => setConfigDraft({ ...configDraft, tax_regime: event.target.value })} placeholder="Informado pelo contador" /></div><div className="space-y-2"><Label>Provedor fiscal</Label><Input value={configDraft.provider} onChange={(event) => setConfigDraft({ ...configDraft, provider: event.target.value })} placeholder="Ainda não definido" /></div><div className="space-y-2"><Label>CNPJ da empresa</Label><Input value={configDraft.cnpj || ''} onChange={(event) => setConfigDraft({ ...configDraft, cnpj: event.target.value })} placeholder="00.000.000/0000-00" /></div><div className="space-y-2"><Label>Inscrição estadual</Label><Input value={configDraft.state_registration || ''} onChange={(event) => setConfigDraft({ ...configDraft, state_registration: event.target.value })} placeholder="Quando aplicável" /></div><div className="space-y-2"><Label>Inscrição municipal</Label><Input value={configDraft.municipal_registration || ''} onChange={(event) => setConfigDraft({ ...configDraft, municipal_registration: event.target.value })} placeholder="Quando aplicável" /></div><div className="space-y-2"><Label>Série NFC-e</Label><Input value={configDraft.nfce_series} onChange={(event) => setConfigDraft({ ...configDraft, nfce_series: event.target.value })} /></div><div className="space-y-2"><Label>Série NF-e</Label><Input value={configDraft.nfe_series} onChange={(event) => setConfigDraft({ ...configDraft, nfe_series: event.target.value })} /></div><div className="space-y-2"><Label>Série NFS-e</Label><Input value={configDraft.nfse_series} onChange={(event) => setConfigDraft({ ...configDraft, nfse_series: event.target.value })} /></div></div><div className="mt-5 rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200"><div className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0" /><p>Não coloque certificado A1, token, CSC ou senha aqui. A etapa de integração deverá armazenar segredos apenas no servidor e com procedimento oficial.</p></div></div></div><DialogFooter className="shrink-0 border-t border-border/60 px-5 py-4"><Button variant="outline" onClick={() => setOpenConfig(false)}>Cancelar</Button><Button onClick={() => void handleSaveConfig()}>Salvar configuração</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={openImport} onOpenChange={(open) => { setOpenImport(open); if (!open) { setXmlPreview(null); setXmlContent(''); } }}><DialogContent className="!flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0"><DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4"><DialogTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" /> Importar XML fiscal</DialogTitle><DialogDescription>A prévia é registrada com hash no SQLite. Nenhum estoque, financeiro ou documento de entrada é criado automaticamente.</DialogDescription></DialogHeader><div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5"><div className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">Importe somente XML de origem confiável. A confirmação atual registra a entrada para análise; a escrituração, estoque e lançamento financeiro continuam sendo operações separadas.</div><div className="space-y-2"><Label>Conteúdo XML</Label><Textarea value={xmlContent} onChange={(event) => { setXmlContent(event.target.value); setXmlPreview(null); }} placeholder="Cole aqui o XML fiscal completo" className="min-h-[220px] resize-y font-mono text-xs" /></div>{xmlPreview && <Card className="border-primary/25 bg-primary/[0.03]"><CardHeader className="px-4 py-3"><CardTitle className="text-sm">Prévia para confirmação</CardTitle></CardHeader><CardContent className="grid gap-3 px-4 pb-4 sm:grid-cols-2"><InfoTile label="Fornecedor/remetente" value={String(xmlPreview.supplier_name || 'Não identificado')} /><InfoTile label="Chave de acesso" value={String(xmlPreview.access_key || 'Não identificada')} /><InfoTile label="Data de emissão" value={String(xmlPreview.issue_date || 'Não identificada')} /><InfoTile label="Total encontrado" value={formatCurrency(Number(xmlPreview.total || 0))} /><InfoTile label="Hash" value={String(xmlPreview.raw_hash || 'Calculado no servidor')} /><div className="sm:col-span-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Confirme apenas se os dados conferem. Esta etapa não interpreta tributos nem cria movimentações correlatas.</div></CardContent></Card>}</div><DialogFooter className="shrink-0 border-t border-border/60 px-5 py-4"><Button variant="outline" onClick={() => setOpenImport(false)}>Cancelar</Button>{xmlPreview ? <Button onClick={() => void handleConfirmXmlImport()} disabled={isImporting}>{isImporting ? 'Confirmando...' : 'Confirmar prévia'}</Button> : <Button onClick={() => void handlePreviewXmlImport()} disabled={isImporting}>{isImporting ? 'Lendo XML...' : 'Gerar prévia'}</Button>}</DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(selectedDocumentId)} onOpenChange={(open) => !open && setSelectedDocumentId(null)}><DialogContent className="!flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0"><DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4"><div className="flex items-start justify-between gap-4"><div><DialogTitle className="flex items-center gap-2 text-lg"><FileCheck2 className="h-5 w-5 text-primary" /> Detalhes fiscais</DialogTitle><DialogDescription>{selectedDocument?.type} · série {selectedDocument?.series} · número {selectedDocument?.number || 'pendente'}</DialogDescription></div>{selectedDocument && <FiscalStatusBadge status={selectedDocument.status} />}</div></DialogHeader>{selectedDocument && <><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{detailQuery.isFetching && <p className="mb-3 text-xs text-muted-foreground">Atualizando detalhe e auditoria...</p>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><InfoTile label="Destinatário" value={selectedDocument.customer_name} /><InfoTile label="CPF/CNPJ" value={selectedDocument.customer_document || 'Não informado'} /><InfoTile label="Origem" value={selectedDocument.origin_table || 'Manual'} /><InfoTile label="Valor total" value={formatCurrency(selectedDocument.total)} /><InfoTile label="Criado em" value={formatDate(selectedDocument.created_at)} /><InfoTile label="Ambiente" value={selectedDocument.environment === 'homologacao' ? 'Homologação' : 'Produção bloqueada'} /></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><Card className="bg-muted/20"><CardHeader className="px-4 py-3"><CardTitle className="text-sm">Transmissão</CardTitle></CardHeader><CardContent className="space-y-3 px-4 pb-4 text-sm"><InfoTile label="Chave de acesso" value={canViewProtocol ? (selectedDocument.access_key || 'Ainda não gerada') : 'Restrita por permissão'} /><InfoTile label="Protocolo" value={canViewProtocol ? (selectedDocument.protocol || 'Ainda não disponível') : 'Restrito por permissão'} /><InfoTile label="Detalhes tributários" value={canViewTax ? 'Disponíveis após integração oficial' : 'Restritos por permissão'} /><InfoTile label="Mensagem do sistema" value={selectedDocument.error_message || 'Nenhuma'} /></CardContent></Card><Card className="bg-muted/20"><CardHeader className="px-4 py-3"><CardTitle className="text-sm">Rastreamento</CardTitle></CardHeader><CardContent className="space-y-3 px-4 pb-4 text-sm"><InfoTile label="Empresa" value={companies.find((company) => company.id === selectedDocument.company_id)?.name || selectedDocument.company_id} /><InfoTile label="Loja" value={stores.find((store) => store.id === selectedDocument.store_id)?.name || selectedDocument.store_id} /><InfoTile label="Criado por" value={selectedDocument.created_by_name || selectedDocument.created_by || 'Sistema'} /><InfoTile label="Auditoria" value={canAudit ? `${detailQuery.data?.audits.length || 0} registro(s)` : 'Restrita por permissão'} /></CardContent></Card></div><div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observação</p><p className="mt-1">{selectedDocument.notes || 'Nenhuma observação registrada.'}</p></div>{canAudit && detailQuery.data?.events.length ? <div className="mt-5 rounded-xl border border-border/60 bg-muted/20 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eventos registrados</p><div className="mt-3 space-y-2">{detailQuery.data.events.map((event) => <div key={String(event.id)} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs"><div><p className="font-semibold">{String(event.event_type || 'evento')}</p><p className="text-muted-foreground">{String(event.response_message || event.justification || 'Sem mensagem')}</p></div><span className="shrink-0 text-muted-foreground">{formatDate(String(event.created_at || ''))}</span></div>)}</div></div> : null}</div><DialogFooter className="shrink-0 flex-wrap border-t border-border/60 px-5 py-4"><Button variant="outline" onClick={() => setSelectedDocumentId(null)}>Fechar</Button>{selectedDocument.status === 'draft' && canEmit && <Button onClick={() => void handleTransmit(selectedDocument)} className="gap-2"><CloudOff className="h-4 w-4" /> Simular envio</Button>}{selectedDocument.status === 'draft' && canDelete && <Button variant="outline" onClick={() => void handleDeleteDraft(selectedDocument)} className="gap-2 text-destructive"><XCircle className="h-4 w-4" /> Excluir rascunho</Button>}{['simulation', 'communication_failed'].includes(selectedDocument.status) && hasPermission('fiscal', 'resend') && <Button variant="outline" onClick={() => void handleResend(selectedDocument)} className="gap-2"><RefreshCw className="h-4 w-4" /> Reenviar simulação</Button>}{selectedDocument.status === 'authorized' && canCancel && <Button variant="outline" onClick={() => void handleCancel(selectedDocument)} className="gap-2"><XCircle className="h-4 w-4" /> Cancelar nota</Button>}{canDownloadXml && selectedDocument.status === 'authorized' && <Button variant="outline" onClick={() => toast.info('XML será disponibilizado após a integração fiscal homologada.')} className="gap-2"><Download className="h-4 w-4" /> Baixar XML</Button>}</DialogFooter></>}</DialogContent></Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone = 'default' }: { label: string; value: number; icon: typeof FileText; tone?: 'default' | 'green' | 'amber' | 'red' | 'orange' }) {
  const tones = { default: 'text-primary bg-primary/10', green: 'text-emerald-600 bg-emerald-500/10', amber: 'text-amber-600 bg-amber-500/10', red: 'text-red-600 bg-red-500/10', orange: 'text-orange-600 bg-orange-500/10' };
  return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div><div className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></div></CardContent></Card>;
}

function FiscalStatusBadge({ status }: { status: FiscalStatus }) {
  const meta = statusMeta[status] || statusMeta.draft;
  const Icon = meta.icon;
  return <Badge variant="outline" className={`gap-1.5 ${meta.className}`}><Icon className="h-3.5 w-3.5" />{meta.label}</Badge>;
}

function FiscalRow({ document, onView, onTransmit, onResend, onCancel, onDelete, canEmit, canCancel, canDelete, canResend }: { document: FiscalDocument; onView: () => void; onTransmit: () => void; onResend: () => void; onCancel: () => void; onDelete: () => void; canEmit: boolean; canCancel: boolean; canDelete: boolean; canResend: boolean }) {
  return <tr className="group border-b border-border/50 transition-colors last:border-0 hover:bg-muted/25"><td className="px-5 py-3.5"><button className="text-left" onClick={onView}><div className="flex items-center gap-2"><span className="font-bold text-foreground">{document.type}</span><span className="text-xs text-muted-foreground">Série {document.series}</span></div><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">Nº {document.number || 'PENDENTE'}</p></button></td><td className="px-4 py-3.5"><p className="font-semibold">{document.customer_name}</p><p className="text-xs text-muted-foreground">{document.customer_document || 'Documento não informado'}</p></td><td className="px-4 py-3.5 text-muted-foreground">{document.origin_table || 'Manual'}</td><td className="px-4 py-3.5 font-bold">{formatCurrency(document.total)}</td><td className="px-4 py-3.5 text-xs text-muted-foreground">{formatDate(document.created_at)}</td><td className="px-4 py-3.5"><FiscalStatusBadge status={document.status} /></td><td className="px-4 py-3.5"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onView}><Eye className="mr-2 h-4 w-4" /> Visualizar detalhes</DropdownMenuItem>{document.status === 'draft' && canEmit && <DropdownMenuItem onClick={onTransmit}><CloudOff className="mr-2 h-4 w-4" /> Simular envio</DropdownMenuItem>}{['simulation', 'communication_failed'].includes(document.status) && canResend && <DropdownMenuItem onClick={onResend}><RefreshCw className="mr-2 h-4 w-4" /> Reenviar simulação</DropdownMenuItem>}{document.status === 'draft' && canDelete && <DropdownMenuItem onClick={onDelete}><XCircle className="mr-2 h-4 w-4" /> Excluir rascunho</DropdownMenuItem>}{document.status === 'authorized' && canCancel && <><DropdownMenuSeparator /><DropdownMenuItem onClick={onCancel}><XCircle className="mr-2 h-4 w-4" /> Cancelar documento</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></td></tr>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>;
}
