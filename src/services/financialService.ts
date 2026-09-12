import { localApi } from '@/lib/localApi';
import { FinancialEntry } from '@/types';
import { normalizePaymentMethod } from '@/lib/financial';

export interface CashRegister {
  id: string;
  company_id: string;
  store_id: string;
  user_id: string;
  opened_by_name?: string;
  opened_at: string;
  closed_at?: string;
  opening_balance: number;
  expected_balance?: number;
  actual_balance?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
  closed_by?: string;
  closed_by_name?: string;
}

export interface CashRegisterMovement {
  id: string;
  cash_register_id: string;
  type: 'sale' | 'withdrawal' | 'reinforcement' | 'opening' | 'closing';
  amount: number;
  description?: string;
  payment_method?: string;
  reference_id?: string;
  reference_table?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  bank_code?: string;
  agency?: string;
  account_number: string;
  account_type?: 'checking' | 'savings' | 'investment';
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
}

export interface BankReconciliation {
  id: string;
  bank_account_id: string;
  period_start: string;
  period_end: string;
  initial_balance_bank: number;
  initial_balance_system: number;
  final_balance_bank: number;
  final_balance_system: number;
  total_transactions: number;
  matched_auto: number;
  matched_manual: number;
  pending: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  reconciled_by?: string;
  reconciled_by_name?: string;
  reconciled_at?: string;
  notes?: string;
}

export interface FinancialCategory {
  id: string;
  company_id: string;
  name: string;
  parent_id?: string;
  type: 'income' | 'expense';
  cost_center?: string;
  icon?: string;
  color?: string;
  is_active: boolean;
}

export interface FixedCost {
  id: string;
  company_id: string;
  store_id: string;
  name: string;
  description?: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  valid_from: string;
  valid_until?: string | null;
  status: 'active' | 'inactive' | 'expired';
  payment_count: number;
  last_paid_at?: string | null;
  next_due_date?: string | null;
  payment_method?: string | null;
  category_id?: string | null;
  cost_center?: string | null;
  notes?: string | null;
  supplier_name?: string | null;
  contract_number?: string | null;
  annual_adjustment_percent?: number | null;
  last_adjustment_at?: string | null;
  responsible_name?: string | null;
  renewal_date?: string | null;
  document_url?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface FixedCostPayment {
  id: string;
  fixed_cost_id: string;
  company_id: string;
  store_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string | null;
  note?: string | null;
  financial_entry_id?: string | null;
  created_at: string;
}

export class FinancialService {
  // =====================================================
  // FIXED COSTS
  // =====================================================

  static async getFixedCosts(companyId: string, storeIds?: string[]): Promise<FixedCost[]> {
    let query = localApi.from('fixed_costs').select('*').eq('company_id', companyId).order('next_due_date', { ascending: true });
    if (storeIds && storeIds.length > 0) query = query.in('store_id', storeIds);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as FixedCost[];
  }

  static async createFixedCost(input: Partial<FixedCost>): Promise<FixedCost> {
    const amount = Number(input.amount);
    if (!input.company_id || !input.store_id || !input.name?.trim()) throw new Error('Empresa, loja e nome do custo são obrigatórios.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('O valor do custo fixo deve ser maior que zero.');
    if (!input.valid_from) throw new Error('A data de início da validade é obrigatória.');
    const { data, error } = await localApi.from('fixed_costs').insert({
      ...input,
      name: input.name.trim(),
      amount,
      frequency: input.frequency || 'monthly',
      interval: Math.max(1, Math.floor(Number(input.interval || 1))),
      status: input.status || 'active',
      payment_count: 0,
      next_due_date: input.next_due_date || input.valid_from,
    }).select().single();
    if (error) throw error;
    return data as FixedCost;
  }

  static async updateFixedCost(id: string, updates: Partial<FixedCost>): Promise<FixedCost> {
    const payload = { ...updates } as Record<string, unknown>;
    delete payload.id;
    delete payload.company_id;
    delete payload.created_at;
    if (payload.amount !== undefined) {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('O valor do custo fixo deve ser maior que zero.');
      payload.amount = amount;
    }
    const { data, error } = await localApi.from('fixed_costs').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as FixedCost;
  }

  static async getFixedCostPayments(fixedCostId: string): Promise<FixedCostPayment[]> {
    const { data, error } = await localApi.from('fixed_cost_payments').select('*').eq('fixed_cost_id', fixedCostId).order('payment_date', { ascending: false });
    if (error) throw error;
    return (data || []) as FixedCostPayment[];
  }

  static async recordFixedCostPayment(fixedCostId: string, input: { amount: number; payment_date: string; payment_method?: string; note?: string }) {
    const { data, error } = await localApi.operations.recordFixedCostPayment(fixedCostId, {
      amount: Number(input.amount),
      payment_date: input.payment_date,
      payment_method: normalizePaymentMethod(input.payment_method),
      note: input.note,
    });
    if (error) throw error;
    return data;
  }

  // =====================================================
  // FINANCIAL ENTRIES
  // =====================================================

  static async createEntry(entry: Partial<FinancialEntry>): Promise<FinancialEntry> {
    const allowedTypes = new Set(['in', 'out', 'receivable', 'payable']);
    const amount = Number(entry.amount);
    if (!entry.company_id) throw new Error('Empresa é obrigatória para o lançamento.');
    if (!allowedTypes.has(String(entry.type))) throw new Error('Tipo de lançamento inválido.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('O valor do lançamento deve ser maior que zero.');
    if (!entry.description?.trim()) throw new Error('Descrição é obrigatória para o lançamento.');
    const normalizedPaymentMethod = normalizePaymentMethod(entry.payment_method);

    const user = (await localApi.auth.getUser()).data.user;
    const payload = {
      ...entry,
      amount,
      payment_method: normalizedPaymentMethod,
      audit_log: {
        created_by: user?.id,
        created_at: new Date().toISOString(),
        changes: [],
      },
    };
    if (entry.origin_table === 'manual') {
      const { data, error } = await localApi.operations.createManualFinancialEntry(payload as Record<string, unknown>);
      if (error) throw error;
      return data as FinancialEntry;
    }
    const { data, error } = await localApi
      .from('financial_entries')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateEntry(id: string, updates: Partial<FinancialEntry>): Promise<FinancialEntry> {
    const user = (await localApi.auth.getUser()).data.user;

    // Buscar entry atual para audit log
    const { data: current } = await localApi
      .from('financial_entries')
      .select('audit_log')
      .eq('id', id)
      .single();

    let auditLog: { created_by: string | null; created_at: string | null; changes: Array<Record<string, unknown>> } = { created_by: null, created_at: null, changes: [] };
    if (current?.audit_log && typeof current.audit_log === 'object') {
      const candidate = current.audit_log as Record<string, unknown>;
      auditLog = {
        created_by: candidate.created_by ? String(candidate.created_by) : null,
        created_at: candidate.created_at ? String(candidate.created_at) : null,
        changes: Array.isArray(candidate.changes) ? candidate.changes as Array<Record<string, unknown>> : [],
      };
    }
    auditLog.changes.push({
      changed_by: user?.id,
      changed_at: new Date().toISOString(),
      fields: Object.keys(updates),
    });

    const { data, error } = await localApi
      .from('financial_entries')
      .update({ ...updates, audit_log: auditLog })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteEntry(id: string): Promise<void> {
    const { error } = await localApi
      .from('financial_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async getEntries(filters?: {
    company_id?: string;
    store_id?: string;
    store_ids?: string[];
    type?: string;
    types?: string[];
    status?: string;
    start_date?: string;
    end_date?: string;
    category_id?: string;
    cost_center?: string;
    tags?: string[];
    is_reconciled?: boolean;
    origin_table?: string;
    origin_id?: string;
    approval_status?: string;
  }): Promise<FinancialEntry[]> {
    let query = localApi.from('financial_entries').select('*');

    if (filters?.company_id) query = query.eq('company_id', filters.company_id);
    if (filters?.store_id) query = query.eq('store_id', filters.store_id);
    else if (filters?.store_ids && filters.store_ids.length > 0) query = query.in('store_id', filters.store_ids);
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.types && filters.types.length > 0) query = query.in('type', filters.types);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.start_date) query = query.gte('due_date', filters.start_date);
    if (filters?.end_date) query = query.lte('due_date', filters.end_date);
    if (filters?.category_id) query = query.eq('category_id', filters.category_id);
    if (filters?.cost_center) query = query.eq('cost_center', filters.cost_center);
    if (filters?.tags) query = query.contains('tags', filters.tags);
    if (filters?.is_reconciled !== undefined) query = query.eq('is_reconciled', filters.is_reconciled);
    if (filters?.origin_table) query = query.eq('origin_table', filters.origin_table);
    if (filters?.origin_id) query = query.eq('origin_id', filters.origin_id);
    if (filters?.approval_status) query = query.eq('approval_status', filters.approval_status);

    const { data, error } = await query.order('due_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getEntriesPage(filters: {
    company_id: string;
    store_id?: string;
    store_ids?: string[];
    type?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    category_id?: string;
    approval_status?: string;
    page: number;
    pageSize: number;
  }): Promise<{ data: FinancialEntry[]; total: number }> {
    let query = localApi.from('financial_entries').select('*');
    query = query.eq('company_id', filters.company_id);
    if (filters.store_id) query = query.eq('store_id', filters.store_id);
    else if (filters.store_ids && filters.store_ids.length > 0) query = query.in('store_id', filters.store_ids);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.start_date) query = query.gte('due_date', filters.start_date);
    if (filters.end_date) query = query.lte('due_date', filters.end_date);
    if (filters.category_id) query = query.eq('category_id', filters.category_id);
    if (filters.approval_status) query = query.eq('approval_status', filters.approval_status);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize || 30)));
    const safePage = Math.max(1, Math.floor(filters.page || 1));
    const result = await query.order('due_date', { ascending: false }).limit(safePageSize).offset((safePage - 1) * safePageSize);
    if (result.error) throw result.error;
    return { data: (result.data || []) as FinancialEntry[], total: result.meta?.total ?? (result.data || []).length };
  }

  static async markAsPaid(id: string, paymentDate: string, paymentMethod: string, amount?: number, paymentNote?: string, adjustments?: { interest_amount?: number; fine_amount?: number; discount_amount?: number }): Promise<FinancialEntry> {
    if (!paymentDate || Number.isNaN(new Date(paymentDate).getTime())) throw new Error('Data de pagamento inválida.');
    if (!paymentMethod?.trim()) throw new Error('Forma de pagamento é obrigatória.');
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!normalizedPaymentMethod) throw new Error('Forma de pagamento é obrigatória.');

    const { data, error } = await localApi.operations.settleFinancialEntry({
      id,
      amount,
      payment_date: paymentDate,
      payment_method: normalizedPaymentMethod,
      payment_note: paymentNote,
      interest_amount: adjustments?.interest_amount,
      fine_amount: adjustments?.fine_amount,
      discount_amount: adjustments?.discount_amount,
    });
    if (error) throw error;
    return data as FinancialEntry;
  }

  static async getEntryAudits(entryId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await localApi
      .from('financial_entry_audits')
      .select('*')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // =====================================================
  // CASH REGISTERS
  // =====================================================

  static async openCashRegister(data: {
    company_id: string;
    store_id: string;
    opening_balance: number;
    notes?: string;
  }): Promise<CashRegister> {
    const { data: cashRegister, error } = await localApi.operations.openCashRegister({
      store_id: data.store_id,
      opening_balance: data.opening_balance,
      notes: data.notes,
    });
    if (error) throw error;
    return cashRegister as CashRegister;
  }

  static async closeCashRegister(
    id: string,
    actualBalance: number,
    notes?: string
  ): Promise<CashRegister> {
    const { data, error } = await localApi.operations.closeCashRegister({
      id,
      actual_balance: actualBalance,
      notes,
    });
    if (error) throw error;
    return data as CashRegister;
  }

  static async createCashMovement(movement: Partial<CashRegisterMovement>): Promise<CashRegisterMovement> {
    if (!movement.cash_register_id || !movement.type || !['sale', 'withdrawal', 'reinforcement'].includes(movement.type)) throw new Error('Movimentação de caixa inválida.');
    const { data, error } = await localApi.operations.createCashMovement({
      cash_register_id: movement.cash_register_id,
      type: movement.type as 'sale' | 'withdrawal' | 'reinforcement',
      amount: Number(movement.amount || 0),
      description: movement.description,
      payment_method: movement.payment_method,
      reference_id: movement.reference_id,
      reference_table: movement.reference_table,
    });
    if (error) throw error;
    return data as CashRegisterMovement;
  }

  static async getCashRegisters(filters?: {
    company_id?: string;
    store_id?: string;
    store_ids?: string[];
    status?: 'open' | 'closed';
    start_date?: string;
    end_date?: string;
  }): Promise<CashRegister[]> {
    let query = localApi.from('cash_registers').select('*');

    if (filters?.company_id) query = query.eq('company_id', filters.company_id);
    if (filters?.store_id) query = query.eq('store_id', filters.store_id);
    else if (filters?.store_ids && filters.store_ids.length > 0) query = query.in('store_id', filters.store_ids);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.start_date) query = query.gte('opened_at', filters.start_date);
    if (filters?.end_date) query = query.lte('opened_at', filters.end_date);

    const { data, error } = await query.order('opened_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getCashRegistersWithBalance(filters?: {
    company_id?: string;
    store_id?: string;
    store_ids?: string[];
    status?: 'open' | 'closed';
    start_date?: string;
    end_date?: string;
  }): Promise<(CashRegister & { current_balance: number; movements: CashRegisterMovement[] })[]> {
    const registers = await this.getCashRegisters(filters);
    if (registers.length === 0) return [];

    const ids = registers.map(r => r.id);
    const { data: movements, error } = await localApi
      .from('cash_register_movements')
      .select('*')
      .in('cash_register_id', ids)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const movsByRegister = (movements || []).reduce<Record<string, CashRegisterMovement[]>>((acc, m) => {
      if (!acc[m.cash_register_id]) acc[m.cash_register_id] = [];
      acc[m.cash_register_id].push(m);
      return acc;
    }, {});

    return registers.map(r => {
      const regMovements = movsByRegister[r.id] || [];
      const current_balance = regMovements.reduce((sum, m) => {
        if (m.type === 'opening' || m.type === 'sale' || m.type === 'reinforcement') return sum + m.amount;
        if (m.type === 'withdrawal') return sum - m.amount;
        return sum;
      }, 0);
      return { ...r, current_balance, movements: regMovements };
    });
  }

  static async getCashMovements(cashRegisterId: string): Promise<CashRegisterMovement[]> {
    const { data, error } = await localApi
      .from('cash_register_movements')
      .select('*')
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // =====================================================
  // BANK ACCOUNTS
  // =====================================================

  static async createBankAccount(account: Partial<BankAccount>): Promise<BankAccount> {
    const { data, error } = await localApi
      .from('bank_accounts')
      .insert({
        ...account,
        current_balance: account.initial_balance || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateBankAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount> {
    const { data, error } = await localApi
      .from('bank_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getBankAccounts(companyId: string): Promise<BankAccount[]> {
    const { data, error } = await localApi
      .from('bank_accounts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('bank_name');

    if (error) throw error;
    return data || [];
  }

  // =====================================================
  // BANK RECONCILIATION
  // =====================================================

  static async createReconciliation(reconciliation: Partial<BankReconciliation>): Promise<BankReconciliation> {
    const { data, error } = await localApi
      .from('bank_reconciliations')
      .insert(reconciliation)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateReconciliation(
    id: string,
    updates: Partial<BankReconciliation>
  ): Promise<BankReconciliation> {
    const { data, error } = await localApi
      .from('bank_reconciliations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async completeReconciliation(id: string): Promise<BankReconciliation> {
    const user = (await localApi.auth.getUser()).data.user;

    const { data, error } = await localApi
      .from('bank_reconciliations')
      .update({
        status: 'completed',
        reconciled_by: user?.id,
        reconciled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getReconciliations(bankAccountId: string): Promise<BankReconciliation[]> {
    const { data, error } = await localApi
      .from('bank_reconciliations')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .order('period_start', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async importBankTransactions(
    bankAccountId: string,
    reconciliationId: string,
    transactions: Array<{
      transaction_date: string;
      description: string;
      amount: number;
      type: 'debit' | 'credit';
      balance_after?: number;
    }>
  ): Promise<void> {
    const { error } = await localApi.from('bank_transactions').insert(
      transactions.map(t => ({
        ...t,
        bank_account_id: bankAccountId,
        reconciliation_id: reconciliationId,
        is_reconciled: false,
      }))
    );

    if (error) throw error;
  }

  static async getBankTransactions(reconciliationId: string) {
    const { data, error } = await localApi
      .from('bank_transactions')
      .select('*')
      .eq('reconciliation_id', reconciliationId)
      .order('transaction_date');

    if (error) throw error;
    return data || [];
  }

  static async matchTransaction(transactionId: string, entryId: string, confidence: number): Promise<void> {
    const { error } = await localApi.operations.matchBankTransaction({
      transaction_id: transactionId,
      entry_id: entryId,
      confidence,
    });
    if (error) throw error;
  }

  // =====================================================
  // CATEGORIES
  // =====================================================

  static async getCategories(companyId: string, type?: 'income' | 'expense'): Promise<FinancialCategory[]> {
    let query = localApi
      .from('financial_categories')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (type) query = query.eq('type', type);

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data || [];
  }

  static async createCategory(category: Partial<FinancialCategory>): Promise<FinancialCategory> {
    const { data, error } = await localApi
      .from('financial_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateCategory(id: string, updates: Partial<FinancialCategory>): Promise<FinancialCategory> {
    const { data, error } = await localApi
      .from('financial_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // =====================================================
  // INTEGRATIONS
  // =====================================================

  static async createEntryFromSale(saleId: string, saleData: {
    customer_id: string;
    customer_name: string;
    total: number;
    payment_method: string;
    store_id: string;
    company_id: string;
  }): Promise<FinancialEntry> {
    return this.createEntry({
      company_id: saleData.company_id,
      store_id: saleData.store_id,
      type: 'in',
      amount: saleData.total,
      description: `Venda #${saleId}`,
      supplier_customer_name: saleData.customer_name,
      payment_method: saleData.payment_method,
      status: 'paid',
      payment_date: new Date().toISOString(),
      due_date: new Date().toISOString(),
      origin_table: 'sales',
      origin_id: saleId,
    });
  }

  static async createEntryFromServiceOrder(osId: string, osData: {
    customer_id: string;
    customer_name: string;
    total: number;
    lab_cost?: number;
    lab_id?: string;
    store_id: string;
    company_id: string;
  }): Promise<void> {
    // Criar entrada de receita
    await this.createEntry({
      company_id: osData.company_id,
      store_id: osData.store_id,
      type: 'receivable',
      amount: osData.total,
      description: `OS #${osId}`,
      supplier_customer_name: osData.customer_name,
      status: 'pending',
      due_date: new Date().toISOString(),
      origin_table: 'service_orders',
      origin_id: osId,
    });

    // Criar saída de custo de laboratório se houver
    if (osData.lab_cost && osData.lab_cost > 0) {
      await this.createEntry({
        company_id: osData.company_id,
        store_id: osData.store_id,
        type: 'payable',
        amount: osData.lab_cost,
        description: `Laboratório - OS #${osId}`,
        supplier_customer_name: 'Laboratório',
        status: 'pending',
        due_date: new Date().toISOString(),
        cost_center: 'CMV',
        origin_table: 'service_orders',
        origin_id: osId,
      });
    }
  }

  static async createRecurringEntries(templateId: string): Promise<void> {
    const { data: template, error: templateError } = await localApi
      .from('financial_entries')
      .select('*')
      .eq('id', templateId)
      .single();
    if (templateError) throw templateError;
    if (!template || !template.is_recurring || !template.recurrence_config) return;

    const rawConfig = typeof template.recurrence_config === 'string' ? JSON.parse(template.recurrence_config) : template.recurrence_config;
    const config = rawConfig as {
      frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval?: number;
      end_date?: string;
      occurrences?: number;
    };
    const frequency = config.frequency || 'monthly';
    const interval = Math.max(1, Math.floor(Number(config.interval || 1)));
    const maxOccurrences = Math.min(120, Math.max(1, Math.floor(Number(config.occurrences || 12))));
    const baseDate = new Date(String(template.due_date || template.created_at));
    if (Number.isNaN(baseDate.getTime())) throw new Error('Data-base da recorrência inválida.');
    const endDate = config.end_date ? new Date(config.end_date) : null;
    const { data: existingRows, error: existingError } = await localApi
      .from('financial_entries')
      .select('due_date')
      .eq('origin_table', 'recurring')
      .eq('origin_id', templateId);
    if (existingError) throw existingError;
    const existingDates = new Set((existingRows || []).map((row: any) => String(row.due_date || '').slice(0, 10)));

    const addPeriod = (date: Date, step: number) => {
      const next = new Date(date);
      if (frequency === 'daily') next.setDate(next.getDate() + step);
      else if (frequency === 'weekly') next.setDate(next.getDate() + step * 7);
      else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + step);
      else next.setMonth(next.getMonth() + step);
      return next;
    };
    const entries = [] as Array<Record<string, unknown>>;
    for (let occurrence = 1; occurrence <= maxOccurrences; occurrence += 1) {
      const dueDate = addPeriod(baseDate, occurrence * interval);
      if (endDate && dueDate > endDate) break;
      const dueDateValue = dueDate.toISOString().slice(0, 10);
      if (existingDates.has(dueDateValue)) continue;
      entries.push({
        company_id: template.company_id,
        store_id: template.store_id,
        cashier_id: template.cashier_id,
        type: template.type,
        description: `${template.description} · Recorrência ${occurrence}`.slice(0, 500),
        amount: Number(template.amount || 0),
        due_date: dueDateValue,
        status: 'pending',
        paid_amount: 0,
        payment_date: null,
        category: template.category,
        category_id: template.category_id,
        payment_method: template.payment_method,
        supplier_customer_name: template.supplier_customer_name,
        customer_id: template.customer_id,
        cost_center: template.cost_center,
        tags: template.tags || [],
        origin_table: 'recurring',
        origin_id: templateId,
        is_recurring: false,
        recurrence_config: null,
        audit_log: { created_from: templateId, created_at: new Date().toISOString(), changes: [] },
      });
    }
    if (entries.length === 0) return;
    const { error } = await localApi.from('financial_entries').insert(entries);
    if (error) throw error;
  }
}
