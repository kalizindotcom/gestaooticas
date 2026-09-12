import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Archive, BarChart3, Bell, CalendarClock, CheckCircle2, Cloud,
  CloudDownload, CloudUpload, Database, Download, FileArchive, FileCheck2, Globe,
  HardDrive, History, KeyRound, LockKeyhole, Palette, Play, RefreshCw, RotateCcw,
  Save, Settings2, ShieldCheck, Trash2, Upload, UserRound, Wifi, XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE, localApi } from '@/lib/localApi';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';
import { Progress } from '@/components/ui/progress';

const defaultBackupSettings: Record<string, any> = {
  enabled: true,
  timezone: 'America/Sao_Paulo',
  daily_enabled: true,
  daily_count: 2,
  weekly_enabled: true,
  weekly_count: 1,
  monthly_enabled: true,
  monthly_count: 1,
  schedule_hour: 2,
  schedule_minute: 0,
  include_database: true,
  include_uploads: true,
  upload_to_drive: true,
  drive_folder_name: 'Gestão Óticas - Backups',
  retention_daily: 30,
  retention_weekly: 12,
  retention_monthly: 12,
  max_local_backups: 20,
};

const featureCatalog = [
  ['Execução manual', 'Faça um backup completo sob demanda.', Play],
  ['Rotina diária', 'Defina quantos backups diários serão criados.', CalendarClock],
  ['Rotina semanal', 'Mantenha pontos de recuperação semanais.', CalendarClock],
  ['Rotina mensal', 'Conserve históricos mensais de longo prazo.', CalendarClock],
  ['Retenção configurável', 'Controle quantos pontos ficam preservados.', Trash2],
  ['Banco SQLite', 'Inclui todos os dados estruturados do sistema.', Database],
  ['Uploads', 'Inclui logos, anexos e imagens da aplicação.', FileArchive],
  ['Manifesto', 'Registra conteúdo, versão e componentes incluídos.', FileCheck2],
  ['Hash SHA-256', 'Verifica a integridade de cada arquivo.', ShieldCheck],
  ['Criptografia OAuth', 'Refresh token do Drive protegido no banco.', LockKeyhole],
  ['Pasta automática', 'Cria e reutiliza a pasta de backups no Drive.', Cloud],
  ['Conta Google', 'Conecta a conta Google por OAuth seguro.', UserRound],
  ['Teste de conexão', 'Valida credencial, pasta e permissões.', Wifi],
  ['Envio ao Drive', 'Copia backups locais para armazenamento externo.', CloudUpload],
  ['Histórico local', 'Mostra cada execução e seu resultado.', History],
  ['Histórico remoto', 'Lista os backups presentes no Drive.', CloudDownload],
  ['Download manual', 'Exporta qualquer backup para esta máquina.', Download],
  ['Importar arquivo', 'Adiciona um backup externo ao histórico.', Upload],
  ['Validar antes de importar', 'Confere formato e manifesto do arquivo.', FileCheck2],
  ['Importar do Drive', 'Baixa um arquivo remoto para a aplicação.', CloudDownload],
  ['Pré-backup de restauração', 'Cria uma proteção antes de restaurar.', ShieldCheck],
  ['Restauração protegida', 'Exige a confirmação textual RESTAURAR.', RotateCcw],
  ['Reinício controlado', 'Reinicia o processo para carregar o banco restaurado.', RefreshCw],
  ['Eventos operacionais', 'Registra início, fim, alertas e falhas.', History],
  ['Status parcial', 'Diferencia backup local concluído de falha no Drive.', BarChart3],
  ['Filtro de histórico', 'Filtre concluídos, falhos e importados.', Settings2],
  ['Limite local', 'Evita ocupar todo o disco da VPS.', HardDrive],
  ['Fuso horário', 'Agenda respeitando o fuso configurado.', Globe],
  ['Segregação master', 'Ações críticas ficam disponíveis ao administrador master.', KeyRound],
  ['Recuperação offline', 'Um arquivo exportado pode ser reimportado sem o Drive.', Archive],
];

function formatBytes(value: unknown) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { completed: 'Concluído', partial: 'Parcial', failed: 'Falhou', running: 'Executando', imported: 'Importado', restored: 'Restaurado' };
  return labels[status] || status;
}

function statusClass(status: string) {
  if (status === 'completed' || status === 'imported' || status === 'restored') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
  if (status === 'partial' || status === 'running') return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
  return 'border-red-500/30 bg-red-500/10 text-red-600';
}

function Metric({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) {
  return (
    <Card className="premium-shadow border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</span>
        </div>
        <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const [localApiUrl, setLocalApiUrl] = useState(API_BASE);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'testing' | 'idle'>('idle');
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [backupSettings, setBackupSettings] = useState<Record<string, any>>(defaultBackupSettings);
  const [driveStatus, setDriveStatus] = useState<Record<string, any>>({ configured: false });
  const [history, setHistory] = useState<Record<string, any>[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<Record<string, any>[]>([]);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [backupLoading, setBackupLoading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');
  const importInputRef = useRef<HTMLInputElement>(null);

  const testConnection = async () => {
    setConnectionStatus('testing');
    const start = performance.now();
    try {
      const { error } = await localApi.from('companies').select('id').limit(1);
      if (error) throw error;
      setLatency(Math.round(performance.now() - start));
      setConnectionStatus('connected');
      setLastCheck(new Date().toLocaleTimeString());
      toast.success('API local conectada ao SQLite.');
    } catch (error: any) {
      setConnectionStatus('error');
      setLatency(null);
      setLastCheck(new Date().toLocaleTimeString());
      toast.error('Erro na API local: ' + (error.message || 'servidor indisponível'));
    }
  };

  const loadBackupData = async () => {
    const settingsResult = await localApi.backupAdmin.getSettings();
    if (settingsResult.data) {
      setBackupSettings({ ...defaultBackupSettings, ...settingsResult.data.settings });
      setDriveStatus(settingsResult.data.drive || {});
    } else if (settingsResult.error) {
      toast.error(settingsResult.error.message);
    }
    const historyResult = await localApi.backupAdmin.listHistory({ status: historyFilter, limit: 50 });
    if (historyResult.data) setHistory(historyResult.data);
  };

  useEffect(() => {
    testConnection();
    loadBackupData();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-drive-connected') {
        toast.success('Google Drive conectado.');
        loadBackupData();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') loadBackupData();
    if (activeTab === 'drive' && backupSettings.google_account_email) refreshRemoteFiles();
  }, [historyFilter, activeTab]);

  const updateSetting = (key: string, value: unknown) => setBackupSettings((current) => ({ ...current, [key]: value }));

  const saveBackupSettings = async () => {
    const result = await localApi.backupAdmin.saveSettings(backupSettings);
    if (result.error) return toast.error(result.error.message);
    if (result.data) setBackupSettings((current) => ({ ...current, ...result.data }));
    toast.success('Política de backup salva.');
  };

  const runManualBackup = async (sendToDrive = false) => {
    setBackupLoading(true);
    const result = await localApi.backupAdmin.run('manual', sendToDrive);
    setBackupLoading(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(sendToDrive ? 'Backup criado e enviado ao Google Drive.' : 'Backup criado com sucesso.');
    await loadBackupData();
    setActiveTab('historico');
  };

  const downloadBackup = async (job: Record<string, any>) => {
    try {
      const blob = await localApi.backupAdmin.download(String(job.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = job.archive_name || `backup-${job.id}.tar.gz`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Download iniciado.');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const inspectAndImport = async (file: File) => {
    setBackupLoading(true);
    const inspected = await localApi.backupAdmin.inspectFile(file);
    if (inspected.error) {
      setBackupLoading(false);
      return toast.error(inspected.error.message);
    }
    const manifest = inspected.data?.manifest || {};
    const approved = window.confirm(`Backup válido: ${manifest.label || 'sem rótulo'}\nCriado em: ${formatDate(manifest.created_at)}\n\nDeseja importar este arquivo para o histórico?`);
    if (!approved) {
      setBackupLoading(false);
      return;
    }
    const imported = await localApi.backupAdmin.importFile(file);
    setBackupLoading(false);
    if (imported.error) return toast.error(imported.error.message);
    toast.success('Backup importado para o histórico.');
    await loadBackupData();
    setActiveTab('historico');
  };

  const restoreJob = async (job: Record<string, any>) => {
    if (!window.confirm('A restauração substituirá o banco e os uploads atuais. Um pré-backup será criado automaticamente. Continuar?')) return;
    const confirmation = window.prompt('Digite RESTAURAR para confirmar:') || '';
    if (confirmation !== 'RESTAURAR') return toast.error('Restauração cancelada.');
    setBackupLoading(true);
    const result = await localApi.backupAdmin.restore(String(job.id), confirmation);
    setBackupLoading(false);
    if (result.error) return toast.error(result.error.message);
    toast.success('Restauração aplicada. O servidor será reiniciado agora.');
  };

  const connectDrive = async () => {
    const result = await localApi.backupAdmin.connectDrive();
    if (result.error) return toast.error(result.error.message);
    if (result.data?.url) window.open(result.data.url, 'google-drive-connect', 'width=620,height=760');
  };

  const testDrive = async () => {
    setDriveLoading(true);
    const result = await localApi.backupAdmin.testDrive();
    setDriveLoading(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(`Google Drive conectado: ${result.data?.user?.emailAddress || 'conta validada'}`);
    await loadBackupData();
  };

  const refreshRemoteFiles = async () => {
    setDriveLoading(true);
    const result = await localApi.backupAdmin.listDrive();
    setDriveLoading(false);
    if (result.error) return toast.error(result.error.message);
    setRemoteFiles(result.data || []);
  };

  const importRemote = async (file: Record<string, any>) => {
    setDriveLoading(true);
    const result = await localApi.backupAdmin.importDrive(String(file.id));
    setDriveLoading(false);
    if (result.error) return toast.error(result.error.message);
    toast.success('Backup do Drive importado para o histórico.');
    await loadBackupData();
    setActiveTab('historico');
  };

  const disconnectDrive = async () => {
    if (!window.confirm('Desconectar o Google Drive interrompe os envios automáticos. Continuar?')) return;
    const result = await localApi.backupAdmin.disconnectDrive();
    if (result.error) return toast.error(result.error.message);
    setDriveStatus({ configured: driveStatus.configured });
    setBackupSettings((current) => ({ ...current, google_account_email: null, drive_folder_id: null }));
    toast.success('Google Drive desconectado.');
  };

  const filteredHistory = useMemo(() => history.filter((job) => historyFilter === 'all' || job.status === historyFilter), [history, historyFilter]);
  const completedCount = history.filter((job) => job.status === 'completed').length;
  const failedCount = history.filter((job) => job.status === 'failed' || job.status === 'partial').length;
  const lastBackup = history[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <PageHeader title="Configurações" description="Preferências do sistema e central completa de backup e recuperação" badge={<Badge variant="secondary" className="rounded-full">Admin Master</Badge>} />
      <FinancialInfoTip className="px-3 py-2.5" title="Central de proteção de dados">Configure cópias locais e externas, acompanhe o histórico e faça uma restauração somente após validar o manifesto do backup.</FinancialInfoTip>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
          <TabsTrigger value="geral" className="text-xs">Geral</TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Backup e recuperação</TabsTrigger>
          <TabsTrigger value="drive" className="gap-1.5 text-xs"><Cloud className="h-3.5 w-3.5" /> Google Drive</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="premium-shadow border-border/60 lg:col-span-1"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Palette className="h-4 w-4 text-primary" /> Aparência</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div className="flex items-center justify-between"><span>Tema global</span><ThemeToggle /></div><div className="flex items-center justify-between"><span>Animações da interface</span><Switch defaultChecked /></div></CardContent></Card>
            <Card className="premium-shadow border-border/60 lg:col-span-1"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4 text-primary" /> Notificações</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div className="flex items-center justify-between"><span>Notificações por e-mail</span><Switch defaultChecked /></div><div className="flex items-center justify-between"><span>Lembrete de agendamento</span><Switch defaultChecked /></div><div className="flex items-center justify-between"><span>Alerta de estoque baixo</span><Switch defaultChecked /></div></CardContent></Card>
            <Card className="premium-shadow border-border/60 lg:col-span-1"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-primary" /> Regional</CardTitle></CardHeader><CardContent className="space-y-3"><Select defaultValue="pt"><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt">Português (BR)</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem></SelectContent></Select><Select value={backupSettings.timezone} onValueChange={(value) => updateSetting('timezone', value)}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem><SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem><SelectItem value="America/Noronha">Fernando de Noronha (GMT-2)</SelectItem></SelectContent></Select></CardContent></Card>
          </div>
          <Card className="premium-shadow border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Wifi className="h-4 w-4 text-primary" /> Status de conexão</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-3"><Badge className={connectionStatus === 'connected' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : connectionStatus === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-600' : 'border-border'}>{connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'error' ? 'Falha na conexão' : connectionStatus === 'testing' ? 'Testando...' : 'Aguardando'}</Badge>{lastCheck && <span className="text-xs text-muted-foreground">Última verificação: {lastCheck} · {latency}ms</span>}</div><div className="flex flex-col gap-2 sm:flex-row"><Input value={localApiUrl} onChange={(event) => setLocalApiUrl(event.target.value)} className="h-9 text-xs" /><Button variant="outline" size="sm" onClick={testConnection}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Testar agora</Button></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Metric icon={Archive} label="Backups registrados" value={String(history.length)} hint="histórico" /><Metric icon={CheckCircle2} label="Concluídos" value={String(completedCount)} hint="sucesso" /><Metric icon={AlertCircle} label="Falhas ou parciais" value={String(failedCount)} hint="atenção" /><Metric icon={History} label="Último backup" value={lastBackup ? formatDate(lastBackup.completed_at || lastBackup.created_at).split(',')[0] : '—'} hint="data" /></div>
          <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <Card className="premium-shadow border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-primary" /> Política de execução automática</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex items-center justify-between rounded-xl border border-border/60 bg-accent/20 p-3"><div><p className="text-sm font-semibold">Agendador ativo</p><p className="text-xs text-muted-foreground">O processo da VPS verifica a política a cada minuto.</p></div><Switch checked={Boolean(backupSettings.enabled)} onCheckedChange={(value) => updateSetting('enabled', value)} /></div><div className="grid gap-4 md:grid-cols-3">{[['daily_enabled','daily_count','Diários'],['weekly_enabled','weekly_count','Semanais'],['monthly_enabled','monthly_count','Mensais']].map(([enabled, count, label]) => <div key={label} className="space-y-3 rounded-xl border border-border/60 p-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{label}</span><Switch checked={Boolean(backupSettings[enabled])} onCheckedChange={(value) => updateSetting(enabled, value)} /></div><label className="text-[11px] font-medium text-muted-foreground">Quantidade por período<Input type="number" min={1} max={label === 'Diários' ? 24 : label === 'Semanais' ? 7 : 31} value={backupSettings[count]} onChange={(event) => updateSetting(count, Number(event.target.value))} className="mt-1 h-9" /></label></div>)}</div><div className="grid gap-4 md:grid-cols-3"><label className="text-[11px] font-medium text-muted-foreground">Horário de referência<Input type="time" value={`${String(backupSettings.schedule_hour).padStart(2,'0')}:${String(backupSettings.schedule_minute).padStart(2,'0')}`} onChange={(event) => { const [hour, minute] = event.target.value.split(':').map(Number); updateSetting('schedule_hour', hour); updateSetting('schedule_minute', minute); }} className="mt-1 h-9" /></label><label className="text-[11px] font-medium text-muted-foreground">Fuso horário<Select value={backupSettings.timezone} onValueChange={(value) => updateSetting('timezone', value)}><SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem><SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem><SelectItem value="America/Noronha">Fernando de Noronha (GMT-2)</SelectItem></SelectContent></Select></label><label className="text-[11px] font-medium text-muted-foreground">Limite de arquivos locais<Input type="number" min={1} max={500} value={backupSettings.max_local_backups} onChange={(event) => updateSetting('max_local_backups', Number(event.target.value))} className="mt-1 h-9" /></label></div><div className="flex flex-wrap gap-4 rounded-xl bg-accent/20 p-3 text-xs"><label className="flex items-center gap-2"><Switch checked={Boolean(backupSettings.include_database)} onCheckedChange={(value) => updateSetting('include_database', value)} /> Banco de dados</label><label className="flex items-center gap-2"><Switch checked={Boolean(backupSettings.include_uploads)} onCheckedChange={(value) => updateSetting('include_uploads', value)} /> Uploads e anexos</label><label className="flex items-center gap-2"><Switch checked={Boolean(backupSettings.upload_to_drive)} onCheckedChange={(value) => updateSetting('upload_to_drive', value)} /> Enviar ao Drive</label></div><Button onClick={saveBackupSettings} className="gap-1.5"><Save className="h-3.5 w-3.5" /> Salvar política</Button></CardContent></Card>
            <Card className="premium-shadow border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /> Retenção e ações</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-3">{[['retention_daily','Diários'],['retention_weekly','Semanais'],['retention_monthly','Mensais']].map(([key,label]) => <label key={key} className="text-[11px] font-medium text-muted-foreground">{label}<Input type="number" min={1} value={backupSettings[key]} onChange={(event) => updateSetting(key, Number(event.target.value))} className="mt-1 h-9" /></label>)}</div><div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4"><p className="text-sm font-bold">Criar backup agora</p><p className="mt-1 text-xs text-muted-foreground">O pacote inclui os componentes marcados na política e gera hash SHA-256.</p><div className="mt-3 flex flex-wrap gap-2"><Button disabled={backupLoading} onClick={() => runManualBackup(false)} className="gap-1.5"><Play className="h-3.5 w-3.5" /> {backupLoading ? 'Processando...' : 'Backup local'}</Button><Button disabled={backupLoading} variant="outline" onClick={() => runManualBackup(true)} className="gap-1.5"><CloudUpload className="h-3.5 w-3.5" /> Backup + Drive</Button></div>{backupLoading && <Progress value={70} className="mt-3 h-1.5" />}</div><div className="rounded-xl border border-border/60 p-4"><p className="text-sm font-bold">Importar arquivo externo</p><p className="mt-1 text-xs text-muted-foreground">Valide um .tar.gz e adicione-o ao histórico sem restaurar automaticamente.</p><input ref={importInputRef} type="file" accept=".gz,.tgz,.tar.gz,application/gzip" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) inspectAndImport(file); event.currentTarget.value = ''; }} /><Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => importInputRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Selecionar backup</Button></div></CardContent></Card>
          </div>
          <Card className="premium-shadow border-border/60"><CardHeader><CardTitle className="text-sm">Ecossistema de proteção · 30 recursos</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{featureCatalog.map(([title, description, Icon]) => <div key={String(title)} className="flex gap-2 rounded-xl border border-border/50 p-3"><div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></div><div><p className="text-xs font-bold">{title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p></div></div>)}</div></CardContent></Card>
        </TabsContent>

        <TabsContent value="drive" className="mt-6 space-y-6">
          <Card className="premium-shadow border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Cloud className="h-4 w-4 text-primary" /> Conta Google Drive</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-accent/20 p-4 md:flex-row md:items-center md:justify-between"><div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Cloud className="h-5 w-5" /></div><div><p className="text-sm font-bold">{backupSettings.google_account_email || 'Nenhuma conta conectada'}</p><p className="text-xs text-muted-foreground">{driveStatus.configured ? 'OAuth configurado no servidor.' : 'Configure as credenciais OAuth do Google no Coolify.'}</p></div></div><div className="flex flex-wrap gap-2"><Button onClick={connectDrive} disabled={!driveStatus.configured} className="gap-1.5"><KeyRound className="h-3.5 w-3.5" /> {backupSettings.google_account_email ? 'Reconectar' : 'Conectar Google'}</Button><Button variant="outline" onClick={testDrive} disabled={!backupSettings.google_account_email || driveLoading} className="gap-1.5"><Wifi className="h-3.5 w-3.5" /> Testar</Button>{backupSettings.google_account_email && <Button variant="ghost" onClick={disconnectDrive} className="gap-1.5 text-red-600"><XCircle className="h-3.5 w-3.5" /> Desconectar</Button>}</div></div><div className="grid gap-4 md:grid-cols-2"><label className="text-[11px] font-medium text-muted-foreground">Nome da pasta no Drive<Input value={backupSettings.drive_folder_name || ''} onChange={(event) => updateSetting('drive_folder_name', event.target.value)} className="mt-1 h-9" /></label><div className="rounded-xl border border-border/60 p-3 text-xs"><p className="font-semibold">Redirect URI para OAuth</p><code className="mt-1 block break-all text-[10px] text-muted-foreground">{driveStatus.redirect_uri || 'Disponível após configurar GOOGLE_DRIVE_REDIRECT_URI'}</code></div></div><div className="flex items-center justify-between rounded-xl border border-border/60 p-3"><div><p className="text-sm font-semibold">Enviar backups automaticamente</p><p className="text-xs text-muted-foreground">Os jobs agendados tentarão enviar o arquivo após concluírem localmente.</p></div><Switch checked={Boolean(backupSettings.upload_to_drive)} onCheckedChange={(value) => updateSetting('upload_to_drive', value)} /></div><Button onClick={saveBackupSettings} variant="outline" className="gap-1.5"><Save className="h-3.5 w-3.5" /> Salvar configuração do Drive</Button>{!driveStatus.configured && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">Para liberar o botão de conexão, cadastre no Coolify: <code>GOOGLE_DRIVE_CLIENT_ID</code>, <code>GOOGLE_DRIVE_CLIENT_SECRET</code> e <code>GOOGLE_DRIVE_REDIRECT_URI</code>.</div>}</CardContent></Card>
          <Card className="premium-shadow border-border/60"><CardHeader><CardTitle className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><CloudDownload className="h-4 w-4 text-primary" /> Backups remotos na pasta</span><Button variant="outline" size="sm" disabled={!backupSettings.google_account_email || driveLoading} onClick={refreshRemoteFiles}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar</Button></CardTitle></CardHeader><CardContent>{remoteFiles.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum arquivo remoto carregado.</p> : <div className="space-y-2">{remoteFiles.map((file) => <div key={file.id} className="flex flex-col gap-3 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{file.name}</p><p className="text-xs text-muted-foreground">{formatDate(file.createdTime)} · {formatBytes(file.size)}</p></div><Button size="sm" variant="outline" onClick={() => importRemote(file)} disabled={driveLoading} className="gap-1.5"><CloudDownload className="h-3.5 w-3.5" /> Importar</Button></div>)}</div>}</CardContent></Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-6 space-y-6">
          <Card className="premium-shadow border-border/60"><CardHeader><CardTitle className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Histórico de backups</span><div className="flex gap-2"><Select value={historyFilter} onValueChange={setHistoryFilter}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="completed">Concluídos</SelectItem><SelectItem value="partial">Parciais</SelectItem><SelectItem value="failed">Falhos</SelectItem><SelectItem value="imported">Importados</SelectItem></SelectContent></Select><Button variant="outline" size="sm" onClick={loadBackupData}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar</Button></div></CardTitle></CardHeader><CardContent>{filteredHistory.length === 0 ? <div className="py-12 text-center"><Archive className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold">Nenhum backup neste filtro</p><p className="mt-1 text-xs text-muted-foreground">Crie o primeiro backup na aba Backup e recuperação.</p></div> : <div className="space-y-3">{filteredHistory.map((job) => <div key={job.id} className="rounded-xl border border-border/60 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{job.archive_name || job.label || 'Backup'}</p><Badge variant="outline" className={statusClass(String(job.status))}>{statusLabel(String(job.status))}</Badge><Badge variant="secondary" className="text-[10px]">{job.source || 'local'}</Badge></div><div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3"><span>Criado: {formatDate(job.created_at)}</span><span>Tamanho: {formatBytes(job.size_bytes)}</span><span>SHA-256: <code>{job.sha256 ? String(job.sha256).slice(0, 12) + '…' : '—'}</code></span></div>{job.error_message && <p className="mt-2 text-xs text-red-600">{job.error_message}</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!job.local_path} onClick={() => downloadBackup(job)} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Exportar</Button><Button size="sm" variant="outline" disabled={!job.local_path || backupLoading} onClick={() => restoreJob(job)} className="gap-1.5 text-amber-700"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</Button></div></div></div>)}</div>}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
