import { describe, expect, it } from 'vitest';
import { getEntryPaidAmount, getEntryRemainingAmount, getPaymentMethodLabel, normalizePaymentMethod } from './financial';

describe('regras financeiras compartilhadas', () => {
  it('normaliza nomes legados de meios de pagamento', () => {
    expect(normalizePaymentMethod('Cartao Credito')).toBe('credit');
    expect(normalizePaymentMethod('Transferência')).toBe('transfer');
    expect(getPaymentMethodLabel('Cartao Debito')).toBe('Cartão de débito');
  });

  it('calcula baixa parcial e saldo restante sem contar cancelados', () => {
    const entry = { amount: 100, paid_amount: 35, status: 'partially_paid', type: 'receivable' };
    expect(getEntryPaidAmount(entry)).toBe(35);
    expect(getEntryRemainingAmount(entry)).toBe(65);
    expect(getEntryPaidAmount({ ...entry, status: 'cancelled' })).toBe(0);
  });
});
