import { describe, expect, it } from 'vitest';
import { canTransitionFiscalStatus, canUseProviderInEnvironment, isProductionEnvironment } from '../../server/fiscalDomain';
import { LocalSimulationProvider, resolveFiscalProvider } from '../../server/fiscalProvider';

describe('domínio fiscal seguro', () => {
  it('aceita o fluxo local de rascunho até simulação e rejeita transições finais inválidas', () => {
    expect(canTransitionFiscalStatus('draft', 'queued')).toBe(true);
    expect(canTransitionFiscalStatus('queued', 'processing')).toBe(true);
    expect(canTransitionFiscalStatus('processing', 'simulation')).toBe(true);
    expect(canTransitionFiscalStatus('simulation', 'authorized')).toBe(false);
    expect(canTransitionFiscalStatus('cancelled', 'draft')).toBe(false);
  });

  it('bloqueia provider local em produção', () => {
    expect(isProductionEnvironment('producao')).toBe(true);
    expect(canUseProviderInEnvironment('local-simulation', 'homologacao')).toBe(true);
    expect(canUseProviderInEnvironment('local-simulation', 'producao')).toBe(false);
    expect(resolveFiscalProvider('Focus NFe')).toBeNull();
  });

  it('não cria chave, número ou protocolo na simulação', () => {
    const provider = new LocalSimulationProvider();
    const result = provider.transmit({ documentId: 'doc-1', type: 'NFC-e', operation: 'sale', environment: 'homologacao', provider: 'local-simulation' });
    expect(result.status).toBe('simulation');
    expect(result.accessKey).toBeUndefined();
    expect(result.number).toBeUndefined();
    expect(result.protocol).toBeUndefined();
  });
});
