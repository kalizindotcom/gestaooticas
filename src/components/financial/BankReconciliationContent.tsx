import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, CheckCircle2, AlertCircle, Link2, X, Download, Calendar, DollarSign, FileText, Plus, Building2 } from 'lucide-react';
import { useBankAccounts, useBankReconciliations, useCreateReconciliation, useUpdateReconciliation, useCompleteReconciliation, useBankTransactions, useAutoMatchTransactions, useMatchTransaction, useImportBankTransactions, useCreateBankAccount } from '@/hooks/useFinancialData';
import { useFinancialEntries } from '@/hooks/useFinancialData';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';
import { ReconciliationMatcher } from '@/services/reconciliationMatcher';
import { cn } from '@/lib/utils';
import { FinancialInfoTip } from '@/components/financial/FinancialInfoTip';

const splitCsvRow = (line: string) => { const delimiter = line.includes(';') ? ';' : ','; const cells: string[] = []; let current = ''; let quoted = false; for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; } else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ''; } else current += char; } cells.push(current.trim()); return cells; };
const parseCsvAmount = (value: string) => { const normalized = String(value || '').trim().replace(/R\\$\\s?/gi, '').replace(/\\s/g, ''); if (!normalized) return Number.NaN; if (normalized.includes(',') && normalized.includes('.')) return Number(normalized.replace(/\\./g, '').replace(',', '.')); return Number(normalized.replace(',', '.')); };

export function BankReconciliationContent() {
  const { user } = useAuth();
  const { selectedCompanyId } = useGlobalFilter();
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedReconciliation, setSelectedReconciliation] = useState<string>('');
  const [newReconciliationDialog, setNewReconciliationDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [matchDialog, setMatchDialog] = useState<any>(null);
  const [newAccountDialog, setNewAccountDialog] = useState(false);

  // Form states
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [initialBalanceBank, setInitialBalanceBank] = useState('');
  const [finalBalanceBank, setFinalBalanceBank] = useState('');
  const [importFormat, setImportFormat] = useState<'ofx' | 'csv'>('ofx');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState({ date: '', description: '', amount: '', type: '' });
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([]);
  const [duplicateIndexes, setDuplicateIndexes] = useState<number[]>([]);

  // New account form states
  const [newAccountBankName, setNewAccountBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountAgency, setNewAccountAgency] = useState('');
  const [newAccountType, setNewAccountType] = useState<'checking' | 'savings'>('checking');
  const [newAccountInitialBalance, setNewAccountInitialBalance] = useState('');

  const accountsQuery = useBankAccounts();
  const reconciliationsQuery = useBankReconciliations(selectedAccount);
  const transactionsQuery = useBankTransactions(selectedReconciliation);
  const autoMatchesQuery = useAutoMatchTransactions(selectedReconciliation); 
  const { data: bankAccounts = [], isLoading: accountsLoading } = accountsQuery;
  const { data: reconciliations = [], isLoading: reconciliationsLoading } = reconciliationsQuery;
  const { data: transactions = [] } = transactionsQuery;
  const { data: autoMatches = [] } = autoMatchesQuery;

  const createReconciliationMutation = useCreateReconciliation();
  const rebuildCsvPreview = (headers: string[], rows: string[][], mapping: typeof csvMapping) => {
    if (!mapping.date || !mapping.description || !mapping.amount) { setPreviewTransactions([]); setDuplicateIndexes([]); return; }
    const dateIndex = Number(mapping.date);
    const descriptionIndex = Number(mapping.description);
    const amountIndex = Number(mapping.amount);
    const typeIndex = mapping.type === '' ? -1 : Number(mapping.type);
    const parsed = rows.map((row, index) => { const amount = parseCsvAmount(row[amountIndex] || ''); const rawType = typeIndex >= 0 ? String(row[typeIndex] || '').trim().toLowerCase() : ''; const type = rawType ? (['c', 'credito', 'credit', 'entrada'].includes(rawType) ? 'credit' : 'debit') : amount >= 0 ? 'credit' : 'debit'; return { transaction_date: row[dateIndex] || '', description: row[descriptionIndex] || '', amount: Math.abs(amount), type, is_reconciled: false, __index: index }; }).filter(row => row.transaction_date && row.description && Number.isFinite(row.amount));
    const known = new Set(transactions.map(item => `${String(item.transaction_date).slice(0, 10)}|${String(item.description).trim().toLowerCase()}|${Number(item.amount).toFixed(2)}`));
    const seen = new Set<string>(); const duplicates: number[] = [];
    parsed.forEach((row, index) => { const key = `${String(row.transaction_date).slice(0, 10)}|${row.description.trim().toLowerCase()}|${Number(row.amount).toFixed(2)}`; if (known.has(key) || seen.has(key)) duplicates.push(index); seen.add(key); });
    setPreviewTransactions(parsed); setDuplicateIndexes(duplicates);
  };
  const handleImportFileChange = async (file: File | null) => {
    setImportFile(file);
    setPreviewTransactions([]); setDuplicateIndexes([]); setCsvHeaders([]); setCsvRows([]);
    if (!file || importFormat !== 'csv') return;
    const content = await file.text();
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const headers = lines.length ? splitCsvRow(lines[0]).map(header => header.replace(/^\ufeff/, '')) : [];
    const rows = lines.slice(1).map(splitCsvRow);
    const normalized = headers.map(header => header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const findHeader = (terms: string[]) => { const index = normalized.findIndex(header => terms.some(term => header.includes(term))); return index >= 0 ? String(index) : ''; };
    const mapping = { date: findHeader(['data', 'date']), description: findHeader(['descricao', 'historico', 'memo', 'description']), amount: findHeader(['valor', 'amount', 'quantia']), type: findHeader(['tipo', 'natureza', 'credito debito']) };
    setCsvHeaders(headers); setCsvRows(rows); setCsvMapping(mapping); rebuildCsvPreview(headers, rows, mapping);
  };

  const updateReconciliationMutation = useUpdateReconciliation();
  const completeReconciliationMutation = useCompleteReconciliation();
  const matchTransactionMutation = useMatchTransaction();
  const importTransactionsMutation = useImportBankTransactions();
  const createBankAccountMutation = useCreateBankAccount();

  const isLoading = accountsLoading || reconciliationsLoading;

  // Get unmatched entries
  const unmatchedEntriesQuery = useFinancialEntries({ is_reconciled: false });
  const { data: unmatchedEntries = [] } = unmatchedEntriesQuery;

  // Calculate reconciliation summary
  const selectedReconciliationRecord = useMemo(
    () => reconciliations.find(item => item.id === selectedReconciliation),
    [reconciliations, selectedReconciliation],
  );
  const selectedBankAccount = useMemo(
    () => bankAccounts.find(account => account.id === selectedAccount),
    [bankAccounts, selectedAccount],
  );

  const summary = useMemo(() => {
    if (!autoMatches || autoMatches.length === 0) {
      return {
        totalTransactions: 0,
        matchedAuto: 0,
        matchedManual: 0,
        pending: 0,
        matchRate: 0,
      };
    }

    return ReconciliationMatcher.generateSummary(autoMatches);
  }, [autoMatches]);

  React.useEffect(() => {
    if (!selectedReconciliation || !autoMatches.length || !selectedReconciliationRecord) return;
    const summaryChanged = selectedReconciliationRecord.total_transactions !== summary.totalTransactions
      || selectedReconciliationRecord.matched_auto !== summary.matchedAuto
      || selectedReconciliationRecord.matched_manual !== summary.matchedManual
      || selectedReconciliationRecord.pending !== summary.pending;
    if (summaryChanged && !updateReconciliationMutation.isPending) {
      void updateReconciliationMutation.mutateAsync({
        id: selectedReconciliation,
        updates: {
          total_transactions: summary.totalTransactions,
          matched_auto: summary.matchedAuto,
          matched_manual: summary.matchedManual,
          pending: summary.pending,
        },
      }).catch(() => undefined);
    }
  }, [selectedReconciliation, selectedReconciliationRecord, autoMatches.length, summary.totalTransactions, summary.matchedAuto, summary.matchedManual, summary.pending, updateReconciliationMutation.isPending]);

  const handleCompleteReconciliation = async () => {
    if (!selectedReconciliation) return;
    try {
      await completeReconciliationMutation.mutateAsync(selectedReconciliation);
      toast({ title: 'Conciliação concluída', description: 'O período bancário foi marcado como conciliado.' });
    } catch {
      toast({ title: 'Erro ao concluir', description: 'Não foi possível concluir a conciliação.', variant: 'destructive' });
    }
  };

  // Handle create reconciliation
  const handleCreateReconciliation = async () => {
    if (!selectedAccount || !periodStart || !periodEnd || !initialBalanceBank || !finalBalanceBank) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const reconciliation = await createReconciliationMutation.mutateAsync({
        bank_account_id: selectedAccount,
        period_start: periodStart,
        period_end: periodEnd,
        initial_balance_bank: parseFloat(initialBalanceBank),
        final_balance_bank: parseFloat(finalBalanceBank),
        initial_balance_system: Number(selectedBankAccount?.current_balance ?? selectedBankAccount?.initial_balance ?? 0),
        final_balance_system: Number(selectedBankAccount?.current_balance ?? selectedBankAccount?.initial_balance ?? 0),
        total_transactions: 0,
        matched_auto: 0,
        matched_manual: 0,
        pending: 0,
        status: 'in_progress',
      });

      setSelectedReconciliation(reconciliation.id);
      setNewReconciliationDialog(false);
      setImportDialog(true);

      toast({
        title: 'Conciliação criada',
        description: 'Agora importe o extrato bancário.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar conciliação',
        description: 'Ocorreu um erro ao criar a conciliação.',
        variant: 'destructive',
      });
    }
  };

  // Handle import file
  const handleImportFile = async () => {
    if (!importFile || !selectedReconciliation) {
      toast({
        title: 'Erro',
        description: 'Selecione um arquivo para importar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const fileContent = await importFile.text();
      let parsedTransactions: any[] = [];

      if (importFormat === 'ofx') {
        parsedTransactions = ReconciliationMatcher.parseOFX(fileContent);
      } else {
        parsedTransactions = previewTransactions.filter((_, index) => !duplicateIndexes.includes(index)).map(({ __index, ...transaction }) => transaction);
      }
      if (parsedTransactions.length === 0) {
        throw new Error('Nenhuma transação válida foi encontrada no arquivo selecionado.');
      }

      await importTransactionsMutation.mutateAsync({
        bankAccountId: selectedAccount,
        reconciliationId: selectedReconciliation,
        transactions: parsedTransactions,
      });

      toast({
        title: 'Extrato importado',
        description: `${parsedTransactions.length} transações importadas com sucesso.`,
      });

      setImportDialog(false);
      setImportFile(null);
    } catch (error) {
      toast({
        title: 'Erro ao importar',
        description: 'Ocorreu um erro ao importar o extrato.',
        variant: 'destructive',
      });
    }
  };

  // Handle create bank account
  const handleCreateBankAccount = async () => {
    if (!newAccountBankName || !newAccountNumber) {
      toast({ title: 'Erro', description: 'Preencha banco e número da conta.', variant: 'destructive' });
      return;
    }
    try {
      await createBankAccountMutation.mutateAsync({
        company_id: selectedCompanyId!,
        bank_name: newAccountBankName,
        account_number: newAccountNumber,
        agency: newAccountAgency,
        account_type: newAccountType,
        initial_balance: parseFloat(newAccountInitialBalance) || 0,
        current_balance: parseFloat(newAccountInitialBalance) || 0,
        is_active: true,
      });
      toast({ title: 'Conta cadastrada', description: 'Conta bancária adicionada com sucesso.' });
      setNewAccountDialog(false);
      setNewAccountBankName('');
      setNewAccountNumber('');
      setNewAccountAgency('');
      setNewAccountInitialBalance('');
    } catch (error) {
      toast({ title: 'Erro ao cadastrar conta', description: 'Ocorreu um erro ao salvar a conta.', variant: 'destructive' });
    }
  };

  // Handle manual match
  const handleManualMatch = async (transactionId: string, entryId: string) => {
    try {
      await matchTransactionMutation.mutateAsync({
        transactionId,
        entryId,
        confidence: 100,
      });

      toast({
        title: 'Transação conciliada',
        description: 'A transação foi conciliada manualmente.',
      });

      setMatchDialog(null);
    } catch (error) {
      toast({
        title: 'Erro ao conciliar',
        description: 'Ocorreu um erro ao conciliar a transação.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Carregando conciliação bancária..." />;
  }
  const queryError = accountsQuery.error || reconciliationsQuery.error || transactionsQuery.error || autoMatchesQuery.error || unmatchedEntriesQuery.error;
  if (queryError) return <ErrorMessage message={queryError instanceof Error ? queryError.message : 'Não foi possível carregar a conciliação bancária local.'} retry={() => { void Promise.all([accountsQuery.refetch(), reconciliationsQuery.refetch(), transactionsQuery.refetch(), autoMatchesQuery.refetch(), unmatchedEntriesQuery.refetch()]); }} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <FinancialInfoTip title="Como conciliar">Importe o extrato, revise as sugestões e confirme somente as correspondências corretas. O vínculo é atômico e deixa o lançamento marcado como conciliado.</FinancialInfoTip>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Conciliação Bancária</h2>
          <p className="text-sm text-muted-foreground">Concilie transações bancárias com lançamentos do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setNewAccountDialog(true)}
            className="h-10 rounded-xl gap-2 border-border/60 bg-background/40 text-foreground hover:border-primary/40"
          >
            <Building2 className="h-4 w-4" /> Nova Conta
          </Button>
          <Button
            onClick={() => setNewReconciliationDialog(true)}
            className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-foreground font-bold gap-2"
          >
            <Upload className="h-4 w-4" /> Nova Conciliação
          </Button>
        </div>
      </div>

      {/* Account Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground/80 font-semibold">Conta Bancária</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background/40 text-foreground hover:border-primary/40">
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              {bankAccounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.bank_name} - {account.account_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedAccount && (
          <div className="space-y-2">
            <Label className="text-foreground/80 font-semibold">Período de Conciliação</Label>
            <Select value={selectedReconciliation} onValueChange={setSelectedReconciliation}>
              <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background/40 text-foreground hover:border-primary/40">
                <SelectValue placeholder="Selecione um período" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-foreground">
                {reconciliations.map(rec => (
                  <SelectItem key={rec.id} value={rec.id}>
                    {new Date(rec.period_start).toLocaleDateString('pt-BR')} a{' '}
                    {new Date(rec.period_end).toLocaleDateString('pt-BR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {selectedReconciliation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/60 backdrop-blur-sm border-border/60 rounded-2xl hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                <FileText className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-foreground">{summary.totalTransactions}</div>
              <span className="text-xs text-foreground/40">transações</span>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border-border/60 rounded-2xl hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Automáticas</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-foreground">{summary.matchedAuto}</div>
              <span className="text-xs text-foreground/40">conciliadas</span>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border-border/60 rounded-2xl hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manuais</span>
                <Link2 className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-foreground">{summary.matchedManual}</div>
              <span className="text-xs text-foreground/40">conciliadas</span>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border-border/60 rounded-2xl hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pendentes</span>
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-foreground">{summary.pending}</div>
              <span className="text-xs text-foreground/40">não conciliadas</span>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedReconciliation && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Status do período: {selectedReconciliationRecord?.status === 'completed' ? 'Concluída' : 'Em andamento'}</p>
            <p className="text-xs text-muted-foreground">Os totais são atualizados automaticamente após importar ou conciliar transações.</p>
          </div>
          <Button
            onClick={handleCompleteReconciliation}
            disabled={selectedReconciliationRecord?.status === 'completed' || completeReconciliationMutation.isPending || autoMatches.length === 0 || summary.pending > 0}
            className="bg-primary hover:bg-primary/90"
          >
            {completeReconciliationMutation.isPending ? 'Concluindo...' : 'Concluir Conciliação'}
          </Button>
        </div>
      )}

      {/* Transactions Table */}
      {selectedReconciliation && autoMatches.length > 0 && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/60 rounded-2xl hover-lift">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">Transações Bancárias</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/70 bg-muted/40">
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-muted-foreground">Data</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-muted-foreground">Descrição</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-right text-muted-foreground">Valor</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-muted-foreground">Lançamento</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-muted-foreground">Confiança</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.05em] h-12 text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoMatches.map((match) => (
                  <TableRow
                    key={match.transaction.id}
                    className={cn(
                      "border-border/50",
                      match.matchType === 'exact' && "bg-emerald-500/5",
                      match.matchType === 'fuzzy' && "bg-primary/5",
                      match.matchType === 'none' && "bg-amber-500/5"
                    )}
                  >
                    <TableCell className="text-foreground">
                      <span className="text-sm">
                        {new Date(match.transaction.transaction_date).toLocaleDateString('pt-BR')}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground">
                      <span className="text-sm">{match.transaction.description}</span>
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      <span className={cn(
                        "font-bold",
                        match.transaction.type === 'credit' ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {match.transaction.type === 'credit' ? '+' : '-'}
                        R$ {Math.abs(match.transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {match.entry ? (
                        <span className="text-sm text-foreground/80 font-semibold">{match.entry.description}</span>
                      ) : (
                        <span className="text-sm text-foreground/40">Sem correspondência</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {match.matchType === 'exact' && (
                        <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          Exata
                        </Badge>
                      )}
                      {match.matchType === 'fuzzy' && (
                        <Badge className="bg-primary/10 text-primary border-primary/30">
                          {match.confidence}%
                        </Badge>
                      )}
                      {match.matchType === 'manual' && (
                        <Badge className="bg-primary/10 text-primary border-primary/30">
                          Manual
                        </Badge>
                      )}
                      {match.matchType === 'none' && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {match.matchType === 'none' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-border/60 bg-background/40 text-foreground hover:border-primary/40"
                          onClick={() => setMatchDialog(match)}
                        >
                          <Link2 className="h-3 w-3 mr-1" /> Conciliar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-lg text-foreground/40"
                          disabled
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Conciliado
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New Reconciliation Dialog */}
      <Dialog open={newReconciliationDialog} onOpenChange={setNewReconciliationDialog}>
        <DialogContent className="bg-card text-foreground border-border/70">
          <DialogHeader>
            <DialogTitle>Nova Conciliação Bancária</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Informe o período e os saldos para iniciar a conciliação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="bg-muted/40 border-border/70 text-foreground">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bank_name} - {account.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="bg-muted/40 border-border/70 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="bg-muted/40 border-border/70 text-foreground"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saldo Inicial (Banco)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={initialBalanceBank}
                  onChange={(e) => setInitialBalanceBank(e.target.value)}
                  className="bg-muted/40 border-border/70 text-foreground"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Saldo Final (Banco)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={finalBalanceBank}
                  onChange={(e) => setFinalBalanceBank(e.target.value)}
                  className="bg-muted/40 border-border/70 text-foreground"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setNewReconciliationDialog(false)}
                className="border-border/60 bg-background/40 text-foreground hover:border-primary/40"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateReconciliation}
                disabled={createReconciliationMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {createReconciliationMutation.isPending ? 'Criando...' : 'Criar e Importar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="bg-card text-foreground border-border/70">
          <DialogHeader>
            <DialogTitle>Importar Extrato Bancário</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Faça upload do arquivo OFX ou CSV do seu banco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Formato do Arquivo</Label>
              <Select value={importFormat} onValueChange={(v: any) => { setImportFormat(v); setImportFile(null); setPreviewTransactions([]); setDuplicateIndexes([]); setCsvHeaders([]); setCsvRows([]); }}>
                <SelectTrigger className="bg-muted/40 border-border/70 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="ofx">OFX (Open Financial Exchange)</SelectItem>
                  <SelectItem value="csv">CSV (Comma Separated Values)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept={importFormat === 'ofx' ? '.ofx' : '.csv'}
                onChange={(e) => { void handleImportFileChange(e.target.files?.[0] || null); }}
                className="bg-muted/40 border-border/70 text-foreground"
              />
            </div>
            {importFormat === 'csv' && csvHeaders.length > 0 && <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3"><FinancialInfoTip title="Prévia e mapeamento">Selecione quais colunas representam data, descrição e valor. Linhas já importadas ou repetidas no arquivo serão ignoradas automaticamente.</FinancialInfoTip><div className="grid gap-2 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Data</Label><Select value={csvMapping.date || 'none'} onValueChange={value => { const next = { ...csvMapping, date: value === 'none' ? '' : value }; setCsvMapping(next); rebuildCsvPreview(csvHeaders, csvRows, next); }}><SelectTrigger className="h-9"><SelectValue placeholder="Coluna de data" /></SelectTrigger><SelectContent><SelectItem value="none">Não mapeado</SelectItem>{csvHeaders.map((header, index) => <SelectItem key={`date-${index}`} value={String(index)}>{header || `Coluna ${index + 1}`}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Descrição</Label><Select value={csvMapping.description || 'none'} onValueChange={value => { const next = { ...csvMapping, description: value === 'none' ? '' : value }; setCsvMapping(next); rebuildCsvPreview(csvHeaders, csvRows, next); }}><SelectTrigger className="h-9"><SelectValue placeholder="Coluna de descrição" /></SelectTrigger><SelectContent><SelectItem value="none">Não mapeado</SelectItem>{csvHeaders.map((header, index) => <SelectItem key={`description-${index}`} value={String(index)}>{header || `Coluna ${index + 1}`}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Valor</Label><Select value={csvMapping.amount || 'none'} onValueChange={value => { const next = { ...csvMapping, amount: value === 'none' ? '' : value }; setCsvMapping(next); rebuildCsvPreview(csvHeaders, csvRows, next); }}><SelectTrigger className="h-9"><SelectValue placeholder="Coluna de valor" /></SelectTrigger><SelectContent><SelectItem value="none">Não mapeado</SelectItem>{csvHeaders.map((header, index) => <SelectItem key={`amount-${index}`} value={String(index)}>{header || `Coluna ${index + 1}`}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Tipo <span className="font-normal text-muted-foreground">(opcional)</span></Label><Select value={csvMapping.type || 'none'} onValueChange={value => { const next = { ...csvMapping, type: value === 'none' ? '' : value }; setCsvMapping(next); rebuildCsvPreview(csvHeaders, csvRows, next); }}><SelectTrigger className="h-9"><SelectValue placeholder="Crédito ou débito" /></SelectTrigger><SelectContent><SelectItem value="none">Inferir pelo sinal</SelectItem>{csvHeaders.map((header, index) => <SelectItem key={`type-${index}`} value={String(index)}>{header || `Coluna ${index + 1}`}</SelectItem>)}</SelectContent></Select></div></div><p className="text-xs text-muted-foreground">{previewTransactions.length} linha(s) válida(s) · {duplicateIndexes.length} duplicidade(s) serão ignoradas.</p>{previewTransactions.slice(0, 4).map((transaction, index) => <div key={`${transaction.transaction_date}-${index}`} className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-xs"><span className="truncate">{transaction.transaction_date} · {transaction.description}</span><strong className={transaction.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}>{transaction.type === 'credit' ? '+' : '-'} {Math.abs(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>)}</div>}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setImportDialog(false)}
                className="border-border/60 bg-background/40 text-foreground hover:border-primary/40"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportFile}
                disabled={!importFile || (importFormat === 'csv' && previewTransactions.length === 0)}
                className="bg-primary hover:bg-primary/90"
              >
                <Upload className="h-4 w-4 mr-2" /> Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      {matchDialog && (
        <Dialog open={!!matchDialog} onOpenChange={() => setMatchDialog(null)}>
          <DialogContent className="bg-card text-foreground border-border/70 max-w-2xl">
            <DialogHeader>
              <DialogTitle>Conciliar Manualmente</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Selecione o lançamento correspondente a esta transação bancária.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Card className="bg-muted/40 border-border/70">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{matchDialog.transaction.description}</p>
                      <p className="text-xs text-foreground/40">
                        {new Date(matchDialog.transaction.transaction_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={cn(
                      "font-bold text-lg",
                      matchDialog.transaction.type === 'credit' ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {matchDialog.transaction.type === 'credit' ? '+' : '-'}
                      R$ {Math.abs(matchDialog.transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                <Label>Lançamentos Disponíveis</Label>
                {unmatchedEntries.length === 0 ? (
                  <p className="text-sm text-foreground/40 text-center py-4">
                    Nenhum lançamento disponível para conciliação.
                  </p>
                ) : (
                  unmatchedEntries.map((entry) => (
                    <Card
                      key={entry.id}
                      className="bg-muted/40 border-border/70 hover:bg-muted cursor-pointer transition-colors border border-transparent hover:border-primary/20"
                      onClick={() => handleManualMatch(matchDialog.transaction.id, entry.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{entry.description}</p>
                            <p className="text-xs text-foreground/40">
                              {new Date(entry.due_date).toLocaleDateString('pt-BR')} · {entry.supplier_customer_name}
                            </p>
                          </div>
                          <span className="font-bold text-foreground">
                            R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* New Bank Account Dialog */}
      <Dialog open={newAccountDialog} onOpenChange={setNewAccountDialog}>
        <DialogContent className="bg-card text-foreground border-border/70 rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cadastrar Conta Bancária</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Adicione uma conta bancária para iniciar a conciliação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-foreground/80 font-semibold">Banco *</Label>
              <Input
                value={newAccountBankName}
                onChange={(e) => setNewAccountBankName(e.target.value)}
                placeholder="Ex: Banco do Brasil, Itaú, Nubank..."
                className="bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Agência</Label>
                <Input
                  value={newAccountAgency}
                  onChange={(e) => setNewAccountAgency(e.target.value)}
                  placeholder="0001"
                  className="bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground/70"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Conta *</Label>
                <Input
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  placeholder="12345-6"
                  className="bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground/70"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Tipo</Label>
                <Select value={newAccountType} onValueChange={(v: any) => setNewAccountType(v)}>
                  <SelectTrigger className="bg-muted/40 border-border/70 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground">
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Saldo Inicial</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newAccountInitialBalance}
                  onChange={(e) => setNewAccountInitialBalance(e.target.value)}
                  placeholder="0,00"
                  className="bg-muted/40 border-border/70 text-foreground placeholder:text-muted-foreground/70"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setNewAccountDialog(false)} className="border-border/60 bg-background/40 text-foreground hover:border-primary/40">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateBankAccount}
                disabled={createBankAccountMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {createBankAccountMutation.isPending ? 'Salvando...' : 'Cadastrar Conta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
