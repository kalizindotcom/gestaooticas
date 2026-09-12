export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debit', label: 'Cartão de débito' },
  { value: 'credit', label: 'Cartão de crédito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'crediario', label: 'Crediário' },
  { value: 'other', label: 'Outro' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

const PAYMENT_METHOD_ALIASES: Record<string, PaymentMethod> = {
  cash: 'cash', dinheiro: 'cash', especie: 'cash', 'em espécie': 'cash',
  pix: 'pix',
  debit: 'debit', 'cartao debito': 'debit', 'cartão débito': 'debit', 'cartão de débito': 'debit', 'cartao de debito': 'debit',
  credit: 'credit', 'cartao credito': 'credit', 'cartão crédito': 'credit', 'cartão de crédito': 'credit', 'cartao de credito': 'credit',
  boleto: 'boleto',
  transfer: 'transfer', transferencia: 'transfer', transferência: 'transfer', 'transferência bancária': 'transfer',
  crediario: 'crediario', 'crediário': 'crediario',
  other: 'other', outro: 'other',
};

function fold(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const raw = String(value).trim();
  return PAYMENT_METHOD_ALIASES[fold(raw)] || PAYMENT_METHOD_ALIASES[raw] || 'other';
}

export function getPaymentMethodLabel(value: unknown) {
  const normalized = normalizePaymentMethod(value);
  return PAYMENT_METHODS.find(method => method.value === normalized)?.label || (value ? String(value) : 'Não informado');
}

export function getEntryPaidAmount(entry: { amount?: unknown; paid_amount?: unknown; status?: unknown; type?: unknown }) {
  if (entry.status === 'cancelled') return 0;
  if (entry.type === 'in') return Number(entry.amount || 0);
  return Number(entry.paid_amount || (entry.status === 'paid' ? entry.amount : 0) || 0);
}

export function getEntryRemainingAmount(entry: { amount?: unknown; paid_amount?: unknown; status?: unknown; type?: unknown }) {
  return Math.max(Number(entry.amount || 0) - getEntryPaidAmount(entry), 0);
}
