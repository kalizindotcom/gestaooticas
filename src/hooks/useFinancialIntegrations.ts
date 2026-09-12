import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FinancialService } from '@/services/financialService';
import { getEntryRemainingAmount, normalizePaymentMethod } from '@/lib/financial';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para criar entrada financeira automaticamente ao finalizar uma venda
 */
export function useCreateSaleFinancialEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sale: {
      id: string;
      customer_id: string;
      customer_name: string;
      total: number;
      payment_method: string;
      store_id: string;
      company_id: string;
      payment_status: 'paid' | 'pending' | 'partial';
    }) => {
      // Se a venda foi paga, criar entrada imediata
      if (sale.payment_status === 'paid') {
        return await FinancialService.createEntryFromSale(sale.id, sale);
      }

      // Se está pendente, criar conta a receber
      return await FinancialService.createEntry({
        company_id: sale.company_id,
        store_id: sale.store_id,
        type: 'receivable',
        amount: sale.total,
        description: `Venda #${sale.id.slice(0, 8)}`,
        supplier_customer_name: sale.customer_name,
        customer_id: sale.customer_id,
        payment_method: sale.payment_method,
        status: 'pending',
        due_date: new Date().toISOString(),
        origin_table: 'sales',
        origin_id: sale.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customer-financials'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['service_orders'], refetchType: 'all' });
      toast({
        title: 'Lançamento financeiro criado',
        description: 'A movimentação foi registrada no sistema financeiro.',
      });
    },
    onError: (error) => {
      console.error('Erro ao criar lançamento financeiro:', error);
      toast({
        title: 'Erro ao criar lançamento',
        description: 'Não foi possível registrar a movimentação financeira.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para criar entradas financeiras automaticamente ao criar uma OS
 */
export function useCreateServiceOrderFinancialEntries() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (serviceOrder: {
      id: string;
      customer_id: string;
      customer_name: string;
      total: number;
      lab_cost?: number;
      lab_id?: string;
      store_id: string;
      company_id: string;
      financial_status: 'pending' | 'partial' | 'paid';
    }) => {
      await FinancialService.createEntryFromServiceOrder(serviceOrder.id, serviceOrder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customer-financials'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['service_orders'], refetchType: 'all' });
      toast({
        title: 'Lançamentos financeiros criados',
        description: 'Receita e custo de laboratório foram registrados.',
      });
    },
    onError: (error) => {
      console.error('Erro ao criar lançamentos financeiros:', error);
      toast({
        title: 'Erro ao criar lançamentos',
        description: 'Não foi possível registrar as movimentações financeiras.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para atualizar status financeiro ao receber pagamento
 */
export function useUpdateFinancialStatusOnPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payment: {
      origin_table: 'sales' | 'service_orders';
      origin_id: string;
      amount: number;
      payment_method: string;
      payment_date: string;
    }) => {
      // Buscar lançamento financeiro relacionado
      const entries = await FinancialService.getEntries({
        origin_table: payment.origin_table,
        origin_id: payment.origin_id,
      });
      const entry = entries.find(candidate => ['pending', 'partially_paid', 'overdue'].includes(String(candidate.status)) && getEntryRemainingAmount(candidate) > 0);
      if (!entry) throw new Error('Lançamento financeiro pendente não encontrado');

      return await FinancialService.markAsPaid(
        entry.id,
        payment.payment_date,
        payment.payment_method,
        payment.amount,
        (payment as { payment_note?: string }).payment_note,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['customer-financials'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['service_orders'], refetchType: 'all' });
      toast({
        title: 'Pagamento registrado',
        description: 'O lançamento financeiro foi atualizado.',
      });
    },
    onError: (error) => {
      console.error('Erro ao atualizar pagamento:', error);
      toast({
        title: 'Erro ao registrar pagamento',
        description: 'Não foi possível atualizar o lançamento financeiro.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para criar movimentação de caixa ao receber pagamento em dinheiro
 */
export function useCreateCashMovementOnPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payment: {
      cash_register_id: string;
      amount: number;
      description: string;
      reference_id: string;
      reference_table: 'sales' | 'service_orders';
    }) => {
      return await FinancialService.createCashMovement({
        cash_register_id: payment.cash_register_id,
        type: 'sale',
        amount: payment.amount,
        description: payment.description,
        reference_id: payment.reference_id,
        reference_table: payment.reference_table,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
    },
    onError: (error) => {
      console.error('Erro ao criar movimentação de caixa:', error);
    },
  });
}

/**
 * Hook para integração completa: venda -> financeiro + caixa
 */
export function useCompleteSaleWithFinancial() {
  const createFinancialEntry = useCreateSaleFinancialEntry();
  const createCashMovement = useCreateCashMovementOnPayment();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      sale: {
        id: string;
        customer_id: string;
        customer_name: string;
        total: number;
        payment_method: string;
        store_id: string;
        company_id: string;
        payment_status: 'paid' | 'pending' | 'partial';
      };
      cash_register_id?: string;
    }) => {
      // 1. Criar lançamento financeiro
      await createFinancialEntry.mutateAsync(data.sale);

      // 2. Se pagamento em dinheiro e caixa aberto, registrar movimentação
      if (
        data.sale.payment_status === 'paid' &&
        normalizePaymentMethod(data.sale.payment_method) === 'cash' &&
        data.cash_register_id
      ) {
        await createCashMovement.mutateAsync({
          cash_register_id: data.cash_register_id,
          amount: data.sale.total,
          description: `Venda #${data.sale.id.slice(0, 8)} - ${data.sale.customer_name}`,
          reference_id: data.sale.id,
          reference_table: 'sales',
        });
      }
    },
    onSuccess: () => {
      toast({
        title: 'Venda finalizada',
        description: 'Venda e movimentações financeiras registradas com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Erro ao finalizar venda:', error);
      toast({
        title: 'Erro ao finalizar venda',
        description: 'Ocorreu um erro ao processar a venda.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para integração completa: OS -> financeiro (receita + custo lab)
 */
export function useCompleteServiceOrderWithFinancial() {
  const createFinancialEntries = useCreateServiceOrderFinancialEntries();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (serviceOrder: {
      id: string;
      customer_id: string;
      customer_name: string;
      total: number;
      lab_cost?: number;
      lab_id?: string;
      store_id: string;
      company_id: string;
      financial_status: 'pending' | 'partial' | 'paid';
    }) => {
      await createFinancialEntries.mutateAsync(serviceOrder);
    },
    onSuccess: () => {
      toast({
        title: 'OS criada',
        description: 'Ordem de serviço e lançamentos financeiros registrados.',
      });
    },
    onError: (error) => {
      console.error('Erro ao criar OS:', error);
      toast({
        title: 'Erro ao criar OS',
        description: 'Ocorreu um erro ao processar a ordem de serviço.',
        variant: 'destructive',
      });
    },
  });
}
