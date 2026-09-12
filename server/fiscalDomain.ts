export const FISCAL_DOCUMENT_STATUSES = [
  'draft',
  'validation_pending',
  'queued',
  'processing',
  'simulation',
  'authorized',
  'rejected',
  'communication_failed',
  'denied',
  'cancelled',
  'inutilized',
  'contingency',
] as const;

export type FiscalDocumentStatus = typeof FISCAL_DOCUMENT_STATUSES[number];

const allowedTransitions: Record<FiscalDocumentStatus, FiscalDocumentStatus[]> = {
  draft: ['validation_pending', 'queued', 'simulation', 'rejected'],
  validation_pending: ['queued', 'rejected'],
  queued: ['processing', 'communication_failed'],
  processing: ['authorized', 'simulation', 'rejected', 'communication_failed', 'denied', 'contingency'],
  simulation: [],
  authorized: ['cancelled', 'contingency'],
  rejected: ['validation_pending', 'queued'],
  communication_failed: ['queued', 'processing'],
  denied: [],
  cancelled: [],
  inutilized: [],
  contingency: ['processing', 'authorized', 'cancelled'],
};

export function isFiscalDocumentStatus(value: unknown): value is FiscalDocumentStatus {
  return FISCAL_DOCUMENT_STATUSES.includes(String(value) as FiscalDocumentStatus);
}

export function canTransitionFiscalStatus(current: unknown, next: unknown): boolean {
  if (!isFiscalDocumentStatus(current) || !isFiscalDocumentStatus(next)) return false;
  if (current === next) return true;
  return allowedTransitions[current].includes(next);
}

export function isProductionEnvironment(value: unknown): boolean {
  return String(value || '').trim().toLowerCase() === 'producao';
}

export function canUseProviderInEnvironment(provider: unknown, environment: unknown): boolean {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (isProductionEnvironment(environment)) return false;
  return ['local-simulation', 'simulacao-local', 'simulacao', 'desenvolvimento'].includes(normalizedProvider.replace(/[áàãâ]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/\s+/g, '-'));
}
