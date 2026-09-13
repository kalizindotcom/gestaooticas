import { describe, expect, it, vi } from 'vitest';
import { createRequestId, getOperationalMetrics, logOperationalEvent, recordRequest, resetOperationalMetrics } from '../../server/observability';

describe('observabilidade operacional', () => {
  it('preserva um request ID válido e substitui valores inválidos', () => {
    expect(createRequestId('request-1234')).toBe('request-1234');
    expect(createRequestId('não permitido')).not.toBe('não permitido');
    expect(createRequestId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('agrega contagem, status, método e duração média das requisições', () => {
    resetOperationalMetrics();
    recordRequest('GET', 200, 10);
    recordRequest('POST', 500, 30);
    const metrics = getOperationalMetrics();
    expect(metrics.requests.total).toBe(2);
    expect(metrics.requests.errors).toBe(1);
    expect(metrics.requests.by_status).toEqual({ '200': 1, '500': 1 });
    expect(metrics.requests.by_method).toEqual({ GET: 1, POST: 1 });
    expect(metrics.requests.average_duration_ms).toBe(20);
  });

  it('não escreve credenciais, tokens ou cookies em logs estruturados', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logOperationalEvent('test_event', { user_id: 'u1', password: 'secret', access_token: 'token', cookie: 'cookie-value', safe: 'ok' });
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.safe).toBe('ok');
    expect(payload.password).toBeUndefined();
    expect(payload.access_token).toBeUndefined();
    expect(payload.cookie).toBeUndefined();
    spy.mockRestore();
  });
});
