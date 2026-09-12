import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinancialService, CashRegister, BankAccount, BankReconciliation, FinancialCategory, FixedCost } from '@/services/financialService';
import { FinancialEntry } from '@/types';
import { DRECalculator, DREData } from '@/services/dreCalculator';
import { ReconciliationMatcher, MatchResult } from '@/services/reconciliationMatcher';
import { useGlobalFilter } from '@/contexts/GlobalFilterContext';

// =====================================================
// CASH REGISTERS HOOKS
// =====================================================

export function useCashRegisters(filters?: {
  store_id?: string;
  store_ids?: string[];
  status?: 'open' | 'closed';
  start_date?: string;
  end_date?: string;
}) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const scopedFilters = { ...filters, store_ids: filters?.store_id ? undefined : (filters?.store_ids || selectedStoreIds) };

  return useQuery({
    queryKey: ['cash-registers', selectedCompanyId, scopedFilters],
    queryFn: () => FinancialService.getCashRegisters({
      company_id: selectedCompanyId!,
      ...scopedFilters,
    }),
    enabled: !!selectedCompanyId,
  });
}

export function useCashRegistersWithBalance(filters?: {
  store_id?: string;
  store_ids?: string[];
  status?: 'open' | 'closed';
  start_date?: string;
  end_date?: string;
}, options?: { enabled?: boolean }) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const scopedFilters = { ...filters, store_ids: filters?.store_id ? undefined : (filters?.store_ids || selectedStoreIds) };

  return useQuery({
    queryKey: ['cash-registers-with-balance', selectedCompanyId, scopedFilters],
    queryFn: () => FinancialService.getCashRegistersWithBalance({
      company_id: selectedCompanyId!,
      ...scopedFilters,
    }),
    enabled: !!selectedCompanyId && (options?.enabled ?? true),
  });
}

export function useOpenCashRegister() {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useGlobalFilter();

  return useMutation({
    mutationFn: (data: {
      store_id: string;
      opening_balance: number;
      notes?: string;
    }) => FinancialService.openCashRegister({
      company_id: selectedCompanyId!,
      ...data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
    },
  });
}

export function useCloseCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: string;
      actual_balance: number;
      notes?: string;
    }) => FinancialService.closeCashRegister(data.id, data.actual_balance, data.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
    },
  });
}

export function useCashMovements(cashRegisterId: string) {
  return useQuery({
    queryKey: ['cash-movements', cashRegisterId],
    queryFn: () => FinancialService.getCashMovements(cashRegisterId),
    enabled: !!cashRegisterId,
  });
}

export function useCreateCashMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FinancialService.createCashMovement,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cash-movements', variables.cash_register_id] });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
    },
  });
}

// =====================================================
// FINANCIAL CATEGORIES HOOKS
// =====================================================

export function useFinancialCategories(type?: 'income' | 'expense', options?: { enabled?: boolean }) {
  const { selectedCompanyId } = useGlobalFilter();

  return useQuery({
    queryKey: ['financial-categories', selectedCompanyId, type],
    queryFn: () => FinancialService.getCategories(selectedCompanyId!, type),
    enabled: !!selectedCompanyId && (options?.enabled ?? true),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FinancialService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FinancialCategory> }) =>
      FinancialService.updateCategory(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
    },
  });
}

// =====================================================
// FIXED COSTS HOOKS
// =====================================================

export function useFixedCosts() {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  return useQuery({
    queryKey: ['fixed-costs', selectedCompanyId, selectedStoreIds],
    queryFn: () => FinancialService.getFixedCosts(selectedCompanyId!, selectedStoreIds),
    enabled: !!selectedCompanyId,
  });
}

export function useFixedCostPayments(fixedCostId?: string) {
  return useQuery({
    queryKey: ['fixed-cost-payments', fixedCostId],
    queryFn: () => FinancialService.getFixedCostPayments(fixedCostId!),
    enabled: !!fixedCostId,
  });
}

export function useCreateFixedCost() {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useGlobalFilter();
  return useMutation({
    mutationFn: (input: Partial<FixedCost>) => FinancialService.createFixedCost({ ...input, company_id: selectedCompanyId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
    },
  });
}

export function useUpdateFixedCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FixedCost> }) => FinancialService.updateFixedCost(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fixed-costs'], refetchType: 'all' }),
  });
}

export function useRecordFixedCostPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; amount: number; payment_date: string; payment_method?: string; note?: string }) => FinancialService.recordFixedCostPayment(id, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['fixed-cost-payments', variables.id], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' });
    },
  });
}

// =====================================================
// DRE HOOKS
// =====================================================

export function useDRE(startDate: Date, endDate: Date) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();

  return useQuery({
    queryKey: ['dre', selectedCompanyId, selectedStoreIds, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const entries = await FinancialService.getEntries({
        company_id: selectedCompanyId!,
        store_ids: selectedStoreIds,
      });
      return DRECalculator.calculate(entries, startDate, endDate);
    },
    enabled: !!selectedCompanyId && !!startDate && !!endDate,
  });
}

export function useDREComparison(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();

  return useQuery({
    queryKey: [
      'dre-comparison',
      selectedCompanyId,
      selectedStoreIds,
      currentStart.toISOString(),
      currentEnd.toISOString(),
      previousStart.toISOString(),
      previousEnd.toISOString(),
    ],
    queryFn: async () => {
      const [currentEntries, previousEntries] = await Promise.all([
        FinancialService.getEntries({
          company_id: selectedCompanyId!,
          store_ids: selectedStoreIds,
        }),
        FinancialService.getEntries({
          company_id: selectedCompanyId!,
          store_ids: selectedStoreIds,
        }),
      ]);

      const current = DRECalculator.calculate(currentEntries, currentStart, currentEnd);
      const previous = DRECalculator.calculate(previousEntries, previousStart, previousEnd);

      return {
        current,
        previous,
        growth: DRECalculator.comparePeriodsGrowth(current, previous),
      };
    },
    enabled: !!selectedCompanyId,
  });
}

// =====================================================
// BANK ACCOUNTS HOOKS
// =====================================================

export function useBankAccounts(options?: { enabled?: boolean }) {
  const { selectedCompanyId } = useGlobalFilter();

  return useQuery({
    queryKey: ['bank-accounts', selectedCompanyId],
    queryFn: () => FinancialService.getBankAccounts(selectedCompanyId!),
    enabled: !!selectedCompanyId && (options?.enabled ?? true),
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FinancialService.createBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'], refetchType: 'all' });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BankAccount> }) =>
      FinancialService.updateBankAccount(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'], refetchType: 'all' });
    },
  });
}

// =====================================================
// BANK RECONCILIATION HOOKS
// =====================================================

export function useBankReconciliations(bankAccountId: string) {
  return useQuery({
    queryKey: ['bank-reconciliations', bankAccountId],
    queryFn: () => FinancialService.getReconciliations(bankAccountId),
    enabled: !!bankAccountId,
  });
}

export function useCreateReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FinancialService.createReconciliation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', data.bank_account_id], refetchType: 'all' });
    },
  });
}

export function useUpdateReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BankReconciliation> }) =>
      FinancialService.updateReconciliation(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', data.bank_account_id], refetchType: 'all' });
    },
  });
}

export function useCompleteReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => FinancialService.completeReconciliation(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', data.bank_account_id], refetchType: 'all' });
    },
  });
}

export function useBankTransactions(reconciliationId: string) {
  return useQuery({
    queryKey: ['bank-transactions', reconciliationId],
    queryFn: () => FinancialService.getBankTransactions(reconciliationId),
    enabled: !!reconciliationId,
  });
}

export function useImportBankTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bankAccountId,
      reconciliationId,
      transactions,
    }: {
      bankAccountId: string;
      reconciliationId: string;
      transactions: Array<{
        transaction_date: string;
        description: string;
        amount: number;
        type: 'debit' | 'credit';
        balance_after?: number;
      }>;
    }) => FinancialService.importBankTransactions(bankAccountId, reconciliationId, transactions),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', variables.reconciliationId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['auto-match', variables.reconciliationId], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'], refetchType: 'all' });
    },
  });
}

export function useMatchTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      entryId,
      confidence,
    }: {
      transactionId: string;
      entryId: string;
      confidence: number;
    }) => FinancialService.matchTransaction(transactionId, entryId, confidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['auto-match'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
    },
  });
}

export function useAutoMatchTransactions(reconciliationId: string) {
  const { data: transactions } = useBankTransactions(reconciliationId);
  const { selectedCompanyId } = useGlobalFilter();

  return useQuery({
    queryKey: ['auto-match', reconciliationId],
    queryFn: async () => {
      if (!transactions || !selectedCompanyId) return [];

      const entries = await FinancialService.getEntries({
        company_id: selectedCompanyId,
        is_reconciled: false,
      });

      return ReconciliationMatcher.matchTransactions(transactions, entries);
    },
    enabled: !!transactions && !!selectedCompanyId,
  });
}

// =====================================================
// FINANCIAL ENTRIES HOOKS (Extended)
// =====================================================

export function useCreateFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FinancialService.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries-page'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customer-financials'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' });
    },
  });
}

export function useUpdateFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FinancialEntry> }) =>
      FinancialService.updateEntry(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries-page'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customer-financials'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' });
    },
  });
}

export function useDeleteFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => FinancialService.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      paymentDate,
      paymentMethod,
      amount,
      paymentNote,
      interestAmount,
      fineAmount,
      discountAmount,
    }: {
      id: string;
      paymentDate: string;
      paymentMethod: string;
      amount?: number;
      paymentNote?: string;
      interestAmount?: number;
      fineAmount?: number;
      discountAmount?: number;
    }) => FinancialService.markAsPaid(id, paymentDate, paymentMethod, amount, paymentNote, { interest_amount: interestAmount, fine_amount: fineAmount, discount_amount: discountAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entries-page'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customer-financials'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['service_orders'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers-with-balance'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['financial-entry-audits'], refetchType: 'all' });
    },
  });
}

export function useFinancialEntryAudits(entryId?: string) {
  return useQuery({
    queryKey: ['financial-entry-audits', entryId],
    queryFn: () => FinancialService.getEntryAudits(entryId!),
    enabled: !!entryId,
  });
}

export function useFinancialEntriesPage(filters: {
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
}) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const scopedFilters = { ...filters, store_ids: filters.store_id ? undefined : (filters.store_ids || selectedStoreIds) };

  return useQuery({
    queryKey: ['financial-entries-page', selectedCompanyId, scopedFilters],
    queryFn: () => FinancialService.getEntriesPage({
      company_id: selectedCompanyId!,
      ...scopedFilters,
    }),
    enabled: !!selectedCompanyId,
    placeholderData: (previous) => previous,
  });
}

export function useFinancialEntries(filters?: {
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
  approval_status?: string;
}, options?: { enabled?: boolean }) {
  const { selectedCompanyId, selectedStoreIds } = useGlobalFilter();
  const scopedFilters = { ...filters, store_ids: filters?.store_id ? undefined : (filters?.store_ids || selectedStoreIds) };

  return useQuery({
    queryKey: ['financial-entries', selectedCompanyId, scopedFilters],
        queryFn: () =>
      FinancialService.getEntries({
        company_id: selectedCompanyId!,
        ...scopedFilters,
      }),
    enabled: !!selectedCompanyId && (options?.enabled ?? true),
  });
}

