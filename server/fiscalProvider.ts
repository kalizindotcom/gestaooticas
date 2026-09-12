export type FiscalProviderInput = {
  documentId: string;
  type: string;
  operation: string;
  environment: string;
  provider: string;
};

export type FiscalProviderResult = {
  status: 'simulation' | 'authorized' | 'rejected' | 'communication_failed';
  message: string;
  accessKey?: string;
  protocol?: string;
  number?: string;
};

export interface FiscalProvider {
  readonly name: string;
  transmit(input: FiscalProviderInput): FiscalProviderResult;
}

export class LocalSimulationProvider implements FiscalProvider {
  readonly name = 'local-simulation';

  transmit(_input: FiscalProviderInput): FiscalProviderResult {
    return {
      status: 'simulation',
      message: 'Simulação local concluída. Nenhuma transmissão foi realizada à SEFAZ ou prefeitura; não há autorização jurídica, número oficial, chave ou protocolo.',
    };
  }
}

export function resolveFiscalProvider(provider: string): FiscalProvider | null {
  const normalized = provider.trim().toLowerCase().replace(/[áàãâ]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/\s+/g, '-');
  if (['local-simulation', 'simulacao-local', 'simulacao', 'desenvolvimento'].includes(normalized)) return new LocalSimulationProvider();
  return null;
}
