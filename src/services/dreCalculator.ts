import { FinancialEntry } from '@/types';

export interface DREData {
  period: { start: Date; end: Date };
  revenue: {
    gross: number;
    deductions: number;
    net: number;
    sales: number;
    services: number;
    other: number;
  };
  costs: {
    cmv: number;
    cogs: number;
    labs: number;
    products: number;
  };
  grossProfit: number;
  grossMargin: number;
  expenses: {
    cogs: number;
    depreciation: number;
    operational: {
      total: number;
      salaries: number;
      rent: number;
      utilities: number;
      marketing: number;
      maintenance: number;
      other: number;
    };
    administrative: {
      total: number;
      accounting: number;
      legal: number;
      office: number;
      other: number;
    };
    financial: {
      total: number;
      interest: number;
      fees: number;
      taxes: number;
    };
  };
  totalExpenses: number;
  ebitda: number;
  ebitdaMargin: number;
  ebit: number;
  ebitMargin: number;
  taxes: number;
  netProfit: number;
  netMargin: number;
  roi: number;
}

export interface PerformanceIndicators {
  liquidityRatio: number;
  currentRatio: number;
  debtRatio: number;
  returnOnAssets: number;
  returnOnEquity: number;
  operatingCashFlow: number;
  burnRate: number;
  runway: number;
}

export class DRECalculator {
  static calculate(
    entries: FinancialEntry[],
    startDate: Date,
    endDate: Date
  ): DREData {
    // FIX Bug #1: usar payment_date para entradas pagas, due_date para pendentes
    const periodStart = new Date(startDate);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);
    const periodEntries = entries.filter(e => {
      const refDate = e.status === 'paid' && e.payment_date
        ? new Date(e.payment_date)
        : new Date(e.due_date);
      return refDate >= periodStart && refDate <= periodEnd && e.status === 'paid';
    });

    const revenue = this.calculateRevenue(periodEntries);
    const costs = this.calculateCosts(periodEntries);
    const expenses = this.calculateExpenses(periodEntries);

    // Deducoes simples: 0 por enquanto (placeholder para impostos sobre venda)
    revenue.deductions = 0;
    revenue.net = revenue.gross - revenue.deductions;

    const grossProfit = revenue.net - costs.cmv;
    const grossMargin = revenue.gross > 0 ? (grossProfit / revenue.gross) * 100 : 0;

    const totalExpenses =
      expenses.operational.total +
      expenses.administrative.total +
      expenses.financial.total +
      expenses.depreciation;

    const ebitda = grossProfit - expenses.operational.total - expenses.administrative.total;
    const ebitdaMargin = revenue.gross > 0 ? (ebitda / revenue.gross) * 100 : 0;

    const ebit = ebitda - expenses.depreciation;
    const ebitMargin = revenue.gross > 0 ? (ebit / revenue.gross) * 100 : 0;

    const profitBeforeTax = ebit - expenses.financial.total;
    const taxes = profitBeforeTax > 0 ? profitBeforeTax * 0.15 : 0;

    const netProfit = profitBeforeTax - taxes;
    const netMargin = revenue.gross > 0 ? (netProfit / revenue.gross) * 100 : 0;

    const roi = costs.cmv > 0 ? (netProfit / costs.cmv) * 100 : 0;

    return {
      period: { start: startDate, end: endDate },
      revenue,
      costs,
      grossProfit,
      grossMargin,
      expenses,
      totalExpenses,
      ebitda,
      ebitdaMargin,
      ebit,
      ebitMargin,
      taxes,
      netProfit,
      netMargin,
      roi,
    };
  }

  private static calculateRevenue(entries: FinancialEntry[]) {
    // FIX Bug #1: aceitar 'receivable' e 'in', NAO exigir category_id
    const revenueEntries = entries.filter(e => e.type === 'receivable' || e.type === 'in');

    // FIX Bug #1: usar 'category' (text) OU origin_table='sales' para identificar vendas
    const isSaleEntry = (e: FinancialEntry) =>
      e.origin_table === 'sales' ||
      (typeof e.category === 'string' && e.category.toLowerCase().includes('venda'));

    const isServiceEntry = (e: FinancialEntry) =>
      e.origin_table === 'service_orders' ||
      (typeof e.category === 'string' && e.category.toLowerCase().includes('serviço'));

    const sales = revenueEntries
      .filter(isSaleEntry)
      .reduce((sum, e) => sum + e.amount, 0);

    const services = revenueEntries
      .filter(isServiceEntry)
      .reduce((sum, e) => sum + e.amount, 0);

    const other = revenueEntries
      .filter(e => !isSaleEntry(e) && !isServiceEntry(e))
      .reduce((sum, e) => sum + e.amount, 0);

    const gross = sales + services + other;
    const deductions = 0;
    const net = gross - deductions;

    return { gross, deductions, net, sales, services, other };
  }

  private static calculateCosts(entries: FinancialEntry[]) {
    const costEntries = entries.filter(e =>
      (e.type === 'payable' || e.type === 'out') &&
      e.cost_center === 'CMV'
    );

    const labs = costEntries
      .filter(e => e.description?.toLowerCase().includes('laboratório'))
      .reduce((sum, e) => sum + e.amount, 0);

    const products = costEntries
      .filter(e => !e.description?.toLowerCase().includes('laboratório'))
      .reduce((sum, e) => sum + e.amount, 0);

    const cmv = labs + products;
    const cogs = cmv;

    return { cmv, cogs, labs, products };
  }

  private static calculateExpenses(entries: FinancialEntry[]) {
    const expenseEntries = entries.filter(e =>
      (e.type === 'payable' || e.type === 'out') &&
      e.cost_center !== 'CMV'
    );

    const salaries = this.sumByKeyword(expenseEntries, ['salário', 'folha']);
    const rent = this.sumByKeyword(expenseEntries, ['aluguel']);
    const utilities = this.sumByKeyword(expenseEntries, ['energia', 'água', 'internet']);
    const marketing = this.sumByKeyword(expenseEntries, ['marketing', 'publicidade']);
    const maintenance = this.sumByKeyword(expenseEntries, ['manutenção', 'manutencao']);
    const accounting = this.sumByKeyword(expenseEntries, ['contabilidade']);
    const legal = this.sumByKeyword(expenseEntries, ['jurídico', 'juridico', 'advocacia']);
    const office = this.sumByKeyword(expenseEntries, ['escritório', 'escritorio', 'material']);
    const interest = this.sumByKeyword(expenseEntries, ['juros']);
    const fees = this.sumByKeyword(expenseEntries, ['taxa', 'tarifa']);
    const taxes = this.sumByKeyword(expenseEntries, ['imposto', 'tributo']);
    const recognized = new Set<string>();
    for (const entry of expenseEntries) {
      const text = `${entry.description || ''} ${entry.category || ''}`.toLowerCase();
      if (['salário', 'salario', 'folha', 'aluguel', 'energia', 'água', 'agua', 'internet', 'marketing', 'publicidade', 'manutenção', 'manutencao', 'contabilidade', 'jurídico', 'juridico', 'advocacia', 'escritório', 'escritorio', 'material', 'juros', 'taxa', 'tarifa', 'imposto', 'tributo'].some(keyword => text.includes(keyword))) recognized.add(String(entry.id));
    }
    const other = expenseEntries.filter(entry => !recognized.has(String(entry.id))).reduce((sum, entry) => sum + entry.amount, 0);
    const operational = {
      total: 0,
      salaries,
      rent,
      utilities,
      marketing,
      maintenance,
      other,
    };
    operational.total = operational.salaries + operational.rent + operational.utilities + operational.marketing + operational.maintenance + operational.other;

    const administrative = {
      total: 0,
      accounting,
      legal,
      office,
      other: 0,
    };
    administrative.total = administrative.accounting + administrative.legal + administrative.office + administrative.other;

    const financial = {
      total: 0,
      interest,
      fees,
      taxes,
    };
    financial.total = financial.interest + financial.fees + financial.taxes;

    return {
      cogs: 0,
      depreciation: 0,
      operational,
      administrative,
      financial,
    };
  }

  private static sumByKeyword(entries: FinancialEntry[], keywords: string[]): number {
    return entries
      .filter(e => {
        const text = `${e.description || ''} ${e.category || ''}`.toLowerCase();
        return keywords.some(keyword => text.includes(keyword));
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }

  static calculatePerformanceIndicators(
    dre: DREData,
    totalAssets: number,
    totalEquity: number,
    currentAssets: number,
    currentLiabilities: number,
    totalDebt: number
  ): PerformanceIndicators {
    const liquidityRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
    const returnOnAssets = totalAssets > 0 ? (dre.netProfit / totalAssets) * 100 : 0;
    const returnOnEquity = totalEquity > 0 ? (dre.netProfit / totalEquity) * 100 : 0;
    const operatingCashFlow = dre.ebitda;
    const burnRate = dre.totalExpenses / 30;
    const runway = burnRate > 0 ? currentAssets / burnRate : 0;

    return {
      liquidityRatio,
      currentRatio,
      debtRatio,
      returnOnAssets,
      returnOnEquity,
      operatingCashFlow,
      burnRate,
      runway,
    };
  }

  static comparePeriodsGrowth(current: DREData, previous: DREData) {
    const revenueGrowth = previous.revenue.gross > 0
      ? ((current.revenue.gross - previous.revenue.gross) / previous.revenue.gross) * 100
      : 0;

    const profitGrowth = previous.netProfit > 0
      ? ((current.netProfit - previous.netProfit) / previous.netProfit) * 100
      : 0;

    const marginImprovement = current.netMargin - previous.netMargin;

    const ebitdaGrowth = previous.ebitda > 0
      ? ((current.ebitda - previous.ebitda) / previous.ebitda) * 100
      : 0;

    return {
      revenueGrowth,
      profitGrowth,
      marginImprovement,
      ebitdaGrowth,
    };
  }
}
