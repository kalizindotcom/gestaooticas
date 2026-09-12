import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FinancialEntry } from '@/types';
import { DREData } from './dreCalculator';

export type ReportFormat = 'pdf' | 'excel' | 'csv';
export type ReportType = 'statement' | 'dre' | 'receivable' | 'payable' | 'cashier' | 'reconciliation';

export interface ReportOptions {
  title: string;
  subtitle?: string;
  period?: { start: Date; end: Date };
  filters?: Record<string, any>;
  companyName?: string;
  storeName?: string;
}

export class ReportGenerator {
  static generateStatement(
    entries: FinancialEntry[],
    format: ReportFormat,
    options: ReportOptions
  ): void {
    switch (format) {
      case 'pdf':
        this.generateStatementPDF(entries, options);
        break;
      case 'excel':
        this.generateStatementExcel(entries, options);
        break;
      case 'csv':
        this.generateStatementCSV(entries, options);
        break;
    }
  }

  private static generateStatementPDF(entries: FinancialEntry[], options: ReportOptions) {
    const doc = new jsPDF();

    // Cabeçalho
    doc.setFontSize(18);
    doc.text(options.title, 14, 20);

    if (options.subtitle) {
      doc.setFontSize(11);
      doc.text(options.subtitle, 14, 28);
    }

    if (options.period) {
      doc.setFontSize(10);
      doc.text(
        `Período: ${this.formatDate(options.period.start)} a ${this.formatDate(options.period.end)}`,
        14,
        36
      );
    }

    // Tabela de lançamentos
    const tableData = entries.map(e => [
      this.formatDate(new Date(e.due_date)),
      e.description || '-',
      e.supplier_customer_name || '-',
      e.type === 'receivable' || e.type === 'in' ? this.formatCurrency(e.amount) : '-',
      e.type === 'payable' || e.type === 'out' ? this.formatCurrency(e.amount) : '-',
      this.translateStatus(e.status),
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Data', 'Descrição', 'Fornecedor/Cliente', 'Entrada', 'Saída', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });

    // Totalizadores
    const totalIn = entries
      .filter(e => e.type === 'receivable' || e.type === 'in')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalOut = entries
      .filter(e => e.type === 'payable' || e.type === 'out')
      .reduce((sum, e) => sum + e.amount, 0);

    const balance = totalIn - totalOut;

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text(`Total Entradas: ${this.formatCurrency(totalIn)}`, 14, finalY);
    doc.text(`Total Saídas: ${this.formatCurrency(totalOut)}`, 14, finalY + 7);
    doc.setFont(undefined, 'bold');
    doc.text(`Saldo: ${this.formatCurrency(balance)}`, 14, finalY + 14);

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount} - Gerado em ${this.formatDateTime(new Date())}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`extrato-financeiro-${Date.now()}.pdf`);
  }

  private static generateStatementExcel(entries: FinancialEntry[], options: ReportOptions) {
    const data = entries.map(e => ({
      Data: this.formatDate(new Date(e.due_date)),
      Descrição: e.description || '-',
      'Fornecedor/Cliente': e.supplier_customer_name || '-',
      Categoria: e.category_id || '-',
      'Centro de Custo': e.cost_center || '-',
      Entrada: e.type === 'receivable' || e.type === 'in' ? e.amount : 0,
      Saída: e.type === 'payable' || e.type === 'out' ? e.amount : 0,
      Status: this.translateStatus(e.status),
      'Método de Pagamento': e.payment_method || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato');

    XLSX.writeFile(wb, `extrato-financeiro-${Date.now()}.xlsx`);
  }

  private static generateStatementCSV(entries: FinancialEntry[], options: ReportOptions) {
    const headers = ['Data', 'Descrição', 'Fornecedor/Cliente', 'Entrada', 'Saída', 'Status'];
    const rows = entries.map(e => [
      this.formatDate(new Date(e.due_date)),
      e.description || '-',
      e.supplier_customer_name || '-',
      e.type === 'receivable' || e.type === 'in' ? e.amount.toString() : '0',
      e.type === 'payable' || e.type === 'out' ? e.amount.toString() : '0',
      this.translateStatus(e.status),
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato-financeiro-${Date.now()}.csv`;
    link.click();
  }

  static generateDRE(dre: DREData, format: ReportFormat, options: ReportOptions): void {
    switch (format) {
      case 'pdf':
        this.generateDREPDF(dre, options);
        break;
      case 'excel':
        this.generateDREExcel(dre, options);
        break;
      case 'csv':
        this.generateDRECSV(dre, options);
        break;
    }
  }

  private static generateDREPDF(dre: DREData, options: ReportOptions) {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Demonstrativo de Resultado do Exercício (DRE)', 14, 20);

    if (options.period) {
      doc.setFontSize(10);
      doc.text(
        `Período: ${this.formatDate(options.period.start)} a ${this.formatDate(options.period.end)}`,
        14,
        28
      );
    }

    const tableData = [
      ['RECEITA BRUTA', '', this.formatCurrency(dre.revenue.gross)],
      ['  Vendas', '', this.formatCurrency(dre.revenue.sales)],
      ['  Serviços', '', this.formatCurrency(dre.revenue.services)],
      ['  Outras Receitas', '', this.formatCurrency(dre.revenue.other)],
      ['', '', ''],
      ['(-) CUSTO DAS MERCADORIAS VENDIDAS', '', this.formatCurrency(dre.costs.cmv)],
      ['  Laboratórios', '', this.formatCurrency(dre.costs.labs)],
      ['  Produtos', '', this.formatCurrency(dre.costs.products)],
      ['', '', ''],
      ['= LUCRO BRUTO', this.formatPercent(dre.grossMargin), this.formatCurrency(dre.grossProfit)],
      ['', '', ''],
      ['(-) DESPESAS OPERACIONAIS', '', this.formatCurrency(dre.expenses.operational.total)],
      ['  Salários', '', this.formatCurrency(dre.expenses.operational.salaries)],
      ['  Aluguel', '', this.formatCurrency(dre.expenses.operational.rent)],
      ['  Utilidades', '', this.formatCurrency(dre.expenses.operational.utilities)],
      ['  Marketing', '', this.formatCurrency(dre.expenses.operational.marketing)],
      ['  Manutenção', '', this.formatCurrency(dre.expenses.operational.maintenance)],
      ['', '', ''],
      ['(-) DESPESAS ADMINISTRATIVAS', '', this.formatCurrency(dre.expenses.administrative.total)],
      ['', '', ''],
      ['(-) DESPESAS FINANCEIRAS', '', this.formatCurrency(dre.expenses.financial.total)],
      ['  Juros', '', this.formatCurrency(dre.expenses.financial.interest)],
      ['  Taxas', '', this.formatCurrency(dre.expenses.financial.fees)],
      ['  Impostos', '', this.formatCurrency(dre.expenses.financial.taxes)],
      ['', '', ''],
      ['= EBITDA', this.formatPercent(dre.ebitdaMargin), this.formatCurrency(dre.ebitda)],
      ['', '', ''],
      ['= LUCRO LÍQUIDO', this.formatPercent(dre.netMargin), this.formatCurrency(dre.netProfit)],
      ['', '', ''],
      ['ROI', this.formatPercent(dre.roi), ''],
    ];

    autoTable(doc, {
      startY: 35,
      head: [['Descrição', 'Margem', 'Valor']],
      body: tableData,
      theme: 'plain',
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index === 9 || data.row.index === 25 || data.row.index === 27) {
          data.cell.styles.fillColor = [243, 244, 246];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount} - Gerado em ${this.formatDateTime(new Date())}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`dre-${Date.now()}.pdf`);
  }

  private static generateDREExcel(dre: DREData, options: ReportOptions) {
    const data = [
      { Descrição: 'RECEITA BRUTA', Margem: '', Valor: dre.revenue.gross },
      { Descrição: '  Vendas', Margem: '', Valor: dre.revenue.sales },
      { Descrição: '  Serviços', Margem: '', Valor: dre.revenue.services },
      { Descrição: '  Outras Receitas', Margem: '', Valor: dre.revenue.other },
      { Descrição: '', Margem: '', Valor: '' },
      { Descrição: '(-) CMV', Margem: '', Valor: dre.costs.cmv },
      { Descrição: '  Laboratórios', Margem: '', Valor: dre.costs.labs },
      { Descrição: '  Produtos', Margem: '', Valor: dre.costs.products },
      { Descrição: '', Margem: '', Valor: '' },
      { Descrição: '= LUCRO BRUTO', Margem: `${dre.grossMargin.toFixed(2)}%`, Valor: dre.grossProfit },
      { Descrição: '', Margem: '', Valor: '' },
      { Descrição: '(-) DESPESAS OPERACIONAIS', Margem: '', Valor: dre.expenses.operational.total },
      { Descrição: '(-) DESPESAS ADMINISTRATIVAS', Margem: '', Valor: dre.expenses.administrative.total },
      { Descrição: '(-) DESPESAS FINANCEIRAS', Margem: '', Valor: dre.expenses.financial.total },
      { Descrição: '', Margem: '', Valor: '' },
      { Descrição: '= EBITDA', Margem: `${dre.ebitdaMargin.toFixed(2)}%`, Valor: dre.ebitda },
      { Descrição: '', Margem: '', Valor: '' },
      { Descrição: '= LUCRO LÍQUIDO', Margem: `${dre.netMargin.toFixed(2)}%`, Valor: dre.netProfit },
      { Descrição: '', Margem: '', Valor: '' },
      { Descrição: 'ROI', Margem: `${dre.roi.toFixed(2)}%`, Valor: '' },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DRE');

    XLSX.writeFile(wb, `dre-${Date.now()}.xlsx`);
  }

  private static generateDRECSV(dre: DREData, options: ReportOptions) {
    const headers = ['Descrição', 'Margem', 'Valor'];
    const rows = [
      ['RECEITA BRUTA', '', dre.revenue.gross.toString()],
      ['  Vendas', '', dre.revenue.sales.toString()],
      ['  Serviços', '', dre.revenue.services.toString()],
      ['= LUCRO BRUTO', `${dre.grossMargin.toFixed(2)}%`, dre.grossProfit.toString()],
      ['= EBITDA', `${dre.ebitdaMargin.toFixed(2)}%`, dre.ebitda.toString()],
      ['= LUCRO LÍQUIDO', `${dre.netMargin.toFixed(2)}%`, dre.netProfit.toString()],
    ];

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dre-${Date.now()}.csv`;
    link.click();
  }

  static generateReceivable(entries: FinancialEntry[], format: ReportFormat, options: ReportOptions): void {
    const receivables = entries.filter(e => e.type === 'receivable' && e.status !== 'paid');

    switch (format) {
      case 'pdf':
        this.generateReceivablePDF(receivables, options);
        break;
      case 'excel':
        this.generateReceivableExcel(receivables, options);
        break;
      case 'csv':
        this.generateReceivableCSV(receivables, options);
        break;
    }
  }

  private static generateReceivablePDF(entries: FinancialEntry[], options: ReportOptions) {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Contas a Receber', 14, 20);

    const tableData = entries.map(e => [
      this.formatDate(new Date(e.due_date)),
      e.supplier_customer_name || '-',
      e.description || '-',
      this.formatCurrency(e.amount),
      this.translateStatus(e.status),
      this.calculateDaysOverdue(new Date(e.due_date)),
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Vencimento', 'Cliente', 'Descrição', 'Valor', 'Status', 'Dias']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 9 },
    });

    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont(undefined, 'bold');
    doc.text(`Total a Receber: ${this.formatCurrency(total)}`, 14, finalY);

    doc.save(`contas-a-receber-${Date.now()}.pdf`);
  }

  private static generateReceivableExcel(entries: FinancialEntry[], options: ReportOptions) {
    const data = entries.map(e => ({
      Vencimento: this.formatDate(new Date(e.due_date)),
      Cliente: e.supplier_customer_name || '-',
      Descrição: e.description || '-',
      Valor: e.amount,
      Status: this.translateStatus(e.status),
      'Dias Atraso': this.calculateDaysOverdue(new Date(e.due_date)),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Receber');

    XLSX.writeFile(wb, `contas-a-receber-${Date.now()}.xlsx`);
  }

  private static generateReceivableCSV(entries: FinancialEntry[], options: ReportOptions) {
    const headers = ['Vencimento', 'Cliente', 'Descrição', 'Valor', 'Status'];
    const rows = entries.map(e => [
      this.formatDate(new Date(e.due_date)),
      e.supplier_customer_name || '-',
      e.description || '-',
      e.amount.toString(),
      this.translateStatus(e.status),
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contas-a-receber-${Date.now()}.csv`;
    link.click();
  }

  // Utility methods
  private static formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR');
  }

  private static formatDateTime(date: Date): string {
    return date.toLocaleString('pt-BR');
  }

  private static formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private static formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  private static translateStatus(status: string): string {
    const translations: Record<string, string> = {
      pending: 'Pendente',
      paid: 'Pago',
      overdue: 'Vencido',
      cancelled: 'Cancelado',
    };
    return translations[status] || status;
  }

  private static calculateDaysOverdue(dueDate: Date): string {
    const today = new Date();
    const diff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `${diff}` : '-';
  }
}
