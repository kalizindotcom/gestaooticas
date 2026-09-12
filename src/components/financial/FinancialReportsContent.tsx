import React, { useMemo } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFinancialEntries, useFixedCosts } from '@/hooks/useFinancialData';
import { usePermissions } from '@/contexts/PermissionsContext';
import { FinancialInfoTip } from './FinancialInfoTip';

const money = (value: unknown) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
const downloadCsv = (filename: string, headers: string[], rows: Array<Array<unknown>>) => {
  const content = '\ufeff' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function FinancialReportsContent() {
  const { hasPermission } = usePermissions();
  const { data: entries = [], isLoading: entriesLoading } = useFinancialEntries({});
  const { data: fixedCosts = [], isLoading: fixedCostsLoading } = useFixedCosts();
  const canExport = hasPermission('financial', 'view');
  const reports = useMemo(() => {
    const open = entries.filter(entry => ['receivable', 'payable'].includes(entry.type) && !['paid', 'cancelled'].includes(String(entry.status)));
    const overdue = open.filter(entry => new Date(entry.due_date) < new Date());
    const flow = entries.filter(entry => !['cancelled'].includes(String(entry.status)));
    const byPayment = new Map<string, number>();
    const byCategory = new Map<string, number>();
    flow.filter(entry => entry.status === 'paid' || entry.type === 'in').forEach(entry => byPayment.set(String(entry.payment_method || 'Não informado'), (byPayment.get(String(entry.payment_method || 'Não informado')) || 0) + Number(entry.net_amount || entry.amount || 0)));
    flow.filter(entry => entry.type === 'out' || entry.type === 'payable').forEach(entry => byCategory.set(String(entry.category || 'Sem categoria'), (byCategory.get(String(entry.category || 'Sem categoria')) || 0) + Number(entry.net_amount || entry.amount || 0)));
    const income = flow.filter(entry => ['in', 'receivable'].includes(entry.type) && entry.status === 'paid').reduce((sum, entry) => sum + Number(entry.net_amount || entry.amount || 0), 0);
    const expense = flow.filter(entry => ['out', 'payable'].includes(entry.type) && entry.status === 'paid').reduce((sum, entry) => sum + Number(entry.net_amount || entry.amount || 0), 0);
    return [
      { key: 'flow', label: 'Fluxo de caixa', description: 'Entradas, saídas, status e origem dos lançamentos.', rows: flow.map(entry => [entry.due_date, entry.type, entry.description, entry.category, entry.payment_method, entry.status, money(entry.net_amount || entry.amount)]), headers: ['Data', 'Tipo', 'Descrição', 'Categoria', 'Meio', 'Status', 'Valor líquido'] },
      { key: 'open', label: 'Contas em aberto', description: 'Recebíveis e pagáveis ainda não quitados.', rows: open.map(entry => [entry.due_date, entry.type, entry.description, entry.supplier_customer_name, entry.status, money(Number(entry.amount || 0) - Number(entry.paid_amount || 0))]), headers: ['Vencimento', 'Tipo', 'Descrição', 'Cliente/Fornecedor', 'Status', 'Saldo'] },
      { key: 'fixed', label: 'Custos fixos', description: 'Cadastro, recorrência, validade e próximo vencimento.', rows: fixedCosts.map(cost => [cost.name, cost.store_id, cost.frequency, cost.valid_from, cost.valid_until, cost.next_due_date, money(cost.amount), cost.status]), headers: ['Custo', 'Loja', 'Recorrência', 'Válido desde', 'Válido até', 'Próximo vencimento', 'Valor', 'Status'] },
      { key: 'overdue', label: 'Vencidos', description: 'Obrigações e recebimentos vencidos com saldo.', rows: overdue.map(entry => [entry.due_date, entry.type, entry.description, entry.supplier_customer_name, money(Number(entry.amount || 0) - Number(entry.paid_amount || 0))]), headers: ['Vencimento', 'Tipo', 'Descrição', 'Cliente/Fornecedor', 'Saldo'] },
      { key: 'payments', label: 'Meios de pagamento', description: 'Total movimentado por meio normalizado.', rows: [...byPayment.entries()].map(([method, total]) => [method, money(total)]), headers: ['Meio', 'Total'] },
      { key: 'categories', label: 'Despesas por categoria', description: 'Despesas pagas agrupadas pela categoria financeira.', rows: [...byCategory.entries()].map(([category, total]) => [category, money(total)]), headers: ['Categoria', 'Total'] },
      { key: 'dre', label: 'DRE sintético', description: 'Receitas, despesas e resultado do conjunto filtrado.', rows: [['Receitas pagas', money(income)], ['Despesas pagas', money(expense)], ['Resultado', money(income - expense)]], headers: ['Linha', 'Valor'] },
    ];
  }, [entries, fixedCosts]);

  const exportReport = (report: (typeof reports)[number]) => downloadCsv(`relatorio-financeiro-${report.key}.csv`, report.headers, report.rows);
  return <Card className="border-border bg-card"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" />Relatórios financeiros</CardTitle></CardHeader><CardContent className="space-y-4"><FinancialInfoTip title="Exportação protegida e objetiva">Os relatórios respeitam o escopo já carregado pelo usuário. Use CSV para análise externa e impressão para conferência operacional; os dados não são alterados.</FinancialInfoTip>{entriesLoading || fixedCostsLoading ? <p className="py-4 text-sm text-muted-foreground">Preparando relatórios...</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{reports.map(report => <div key={report.key} className="rounded-xl border border-border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold text-foreground">{report.label}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{report.description}</p></div><Badge variant="outline" className="shrink-0 border-primary/20 text-primary">{report.rows.length}</Badge></div><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" disabled={!canExport} onClick={() => exportReport(report)} className="h-8 flex-1 rounded-lg text-xs"><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button><Button size="sm" variant="outline" disabled={!canExport} onClick={() => window.print()} className="h-8 rounded-lg text-xs"><Printer className="mr-1.5 h-3.5 w-3.5" />Imprimir</Button></div></div>)}</div>}{!canExport && <p className="text-xs text-muted-foreground">Sua permissão atual permite consultar o Financeiro, mas não exportar relatórios.</p>}</CardContent></Card>;
}
